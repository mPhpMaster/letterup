"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isEmbeddedInDiscord } from "@/lib/discord";

/** The slice of the Web Speech API we use; TypeScript's DOM lib doesn't ship it. */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SPEECH_LANG: Record<string, string> = { ar: "ar-SA", en: "en-US" };

/** Why listening stopped without a word, for the message the player sees. */
export type SpeechError = "denied" | "unavailable" | "nothing";

/**
 * Dictate one answer at a time. `onText` gets the running transcript (interim, then
 * final) for the field being dictated into.
 */
export function useSpeechInput(locale: string, onText: (key: string, text: string) => void, onError: (error: SpeechError) => void) {
  // Checked after mount: the server render has no `window`, and a mismatch would warn.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // Discord's Activity iframe is served without the `microphone` permission, so
    // getUserMedia (and with it speech recognition) always fails in there -- a mic
    // button would only ever say "blocked". https://github.com/discord/embedded-app-sdk/issues/363
    setSupported(recognitionCtor() !== null && !isEmbeddedInDiscord());
  }, []);

  const [listening, setListening] = useState<string | null>(null);
  const active = useRef<Recognition | null>(null);
  const heard = useRef(false);
  const handlers = useRef({ onText, onError });
  handlers.current = { onText, onError };

  const stop = useCallback(() => {
    active.current?.stop();
  }, []);

  const start = useCallback(
    (key: string) => {
      const Ctor = recognitionCtor();
      if (!Ctor) return handlers.current.onError("unavailable");
      active.current?.abort();

      const rec = new Ctor();
      rec.lang = SPEECH_LANG[locale] ?? locale;
      rec.interimResults = true;
      rec.continuous = false; // one answer, then stop by itself
      rec.maxAlternatives = 1;
      heard.current = false;

      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        // Recognisers like to end a phrase with a full stop; answers never have one.
        text = text.replace(/[.,!?؟،]+$/u, "").trim();
        if (!text) return;
        heard.current = true;
        handlers.current.onText(key, text);
      };
      rec.onerror = (e) => {
        if (e.error === "aborted") return;
        heard.current = true; // reported here; don't also say "didn't catch that"
        handlers.current.onError(
          e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : e.error === "no-speech" ? "nothing" : "unavailable",
        );
      };
      rec.onend = () => {
        if (active.current === rec) {
          active.current = null;
          setListening(null);
          if (!heard.current) handlers.current.onError("nothing");
        }
      };

      active.current = rec;
      setListening(key);
      try {
        rec.start();
      } catch {
        active.current = null;
        setListening(null);
        handlers.current.onError("unavailable");
      }
    },
    [locale],
  );

  // Never leave the microphone open behind a closed round.
  useEffect(() => () => active.current?.abort(), []);

  return { supported, listening, start, stop };
}
