---
name: geekbot-run
description: >
  Use when the user mentions Geekbot, standups, daily check-ins, async
  reports, polls, team engagement, response rates, or participation
  tracking. Triggers on: "standup", "check-in", "report", "poll",
  "Geekbot", "who hasn't posted", "draft my standup", "team analytics".
---

# Geekbot — AI-Powered Standup & Poll Management

## Overview

This skill wraps the `geekbot` CLI to let users manage async team rituals
conversationally. It handles two broad workflows:

- **Manager workflows** — create standups/polls from templates, edit configs,
  manage members and schedules, analyse team engagement from report data
- **Reporter workflows** — draft standup reports with AI assistance, carry
  over unresolved blockers, calibrate tone from history, post reports

The CLI produces structured JSON output with machine-readable error codes,
making it reliable for agent-driven automation.

## Prerequisites

Before any operation, verify the CLI is available and authenticated.

Run `check-cli.sh` on first invocation. If it fails:

- **CLI not found**: Install via `npm install -g geekbot-cli` (requires
  Bun >= 1.3.5 runtime). Note: `npx geekbot-cli` also requires Bun on
  PATH — it is not a Node.js fallback.
- **CLI outdated** (`cli_outdated`): the installed CLI is older than the
  `minCliVersion` this plugin declares, so documented flags may not exist
  yet. Prompt the user to update via `npm install -g geekbot-cli@latest`
  (offer to run it) and re-run the check before continuing.
- **Auth not configured**: Guide the user to run `geekbot auth login`,
  which uses the OAuth 2.1 authorization-code + PKCE flow with a
  `http://127.0.0.1:<port>/callback` loopback redirect and writes the
  resulting `cli_*` token to the OS keychain. As a fallback they can use
  `geekbot auth setup --api-key <KEY>` with a dashboard API key, or set
  `GEEKBOT_API_KEY` as an environment variable.

Do not attempt any Geekbot operation until both checks pass.

## Asking the User

Some steps in this skill need to ask the user for input. Render each
question with whatever interaction primitive your harness provides —
the question content is identical either way.

- **`[PICKER]`** — a small fixed set of mutually-exclusive options
  (2–4). If your harness exposes a structured single-select question
  tool (e.g. Claude Code's `AskUserQuestion`, or any equivalent picker
  UI), use it. Otherwise present the same options as a numbered list
  in chat.
- **`[PICKER, top-N + Other]`** — same as `[PICKER]` but the candidate
  set may exceed 4 (e.g. "pick one of these 12 standups"). Pre-filter
  to the 3 most likely options and add an "Other" choice that lets the
  user name the rest in chat.
- **`[CONFIRM]`** — a yes/edit/cancel decision before a destructive or
  externally-visible action. Treat as `[PICKER]` with options
  *Approve / Edit / Cancel*.
- **`[CHAT]`** — open-ended question. Always ask in plain prose; a
  picker doesn't fit.

Tags appear inline in the workflow docs at the point where the
question is asked. Untagged "ask the user" prose is conversational by
default. Do not name `AskUserQuestion` (or any other tool) directly in
prompts to the user — pick the right primitive silently based on your
harness.

## How the CLI Works

The CLI follows a noun-verb pattern: `geekbot <resource> <action> [options]`.

Every command returns a JSON envelope on stdout:

```
Success: { "ok": true,  "data": <T>,  "error": null,  "metadata": {...} }
Error:   { "ok": false, "data": null,  "error": { "code", "message", "retryable", "suggestion" }, "metadata": {...} }
```

Always check the `ok` field first. On errors, the `error.suggestion` field
often contains the exact fix — including listing valid IDs when a resource
isn't found. Use this to self-correct without bothering the user.

For the full command reference with flags, defaults, and examples, read
`cli-commands.md`.

## Quick Reference

Most common operations at a glance:

