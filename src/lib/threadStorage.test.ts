import { describe, it, expect, beforeEach } from "vitest";
import type { UIMessage } from "ai";
import {
  readThreadMessages,
  THREADS_STORAGE_KEY,
  type ReadThreadMessages,
  type StoredThread,
} from "@/lib/threadStorage";

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
function uninstallWindow() {
  const g = globalThis as unknown as { window?: unknown };
  delete g.window;
}

const msg = (id: string, text: string): UIMessage =>
  ({ id, role: "user", parts: [{ type: "text", text }] }) as UIMessage;

// ---------- Type-level assertions ----------
// Disse er rent compile-time guards. Kommer noget i drift på typen,
// fejler `bun run build` / `tsc` før testene overhovedet kører.
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

// 1) Den eksporterede funktion matcher kontrakt-typen præcist.
type _SignatureMatches = Expect<Equal<typeof readThreadMessages, ReadThreadMessages>>;
// 2) Returtypen er UIMessage[] — IKKE Promise<UIMessage[]>.
type _ReturnIsSync = Expect<Equal<ReturnType<ReadThreadMessages>, UIMessage[]>>;
// 3) Returtypen er ikke en Promise (eksplicit negativ check).
type _NotPromise = Expect<
  Equal<ReturnType<ReadThreadMessages> extends Promise<unknown> ? true : false, false>
>;
// 4) StoredThread kræver kun id; messages er valgfri.
type _StoredThreadShape = Expect<
  Equal<StoredThread, { id: string; messages?: UIMessage[] }>
>;
// 5) Parametertypen accepterer unknown (non-string input håndteres defensivt).
type _ParamAcceptsUnknown = Expect<
  Equal<Parameters<ReadThreadMessages>[0], unknown>
>;
// Holder referencer i live for noUnusedLocals.
type _Hold = [_SignatureMatches, _ReturnIsSync, _NotPromise, _StoredThreadShape, _ParamAcceptsUnknown];

// ---------- Runtime kontrakt-tests ----------
describe("readThreadMessages — kontrakt", () => {
  beforeEach(() => uninstallWindow());

  it("er en synkron funktion (returnerer ALDRIG en Promise)", () => {
    installLocalStorage({
      [THREADS_STORAGE_KEY]: JSON.stringify([{ id: "a", messages: [msg("m1", "x")] }]),
    });
    const r = readThreadMessages("a");
    // Hverken thenable eller Promise-instans
    expect(r).not.toBeInstanceOf(Promise);
    expect(typeof (r as unknown as { then?: unknown }).then).toBe("undefined");
    expect(Array.isArray(r)).toBe(true);
  });

  it("ssr-sikker: intet window → []", () => {
    expect(readThreadMessages("any")).toEqual([]);
  });

  it("total: kaster aldrig på korrupt JSON", () => {
    installLocalStorage({ [THREADS_STORAGE_KEY]: "{ ikke gyldig" });
    expect(() => readThreadMessages("a")).not.toThrow();
    expect(readThreadMessages("a")).toEqual([]);
  });

  it("total: kaster aldrig hvis payload ikke er et array", () => {
    installLocalStorage({ [THREADS_STORAGE_KEY]: JSON.stringify({ ups: true }) });
    expect(readThreadMessages("a")).toEqual([]);
  });

  it("total: tom liste hvis tråden findes uden messages-felt", () => {
    installLocalStorage({
      [THREADS_STORAGE_KEY]: JSON.stringify([{ id: "a" }]),
    });
    expect(readThreadMessages("a")).toEqual([]);
  });

  it("returnerer frisk array-reference pr. kald (identitets-skift sikret)", () => {
    installLocalStorage({
      [THREADS_STORAGE_KEY]: JSON.stringify([{ id: "a", messages: [msg("m1", "x")] }]),
    });
    const a1 = readThreadMessages("a");
    const a2 = readThreadMessages("a");
    expect(a1).toEqual(a2);
    expect(a1).not.toBe(a2); // ingen delt reference på tværs af kald
  });

  it("ren / idempotent: muterer ikke det persisterede payload", () => {
    const payload = JSON.stringify([{ id: "a", messages: [msg("m1", "x")] }]);
    installLocalStorage({ [THREADS_STORAGE_KEY]: payload });
    const before = window.localStorage.getItem(THREADS_STORAGE_KEY);
    readThreadMessages("a");
    const after = window.localStorage.getItem(THREADS_STORAGE_KEY);
    expect(after).toBe(before);
  });

  it("ukendt threadId → [] (ny chat starter rent)", () => {
    installLocalStorage({
      [THREADS_STORAGE_KEY]: JSON.stringify([{ id: "a", messages: [msg("m1", "x")] }]),
    });
    expect(readThreadMessages("ukendt")).toEqual([]);
  });
});

