import { describe, it, expect } from "vitest";
import { parseSseBuffer } from "./sse.server";

describe("parseSseBuffer (AUR-15 streaming framing)", () => {
  it("returns no events and keeps the buffer when no separator present", () => {
    const { events, rest } = parseSseBuffer("data: {partial");
    expect(events).toEqual([]);
    expect(rest).toBe("data: {partial");
  });

  it("extracts a complete data event and keeps the incomplete tail", () => {
    const { events, rest } = parseSseBuffer('data: {"a":1}\n\ndata: {"b":');
    expect(events).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b":');
  });

  it("handles multiple complete events in one buffer", () => {
    const { events, rest } = parseSseBuffer("data: one\n\ndata: two\n\n");
    expect(events).toEqual(["one", "two"]);
    expect(rest).toBe("");
  });

  it("passes the [DONE] sentinel through verbatim", () => {
    const { events } = parseSseBuffer("data: [DONE]\n\n");
    expect(events).toEqual(["[DONE]"]);
  });

  it("concatenates multiple data: lines within one event", () => {
    const { events } = parseSseBuffer("data: line1\ndata: line2\n\n");
    expect(events).toEqual(["line1\nline2"]);
  });

  it("ignores comment/keep-alive lines without data:", () => {
    const { events, rest } = parseSseBuffer(": keep-alive\n\ndata: real\n\n");
    expect(events).toEqual(["real"]);
    expect(rest).toBe("");
  });

  it("handles CRLF (\\r\\n\\r\\n) separators from providers/proxies", () => {
    const { events, rest } = parseSseBuffer('data: {"a":1}\r\n\r\ndata: {"b":');
    expect(events).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b":');
  });

  it("handles bare CR line terminators", () => {
    const { events } = parseSseBuffer("data: one\r\rdata: two\r\r");
    expect(events).toEqual(["one", "two"]);
  });
});