| Task | Command |
|------|---------|
| List my standups | `geekbot standup list` (add `--state active`, `--is-anonymous true`, `--broadcast-channel <id>`, or `--page-size <n>` to narrow results) |
| Get standup details + question IDs | `geekbot standup get <id>` |
| Create a standup | `geekbot standup create --channel "..." --questions '[...]' --users "U1,U2"` (or `--sync-channel "#ch"`; `--is-anonymous` optional) |
| List reports | `geekbot report list --standup-id <id> --limit 10` |
| Submit a report | `geekbot report create --standup-id <id> --answers '{"<qid>":"..."}'` |
| My profile + user ID | `geekbot me show` |
| Set out-of-office (pauses standups) | `geekbot ooo create --start-date "YYYY-MM-DD" --end-date "YYYY-MM-DD"` (admins add `--user <id>` for another member) |
| List/adjust out-of-office periods | `geekbot ooo list`, `geekbot ooo edit <id> --end-date "..."`, `geekbot ooo delete <id> --yes` |
| Create a poll (Slack only) | `geekbot poll create --name "..." --channel "..." --question "..." --choices '[...]' [--duration 120]` |
| Search team members | `geekbot team search <query>` (matches username, realname, email) |
| Check auth | `geekbot auth status` |

For full flag details, see `cli-commands.md`.

## External Context Enrichment

The skill becomes dramatically more useful when it can pull data from where
work actually happens. Prefer MCP enrichment for report drafts when relevant
servers can be made ready; fall back to asking the user only after reconnect
attempts fail (or when no enrichment sources apply).

**Session auth (before treating a source as missing):**
OAuth MCP plugins are often configured on disk (and may even appear in the
agent system prompt) but absent from the live tool catalog until authenticated
in *this* session. That commonly looks like "server not found" / an incomplete
catalog — not always a clear `needsAuth`-style status. Do **not** skip on
first miss.

When drafting a report, attempt reconnect for enrichment-relevant MCP servers
already known to the session (advertised in the prompt, present under the
workspace MCP config, or previously used in the conversation). Typical
examples include issue trackers, chat/team messaging, git hosts, and calendar —
use whatever maps to the standup questions (see `reporter-workflows.md`).
Do not hard-require a specific vendor; do not nag about servers that cannot
contribute to the draft.

**Reconnect flow (per server, once per conversation):**
1. Inspect MCP tools/catalog for that server. If status is `ready`, use it.
2. If status indicates auth is required, the server is missing from the catalog,
   lookup returns "not found", or the only exposed tool is an auth/login tool
   (e.g. `mcp_auth`) → invoke that server's auth tool once.
3. Re-inspect tools for that server; then query.
4. If auth fails or the user dismisses OAuth, skip that source and continue.
   When presenting the draft, mention skipped sources briefly (so the user can
   retry) — do not turn a miss into a troubleshooting session unless they ask.

If a source has a well-known non-MCP fallback (for example a git host CLI),
using that fallback after MCP reconnect fails is fine. Never fail the whole
standup flow because one MCP is down.

**For report drafting:** Pull recent activity from ready enrichment sources
and pre-populate the draft. The user reviews and approves instead of writing
from scratch.

**For analytics:** Cross-reference standup report data with delivery data
to give richer insights — not just "who posted" but "what was actually shipped."

For entity mapping tables and deduplication strategy, see `reporter-workflows.md`.

**Important boundaries:**
- Always show the user what data you pulled and from where
- Never post a report containing enrichment data without user review
- After a successful connect, if a *query* fails, skip that query and move on
- Enrichment provides specifics (PR numbers, ticket IDs); the user's
  voice still drives the narrative

## Intent Routing

Pattern-match on the user's request to pick the right workflow. Don't ask
"are you a manager or a reporter?" — the request itself makes intent clear.
The same person can manage standups and submit reports in one conversation.

**Route to Manager Workflows (§ below) when you see:**
- Creation/config language: "create", "set up", "configure", "schedule"
- Analytics language: "how is my team doing", "engagement", "response rate",
  "who hasn't posted", "participation", "trends"
- Member summary language: "what has X been up to", "X's reports",
  "1-1 prep for X", "summarize X's work", "what did X report",
  "catch me up on X", "X's recent standups"
- Poll language: "create a poll", "voting results", "survey"

**Route to Reporter Workflows (§ below) when you see:**
- Drafting language: "help me write", "draft my report", "what should I say",
  "fill in my standup"
