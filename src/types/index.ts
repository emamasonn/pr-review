// ── App-wide types ────────────────────────────────────────────

export type Priority = "high" | "medium" | "low";
export type Category = "bug" | "security" | "performance" | "style" | "maintainability" | "suggestion";
export type Verdict  = "approve" | "request_changes" | "comment";
export type RunState = "idle" | "running" | "done" | "error";
export type Provider = "ollama" | "claude";

// ── Model config ──────────────────────────────────────────────

export interface OllamaConfig {
  provider: "ollama";
  host: string;         // OLLAMA_HOST
  model: string;        // OLLAMA_MODEL
  timeoutMs: number;    // OLLAMA_TIMEOUT_MS
}

export interface ClaudeConfig {
  provider: "claude";
  apiKey: string;       // ANTHROPIC_API_KEY
  model: string;        // e.g. claude-opus-4-5
}

export type ModelConfig = OllamaConfig | ClaudeConfig;

// ── App settings (persisted in localStorage) ─────────────────

export interface AppSettings {
  githubPat:  string;
  githubRepo: string;
  systemPrompt: string;
  modelConfig: ModelConfig;
}

// ── Review finding (one row in the results table) ─────────────

export interface Finding {
  id:          string;
  file:        string;
  line:        number;
  priority:    Priority;
  category:    Category;
  codeSnippet: string;
  comment:     string;
  suggestion?: string;
}

// ── Full review result ────────────────────────────────────────

export interface ReviewResult {
  verdict:    Verdict;
  confidence: number;
  summary:    string;
  findings:   Finding[];
  prNumber:   number;
  repo:       string;
  runAt:      string;
}

// ── SSE event from the API ────────────────────────────────────

export interface SSEEvent {
  type: "log" | "result" | "error";
  data: unknown;
}

export interface LogEntry {
  id:   number;
  text: string;
  kind: "info" | "ok" | "warn" | "err" | "dim";
}
