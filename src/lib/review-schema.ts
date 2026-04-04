import { z } from "zod";

// ─── Schema de un comentario individual ──────────────────────

export const ReviewCommentSchema = z.object({
  /** Ruta del archivo relativa a la raíz del repo */
  file: z.string().min(1),

  /** Número de línea en la versión nueva del archivo (head) */
  line: z.number().int().positive(),

  /** El fragmento de código exacto que genera el comentario (máx 120 chars) */
  codeSnippet: z.string().max(120),

  /** Comentario técnico claro, accionable y en tono de code review */
  comment: z.string().min(10),

  /** Severidad del hallazgo */
  priority: z.enum(["low", "medium", "high"]),

  /** Categoría del hallazgo — ayuda a agrupar el reporte final */
  category: z.enum([
    "bug",           // error lógico o comportamiento incorrecto
    "security",      // vulnerabilidad o manejo inseguro de datos
    "performance",   // ineficiencia que puede afectar en producción
    "style",         // violación de convenciones del equipo
    "maintainability", // código difícil de leer, testear o extender
    "suggestion",    // mejora opcional, no crítica
  ]),

  /** Sugerencia de código corregido (opcional, en formato diff o snippet) */
  suggestion: z.string().optional(),
});

export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

// ─── Schema del review completo ───────────────────────────────

export const ReviewSchema = z.object({
  /** Lista de comentarios por línea de código */
  comments: z.array(ReviewCommentSchema),

  /** Resumen ejecutivo del PR en 2-4 oraciones */
  summary: z.string().min(20),

  /** Veredicto final */
  verdict: z.enum([
    "approve",          // se puede mergear
    "request_changes",  // hay cambios requeridos antes de mergear
    "comment",          // observaciones menores, sin bloquear
  ]),

  /** Nivel de confianza del análisis (0–100) */
  confidence: z.number().min(0).max(100),
});

export type Review = z.infer<typeof ReviewSchema>;

// ─── Helpers de validación ────────────────────────────────────

/**
 * Intenta parsear y validar el JSON devuelto por el LLM.
 * Aplica múltiples estrategias de limpieza antes de rendirse,
 * porque los modelos locales (CodeLlama) suelen escapar mal las comillas
 * cuando el diff contiene strings con comillas dentro.
 */
export function parseReviewResponse(raw: string): Review {
  const candidates = buildCandidates(raw);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      // Sanitizar campos string antes de validar con Zod
      sanitizeComments(parsed);
      normalizeFields(parsed);
      return ReviewSchema.parse(parsed);
    } catch {
      // Siguiente estrategia
    }
  }

  throw new Error(
    `El LLM no devolvió JSON válido.\nRespuesta recibida:\n${raw.slice(0, 500)}`
  );
}

/**
 * Normaliza campos del objeto parseado antes de pasarlos a Zod.
 * Cubre los casos más comunes de respuestas "casi válidas" de modelos locales:
 *
 * - suggestion: ""  → undefined   (Zod espera string | undefined, no string vacío)
 * - summary: ""     → texto por defecto (Zod exige min 20 chars)
 * - summary: null   → texto por defecto
 * - confidence fuera de rango → clamp a [0, 100]
 */