- Posting language: "post my answers", "submit my report"
- Context language: "what did I say last time", "carry over blockers",
  "my recent reports"
- Identity queries: "what standups am I in", "show my profile"
- Out-of-office language: "I'm on vacation", "out of office", "OOO",
  "pause my standups while I'm away" — use the `geekbot ooo` commands
  (managers can set OOO for a member with `--user <id>`)

**When ambiguous**, ask one clarifying question — never more than one.
Use `[PICKER]` if the disambiguation is between 2–4 named options
(e.g. manager-vs-reporter intent split with a third "something else"
fallback), otherwise `[CHAT]`.

## Manager Workflows

For detailed multi-step guides, read `manager-workflows.md`.

### Creating a Standup

This is the most common and most complex manager operation.

**If the request is vague** ("set up a standup for my team"), offer templates.
Load `standup-templates.json` and present the 3–4 most relevant options
based on context. Templates provide pre-built questions and sensible schedule
defaults — the user just needs to confirm name, channel, and members.

**Gathering required fields (v2):**
- `--channel` — broadcast channel id or name (required)
- `--questions` — JSON array (required). Strings `["q1","q2"]` for free-text
  or `[{"text":"q1","choices":["A","B"]}]` for multiple-choice
- `--name` — optional. If the user gave a name, use it verbatim. Otherwise
  infer a meaningful name from the configured questions (use the template
  name when a template is in play). **Don't** rely on the API default
  `"Standup #<broadcast channel>"`.
- `--time` — defaults to `10:00`
- `--timezone` — infer from `geekbot me show` → `data.timezone` if not given
- `--days` — defaults to Mon–Fri
- **Members — always ask.** Pass `--users "U1,U2"` for an explicit list or
  `--sync-channel "#name"` to sync members from a channel. The two flags
  are mutually exclusive. The API does not auto-populate members when both
  are omitted — never call without member resolution.
- `--is-anonymous` — surface proactively for sensitive content (well-being,
  feedback, retro psychological safety) or templates with
  `is_anonymous_recommended: true`.

**Always confirm the full configuration with the user before executing.**
Show: name, channel, members (count + list or sync source), schedule,
timezone, anonymous flag, questions.

**Idempotency:** the CLI auto-generates a UUID `Idempotency-Key` per call
(24h API window). Re-running the command creates a new standup. On
ambiguous outcomes (timeout, partial response), list with
`geekbot standup list` before retrying.

**Note:** The CLI sets which days of the week to run but cannot set frequency
(bi-weekly, monthly). For non-weekly schedules, create the standup via CLI
and tell the user to adjust the frequency in the Geekbot web dashboard.

For the full step-by-step wizard (naming, channel resolution, member
resolution, anonymous-flag policy, edge cases), read `manager-workflows.md`
§ Standup Creation Wizard.

### Other Operations

- **Edit / Delete / Duplicate**: Not available in the CLI. Direct the user
  to the Geekbot web dashboard for these operations.
- **Trigger now**: `geekbot standup start <id>` — confirm before executing.
- **Polls** (Slack only): See `cli-commands.md` for poll commands.

### Analytics

Analytics come from report data fetched via the CLI. The skill computes
metrics; the CLI provides raw data. For the full analytics playbook with
6 named analysis patterns (response rate, participation gaps, blocker
frequency, trends, answer quality, cross-referencing), read
`manager-workflows.md`.

**Quick start:** Identify the standup with `standup list`, get member count
with `standup get <id>`, fetch reports with
`report list --standup-id <id> --after <date> --limit 100`, then compute.

### Team Member Summary

Summarize what a specific person has been working on — ideal for 1-1 prep.
For the full step-by-step workflow, read `manager-workflows.md` §Team Member
Summary.

**Quick start:** `geekbot team search <name>` → get user ID →
`geekbot standup list` to enumerate standups → for each, fetch reports with
`geekbot report list --standup-id <sid> --user-id <id> --after <3 weeks ago> --page-size 20` →
synthesize by work stream, not chronologically.

## Reporter Workflows

For the full drafting pipeline, tone calibration, blocker carry-over logic,
and edge cases, read `reporter-workflows.md`.

### Report Drafting Pipeline (Summary)

