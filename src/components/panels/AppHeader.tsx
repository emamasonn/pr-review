"use client";
import { AlertTriangle, Bot, FileText, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppSettings, RunState } from "@/types";

interface Props {
  settings:     AppSettings;
  prNumber:     string;
  onPrChange:   (v: string) => void;
  onRepoChange: (v: string) => void;
  onPatChange:  (v: string) => void;
  onOpenPrompt: () => void;
  onOpenModel:  () => void;
  onRun:        () => void;
  runState:     RunState;
  isReady:      boolean;
  missing:      string[];
  hydrated:     boolean;
}

export function AppHeader({
  settings, prNumber, onPrChange, onRepoChange, onPatChange,
  onOpenPrompt, onOpenModel, onRun, runState, isReady, missing, hydrated,
}: Props) {
  const canRun     = isReady && prNumber.trim().length > 0 && runState !== "running";
  const isRunning  = runState === "running";
  const modelLabel = settings.modelConfig.provider === "claude"
    ? `Claude · ${settings.modelConfig.model.split("-").slice(1, 3).join(" ")}`
    : `Ollama · ${settings.modelConfig.model}`;

  return (
    <header className="flex-shrink-0 border-b border-border bg-card">
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap">

        {/* Brand */}
        <div className="flex items-center gap-2 flex-shrink-0 mr-2">
          <div className="w-2 h-2 rounded-sm bg-primary rotate-45" />
          <span className="text-sm font-semibold text-foreground tracking-tight">PR Review</span>
        </div>

        {/* Fields */}
        <div className="flex items-end gap-2 flex-1 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pat">GitHub PAT</Label>
            <Input
              id="pat"
              type="password"
              value={settings.githubPat}
              onChange={(e) => onPatChange(e.target.value)}
              placeholder="github_pat_..."
              className="w-48 h-8 text-xs"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="repo">Repositorio</Label>
            <Input
              id="repo"
              type="text"
              value={settings.githubRepo}
              onChange={(e) => onRepoChange(e.target.value)}
              placeholder="owner/repo"
              className="w-44 h-8 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pr">PR #</Label>
            <Input
              id="pr"
              type="number"
              min={1}
              value={prNumber}
              onChange={(e) => onPrChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canRun && onRun()}
              placeholder="123"
              className="w-20 h-8 text-xs"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenModel}
            className={cn(
              "h-8 text-xs gap-1.5 font-mono",
              !isReady && hydrated && "border-destructive/50 text-destructive"
            )}
          >
            <Bot className="w-3.5 h-3.5" />
            {modelLabel}
            {hydrated && !isReady && missing.some(m => m.includes("API Key")) && (
              <Badge variant="high" className="text-[9px] px-1 py-0">!</Badge>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={onOpenPrompt} className="h-8 text-xs gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Prompt
          </Button>

          <Button
            size="sm"
            onClick={onRun}
            disabled={!canRun}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isRunning
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analizando...</>
              : <><Play  className="w-3.5 h-3.5" />Ejecutar</>
            }
          </Button>
        </div>
      </div>

      {/* Missing config warning */}
      {hydrated && !isReady && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/5 border-t border-amber-500/20 text-amber-400 text-xs font-mono">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          Falta configurar: {missing.join(", ")}
        </div>
      )}
    </header>
  );
}
