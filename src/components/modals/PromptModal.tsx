"use client";
import { useState, useRef } from "react";
import { Lock, RotateCcw, Download, Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button }    from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DEFAULT_PROMPT, LOCKED_SCHEMA } from "@/store/settings";

const SPLIT_MARKER = "\n\n" + LOCKED_SCHEMA;

function splitPrompt(full: string) {
  const idx = full.indexOf(LOCKED_SCHEMA);
  return { editable: idx === -1 ? full : full.slice(0, idx).trimEnd() };
}

function joinPrompt(editable: string) {
  return editable.trimEnd() + SPLIT_MARKER;
}

interface Props {
  value:    string;
  onChange: (v: string) => void;
  onClose:  () => void;
}

export function PromptModal({ value, onChange, onClose }: Props) {
  const { editable: init } = splitPrompt(value);
  const [draft, setDraft]  = useState(init);
  const fileRef            = useRef<HTMLInputElement>(null);

  const handleSave = () => { onChange(joinPrompt(draft)); onClose(); };

  const handleReset = () => {
    if (confirm("¿Restaurar el prompt por defecto?")) {
      setDraft(splitPrompt(DEFAULT_PROMPT).editable);
    }
  };

  const handleExport = () => {
    const blob = new Blob([joinPrompt(draft)], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "system-prompt.md" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft(splitPrompt(reader.result as string).editable);
    reader.readAsText(file);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>System Prompt</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="edit" className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-1 flex-shrink-0">
            <TabsList className="bg-transparent">
              <TabsTrigger value="edit">Editar</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <span className="text-[10px] text-muted-foreground font-mono">
              {draft.length} chars editables
            </span>
          </div>

          <TabsContent value="edit" className="flex flex-col gap-3 flex-1 overflow-auto mt-0 min-h-0">
            {/* Editable area */}
            <textarea
              className="flex-1 min-h-[200px] w-full resize-none rounded-md border border-input bg-muted/20 px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              spellCheck={false}
              placeholder="Escribí las instrucciones, reglas y criterios para el LLM..."
            />

            {/* Locked schema */}
            <div className="rounded-md border border-border overflow-hidden flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-foreground">Formato de respuesta — bloqueado</span>
                <span className="text-[10px] text-muted-foreground ml-1">
                  Define el contrato con la tabla de resultados
                </span>
              </div>
              <pre className="px-3 py-2.5 text-[11px] font-mono text-muted-foreground bg-muted/10 overflow-x-auto cursor-not-allowed select-none leading-relaxed">
                {LOCKED_SCHEMA}
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-auto mt-0 min-h-0">
            <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap p-1">
              {joinPrompt(draft)}
            </pre>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <div className="flex gap-2 mr-auto">
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 text-xs gap-1.5">
              <RotateCcw className="w-3 h-3" />
              Restaurar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExport} className="h-8 text-xs gap-1.5">
              <Download className="w-3 h-3" />
              Exportar .md
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="h-8 text-xs gap-1.5">
              <Upload className="w-3 h-3" />
              Importar .md
            </Button>
            <input ref={fileRef} type="file" accept=".md,.txt" className="hidden" onChange={handleImport} />
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
