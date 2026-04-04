import type { AppSettings, ModelConfig } from "@/types";

const KEY = "gh-review:settings";

// The locked schema section — imported at runtime by PromptModal
// and appended to every saved prompt. Defined here as the canonical
// source so API route and modal stay in sync.
export const LOCKED_SCHEMA = `Respondé SOLO con JSON válido, sin markdown ni texto extra:
{
  "comments": [{
    "file": "src/...",
    "line": 42,
    "codeSnippet": "una sola línea, sin saltos (máx 120 chars)",
    "comment": "explicación técnica",
    "priority": "high|medium|low",
    "category": "bug|security|performance|style|maintainability|suggestion",
    "suggestion": "código corregido (opcional)"
  }],
  "summary": "resumen de 2-4 oraciones",
  "verdict": "approve|request_changes|comment",
  "confidence": 85
}`;

// The editable portion of the default prompt (without the locked schema)
const DEFAULT_EDITABLE = `Sos un Senior Software Engineer revisando Pull Requests.
Revisá CADA línea del diff y reportá TODOS los problemas encontrados.

REGLAS (no negociables):
1. NUNCA dejes console.log, console.error o debugger en producción.
2. Usá optional chaining (?.) y nullish coalescing (??) siempre.
3. Todo async/await debe tener manejo de errores (try/catch).
4. No uses "any" en TypeScript — usá "unknown" con type guards.
5. Nombres descriptivos en inglés. No abreviar.
6. Magic numbers → constantes nombradas.
7. No duplicar lógica. Extraer funciones reutilizables.

PRIORIDADES:
🔴 HIGH: bugs, vulnerabilidades, violaciones de reglas.
🟡 MEDIUM: mantenibilidad, performance, tipos débiles.
🟢 LOW: legibilidad, sugerencias menores.`.trim();

// Full prompt = editable + locked schema (always appended)
export const DEFAULT_PROMPT = DEFAULT_EDITABLE + "\n\n" + LOCKED_SCHEMA;

export const DEFAULT_OLLAMA_CONFIG = {
  provider: "ollama" as const,
  host:      "http://localhost:11434",
  model:     "codellama",
  timeoutMs: 120000,
};

export const DEFAULT_CLAUDE_CONFIG = {
  provider: "claude" as const,
  apiKey:   "",
  model:    "claude-sonnet-4-5",
};

export const DEFAULT_SETTINGS: AppSettings = {
  githubPat:    "",
  githubRepo:   "",
  systemPrompt: DEFAULT_PROMPT,
  modelConfig:  DEFAULT_OLLAMA_CONFIG,
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as AppSettings };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function isConfigured(s: AppSettings): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!s.githubPat.trim())  missing.push("GitHub PAT");
  if (!s.githubRepo.trim()) missing.push("Repositorio");
  if (s.modelConfig.provider === "claude" && !s.modelConfig.apiKey.trim()) {
    missing.push("Anthropic API Key");
  }
  return { ok: missing.length === 0, missing };
}
