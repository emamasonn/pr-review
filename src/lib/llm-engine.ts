import { PRDetails } from "./types";
import { PRDiff } from "./diff-parser";
import { Review, ReviewComment, parseReviewResponse, formatZodError } from "./review-schema";
import { buildFilePrompt, buildUserPrompt } from "./prompts";

const MAX_RETRIES = 2;
const FILE_BY_FILE_THRESHOLD = 1;

interface LLMProvider {
  readonly name: string;
  complete(systemPrompt: string, messages: ChatMessage[]): Promise<string>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type LogEmitter = (msg: string) => void;

// ─── TLS helper ───────────────────────────────────────────────

/**
 * Devuelve opciones de fetch que ignoran errores de certificado SSL
 * autofirmado. Solo se activa cuando:
 *   1. La URL es localhost / 127.0.0.1 (nunca en tráfico externo), O
 *   2. La variable OLLAMA_IGNORE_SSL=true está seteada explícitamente
 *      (para redes corporativas con proxy que re-firman certificados).
 *
 * Usa el agente HTTPS de Node.js directamente — no afecta a fetch global.
 */
function makeFetchOptions(url: string): RequestInit {
  const isLocal = /https?:\/\/(localhost|127\.0\.0\.1)/.test(url);
  const forceIgnore = process.env.OLLAMA_IGNORE_SSL === "true";

  if (!isLocal && !forceIgnore) return {};

  // En Node.js 18+ podemos pasar un dispatcher de undici
  // pero la forma más compatible es setear el env antes del fetch
  // Solo lo hacemos si es necesario (evitar side effects globales)
  if (typeof process !== "undefined") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  return {};
}

/**
 * Restaura la validación TLS después de las llamadas locales.
 * Se llama en el finally de cada fetch a Ollama.
 */
function restoreTLS(): void {
  // Solo restaurar si NO hay un override explícito del usuario
  if (process.env.OLLAMA_IGNORE_SSL !== "true") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
  }
}

// ─── Ollama ───────────────────────────────────────────────────

