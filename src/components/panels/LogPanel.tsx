"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { LogEntry, RunState } from "@/types";

interface Props {
  logs:     LogEntry[];
  runState: RunState;
}

const kindClass: Record<LogEntry["kind"], string> = {
  ok:   "text-green-400",
  err:  "text-red-400",
  warn: "text-amber-400",
  info: "text-blue-400",
  dim:  "text-muted-foreground",
};

const statusConfig = {
  idle:    { color: "bg-muted-foreground", label: "Esperando" },
  running: { color: "bg-primary animate-pulse", label: "Analizando" },
  done:    { color: "bg-green-500", label: "Completado" },
  error:   { color: "bg-red-500", label: "Error" },
} as const;

export function LogPanel({ logs, runState }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs.length]);

  const { color, label } = statusConfig[runState];

  return (
    <div className="flex flex-col border-r border-border bg-background overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", color)} />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Activity Log
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{label}</span>
          {logs.length > 0 && (
            <span className="text-xs text-muted-foreground font-mono">· {logs.length}</span>
          )}
        </div>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 scrollbar-thin scrollbar-thumb-border">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-12">
            <span className="text-2xl opacity-20">◌</span>
            <span className="text-xs">Esperando ejecución...</span>
          </div>
        ) : (
          logs.map((l) => (
            <div key={l.id} className="flex gap-2 font-mono text-[11px] leading-relaxed">
              <span className="text-muted-foreground/50 flex-shrink-0 tabular-nums">
                {new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className={cn(kindClass[l.kind], "break-words min-w-0")}>{l.text}</span>
            </div>
          ))
        )}
        {runState === "running" && (
          <div className="flex gap-2 font-mono text-[11px]">
            <span className="text-muted-foreground/50">···</span>
            <span className="text-primary animate-pulse">▋</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
