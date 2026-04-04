import { PRDetails } from "./types";
import { PRDiff, formatPRDiffForLLM, formatFileDiffForLLM } from "./diff-parser";
import { FileDiff } from "./types";

// Single source of truth for the default prompt lives in store/settings
// but we re-export here so llm-engine can import from one place
export { DEFAULT_PROMPT as DEFAULT_SYSTEM_PROMPT } from "../store/settings";

export function buildFilePrompt(
  pr: PRDetails,
  file: FileDiff,
  fileIndex: number,
  totalFiles: number
): string {
  const diffBlock = formatFileDiffForLLM(file);
  return [
    `## PR #${pr.number}: ${pr.title}`,
    `Archivo ${fileIndex + 1} de ${totalFiles}: \`${file.filename}\``,
    ``,
    `INSTRUCCIÓN: Revisá CADA línea del diff de arriba a abajo.`,
    `Reportá TODOS los problemas. Sin límite de comentarios.`,
    `Si no hay ningún problema, devolvé "comments": [].`,
    ``,
    "```diff",
    diffBlock,
    "```",
    ``,
    `Respondé SOLO con el JSON del review para este archivo.`,
  ].join("\n");
}

export function buildUserPrompt(pr: PRDetails, diff: PRDiff): string {
  return [
    `## PR #${pr.number}: ${pr.title}`,
    `**Autor:** ${pr.author}  |  **Rama:** \`${pr.head}\` → \`${pr.base}\``,
    `**Commits:** ${pr.commits}  |  **Archivos:** ${diff.files.length}`,
    "",
    `INSTRUCCIÓN: Revisá CADA línea. Reportá TODOS los problemas.`,
    "",
    "## Diff completo",
    "```diff",
    formatPRDiffForLLM(diff),
    "```",
    "",
    "Respondé SOLO con el JSON del review.",
  ].join("\n");
}
