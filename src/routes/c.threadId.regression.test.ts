import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { UIMessage } from "ai";
import { readThreadMessages, THREADS_STORAGE_KEY } from "@/lib/threadStorage";

// Minimal localStorage stub for node-miljøet
function installLocalStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  const g = globalThis as unknown as { window?: { localStorage: Storage } };
  g.window = {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    } as Storage,
  };
}

function makeMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] } as UIMessage;
}

describe("Regressionstest: Ny chat → ChatWindow remountes og rydder messages", () => {
  beforeEach(() => {
    const g = globalThis as unknown as { window?: unknown };
    delete g.window;
  });

  it("readThreadMessages returnerer gemte beskeder for kendt threadId", () => {
    installLocalStorage({
      [THREADS_STORAGE_KEY]: JSON.stringify([
        { id: "old", title: "Old", messages: [makeMessage("m1", "hej fra gammel")] },
      ]),
    });
    const msgs = readThreadMessages("old");
    expect(msgs).toHaveLength(1);
    expect((msgs[0].parts[0] as { text: string }).text).toBe("hej fra gammel");
  });

  it("returnerer tom liste for ny/ukendt threadId — så Ny chat starter rent", () => {
    installLocalStorage({
      [THREADS_STORAGE_KEY]: JSON.stringify([
        { id: "old", title: "Old", messages: [makeMessage("m1", "skal IKKE læne")] },
      ]),
    });
    // Skift til frisk id (som "Ny chat" gør) → tom liste, ingen lækage
    expect(readThreadMessages("brand-new-id")).toEqual([]);
  });

  it("returnerer [] under SSR (intet window) uden at kaste", () => {
    expect(readThreadMessages("any")).toEqual([]);
  });

  it("er robust ved korrupt localStorage-payload", () => {
    installLocalStorage({ [THREADS_STORAGE_KEY]: "{ ikke gyldig json" });
    expect(readThreadMessages("old")).toEqual([]);
  });

  it("ThreadRoute keyer ChatWindow på threadId (remount-kontrakt)", () => {
    // Tekst-baseret guardrail: koden MÅ ikke regredere væk fra
    // synkron udledning + key på threadId — det er det der forhindrer
    // useChat i at fryse gamle beskeder fast ved tråd-skift.
    const src = readFileSync(resolve(__dirname, "../routes/c.$threadId.tsx"), "utf8");
    expect(src).toMatch(/key=\{`?\$\{threadId\}/);
    expect(src).toMatch(/readThreadMessages\(threadId\)/);
    expect(src).not.toMatch(/setInitial\(/); // ingen async setState af initial
  });

  it("simulerer tråd-skift: gammel tråd har beskeder, ny tråd er tom", () => {
    installLocalStorage({
      [THREADS_STORAGE_KEY]: JSON.stringify([
        { id: "a", messages: [makeMessage("m1", "A1"), makeMessage("m2", "A2")] },
        { id: "b", messages: [makeMessage("m3", "B1")] },
      ]),
    });
    const a = readThreadMessages("a");
    const b = readThreadMessages("b");
    const fresh = readThreadMessages("c-new");
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(1);
    expect(fresh).toEqual([]);
    // Beskeder må ikke deles på tværs af tråde
    expect(a).not.toBe(b);
  });
});

// Sikkerhedsnet: vitest mock-import opvarmning, så ChatWindow-importgrafen
// ikke trækkes ind utilsigtet under denne test-fil.
vi.mock("@/components/ChatWindow", () => ({ ChatWindow: () => null }));