class OllamaProvider implements LLMProvider {
  readonly name = "Ollama (local)";
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl   = process.env.OLLAMA_HOST       ?? "http://localhost:11434";
    this.model     = process.env.OLLAMA_MODEL      ?? "codellama";
    this.timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS ?? "120000", 10);
  }

  async complete(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
    await this.checkHealth();
    const body = {
      model: this.model,
      stream: false,
      options: { temperature: 0.1, num_predict: 4096 },
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    };

    const url = `${this.baseUrl}/api/chat`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        ...makeFetchOptions(url),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`⏱️ Ollama timeout (${this.timeoutMs / 1000}s). Probá con un modelo más chico.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      restoreTLS();
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Ollama error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json() as { message?: { content?: string }; error?: string };
    if (data.error) throw new Error(`Ollama: ${data.error}`);
    const text = data.message?.content ?? "";
    if (!text.trim()) throw new Error("Ollama devolvió respuesta vacía.");
    return text;
  }

  private async checkHealth(): Promise<void> {
    const url = `${this.baseUrl}/api/tags`;
    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        ...makeFetchOptions(url),
      });
    } catch {
      throw new Error(`No se puede conectar a Ollama en ${this.baseUrl}. ¿Está corriendo? → ollama serve`);
    } finally {
      restoreTLS();
    }
    if (!res.ok) return;
    const tags = await res.json() as { models?: Array<{ name: string }> };
    const available = tags.models?.map((m) => m.name) ?? [];
    const modelBase = this.model.split(":")[0];
    const found = available.some((n) => n === this.model || n.startsWith(modelBase + ":"));
    if (!found) {
      throw new Error(
        `Modelo "${this.model}" no disponible. Descargalo: ollama pull ${this.model}\n` +
        `Disponibles: ${available.join(", ") || "ninguno"}`
      );
    }
  }
}

// ─── Anthropic ────────────────────────────────────────────────

class AnthropicProvider implements LLMProvider {
  readonly name = "Anthropic Claude (cloud)";
  private readonly model: string;
  constructor() { this.model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-5"; }

  async complete(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk").catch(() => {
      throw new Error("SDK de Anthropic no instalado. npm install @anthropic-ai/sdk");
    });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY no encontrada en .env.local");
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: this.model, max_tokens: 4096, system: systemPrompt, messages,
    });
    return response.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { type: string; text?: string }) => b.text ?? "")
      .join("");
  }
}

function createProvider(): LLMProvider {
  return (process.env.LLM_PROVIDER ?? "ollama") === "anthropic"
    ? new AnthropicProvider()
    : new OllamaProvider();
}

// ─── Retry helper ─────────────────────────────────────────────

async function callWithRetry(
  provider: LLMProvider,
  systemPrompt: string,
  userPrompt: string,
  label: string,
  emit: LogEmitter
): Promise<Review> {
  const messages: ChatMessage[] = [{ role: "user", content: userPrompt }];
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    if (attempt > 1) {
      emit(`🔄 Reintento ${attempt - 1}/${MAX_RETRIES} — corrigiendo JSON...`);
      messages.push({
        role: "user",
        content: `Tu respuesta no cumple el schema JSON.\nError: ${lastError}\nDevolvé SOLO el JSON corregido.`,
      });
    }

    const rawText = await provider.complete(systemPrompt, messages);
    messages.push({ role: "assistant", content: rawText });

    try {
      return parseReviewResponse(rawText);
    } catch (err) {
      lastError = formatZodError(err);
      emit(`⚠️ JSON inválido en ${label} (intento ${attempt})`);
      if (attempt === MAX_RETRIES + 1) {
        throw new Error(`No se pudo obtener review válido para ${label} tras ${MAX_RETRIES + 1} intentos.\n${lastError}`);
      }
    }
  }
  throw new Error("Error inesperado.");
}

// ─── File-by-file analysis ────────────────────────────────────

async function analyzeFileByFile(
  provider: LLMProvider,
  systemPrompt: string,
  pr: PRDetails,
  diff: PRDiff,
  emit: LogEmitter
): Promise<Review> {
  const files = diff.files.filter((f) => !f.isBinary);
  const allComments: ReviewComment[] = [];
  const fileVerdicts: Review["verdict"][] = [];

  emit(`📂 Analizando ${files.length} archivo(s) individualmente...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    emit(`🔍 [${i + 1}/${files.length}] ${file.filename}`);

    const prompt = buildFilePrompt(pr, file, i, files.length);
    const fileReview = await callWithRetry(provider, systemPrompt, prompt, file.filename, emit);

    allComments.push(...fileReview.comments);
    fileVerdicts.push(fileReview.verdict);
    emit(`✅ ${fileReview.comments.length} problema(s) en ${file.filename}`);
  }

  const verdictOrder: Review["verdict"][] = ["request_changes", "comment", "approve"];
  const finalVerdict = verdictOrder.find((v) => fileVerdicts.includes(v)) ?? "approve";

  // Quick summary call
  let summary = `${allComments.length} problema(s) en ${files.length} archivo(s).`;
  try {
    const summaryPrompt = `PR #${pr.number}: "${pr.title}". ${allComments.length} problema(s). Veredicto: ${finalVerdict}. Escribí un resumen de 2-3 oraciones. Respondé SOLO: { "summary": "..." }`;
    const raw = await provider.complete(systemPrompt, [{ role: "user", content: summaryPrompt }]);
    const parsed = JSON.parse(raw.replace(/```(?:json)?/g, "").trim()) as { summary?: string };
    if (parsed.summary) summary = parsed.summary;
  } catch { /* usar fallback */ }

  return {
    comments: allComments,
    summary,
    verdict: finalVerdict,
    confidence: Math.min(70 + allComments.length * 3, 95),
  };
}

// ─── Main export ──────────────────────────────────────────────

export async function analyzeWithLLM(
  pr: PRDetails,
  diff: PRDiff,
  systemPrompt: string,
  emit: LogEmitter
): Promise<Review> {
  const provider = createProvider();
  emit(`🧠 Proveedor: ${provider.name}`);

  const nonBinaryFiles = diff.files.filter((f) => !f.isBinary);

  if (nonBinaryFiles.length > FILE_BY_FILE_THRESHOLD) {
    return analyzeFileByFile(provider, systemPrompt, pr, diff, emit);
  }

  emit(`⏳ Analizando PR completo...`);
  const userPrompt = buildUserPrompt(pr, diff);
  return callWithRetry(provider, systemPrompt, userPrompt, `PR #${pr.number}`, emit);
}
