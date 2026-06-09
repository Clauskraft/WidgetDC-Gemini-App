/**
 * Runtime model preference — persisteres i localStorage, læses synkront af
 * useChat-transport (DefaultChatTransport.body). Validerer mod en kuretert
 * whitelist så vi ikke sender ukendte model-id's til AI Gateway.
 *
 * Bruges af både ChatWindow (sender per request) og Dashboard/ModelPicker
 * (viser + skifter aktiv model).
 */
import { useEffect, useState } from "react";

export type ModelOption = {
  id: string;
  label: string;
  vendor: "Google" | "OpenAI" | "Anthropic" | "Platform";
  tier: "default" | "fast" | "balanced" | "pro";
  hint: string;
};

// IDs after the "vendor/" slash are passed verbatim to the provider's REST API
// (see src/lib/providers.server.ts). Keep them aligned with real model ids.
export const MODEL_OPTIONS: ModelOption[] = [
  // OpenAI
  { id: "openai/gpt-5", label: "GPT-5", vendor: "OpenAI", tier: "pro", hint: "Stærk all-rounder" },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 mini",
    vendor: "OpenAI",
    tier: "balanced",
    hint: "Billigere GPT-5",
  },
  {
    id: "openai/gpt-5-nano",
    label: "GPT-5 nano",
    vendor: "OpenAI",
    tier: "fast",
    hint: "Hurtig + billig",
  },
  {
    id: "openai/gpt-5.5",
    label: "GPT-5.5",
    vendor: "OpenAI",
    tier: "pro",
    hint: "State-of-the-art reasoning",
  },
  // Anthropic
  {
    id: "anthropic/claude-opus-4-1-20250805",
    label: "Claude Opus 4.1",
    vendor: "Anthropic",
    tier: "pro",
    hint: "Anthropic flagship reasoning",
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    vendor: "Anthropic",
    tier: "balanced",
    hint: "Stærk + hurtig balance",
  },
  {
    id: "anthropic/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    vendor: "Anthropic",
    tier: "fast",
    hint: "Lille, hurtig Claude",
  },
  // Google (direct Gemini API)
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    vendor: "Google",
    tier: "pro",
    hint: "Stort kontekst, multimodal",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    vendor: "Google",
    tier: "balanced",
    hint: "Hurtig kode + reasoning",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    vendor: "Google",
    tier: "fast",
    hint: "Billigst, høj volumen",
  },
  // WidgeTDC Platform RLM (reason_deeply auto-routes — model fixed)
  {
    id: "platform/rlm",
    label: "WidgeTDC RLM (auto)",
    vendor: "Platform",
    tier: "default",
    hint: "Platform-routet med refleksion (Deep mode)",
  },
];

export const DEFAULT_MODEL_ID = "openai/gpt-5";
const KEY = "widgetdc.model.v1";

export function getStoredModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  try {
    const v = window.localStorage.getItem(KEY);
    if (v && MODEL_OPTIONS.some((m) => m.id === v)) return v;
  } catch {
    /* noop */
  }
  return DEFAULT_MODEL_ID;
}

export function setStoredModel(id: string) {
  if (typeof window === "undefined") return;
  if (!MODEL_OPTIONS.some((m) => m.id === id)) return;
  try {
    window.localStorage.setItem(KEY, id);
    window.dispatchEvent(new CustomEvent("widgetdc:model-changed", { detail: id }));
  } catch {
    /* noop */
  }
}

export function getModelMeta(id: string): ModelOption | undefined {
  return MODEL_OPTIONS.find((m) => m.id === id);
}

/** Reaktiv hook — lytter til både storage- og custom-event så valg deler sig på tværs af paneler. */
export function useModelPreference(): [string, (id: string) => void] {
  const [model, setModel] = useState<string>(DEFAULT_MODEL_ID);
  useEffect(() => {
    setModel(getStoredModel());
    const onChange = () => setModel(getStoredModel());
    window.addEventListener("storage", onChange);
    window.addEventListener("widgetdc:model-changed", onChange as EventListener);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("widgetdc:model-changed", onChange as EventListener);
    };
  }, []);
  return [
    model,
    (id: string) => {
      setStoredModel(id);
      setModel(id);
    },
  ];
}
