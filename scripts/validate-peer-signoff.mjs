const body = process.env.PR_BODY ?? "";

function fail(message) {
  console.error(`Peer signoff gate failed: ${message}`);
  process.exit(1);
}

function field(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`^${escaped}:\\s*(.+?)\\s*$`, "im"));
  return match?.[1]?.trim() ?? "";
}

if (!body.trim()) {
  fail("PR body is empty.");
}

const owner = field("Owner agent");
const reviewer = field("Peer reviewer");
const signoff = field("Peer signoff");
const thread = field("A2A thread");
const message = field("A2A message");

if (!/^(Codex|Claude)$/i.test(owner)) {
  fail("Owner agent must be Codex or Claude.");
}

if (!/^(Codex|Claude)$/i.test(reviewer)) {
  fail("Peer reviewer must be Codex or Claude.");
}

if (owner.toLowerCase() === reviewer.toLowerCase()) {
  fail("Owner agent and peer reviewer must be different.");
}

if (owner.toLowerCase() === "codex" && reviewer.toLowerCase() !== "claude") {
  fail("Codex-owned work requires Claude peer review.");
}

if (owner.toLowerCase() === "claude" && reviewer.toLowerCase() !== "codex") {
  fail("Claude-owned work requires Codex peer review.");
}

if (/^BLOCKED_WITH_FINDINGS$/i.test(signoff)) {
  fail("Peer blocked this work. Open a new slice/PR for fixes; do not continue a feedback loop in this PR.");
}

if (!/^SIGNOFF$/i.test(signoff)) {
  fail("Peer signoff must be SIGNOFF before closure.");
}

if (!thread || /<!--/.test(thread)) {
  fail("A2A thread evidence is required.");
}

if (!message || /<!--/.test(message)) {
  fail("A2A message evidence is required.");
}

console.log("Peer signoff gate passed.");
