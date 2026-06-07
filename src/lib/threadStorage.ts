import type { UIMessage } from "ai";

export const THREADS_STORAGE_KEY = "widgetdc.threads.v1";

/**
 * Persisteret tråd-form i localStorage. Hold den minimal og tolerant —
 * extra felter (title, updatedAt, ...) ignoreres af læseren.
 */
export type StoredThread = {
  id: string;
  messages?: UIMessage[];
};

/**
 * KONTRAKT for `readThreadMessages`.
 *
 * - **Rent synkron**: returnerer ALDRIG en Promise. Initial state for
 *   ChatWindow MÅ udledes synkront, ellers fryser useChat en gammel
 *   samtales beskeder fast ved threadId-skift (se regressionstest).
 * - **SSR-sikker**: returnerer `[]` hvis `window` ikke findes.
 * - **Total**: kaster aldrig. Korrupt JSON, manglende nøgle, ukendt tråd
 *   og uventet payload-form returnerer alle den tomme liste.
 * - **Idempotent / pure**: muterer intet og afhænger kun af
 *   `localStorage[THREADS_STORAGE_KEY]` på kald-tidspunktet.
 * - **Frisk reference**: returnerer en frisk array-reference pr. kald,
 *   så React kan stole på identitets-skift når threadId ændres.
 */
export type ReadThreadMessages = (threadId: unknown) => UIMessage[];

export const readThreadMessages: ReadThreadMessages = (threadId) => {
  if (typeof threadId !== "string") return [];
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(THREADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const hit = (parsed as StoredThread[]).find(
      (x) => x && typeof x === "object" && x.id === threadId,
    );
    const msgs = hit?.messages;
    return Array.isArray(msgs) ? [...msgs] : [];
  } catch {
    return [];
  }
};