function normalizeFields(parsed: unknown): void {
  if (typeof parsed !== "object" || parsed === null) return;
  const obj = parsed as Record<string, unknown>;

  // summary vacío o nulo → fallback
  if (!obj.summary || (typeof obj.summary === "string" && obj.summary.trim().length < 20)) {
    obj.summary = "Análisis completado. Revisar los comentarios detallados para cada hallazgo.";
  }

  // confidence fuera de rango
  if (typeof obj.confidence === "number") {
    obj.confidence = Math.max(0, Math.min(100, obj.confidence));
  } else {
    obj.confidence = 70;
  }

  // verdict inválido → fallback
  const validVerdicts = ["approve", "request_changes", "comment"];
  if (!validVerdicts.includes(obj.verdict as string)) {
    obj.verdict = "comment";
  }

  // comments: limpiar cada comentario
  if (Array.isArray(obj.comments)) {
    obj.comments = obj.comments.map((c: unknown) => {
      if (typeof c !== "object" || c === null) return c;
      const comment = c as Record<string, unknown>;

      // suggestion: "" → eliminar el campo (Zod lo trata como opcional)
      if (comment.suggestion === "" || comment.suggestion === null) {
        delete comment.suggestion;
      }

      // comment muy corto → completar
      if (typeof comment.comment === "string" && comment.comment.trim().length < 10) {
        comment.comment = comment.comment.trim() + " — revisar este fragmento de código.";
      }

      // priority inválido → low
      if (!["low", "medium", "high"].includes(comment.priority as string)) {
        comment.priority = "low";
      }

      // category inválido → style
      const validCategories = ["bug", "security", "performance", "style", "maintainability", "suggestion"];
      if (!validCategories.includes(comment.category as string)) {
        comment.category = "style";
      }

      return comment;
    });
  }
}

/**
 * Genera variantes del string crudos del LLM, de más conservadora
 * a más agresiva, para maximizar las chances de parseo exitoso.
 */
function buildCandidates(raw: string): string[] {
  const candidates: string[] = [];

  // 1. Extraer el primer bloque JSON {...} del texto (ignora prose alrededor)
  const jsonBlockMatch = raw.match(/\{[\s\S]*\}/);
  const jsonBlock = jsonBlockMatch?.[0] ?? raw;

  // 2. Quitar markdown fences
  const noFences = jsonBlock
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // 3. Escapar newlines literales dentro de valores string.
  //    Este es el caso de ChartsPanel: el modelo mete \n reales en el
  //    codeSnippet, lo que rompe JSON.parse porque los strings JSON
  //    no pueden tener saltos de línea sin escapar.
  const escapedNewlines = escapeNewlinesInStringValues(noFences);

  candidates.push(escapedNewlines);
  candidates.push(noFences);

  // 4. Reemplazar \" (escape doble que genera CodeLlama) por "
  candidates.push(escapedNewlines.replace(/\\"/g, '"'));
  candidates.push(noFences.replace(/\\"/g, '"'));

  // 5. Versión con comillas internas escapadas correctamente
  candidates.push(fixUnescapedQuotesInValues(escapedNewlines));

  // 6. Fallback agresivo: extraer cada campo a mano y reconstruir
  const reconstructed = tryReconstruct(raw);
  if (reconstructed) candidates.push(reconstructed);

  return candidates;
}

/**
 * Escapa los saltos de línea LITERALES que aparecen dentro de valores
 * string en el JSON malformado del LLM.
 *
 * El modelo a veces escribe:
 *   "codeSnippet": "linea uno
 *   linea dos"
 *
 * En lugar de:
 *   "codeSnippet": "linea uno\nlinea dos"
 *
 * Esta función encuentra esos newlines dentro de strings y los escapa.
 */
function escapeNewlinesInStringValues(s: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      result += ch;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    // Newline literal dentro de un string → escapar
    if (inString && (ch === "\n" || ch === "\r")) {
      result += ch === "\n" ? "\\n" : "\\r";
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Corrige comillas sin escapar dentro de valores de string JSON.
 * Ejemplo: "comment": "use "optional chaining"" → "comment": "use \"optional chaining\""
 */
function fixUnescapedQuotesInValues(s: string): string {
  // Reemplaza " no precedidas por \ dentro de valores string
  return s.replace(/:\s*"((?:[^"\\]|\\.)*)"/g, (_match, inner: string) => {
    const fixed = inner.replace(/(?<!\\)"/g, '\\"');
    return `: "${fixed}"`;
  });
}

/**
 * Fallback de último recurso: intenta extraer los campos del JSON
 * usando regex individuales y reconstruye un objeto limpio.
 */
function tryReconstruct(raw: string): string | null {
  try {
    // Extraer summary, verdict, confidence con regex simples
    const summary = raw.match(/"summary"\s*:\s*"([^"]+)"/)?.[1] ?? "Review completado.";
    const verdict = raw.match(/"verdict"\s*:\s*"(approve|request_changes|comment)"/)?.[1] ?? "comment";
    const confidence = raw.match(/"confidence"\s*:\s*(\d+)/)?.[1] ?? "70";

    // Para comentarios: extraer bloques individuales
    const commentBlocks = [...raw.matchAll(/\{[^{}]*"file"\s*:/g)];
    const comments = commentBlocks.map((m) => {
      const block = raw.slice(m.index, raw.indexOf("}", m.index ?? 0) + 1);
      const file     = block.match(/"file"\s*:\s*"([^"]+)"/)?.[1] ?? "";
      const line     = parseInt(block.match(/"line"\s*:\s*(\d+)/)?.[1] ?? "0", 10);
      const priority = block.match(/"priority"\s*:\s*"(high|medium|low)"/)?.[1] ?? "low";
      const category = block.match(/"category"\s*:\s*"([^"]+)"/)?.[1] ?? "style";
      // Snippet: limpiar prefijos del diff como "-  33 | "
      const rawSnippet = block.match(/"codeSnippet"\s*:\s*"([^"]+)"/)?.[1] ?? "";
      const codeSnippet = stripDiffPrefix(rawSnippet);
      const comment  = block.match(/"comment"\s*:\s*"([^"]+)"/)?.[1] ?? "";
      return { file, line, priority, category, codeSnippet, comment };
    }).filter((c) => c.file && c.line > 0);

    return JSON.stringify({ comments, summary, verdict: verdict, confidence: parseInt(confidence, 10) });
  } catch {
    return null;
  }
}