1. **Identify the standup** — `standup list`, auto-select if only one
2. **Fetch questions** — `standup get <id>` → extract question IDs and text
3. **Gather context** — from MCP servers (if connected), previous reports
   (for style calibration), and the user's direct input
4. **Draft answers** — match their historical tone/length, weave in specifics
   from MCP data, run blocker carry-over check on last 3–5 reports
5. **Review and post** — present draft, get explicit approval, then
   `report create --standup-id <id> --answers '{...}'`

**Never post a report without explicit user approval.**

### Quick Actions

One-shot commands that don't need the full pipeline:

- **"What standups am I in?"** → `geekbot standup list`
- **"Show my recent reports"** → `geekbot report list --user-id <uid> --limit 5`
- **"Show my profile"** → `geekbot me show`
- **"What teams am I in?"** → `geekbot me teams`
- **"Trigger my standup now"** → confirm first, then `geekbot standup start <id>`

## Confirmation Policy

All required confirmations are `[CONFIRM]` — render as a structured
picker (Approve / Edit / Cancel) when the harness supports it, or as
the same three options in chat.

| Operation | Confirmation required? | What to show |
|-----------|----------------------|--------------|
| CREATE standup/poll | `[CONFIRM]` | Full config: name, channel, questions, schedule |
| POST report | `[CONFIRM]` — always | Complete draft with all answers |
| TRIGGER standup | `[CONFIRM]` | Which standup, who it targets |
| List / Get / Analytics | No | Just execute and present results |
| Error recovery retries | No | Transparent to user |

## Error Handling

For the complete recovery guide, read `error-recovery.md`.

**Core pattern**: always parse the JSON envelope, check `ok`, branch on
exit code.

| Exit code | Meaning | Agent action |
|-----------|---------|--------------|
| 0 | Success | Proceed normally |
| 3 | Not found | Parse `error.suggestion` — it lists valid IDs. Offer them to the user. |
| 4 | Auth failed | Guide user through `geekbot auth login` (or `geekbot auth setup --api-key` as fallback). Do not retry. |
| 5 | Forbidden | Explain permission issue. The user may need admin access. |
| 6 | Validation | Show `error.message`, help the user fix the input. |
| 7 | Network | If `error.retryable` is true, retry once after 2s silently. If it fails again, report. |
| 8 | Conflict | Explain the conflict (e.g., duplicate name). Suggest resolution. |
| 9 | Schema validation (`schema_validation_error`) | API response didn't match expected format. Don't ask user to fix input — suggest updating CLI or reporting a bug. |
| 1, 2, 9 | General / usage / API | Report `error.message` to the user clearly. |

**Never retry** errors where `retryable` is false.

## Common Mistakes

- **Inventing report answers** — if the user didn't provide enough context
  for a question, ask. Never guess or fabricate.
- **Treating MCP "not found" as permanently unavailable** — for OAuth
  enrichment servers, run the server's auth tool once and retry before
  skipping. Catalog omission is often unauthenticated session state, not
  missing install.
- **Retrying Geekbot auth errors** — exit code 4 is never transient. Guide
  the user to `geekbot auth login` (or `geekbot auth setup --api-key` as
  fallback) instead.
- **Dumping raw JSON** — format output as tables, summaries, or narratives.
  The user should never see a raw JSON envelope.
- **Ignoring `error.suggestion`** — when a resource isn't found (exit 3),
  the CLI already lists valid alternatives. Use them.
- **Asking "are you a manager or reporter?"** — the request itself reveals
  intent. Pattern-match, don't interrogate.

## Output Patterns

**CRUD confirmations** — brief, factual, include key identifiers:
> Created "Sprint Retro" standup (ID 789) in #engineering — Fridays at
> 15:00 Chicago time with 3 questions.

**Lists** — concise table: ID, name, channel, schedule. Don't dump raw JSON.

**Analytics** — narrative summary first, data table for details. Use
visualisation (chart/graph) when showing trends over time.

**Report drafts** — one question per block, clearly labelled with question
text and proposed answer. Easy to scan and approve.

**Errors** — plain language: what happened, why, what to do next. Always
use `error.suggestion` when available.
