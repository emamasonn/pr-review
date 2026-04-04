export interface PRFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  patch?: string; // diff del archivo
}

export interface PRDetails {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  base: string;  // rama destino
  head: string;  // rama origen
  createdAt: string;
  updatedAt: string;
  files: PRFile[];
  commits: number;
  additions: number;
  deletions: number;
}

// ─── Fase 2: estructuras del diff ────────────────────────────

/** Una línea individual dentro de un hunk */
export interface DiffLine {
  type: "context" | "added" | "removed";
  content: string;       // texto de la línea (sin el +/-/ prefijo)
  lineNumberOld?: number; // número en la rama base  (undefined en líneas añadidas)
  lineNumberNew?: number; // número en la rama head  (undefined en líneas borradas)
}

/** Un fragmento contiguo de cambios (@@ ... @@) */
export interface DiffHunk {
  header: string;         // ej: "@@ -12,7 +12,8 @@ function login()"
  oldStart: number;       // línea de inicio en base
  oldLines: number;       // cantidad de líneas afectadas en base
  newStart: number;       // línea de inicio en head
  newLines: number;       // cantidad de líneas afectadas en head
  context?: string;       // función/clase capturada del header (si está disponible)
  lines: DiffLine[];
}

/** Diff completo de un archivo */
export interface FileDiff {
  filename: string;
  status: PRFile["status"];
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  isBinary: boolean;
  isTooLarge: boolean;    // archivos con diff > umbral configurado
}

/** Resultado final del diff de todo el PR */
export interface PRDiff {
  prNumber: number;
  files: FileDiff[];
  totalAdditions: number;
  totalDeletions: number;
  totalHunks: number;
}