/**
 * Limpia los campos codeSnippet en los comentarios del objeto parseado:
 * - Elimina prefijos del diff ("-  33 | ", "+  12 | ")
 * - Colapsa snippets multilinea a la primera línea de código real
 * - Elimina líneas de contexto del diff ("// contexto: ...")
 * - Trunca a 120 caracteres
 */
function sanitizeComments(parsed: unknown): void {
  if (typeof parsed !== "object" || parsed === null) return;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.comments)) return;

  for (const comment of obj.comments) {
    if (typeof comment === "object" && comment !== null) {
      const c = comment as Record<string, unknown>;
      if (typeof c.codeSnippet === "string") {
        c.codeSnippet = cleanSnippet(c.codeSnippet);
      }
    }
  }
}

/**
 * Limpia un codeSnippet que puede venir malformado del LLM:
 * 1. Divide en líneas (el modelo puede meter \n escapados o literales)
 * 2. Descarta líneas de contexto del diff ("// contexto: ...")
 * 3. Toma la primera línea con contenido real de código
 * 4. Elimina prefijos del diff ("-  33  ", "+  12  ")
 * 5. Trunca a 120 caracteres
 */
function cleanSnippet(raw: string): string {
  // Dividir por \n escapados o literales
  const lines = raw
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Descartar líneas que son headers de contexto del diff
  const codeLines = lines.filter(
    (l) => !l.startsWith("// contexto:") && !l.startsWith("@@ ")
  );

  // Tomar la primera línea de código real
  const firstCode = codeLines[0] ?? lines[0] ?? raw;

  return stripDiffPrefix(firstCode).slice(0, 120);
}

/**
 * Elimina el prefijo de número de línea del diff del snippet.
 * "-  33   console.error(...)"  →  "console.error(...)"
 * "+  12   const x = 1"        →  "const x = 1"
 */
function stripDiffPrefix(snippet: string): string {
  return snippet
    .replace(/^[-+ ]\s*\d+\s+/, "")  // "-  33   " o "+  12   "
    .replace(/^[-+]\s*/, "")         // "- " o "+ " sin número
    .trim();
}

/**
 * Devuelve los errores de validación Zod en formato legible para el log.
 */
export function formatZodError(err: unknown): string {
  if (err instanceof Error && err.name === "ZodError") {
    const zodErr = err as { errors: Array<{ path: (string | number)[]; message: string }> };
    return zodErr.errors
      .map((e) => `  • ${e.path.join(".")}: ${e.message}`)
      .join("\n");
  }
  return String(err);
}
