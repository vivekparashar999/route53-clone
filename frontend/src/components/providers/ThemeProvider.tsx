"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { applyDensity, applyMode, Density, Mode } from "@cloudscape-design/global-styles";

export type VisualMode = "light" | "dark";
export type DensityMode = "comfortable" | "compact";

interface ThemeState {
  mode: VisualMode;
  density: DensityMode;
  setMode: (m: VisualMode) => void;
  setDensity: (d: DensityMode) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const MODE_KEY = "r53.visualMode";
const DENSITY_KEY = "r53.density";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) - preference just won't persist */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<VisualMode>("light");
  const [density, setDensityState] = useState<DensityMode>("comfortable");

  useEffect(() => {
    const storedMode = read(MODE_KEY);
    const storedDensity = read(DENSITY_KEY);
    if (storedMode === "dark" || storedMode === "light") setModeState(storedMode);
    else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setModeState("dark");
    if (storedDensity === "compact") setDensityState("compact");
  }, []);

  useEffect(() => {
    applyMode(mode === "dark" ? Mode.Dark : Mode.Light);
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  useEffect(() => {
    applyDensity(density === "compact" ? Density.Compact : Density.Comfortable);
  }, [density]);

  const setMode = useCallback((m: VisualMode) => {
    setModeState(m);
    write(MODE_KEY, m);
  }, []);

  const setDensity = useCallback((d: DensityMode) => {
    setDensityState(d);
    write(DENSITY_KEY, d);
  }, []);

  const value = useMemo(() => ({ mode, density, setMode, setDensity }), [mode, density, setMode, setDensity]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