describe("readThreadMessages — edge cases for threadId", () => {
  beforeEach(() => uninstallWindow());

  const seed = () =>
    installLocalStorage({
      [THREADS_STORAGE_KEY]: JSON.stringify([
        { id: "", messages: [msg("e1", "empty-id thread")] },
        { id: " ", messages: [msg("w1", "single space")] },
        { id: "  \t\n ", messages: [msg("w2", "whitespace")] },
        { id: "a".repeat(10_000), messages: [msg("l1", "long id")] },
        { id: "🧵-emoji-✨", messages: [msg("u1", "unicode")] },
        { id: "weird/\\?#&=", messages: [msg("s1", "special chars")] },
        { id: "a", messages: [msg("m1", "normal")] },
      ]),
    });

  const cases: Array<[string, string]> = [
    ["tom streng", ""],
    ["single space", " "],
    ["blandet whitespace", "  \t\n "],
    ["ekstrem længde (10k tegn)", "a".repeat(10_000)],
    ["ekstrem længde, ukendt (10k 'b')", "b".repeat(10_000)],
    ["unicode/emoji", "🧵-emoji-✨"],
    ["URL-specialtegn", "weird/\\?#&="],
    ["ukendt id", "does-not-exist"],
  ];

  for (const [label, id] of cases) {
    it(`forbliver synkron + total for threadId: ${label}`, () => {
      seed();
      let threw = false;
      let result: UIMessage[] | undefined;
      try {
        result = readThreadMessages(id);
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
      expect(Array.isArray(result)).toBe(true);
      expect(result).not.toBeInstanceOf(Promise);
      expect(typeof (result as unknown as { then?: unknown }).then).toBe("undefined");
    });
  }

  it("matcher præcis på id — whitespace-id leverer kun whitespace-trådens beskeder", () => {
    seed();
    const ws = readThreadMessages(" ");
    expect(ws).toHaveLength(1);
    expect((ws[0].parts[0] as { text: string }).text).toBe("single space");
    // Andre whitespace-varianter må IKKE lække ind
    expect(readThreadMessages("  ")).toEqual([]);
  });

  it("tom-streng id rammer kun tråden med id=''", () => {
    seed();
    const empty = readThreadMessages("");
    expect(empty).toHaveLength(1);
    expect((empty[0].parts[0] as { text: string }).text).toBe("empty-id thread");
  });

  it("ekstrem længde: kendt 10k-id returnerer beskeder; ukendt 10k-id returnerer []", () => {
    seed();
    expect(readThreadMessages("a".repeat(10_000))).toHaveLength(1);
    expect(readThreadMessages("b".repeat(10_000))).toEqual([]);
  });

  it("alle edge-case kald færdiggør før næste microtask (synkron)", async () => {
    seed();
    let microtaskRan = false;
    queueMicrotask(() => {
      microtaskRan = true;
    });
    for (const [, id] of cases) {
      const r = readThreadMessages(id);
      // Hver iteration skal være færdig før microtasken får lov at køre
      expect(microtaskRan).toBe(false);
      expect(Array.isArray(r)).toBe(true);
    }
    await Promise.resolve();
    expect(microtaskRan).toBe(true);
  });

  it("total selv når payload har poster uden id eller med ikke-string id", () => {
    installLocalStorage({
      [THREADS_STORAGE_KEY]: JSON.stringify([
        null,
        { messages: [msg("x", "ingen id")] },
        { id: 42, messages: [msg("y", "talid")] },
        { id: "a", messages: [msg("m1", "ok")] },
      ]),
    });
    expect(() => readThreadMessages("a")).not.toThrow();
    expect(readThreadMessages("a")).toHaveLength(1);
    expect(readThreadMessages("")).toEqual([]);
  });
});

describe("readThreadMessages — non-string threadId inputs", () => {
  beforeEach(() => uninstallWindow());

  const badInputs: Array<{ label: string; value: unknown }> = [
    { label: "null", value: null },
    { label: "undefined", value: undefined },
    { label: "number", value: 42 },
    { label: "object", value: { id: "a" } },
    { label: "array", value: ["a"] },
    { label: "boolean true", value: true },
    { label: "boolean false", value: false },
    { label: "symbol", value: Symbol("x") },
    { label: "function", value: () => "a" },
  ];

  for (const { label, value } of badInputs) {
    it(`total for ${label}: kaster aldrig, returnerer frisk []`, () => {
      installLocalStorage({
        [THREADS_STORAGE_KEY]: JSON.stringify([
          { id: "a", messages: [msg("m1", "x")] },
        ]),
      });
      let threw = false;
      let result: UIMessage[] | undefined;
      try {
        result = readThreadMessages(value);
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
      expect(result).not.toBeInstanceOf(Promise);
    });
  }

  it("frisk array-reference også for non-string input", () => {
    const inputs = [null, undefined, 42, {}];
    const results = inputs.map((v) => readThreadMessages(v));
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        expect(results[i]).not.toBe(results[j]);
      }
    }
    results.forEach((r) => expect(r).toEqual([]));
  });

  it("synkron udførsel for non-string: færdig før næste microtask", async () => {
    let microtaskRan = false;
    queueMicrotask(() => {
      microtaskRan = true;
    });
    for (const { value } of badInputs) {
      const r = readThreadMessages(value);
      expect(microtaskRan).toBe(false);
      expect(Array.isArray(r)).toBe(true);
    }
    await Promise.resolve();
    expect(microtaskRan).toBe(true);
  });
});

it("synkron udførsel: færdig før næste microtask", async () => {
  installLocalStorage({
    [THREADS_STORAGE_KEY]: JSON.stringify([{ id: "a", messages: [msg("m1", "x")] }]),
  });
  let done = false;
  const result = readThreadMessages("a");
  done = true; // skal være sat FØR vi nogensinde awaiter
  await Promise.resolve();
  expect(done).toBe(true);
  expect(result.length).toBe(1);
});
