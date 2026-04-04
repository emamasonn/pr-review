import { DiffLine, DiffHunk, FileDiff, PRDiff, PRFile } from "./types";

// ─── Configuración ───────────────────────────────────────────

/** Tamaño máximo de diff por archivo antes de marcarlo como "too large" (en líneas) */
const MAX_LINES_PER_FILE = 1000;

// ─── Regexes ─────────────────────────────────────────────────

/** Detecta el inicio de un nuevo archivo en el diff: `diff --git a/... b/...` */
const FILE_HEADER_RE = /^diff --git a\/.+ b\/(.+)$/;

/** Detecta el header del hunk con los números de línea exactos:
 *  @@ -<oldStart>,<oldLines> +<newStart>,<newLines> @@ <context?>
 *  El group 5 (context) es opcional — aparece cuando el diff incluye el nombre
 *  de la función/clase donde ocurre el cambio (muy útil para la IA).
 */
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)?$/;

/** Detecta archivos binarios */
const BINARY_RE = /^Binary files/;

/** Detecta el status del archivo desde los headers del diff */
const NEW_FILE_RE = /^new file mode/;
const DELETED_FILE_RE = /^deleted file mode/;
const RENAME_RE = /^rename from /;

// ─── Parser principal ─────────────────────────────────────────

/**
 * Parsea el unified diff crudo de un PR completo y devuelve
 * una estructura limpia con hunks y números de línea exactos.
 */
export function parseDiff(
  rawDiff: string,
  prNumber: number,
  prFiles: PRFile[]
): PRDiff {
  // Construir un mapa filename → metadata de la Fase 1 para enriquecer el resultado
  const fileMetaMap = new Map(prFiles.map((f) => [f.filename, f]));

  const fileDiffs: FileDiff[] = [];
  const lines = rawDiff.split("\n");

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Buscar el inicio de un bloque de archivo
    const fileMatch = FILE_HEADER_RE.exec(line);
    if (!fileMatch) {
      i++;
      continue;
    }

    const filename = fileMatch[1];
    const meta = fileMetaMap.get(filename);

    // Consumir headers del archivo (new file, deleted file, index, ---, +++)
    let isBinary = false;
    let detectedStatus: PRFile["status"] = meta?.status ?? "modified";
    i++;

    while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("diff --git")) {
      if (BINARY_RE.test(lines[i])) isBinary = true;
      if (NEW_FILE_RE.test(lines[i])) detectedStatus = "added";
      if (DELETED_FILE_RE.test(lines[i])) detectedStatus = "removed";
      if (RENAME_RE.test(lines[i])) detectedStatus = "renamed";
      i++;
    }

    if (isBinary) {
      fileDiffs.push({
        filename,
        status: detectedStatus,
        additions: 0,
        deletions: 0,
        hunks: [],
        isBinary: true,
        isTooLarge: false,
      });
      continue;
    }

    // Parsear los hunks del archivo
    const hunks: DiffHunk[] = [];
    let totalLines = 0;
    let isTooLarge = false;

    while (i < lines.length && !lines[i].startsWith("diff --git")) {
      const hunkMatch = HUNK_HEADER_RE.exec(lines[i]);
      if (!hunkMatch) {
        i++;
        continue;
      }

      const oldStart = parseInt(hunkMatch[1], 10);
      const oldLines = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
      const newStart = parseInt(hunkMatch[3], 10);
      const newLines = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;
      const context = hunkMatch[5]?.trim() ?? "";
      const header = lines[i];

      i++;

      const diffLines: DiffLine[] = [];
      let oldCursor = oldStart;
      let newCursor = newStart;

      // Consumir las líneas del hunk hasta el próximo @@ o diff --git
      while (
        i < lines.length &&
        !lines[i].startsWith("@@") &&
        !lines[i].startsWith("diff --git")
      ) {
        const l = lines[i];
        totalLines++;

        if (l.startsWith("+")) {
          diffLines.push({
            type: "added",
            content: l.slice(1),
            lineNumberNew: newCursor++,
          });
        } else if (l.startsWith("-")) {
          diffLines.push({
            type: "removed",
            content: l.slice(1),
            lineNumberOld: oldCursor++,
          });
        } else if (l.startsWith(" ") || l === "") {
          // Línea de contexto (sin cambios, mostrada para dar contexto)
          diffLines.push({
            type: "context",
            content: l.startsWith(" ") ? l.slice(1) : "",
            lineNumberOld: oldCursor++,
            lineNumberNew: newCursor++,
          });
        }
        // Las líneas "\ No newline at end of file" se ignoran silenciosamente

        i++;
      }

      hunks.push({ header, oldStart, oldLines, newStart, newLines, context, lines: diffLines });

      if (totalLines > MAX_LINES_PER_FILE) {
        isTooLarge = true;
        break;
      }
    }

    fileDiffs.push({
      filename,
      status: detectedStatus,
      additions: meta?.additions ?? 0,
      deletions: meta?.deletions ?? 0,
      hunks,
      isBinary: false,
      isTooLarge,
    });
  }

  return {
    prNumber,
    files: fileDiffs,
    totalAdditions: fileDiffs.reduce((s, f) => s + f.additions, 0),
    totalDeletions: fileDiffs.reduce((s, f) => s + f.deletions, 0),
    totalHunks: fileDiffs.reduce((s, f) => s + f.hunks.length, 0),
  };
}

