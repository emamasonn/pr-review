import { NextRequest } from "next/server";
import { createClient, parseRepo } from "@/lib/github-client";
import { fetchPR } from "@/lib/pr-fetcher";
import { fetchRawDiff } from "@/lib/diff-fetcher";
import { parseDiff } from "@/lib/diff-parser";
import { analyzeWithLLM } from "@/lib/llm-engine";
import { DEFAULT_PROMPT } from "@/store/settings";
import type { ModelConfig } from "@/types";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const {
    prNumber, githubPat, githubRepo,
    systemPrompt, modelConfig,
  } = await req.json() as {
    prNumber:     number;
    githubPat?:   string;
    githubRepo?:  string;
    systemPrompt?: string;
    modelConfig?: ModelConfig;
  };

  // Inject settings into env so lib functions pick them up
  if (githubPat)  process.env.GITHUB_PAT  = githubPat;
  if (githubRepo) process.env.GITHUB_REPO = githubRepo;

  if (modelConfig) {
    if (modelConfig.provider === "ollama") {
      process.env.LLM_PROVIDER      = "ollama";
      process.env.OLLAMA_HOST        = modelConfig.host;
      process.env.OLLAMA_MODEL       = modelConfig.model;
      process.env.OLLAMA_TIMEOUT_MS  = String(modelConfig.timeoutMs);
    } else {
      process.env.LLM_PROVIDER      = "anthropic";
      process.env.ANTHROPIC_API_KEY  = modelConfig.apiKey;
      process.env.ANTHROPIC_MODEL    = modelConfig.model;
    }
  }

  const activePrompt = systemPrompt?.trim() || DEFAULT_PROMPT;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (type: "log" | "result" | "error", data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      const log = (msg: string) => emit("log", msg);

      try {
        log(`🚀 Iniciando review del PR #${prNumber}...`);

        const { owner, repoName } = parseRepo(githubRepo);
        const octokit = createClient();

        log(`📦 Repositorio: ${owner}/${repoName}`);
        log(`🔍 Obteniendo metadata del PR...`);

        const pr = await fetchPR(octokit, owner, repoName, prNumber);
        log(`✅ PR: "${pr.title}" por @${pr.author}`);
        log(`📊 ${pr.commits} commit(s) · ${pr.files.length} archivo(s) · +${pr.additions} -${pr.deletions}`);

        log(`📥 Descargando diff...`);
        const rawDiff = await fetchRawDiff(octokit, owner, repoName, prNumber);
        const diff = parseDiff(rawDiff, prNumber, pr.files);
        log(`🧩 Diff: ${diff.files.length} archivo(s) · ${diff.totalHunks} hunk(s)`);

        const review = await analyzeWithLLM(pr, diff, activePrompt, log);
        log(`✅ Análisis completo — ${review.comments.length} hallazgo(s)`);
        emit("result", review);
      } catch (err: unknown) {
        emit("error", err instanceof Error ? err.message : String(err));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":   "keep-alive",
    },
  });
}
