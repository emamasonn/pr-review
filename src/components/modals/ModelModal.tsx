"use client";
import { useState } from "react";
import { Eye, EyeOff, Info } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button }  from "@/components/ui/button";
import { Input }   from "@/components/ui/input";
import { Label }   from "@/components/ui/label";
import { Badge }   from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ModelConfig, OllamaConfig, ClaudeConfig } from "@/types";
import { DEFAULT_OLLAMA_CONFIG, DEFAULT_CLAUDE_CONFIG } from "@/store/settings";

const CLAUDE_MODELS = [
  { id: "claude-opus-4-5",           label: "Claude Opus 4.5",   note: "más capaz"  },
  { id: "claude-sonnet-4-5",         label: "Claude Sonnet 4.5", note: "balanceado" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",  note: "más rápido" },
];

interface Props {
  current:  ModelConfig;
  onChange: (cfg: ModelConfig) => void;
  onClose:  () => void;
}

export function ModelModal({ current, onChange, onClose }: Props) {
  const [selected, setSelected] = useState<"ollama" | "claude">(
    current.provider === "claude" ? "claude" : "ollama"
  );
  const [ollama, setOllama] = useState<OllamaConfig>(
    current.provider === "ollama" ? current : DEFAULT_OLLAMA_CONFIG
  );
  const [claude, setClaude] = useState<ClaudeConfig>(
    current.provider === "claude" ? current : DEFAULT_CLAUDE_CONFIG
  );
  const [showKey, setShowKey] = useState(false);

  const isOllamaReady = !!(ollama.host.trim() && ollama.model.trim());
  const isClaudeReady = !!(claude.apiKey.trim() && claude.model.trim());
  const isReady = selected === "ollama" ? isOllamaReady : isClaudeReady;

  const handleSave = () => {
    onChange(selected === "ollama" ? ollama : claude);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[580px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar modelo LLM</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-1">
          {/* Provider selector cards */}
          <div className="grid grid-cols-2 gap-3">
            {(["ollama", "claude"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelected(p)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border text-left transition-all",
                  selected === p
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                    : "border-border hover:border-border/80 hover:bg-muted/20"
                )}
              >
                <span className="text-2xl text-primary">{p === "ollama" ? "⬡" : "◈"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {p === "ollama" ? "Ollama" : "Claude"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {p === "ollama" ? "Local · Sin costo · Privado" : "Cloud · API key requerida"}
                  </div>
                </div>
                {selected === p && (
                  <span className="text-primary font-bold text-sm">✓</span>
                )}
              </button>
            ))}
          </div>

          <Separator />

          {/* Config panel */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Variables de entorno — {selected === "ollama" ? "Ollama" : "Anthropic Claude"}
            </p>

            {/* LLM_PROVIDER (readonly) */}
            <EnvRow label="LLM_PROVIDER" value={selected === "ollama" ? "ollama" : "anthropic"} readOnly />

            {selected === "ollama" && (
              <>
                <EnvRow
                  label="OLLAMA_HOST"
                  value={ollama.host}
                  onChange={(v) => setOllama({ ...ollama, host: v })}
                  placeholder="http://localhost:11434"
                />
                <EnvRow
                  label="OLLAMA_MODEL"
                  value={ollama.model}
                  onChange={(v) => setOllama({ ...ollama, model: v })}
                  placeholder="codellama"
                />
                <EnvRow
                  label="OLLAMA_TIMEOUT_MS"
                  value={String(ollama.timeoutMs)}
                  onChange={(v) => setOllama({ ...ollama, timeoutMs: parseInt(v, 10) || 120000 })}
                  placeholder="120000"
                  type="number"
                />
                <div className="flex items-start gap-2 text-[11px] text-muted-foreground mt-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                  <span>
                    Para descargar un modelo:{" "}
                    <code className="font-mono bg-muted px-1 rounded text-foreground">
                      ollama pull {ollama.model || "codellama"}
                    </code>
                  </span>
                </div>
                {!isOllamaReady && (
                  <p className="text-[11px] text-amber-400 font-mono bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2">
                    ⚠ Completá OLLAMA_HOST y OLLAMA_MODEL para continuar.
                  </p>
                )}
              </>
            )}

            {selected === "claude" && (
              <>
                <EnvRow label="LLM_PROVIDER" value="anthropic" readOnly />
                {/* API Key with show/hide */}
                <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                  <Label className="font-mono text-[11px] text-muted-foreground">ANTHROPIC_API_KEY</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={claude.apiKey}
                      onChange={(e) => setClaude({ ...claude, apiKey: e.target.value })}
                      placeholder="sk-ant-..."
                      className="h-8 text-xs flex-1"
                      autoComplete="off"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      onClick={() => setShowKey((s) => !s)}
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                {/* Model select */}
                <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                  <Label className="font-mono text-[11px] text-muted-foreground">ANTHROPIC_MODEL</Label>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-transparent px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={claude.model}
                    onChange={(e) => setClaude({ ...claude, model: e.target.value })}
                  >
                    {CLAUDE_MODELS.map((m) => (
                      <option key={m.id} value={m.id} className="bg-popover">
                        {m.label} · {m.note}
                      </option>
                    ))}
                  </select>
                </div>
                {!isClaudeReady && (
                  <p className="text-[11px] text-amber-400 font-mono bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2">
                    ⚠ Completá ANTHROPIC_API_KEY para continuar.
                  </p>
                )}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                  <span>
                    Generá tu API key en{" "}
                    <a
                      href="https://console.anthropic.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      console.anthropic.com ↗
                    </a>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isReady}>
            Guardar configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnvRow({ label, value, onChange, placeholder, readOnly, type = "text" }: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; readOnly?: boolean; type?: string;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-3">
      <Label className="font-mono text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn("h-8 text-xs", readOnly && "opacity-50 cursor-default bg-muted")}
      />
    </div>
  );
}
