/**
 * Minimal, dependency-free SSE (Server-Sent Events) line reader for streaming
 * provider responses (AUR-15 true-streaming). Kept in `.server.ts` so it never
 * lands in the client bundle.
 *
 * Provider SSE wire formats differ in payload shape but share the same framing:
 * UTF-8 text, events separated by a blank line, `data:` lines carry the JSON
 * chunk (or the literal `[DONE]` sentinel). This helper handles the framing;
 * callers map each parsed `data` payload to text deltas.
 */

/** A single parsed SSE `data:` payload (the raw string after `data: `). */
export type SseDataLine = string;

/**
 * Split a running SSE buffer into complete `data:` payloads plus the remaining
 * (incomplete) tail. Pure + synchronous so it is trivially unit-testable.
 *
 * Returns `{ events, rest }` where `events` are the `data:` payload strings
 * (the `[DONE]` sentinel included verbatim — callers decide when to stop) and
 * `rest` is the unconsumed buffer tail to prepend to the next chunk.
 */
export function parseSseBuffer(rawBuffer: string): { events: SseDataLine[]; rest: string } {
  const events: SseDataLine[] = [];
  // SSE line terminators may be LF, CRLF or bare CR (spec §9.2). Some providers
  // and proxies emit `\r\n\r\n` as the event separator — `lastIndexOf("\n\n")`
  // would never match and the stream would buffer forever (no incremental
  // deltas). Normalize all CR/CRLF to LF first so framing is robust. This also
  // neutralizes the CR/LF SSE-field-injection class (cf. Hono CVE-2024 streamSSE).
  const buffer = rawBuffer.replace(/\r\n?/g, "\n");
  // Events are separated by a blank line (\n\n). Anything after the last
  // separator is an incomplete event we keep for the next read.
  const lastSep = buffer.lastIndexOf("\n\n");
  if (lastSep === -1) return { events, rest: buffer };

  const complete = buffer.slice(0, lastSep);
  const rest = buffer.slice(lastSep + 2);

  for (const rawEvent of complete.split("\n\n")) {
    // An event may carry multiple `data:` lines that concatenate.
    const dataLines = rawEvent
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart());
    if (dataLines.length === 0) continue;
    events.push(dataLines.join("\n"));
  }
  return { events, rest };
}

/**
 * Consume a `ReadableStream<Uint8Array>` (a fetch `res.body`) as SSE, invoking
 * `onData` for every `data:` payload until the stream ends or `onData` returns
 * `false` (e.g. on the `[DONE]` sentinel). Tolerant of chunk boundaries that
 * split an event mid-frame.
 */
export async function consumeSse(
  body: ReadableStream<Uint8Array>,
  onData: (payload: string) => boolean | void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseBuffer(buffer);
      buffer = rest;
      for (const payload of events) {
        const keepGoing = onData(payload);
        if (keepGoing === false) return;
      }
    }
    // Flush any trailing complete event left without a final blank line.
    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail) {
      for (const line of tail.split("\n")) {
        if (line.startsWith("data:")) onData(line.slice(5).trimStart());
      }
    }
  } finally {
    reader.releaseLock();
  }
}
