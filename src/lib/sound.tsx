"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Tiny synthesized sound effects (Web Audio, no files to load through Discord's
 * proxy). Browsers keep audio locked until the first tap, so anything played
 * before that is silently dropped -- which is fine for effects.
 */
export type SfxName = "click" | "select" | "tick" | "reveal" | "submit" | "vote-up" | "vote-down" | "score" | "fanfare";

const STORAGE_KEY = "letterup.sound";

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number };

const RECIPES: Record<SfxName, Note[]> = {
  click: [{ f: 520, t: 0, d: 0.07, g: 0.18 }],
  select: [
    { f: 660, t: 0, d: 0.06, g: 0.16 },
    { f: 880, t: 0.05, d: 0.08, g: 0.16 },
  ],
  tick: [{ f: 1100, t: 0, d: 0.05, type: "square", g: 0.1 }],
  reveal: [
    { f: 392, t: 0, d: 0.1 },
    { f: 587, t: 0.08, d: 0.1 },
    { f: 784, t: 0.16, d: 0.22 },
  ],
  submit: [
    { f: 523, t: 0, d: 0.09 },
    { f: 784, t: 0.08, d: 0.16 },
  ],
  "vote-up": [{ f: 880, t: 0, d: 0.1 }],
  "vote-down": [{ f: 220, t: 0, d: 0.14, type: "sawtooth", g: 0.12 }],
  score: [
    { f: 784, t: 0, d: 0.08 },
    { f: 1046, t: 0.07, d: 0.14 },
  ],
  fanfare: [
    { f: 523, t: 0, d: 0.12 },
    { f: 659, t: 0.11, d: 0.12 },
    { f: 784, t: 0.22, d: 0.12 },
    { f: 1046, t: 0.33, d: 0.36 },
  ],
};

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function playSfx(name: SfxName) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const n of RECIPES[name]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = n.type ?? "triangle";
    osc.frequency.setValueAtTime(n.f, now + n.t);
    gain.gain.setValueAtTime(0.0001, now + n.t);
    gain.gain.exponentialRampToValueAtTime(n.g ?? 0.22, now + n.t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + n.t);
    osc.stop(now + n.t + n.d + 0.02);
  }
}

interface SoundApi {
  enabled: boolean;
  toggle: () => void;
  play: (name: SfxName) => void;
}

const SoundContext = createContext<SoundApi>({ enabled: false, toggle: () => {}, play: () => {} });

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "off") setEnabled(false);
    } catch {
      // storage blocked inside some iframes: keep the default
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {}
    if (next) playSfx("select");
  }, []);

  // Stable identity: effects that play a sound should not re-run when it is muted.
  const play = useCallback((name: SfxName) => {
    if (enabledRef.current) playSfx(name);
  }, []);

  const value = useMemo(() => ({ enabled, toggle, play }), [enabled, toggle, play]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundApi {
  return useContext(SoundContext);
}
