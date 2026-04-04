"use client";
import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ReviewResult, Finding, Priority, Category } from "@/types";

interface Props {
  result:   ReviewResult | null;
  runState: string;
  errorMsg: string;
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

type SortKey = "priority" | "file" | "line";

export function ResultsPanel({ result, runState, errorMsg }: Props) {
  const [sortBy,     setSortBy]     = useState<SortKey>("priority");
  const [filterCat,  setFilterCat]  = useState<Category | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = useMemo<Category[]>(
    () => [...new Set((result?.findings ?? []).map((f) => f.category))] as Category[],
    [result]
  );

  const findings = useMemo<Finding[]>(() => {
    if (!result) return [];
    let list = [...result.findings];
    if (filterCat !== "all") list = list.filter((f) => f.category === filterCat);
    list.sort((a, b) => {
      if (sortBy === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (sortBy === "file")     return a.file.localeCompare(b.file);
      return a.line - b.line;
    });
    return list;
  }, [result, filterCat, sortBy]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    (result?.findings ?? []).forEach((f) => c[f.priority]++);
    return c;
  }, [result]);

  // ── Empty / loading / error states ──────────────────────────

  const emptyState = (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground py-20">
      {runState === "running" ? (
        <>
          <div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin" />
          <span className="text-sm">Analizando código...</span>
        </>
      ) : runState === "error" && !result ? (
        <>
          <XCircle className="w-10 h-10 text-destructive/50" />
          <span className="text-sm font-medium text-destructive">Error en el análisis</span>
          <span className="text-xs text-center max-w-xs">{errorMsg}</span>
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center text-muted-foreground/30">
            ◎
          </div>
          <span className="text-sm font-medium">Sin resultados</span>
          <span className="text-xs">Configurá el PR y ejecutá el review</span>
        </>
      )}
    </div>
  );

  if (!result) {
    return (
      <div className="flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Resultados
          </span>
        </div>
        {emptyState}
      </div>
    );
  }

  // ── Verdict icon ──────────────────────────────────────────────
  const VerdictIcon = result.verdict === "approve"
    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
    : result.verdict === "request_changes"
    ? <XCircle className="w-4 h-4 text-red-400" />
    : <MessageSquare className="w-4 h-4 text-amber-400" />;

  return (
    <div className="flex flex-col bg-background overflow-hidden">

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Resultados</span>
          {VerdictIcon}
          <Badge variant={result.verdict as "approve" | "request_changes" | "comment"}>
            {result.verdict === "approve" ? "Aprobado" : result.verdict === "request_changes" ? "Cambios requeridos" : "Comentario"}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {counts.high   > 0 && <Badge variant="high">🔴 {counts.high}</Badge>}
            {counts.medium > 0 && <Badge variant="medium">🟡 {counts.medium}</Badge>}
            {counts.low    > 0 && <Badge variant="low">🟢 {counts.low}</Badge>}
          </div>
          <span className="text-xs font-mono text-primary">⚡ {result.confidence}%</span>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
      </div>

      {/* Filter + sort bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/30 gap-2 flex-wrap flex-shrink-0">
        {/* Category filters */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant={filterCat === "all" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-[11px] px-2 font-mono"
            onClick={() => setFilterCat("all")}
          >
            Todos ({result.findings.length})
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              variant={filterCat === c ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-[11px] px-2 font-mono"
              onClick={() => setFilterCat(c)}
            >
              {c} ({result.findings.filter((f) => f.category === c).length})
            </Button>
          ))}
        </div>
        {/* Sort buttons */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">Ordenar:</span>
          {(["priority", "file", "line"] as SortKey[]).map((s) => (
            <Button
              key={s}
              variant={sortBy === s ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-[11px] px-2 font-mono"
              onClick={() => setSortBy(s)}
            >
              {s === "priority" ? "Prioridad" : s === "file" ? "Archivo" : "Línea"}
            </Button>
          ))}
        </div>
      </div>

      {/* Findings table */}
      {findings.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
          No hay hallazgos en esta categoría
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr>
                {["Prioridad", "Categoría", "Archivo · Línea", "Hallazgo"].map((h, i) => (
                  <th
                    key={h}
                    className="bg-muted/50 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border whitespace-nowrap"
                    style={{ width: i === 0 ? 90 : i === 1 ? 110 : i === 2 ? "auto" : "auto" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <FindingRows
                  key={f.id}
                  finding={f}
                  expanded={expandedId === f.id}
                  onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── FindingRows ────────────────────────────────────────────────

interface FindingRowsProps {
  finding:  Finding;
  expanded: boolean;
  onToggle: () => void;
}

function FindingRows({ finding: f, expanded, onToggle }: FindingRowsProps) {
  return (
    <>
      <tr
        className={cn(
          "cursor-pointer transition-colors",
          expanded ? "bg-muted/30" : "hover:bg-muted/20"
        )}
        onClick={onToggle}
      >
        <td className={cn("px-4 py-2.5 align-middle", expanded ? "" : "border-b border-border/50")}>
          <Badge variant={f.priority as "high" | "medium" | "low"}>{f.priority}</Badge>
        </td>
        <td className={cn("px-4 py-2.5 align-middle", expanded ? "" : "border-b border-border/50")}>
          <Badge variant={f.category as "bug" | "security" | "performance" | "style" | "maintainability" | "suggestion"}>{f.category}</Badge>
        </td>
        <td className={cn("px-4 py-2.5 align-middle whitespace-nowrap", expanded ? "" : "border-b border-border/50")}>
          <span className="font-mono text-blue-400 text-[11px]">{f.file}</span>
          <span className="font-mono text-muted-foreground text-[11px]">:{f.line}</span>
        </td>
        <td className={cn("px-4 py-2.5 align-middle", expanded ? "" : "border-b border-border/50")}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-muted-foreground truncate max-w-xs">
              {f.codeSnippet}
            </span>
            {expanded
              ? <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            }
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={4} className="border-b border-border p-0">
            <div className="px-4 py-3 bg-muted/20 border-l-2 border-primary flex flex-col gap-2">
              <p className="text-xs text-foreground leading-relaxed">{f.comment}</p>
              {f.suggestion && (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">Sugerencia:</span>
                  <code className="text-[11px] font-mono text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded">
                    {f.suggestion}
                  </code>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
