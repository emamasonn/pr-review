"use client";
import { useState, useRef, useCallback } from "react";
import type { LogEntry, ReviewResult, RunState, AppSettings, Finding } from "@/types";
import type { Review } from "@/lib/review-schema";

let logCounter = 0;

function classify(msg: string): LogEntry["kind"] {
  if (/^(✅|📂|🧠)/.test(msg))  return "ok";
  if (/^(❌|⚠️)/.test(msg))     return "err";
  if (/^🔄/.test(msg))           return "warn";
  if (/^(🚀|📦|🔍|📥|🧩|🤖)/.test(msg)) return "info";
  return "dim";
}

function toFindings(review: Review, prNumber: number): Finding[] {
  return review.comments.map((c, i) => ({
    id:          `${prNumber}-${i + 1}`,
    file:        c.file,
    line:        c.line,
    priority:    c.priority,
    category:    c.category,
    codeSnippet: c.codeSnippet,
    comment:     c.comment,
    suggestion:  c.suggestion,
  }));
}

export function useReview() {
  const [logs,      setLogs]      = useState<LogEntry[]>([]);
  const [result,    setResult]    = useState<ReviewResult | null>(null);
  const [runState,  setRunState]  = useState<RunState>("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((text: string) => {
    setLogs((prev) => [...prev, { id: logCounter++, text, kind: classify(text) }]);
  }, []);

  const run = useCallback(async (prNumber: number, settings: AppSettings) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setRunState("running");
    setLogs([]);
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          prNumber,
          githubPat:    settings.githubPat,
          githubRepo:   settings.githubRepo,
          systemPrompt: settings.systemPrompt,
          modelConfig:  settings.modelConfig,
        }),
      });

      if (!res.body) throw new Error("Sin stream body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(chunk.slice(6)) as { type: string; data: unknown };
            if (evt.type === "log") {
              addLog(evt.data as string);
            } else if (evt.type === "error") {
              addLog(`❌ ${evt.data as string}`);
              setErrorMsg(evt.data as string);
              setRunState("error");
            } else if (evt.type === "result") {
              const review = evt.data as Review;
              const findings = toFindings(review, prNumber);
              setResult({
                verdict:    review.verdict,
                confidence: review.confidence,
                summary:    review.summary,
                findings,
                prNumber,
                repo:       settings.githubRepo,
                runAt:      new Date().toISOString(),
              });
              setRunState("done");
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`❌ ${msg}`);
      setErrorMsg(msg);
      setRunState("error");
    }
  }, [addLog]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setRunState("idle");
  }, []);

  const reset = useCallback(() => {
    setLogs([]);
    setResult(null);
    setRunState("idle");
    setErrorMsg("");
  }, []);

  return { logs, result, runState, errorMsg, run, cancel, reset };
}
