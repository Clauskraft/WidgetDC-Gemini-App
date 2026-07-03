const body = process.env.PR_BODY ?? "";

function fail(message) {
  console.error(`Peer signoff gate failed: ${message}`);
  process.exit(1);
}

function field(...names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = body.match(new RegExp(`^[-*]?\\s*${escaped}:\\s*(.+?)\\s*$`, "im"));
    const val = match?.[1]?.trim() ?? "";
    if (val && !/^<!--/.test(val) && val !== "—") return val;
  }
  return "";
}

if (!body.trim()) {
  fail("PR body is empty.");
}

// Support both old format (Owner agent / Peer reviewer / Peer signoff / A2A thread / A2A message)
// and new format (author_agent / peer_reviewer / reviewer_verdict / review_anchor)
const owner = field("author_agent", "Owner agent");
const reviewer = field("peer_reviewer", "Peer reviewer");
const verdict = field("reviewer_verdict", "Peer signoff");
const anchor = field("review_anchor", "A2A message", "A2A thread");

if (!/^(Codex|Claude)$/i.test(owner)) {
  fail("author_agent must be Codex or Claude.");
}

if (!/^(Codex|Claude)$/i.test(reviewer)) {
  fail("peer_reviewer must be Codex or Claude.");
}

if (owner.toLowerCase() === reviewer.toLowerCase()) {
  fail("author_agent and peer_reviewer must be different agents.");
}

if (/^BLOCKED_WITH_FINDINGS$/i.test(verdict)) {
  fail(
    "Peer blocked this work. Open a new slice/PR for fixes; do not continue a feedback loop in this PR.",
  );
}

if (!/^SIGNOFF$/i.test(verdict)) {
  fail("reviewer_verdict must be SIGNOFF before closure.");
}

if (!anchor || /<!--/.test(anchor)) {
  fail("review_anchor (A2A message or thread evidence) is required.");
}

console.log("Peer signoff gate passed.");
