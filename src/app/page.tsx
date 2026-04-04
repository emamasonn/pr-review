"use client";
import { useState } from "react";
import { AppHeader }    from "@/components/panels/AppHeader";
import { LogPanel }     from "@/components/panels/LogPanel";
import { ResultsPanel } from "@/components/panels/ResultsPanel";
import { PromptModal }  from "@/components/modals/PromptModal";
import { ModelModal }   from "@/components/modals/ModelModal";
import { useSettings }  from "@/hooks/useSettings";
import { useReview }    from "@/hooks/useReview";

export default function Home() {
  const { settings, update, setModel, isReady, missing, hydrated } = useSettings();
  const { logs, result, runState, errorMsg, run } = useReview();
  const [prNumber,   setPrNumber]   = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [showModel,  setShowModel]  = useState(false);

  const handleRun = () => {
    const pr = parseInt(prNumber.trim(), 10);
    if (!pr || pr <= 0) return;
    run(pr, settings);
  };

  return (
    <div className="app-root">
      <AppHeader
        settings={settings}
        prNumber={prNumber}
        onPrChange={setPrNumber}
        onRepoChange={(v) => update({ githubRepo: v })}
        onPatChange={(v)  => update({ githubPat: v })}
        onOpenPrompt={() => setShowPrompt(true)}
        onOpenModel={() => setShowModel(true)}
        onRun={handleRun}
        runState={runState}
        isReady={isReady}
        missing={missing}
        hydrated={hydrated}
      />
      <div className="app-body">
        <LogPanel     logs={logs} runState={runState} />
        <ResultsPanel result={result} runState={runState} errorMsg={errorMsg} />
      </div>

      {showPrompt && (
        <PromptModal
          value={settings.systemPrompt}
          onChange={(v) => update({ systemPrompt: v })}
          onClose={() => setShowPrompt(false)}
        />
      )}
      {showModel && (
        <ModelModal
          current={settings.modelConfig}
          onChange={(cfg) => { setModel(cfg); setShowModel(false); }}
          onClose={() => setShowModel(false)}
        />
      )}
    </div>
  );
}
