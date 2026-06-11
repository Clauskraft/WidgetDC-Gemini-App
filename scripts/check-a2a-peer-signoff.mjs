#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const REQUIRED_FIELDS = [
  "author_agent",
  "peer_reviewer",
  "review_transport",
  "review_anchor",
  "review_status",
  "reviewer_verdict",
  "review_scope",
  "reviewed_subject",
  "no_feedback_loop",
];

const REQUIRED_PEER = {
  codex: "claude",
  claude: "codex",
};

const BLOCKED_VERDICTS = new Set(["BLOCKED_WITH_FINDINGS", "BLOCKED_FINDINGS"]);

function normalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/^"|"$/g, "")
    .trim();
}

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return null;
  return JSON.parse(fs.readFileSync(eventPath, "utf8"));
}

export function extractPeerReviewSection(body) {
  const lines = String(body ?? "").split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Peer Review\s*$/i.test(line.trim()));
  if (start < 0) return null;

  const section = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index].trim())) break;
    section.push(lines[index]);
  }
  return section.join("\n").trim();
}

export function parseFields(section) {
  const fields = {};
  for (const rawLine of String(section ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("<!--")) continue;
    const match = line.match(/^(?:[-*]\s*)?(?:\*\*)?([A-Za-z_]+)(?:\*\*)?\s*:\s*(.+)$/);
    if (!match) continue;
    fields[match[1].toLowerCase()] = normalize(match[2]);
  }
  return fields;
}

function hasPlaceholder(value) {
  return /<!--|-->|^\s*$/.test(String(value ?? ""));
}

function hasReviewAnchor(value) {
  return (
    /\bmsg-[A-Za-z0-9-]+\b/.test(value) ||
    /\ba2a[:/][A-Za-z0-9._-]+\b/i.test(value) ||
    /\bLIN-\d+\b/.test(value) ||
    /\bPR\s*#\d+\b/i.test(value) ||
    /https:\/\/\S+/i.test(value)
  );
}

export function validatePeerSignoff(body) {
  const failures = [];
  const section = extractPeerReviewSection(body);

  if (!section) {
    return {
      ok: false,
      failures: ["Missing required ## Peer Review section."],
      fields: {},
    };
  }

  const fields = parseFields(section);
  for (const field of REQUIRED_FIELDS) {
    if (!fields[field] || hasPlaceholder(fields[field])) {
      failures.push(`Missing Peer Review field: ${field}`);
    }
  }

  const author = fields.author_agent?.toLowerCase();
  const peer = fields.peer_reviewer?.toLowerCase();
  const requiredPeer = REQUIRED_PEER[author];

  if (!requiredPeer) {
    failures.push("author_agent must be codex or claude.");
  } else if (peer !== requiredPeer) {
    failures.push(`peer_reviewer for ${author} work must be ${requiredPeer}.`);
  }

  if (author && peer && author === peer) {
    failures.push("author_agent and peer_reviewer must be different.");
  }

  if (!/a2a/i.test(fields.review_transport ?? "")) {
    failures.push("review_transport must identify A2A.");
  }

  if (!hasReviewAnchor(fields.review_anchor ?? "")) {
    failures.push("review_anchor must include msg-*, a2a:*, PR #, LIN-*, or an HTTPS URL.");
  }

  if ((fields.review_status ?? "").toLowerCase() !== "signoff") {
    failures.push("review_status must be signoff.");
  }

  const verdict = (fields.reviewer_verdict ?? "").toUpperCase();
  if (BLOCKED_VERDICTS.has(verdict)) {
    failures.push("reviewer_verdict blocked this work; open a new slice/PR for fixes.");
  } else if (verdict !== "SIGNOFF") {
    failures.push("reviewer_verdict must be SIGNOFF.");
  }

  if ((fields.no_feedback_loop ?? "").toLowerCase() !== "true") {
    failures.push("no_feedback_loop must be true.");
  }

  return { ok: failures.length === 0, failures, fields };
}

function selfTest() {
  const valid = validatePeerSignoff(`## Peer Review
- author_agent: codex
- peer_reviewer: claude
- review_transport: A2A chat_send(agent-coordination)
- review_anchor: msg-abc-123
- review_status: signoff
- reviewer_verdict: SIGNOFF
- review_scope: code_and_proposal
- reviewed_subject: PR #38 successor
- no_feedback_loop: true
`);
  if (!valid.ok) throw new Error(`Expected valid signoff: ${valid.failures.join("; ")}`);

  const duplicateOutsideSection = validatePeerSignoff(`author_agent: claude
peer_reviewer: codex

## Peer Review
- author_agent: codex
- peer_reviewer: claude
- review_transport: A2A
- review_anchor: msg-section-wins
- review_status: signoff
- reviewer_verdict: SIGNOFF
- review_scope: code
- reviewed_subject: PR #39
- no_feedback_loop: true
`);
  if (!duplicateOutsideSection.ok) {
    throw new Error("Expected parser to ignore fields outside ## Peer Review.");
  }
  if (duplicateOutsideSection.fields.author_agent !== "codex") {
    throw new Error("Expected parser to read author_agent from ## Peer Review only.");
  }

  const selfReview = validatePeerSignoff(`## Peer Review
- author_agent: codex
- peer_reviewer: codex
- review_transport: A2A
- review_anchor: msg-self-review
- review_status: signoff
- reviewer_verdict: SIGNOFF
- review_scope: code
- reviewed_subject: PR #39
- no_feedback_loop: true
`);
  if (selfReview.ok) throw new Error("Expected self-review to fail.");

  const blocked = validatePeerSignoff(`## Peer Review
- author_agent: codex
- peer_reviewer: claude
- review_transport: A2A
- review_anchor: msg-blocked
- review_status: signoff
- reviewer_verdict: BLOCKED_WITH_FINDINGS
- review_scope: code
- reviewed_subject: PR #39
- no_feedback_loop: true
`);
  if (blocked.ok) throw new Error("Expected blocked verdict to fail.");

  process.stdout.write("A2A peer signoff self-test passed.\n");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const eventPayload = readEventPayload();
  const body = eventPayload?.pull_request?.body ?? process.env.PR_BODY;

  if (!body) {
    process.stdout.write("A2A peer signoff check skipped: no pull_request body.\n");
    return;
  }

  const result = validatePeerSignoff(body);
  if (result.ok) {
    process.stdout.write(
      `A2A peer signoff check passed: ${result.fields.author_agent} reviewed by ${result.fields.peer_reviewer} (${result.fields.review_anchor}).\n`,
    );
    return;
  }

  process.stderr.write("A2A peer signoff check failed.\n");
  for (const failure of result.failures) process.stderr.write(`- ${failure}\n`);
  process.stderr.write(
    "\nAdd a ## Peer Review section with author_agent, peer_reviewer, review_transport, review_anchor, review_status=signoff, reviewer_verdict=SIGNOFF, review_scope, reviewed_subject, and no_feedback_loop=true.\n",
  );
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}
