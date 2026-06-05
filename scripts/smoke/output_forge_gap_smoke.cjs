const base = process.argv[2] || "http://127.0.0.1:3022";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 10000);

const flows = [
  {
    name: "gap_report",
    query: "Generate Output Forge Gap Report using symptom principle complaint moat acceptance test",
    expectedTarget: "output_forge.gap",
    expectedStatus: "Grounded",
    expectedType: "Gap Report",
    expectedText: ["Best-practice principle", "Expected complaint", "Moat", "Acceptance test"],
  },
  {
    name: "trust_check",
    query: "Generate Output Forge Trust Check for this client-ready artifact",
    expectedTarget: "output_forge.trust",
    expectedStatus: "Needs review",
    expectedType: "Trust Check",
    expectedText: ["Ready to share", "Needs source", "Assumption", "What should I check"],
  },
  {
    name: "consulting_structure",
    query: "Generate Output Forge Consulting Structure using SCR MECE issue tree recommendation",
    expectedTarget: "output_forge.consulting",
    expectedStatus: "Grounded",
    expectedType: "Consulting Structure",
    expectedText: ["Situation", "Complication", "Key question", "Recommendation"],
  },
  {
    name: "reproducibility",
    query: "Generate Output Forge Reproducibility Pack for the data analysis",
    expectedTarget: "output_forge.reproducibility",
    expectedStatus: "Needs review",
    expectedType: "Reproducibility Pack",
    expectedText: ["Dataset snapshot", "Transform trace", "Eval metadata", "Notebook export"],
  },
];

async function postJson(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const bodyText = await res.text();
    let json = {};
    let parseError;
    try {
      json = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      json = {};
      parseError = "non-json response";
    }
    return { ok: res.ok, status: res.status, json, bodyText, parseError };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: {},
      bodyText: "",
      parseError: undefined,
      error: error && error.name === "AbortError" ? `timeout after ${timeoutMs}ms` : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function responseDetail(result) {
  const detail = result.error || result.bodyText || result.parseError || JSON.stringify(result.json);
  if (!detail || detail === "{}") return "";
  return `: ${detail.slice(0, 300)}`;
}

function contractDetail(result) {
  const jsonIsEmpty = Object.keys(result.json || {}).length === 0;
  if (result.parseError) {
    return `: non-json response${result.bodyText ? `: ${result.bodyText.slice(0, 300)}` : ""}`;
  }
  if (jsonIsEmpty) return ": empty JSON response";
  return "";
}

const failures = [];

async function main() {
  for (const flow of flows) {
    const result = await postJson("/api/widgetdc/route", {
      tool: "intent_detect",
      payload: { query: flow.query },
    });

    const text = `${result.json.intent || ""}\n${result.json._canvas_content || ""}`;
    const detail = contractDetail(result);
    if (!result.ok) failures.push(`${flow.name}: HTTP ${result.status}${responseDetail(result)}`);
    if (result.json._target_tool !== flow.expectedTarget) {
      failures.push(`${flow.name}: expected target ${flow.expectedTarget}, got ${result.json._target_tool}${detail}`);
    }
    if (result.json._output_status !== flow.expectedStatus) {
      failures.push(`${flow.name}: expected status ${flow.expectedStatus}, got ${result.json._output_status}${detail}`);
    }
    if (result.json._output_type !== flow.expectedType) {
      failures.push(`${flow.name}: expected type ${flow.expectedType}, got ${result.json._output_type}${detail}`);
    }
    if (!result.json._canvas_content) failures.push(`${flow.name}: missing _canvas_content${detail}`);
    for (const expected of flow.expectedText) {
      if (!text.includes(expected)) failures.push(`${flow.name}: missing text "${expected}"${detail}`);
    }
  }

  if (process.env.RUN_CHAT_NO_MODEL_SMOKE === "1") {
    const noModel = await postJson("/api/chat", { contents: "hello" });
    if (noModel.status !== 401 && !String(noModel.json.text || "").includes("No runtime model is configured")) {
      failures.push(
        `chat_no_model: expected 401 unauthenticated or no-runtime-model text, got HTTP ${noModel.status}${responseDetail(noModel)}`,
      );
    }
  }

  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(`Output Forge gap smoke passed for ${base}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
