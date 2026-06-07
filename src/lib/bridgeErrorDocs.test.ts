import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATED_DOC_PATH, generateBridgeErrorDocs } from "./bridgeErrorDocs";

describe("bridgeErrorDocs generator", () => {
  it("matcher den committede generated markdown-fil (drift-check)", () => {
    const onDisk = readFileSync(resolve(process.cwd(), GENERATED_DOC_PATH), "utf8");
    const fresh = generateBridgeErrorDocs();
    expect(onDisk).toBe(fresh);
  });

  it("indeholder envelope for hver fejlkode i specifikationen", () => {
    const md = generateBridgeErrorDocs();
    for (const code of [
      "origin_not_allowed",
      "wrong_contract_version",
      "invalid_schema",
      "canvas_id_mismatch",
    ]) {
      expect(md, `mangler ${code}`).toContain(`"code": "${code}"`);
    }
  });

  it("er deterministisk (samme output ved gentagne kald)", () => {
    expect(generateBridgeErrorDocs()).toBe(generateBridgeErrorDocs());
  });
});
