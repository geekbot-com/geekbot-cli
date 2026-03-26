---
name: geekbot
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
- **Auth not configured**: Guide the user to run `geekbot auth setup`
  which stores the API key in the OS keychain. Alternatively they can
  set `GEEKBOT_API_KEY` as an environment variable.

Do not attempt any Geekbot operation until both checks pass.

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
| List my standups | `geekbot standup list` (add `--brief` for compact output, `--name`/`--channel` to filter, `--mine` for member-only, `--member <id>` for a specific user, `--limit <n>` to cap results) |
| Get standup details + question IDs | `geekbot standup get <id>` |
| Create a standup | `geekbot standup create --name "..." --channel "..." --questions '[...]'` |
| Update a standup (PATCH) | `geekbot standup update <id> --time "09:30"` |
| Delete a standup | `geekbot standup delete <id> --yes` |
| List reports | `geekbot report list --standup-id <id> --limit 10` |
| Submit a report | `geekbot report create --standup-id <id> --answers '{"<qid>":"..."}'` |
| My profile + user ID | `geekbot me show` |
| Create a poll (Slack only) | `geekbot poll create --name "..." --channel "..." --question "..." --choices '[...]'` |
| Search team members | `geekbot team search <query>` (matches username, realname, email) |
| Check auth | `geekbot auth status` |

For full flag details, see `cli-commands.md`.

## External Context Enrichment

The skill becomes dramatically more useful when it can pull data from where
work actually happens. This is **opportunistic** — check what MCP servers
are connected in the current session and use whatever is available. Never
fail or complain if nothing is connected; just fall back to asking the user.

**For report drafting:** Pull the user's recent activity from connected MCP
servers (GitHub, Jira, Calendar, Slack) and use it to pre-populate a draft.
The user reviews and approves instead of writing from scratch.

**For analytics:** Cross-reference standup report data with delivery data
to give richer insights — not just "who posted" but "what was actually shipped."

For entity mapping tables and deduplication strategy, see `reporter-workflows.md`.

**Important boundaries:**
- Always show the user what data you pulled and from where
- Never post a report containing enrichment data without user review
- If an MCP server query fails, skip it silently and move on
- Enrichment provides specifics (PR numbers, ticket IDs); the user's
  voice still drives the narrative

## Intent Routing

Pattern-match on the user's request to pick the right workflow. Don't ask
"are you a manager or a reporter?" — the request itself makes intent clear.
The same person can manage standups and submit reports in one conversation.

**Route to Manager Workflows (§ below) when you see:**
- Creation/config language: "create", "set up", "configure", "schedule",
  "add members", "change the questions", "duplicate", "delete"
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

**When ambiguous**, ask one clarifying question — never more than one.

## Manager Workflows

For detailed multi-step guides, read `manager-workflows.md`.

### Creating a Standup

This is the most common and most complex manager operation.

**If the request is vague** ("set up a standup for my team"), offer templates.
Load `standup-templates.json` and present the 3–4 most relevant options
based on context. Templates provide pre-built questions and sensible schedule
defaults — the user just needs to supply a name and Slack/Teams channel.

**Gathering required fields:**
- `--name` — the standup name (required)
- `--channel` — Slack/Teams channel to post in (required)
- `--questions` — JSON array of question objects (required; from template or custom)
- `--time` — defaults to 10:00 if not specified
- `--timezone` — infer from `geekbot me show` → `data.timezone` if not given
- `--days` — defaults to Mon–Fri
- `--users` — comma-separated user IDs (can add later via `update`)

**Always confirm the full configuration with the user before executing.**
Show: name, channel, questions, schedule, timezone.

**Note:** The CLI sets which days of the week to run but cannot set frequency
(bi-weekly, monthly). For non-weekly schedules, create the standup via CLI
and tell the user to adjust the frequency in the Geekbot web dashboard.

### Editing / Deleting / Other Operations

- **Edit**: Fetch current state with `standup get`, show the user, confirm
  changes, use `standup update` (PATCH). Use `standup replace` only for
  full config replacement.
- **Delete**: Always fetch and show what will be deleted first. Get explicit
  confirmation. Execute with `--yes`.
- **Duplicate**: `geekbot standup duplicate <id> --name "New Name"`
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
`geekbot standup list --member <id> --brief` to find their standups →
`geekbot report list --standup-id <sid> --user-id <id> --after <3 weeks ago> --limit 20` →
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

| Operation | Confirmation required? | What to show |
|-----------|----------------------|--------------|
| CREATE standup/poll | Yes | Full config: name, channel, questions, schedule |
| UPDATE standup | Yes | Current vs proposed (diff) |
| DELETE standup | Yes, always | What will be deleted (name, channel, members) |
| POST report | Yes, always | Complete draft with all answers |
| TRIGGER standup | Yes | Which standup, who it targets |
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
| 4 | Auth failed | Guide user through `geekbot auth setup`. Do not retry. |
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
- **Retrying auth errors** — exit code 4 is never transient. Guide the user
  to `geekbot auth setup` instead.
- **Skipping confirmation for deletes** — always show what will be deleted
  and get explicit approval, even if it feels obvious.
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
