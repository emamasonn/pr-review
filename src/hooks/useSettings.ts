"use client";
import { useState, useEffect, useCallback } from "react";
import type { AppSettings, ModelConfig } from "@/types";
import { loadSettings, saveSettings, isConfigured, DEFAULT_SETTINGS } from "@/store/settings";

export function useSettings() {
  // Start with defaults on both server and client — avoids hydration mismatch.
  // localStorage is only read in the effect, which runs client-side only.
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hydrated,  setHydrated] = useState(false);

  useEffect(() => {
    // This runs only on the client, after hydration is complete.
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const setModel = useCallback((config: ModelConfig) => {
    update({ modelConfig: config });
  }, [update]);

  // Don't expose isReady until we've read localStorage — avoids warning flash
  const { ok, missing } = isConfigured(settings);

  return {
    settings,
    update,
    setModel,
    isReady:  hydrated && ok,
    missing:  hydrated ? missing : [],
    hydrated,
  };
}