// ─── Formatters para la IA ────────────────────────────────────

/**
 * Convierte un FileDiff a un bloque de texto compacto y estructurado,
 * listo para ser enviado como contexto a un LLM.
 *
 * Ejemplo de output:
 * ```
 * ### src/auth/login.ts  [modified  +30 -10]
 *
 * @@ -12,7 +12,8 @@ function login()
 *  12  | const user = getUser(id);
 * -13  | if (user.active) {
 * +13  | if (user.active && user.verified) {
 *  14  |   return user;
 * ```
 */
export function formatFileDiffForLLM(file: FileDiff): string {
  if (file.isBinary) {
    return `### ${file.filename}  [binary — omitido]\n`;
  }

  const statusTag = `${file.status}  +${file.additions} -${file.deletions}`;
  let out = `### ${file.filename}  [${statusTag}]\n`;

  if (file.isTooLarge) {
    out += `⚠️  Archivo muy grande — se muestran solo los primeros hunks.\n`;
  }

  for (const hunk of file.hunks) {
    out += `\n${hunk.header}\n`;
    if (hunk.context) out += `// contexto: ${hunk.context}\n`;

    for (const dl of hunk.lines) {
      const lineRef = formatLineRef(dl);
      const prefix = dl.type === "added" ? "+" : dl.type === "removed" ? "-" : " ";
      out += `${prefix}${lineRef}  ${dl.content}\n`;
    }
  }

  return out;
}

/**
 * Formatea el diff completo del PR como un único string para el LLM.
 * Incluye una cabecera con el resumen general.
 */
export function formatPRDiffForLLM(diff: PRDiff): string {
  const header = [
    `PR #${diff.prNumber} — Diff estructurado`,
    `Archivos: ${diff.files.length} | Hunks: ${diff.totalHunks} | +${diff.totalAdditions} -${diff.totalDeletions}`,
    "─".repeat(60),
    "",
  ].join("\n");

  const body = diff.files
    .filter((f) => !f.isBinary)
    .map(formatFileDiffForLLM)
    .join("\n");

  return header + body;
}

/**
 * Devuelve un array de objetos compactos por hunk, útil para enviar
 * solo los fragmentos relevantes a la IA en lugar del diff completo.
 */
export function extractHunkContexts(
  diff: PRDiff
): Array<{ filename: string; hunkHeader: string; context: string; patch: string }> {
  const result = [];

  for (const file of diff.files) {
    if (file.isBinary) continue;

    for (const hunk of file.hunks) {
      const patch = hunk.lines
        .map((dl) => {
          const prefix = dl.type === "added" ? "+" : dl.type === "removed" ? "-" : " ";
          return `${prefix}${dl.content}`;
        })
        .join("\n");

      result.push({
        filename: file.filename,
        hunkHeader: hunk.header,
        context: hunk.context ?? "",
        patch,
      });
    }
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatLineRef(dl: DiffLine): string {
  if (dl.type === "added") return String(dl.lineNumberNew ?? "").padStart(4);
  if (dl.type === "removed") return String(dl.lineNumberOld ?? "").padStart(4);
  // contexto: mostrar número nuevo (más relevante para comentar en el PR)
  return String(dl.lineNumberNew ?? "").padStart(4);
}
