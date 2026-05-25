# Geekbot CLI — Command Reference

Agent-optimised reference for the `geekbot` CLI. Every command returns a
JSON envelope: `{ ok, data, error, metadata }`. Always check `ok` first.

## Table of Contents

1. [Standup commands](#standup)
2. [Report commands](#report)
3. [Poll commands](#poll)
4. [Identity commands](#identity)
5. [Auth commands](#auth)
6. [Global options](#global-options)

---

## Standup

### standup list

List standups visible to the authenticated user via `GET /v2/standups`.
Cursor-paginated; each invocation returns one page.

```bash
geekbot standup list                                 # first page (default 25)
geekbot standup list --state active --page-size 50   # only active standups, 50 per page
geekbot standup list --broadcast-channel C0123ABCD   # restrict to a channel id
geekbot standup list --is-anonymous true             # only anonymous standups
geekbot standup list --include questions             # expand questions
geekbot standup list --cursor "<token>"              # next page
```

| Flag | Default | Notes |
|------|---------|-------|
| `--state <states>` | — | Comma-separated subset of `active`, `paused` |
| `--is-anonymous <bool>` | — | `true` or `false` |
| `--broadcast-channel <id>` | — | Specific channel id (e.g. `C12345`) |
| `--created-since <date>` | — | ISO 8601 or `YYYY-MM-DD` (inclusive) |
| `--created-until <date>` | — | ISO 8601 or `YYYY-MM-DD` (exclusive) |
| `--cursor <token>` | — | Opaque pagination cursor from a previous response |
| `--page-size <n>` | `25` | Page size (1-100) |
| `--include <fields>` | — | Comma-separated extras: `questions`, `member_email`, `member_username`, `member_realname` |

Returns: `data` is an array of standup objects, `metadata.next_cursor`
and `metadata.has_more` drive pagination. Each standup includes `id`,
`name`, `state`, `time`, `timezone`, `days`, `broadcast_channel`,
`is_anonymous`, `members`, and (when requested) `questions`. `members`
is an array of `{ id, email?, username?, realname? }` — optional fields
populated via `--include member_email|member_username|member_realname`.

### standup get

Get full details of a standup including questions with their IDs.

```bash
geekbot standup get 123
geekbot standup get 123 --include member_realname,member_username
```

| Flag | Notes |
|------|-------|
| `--include <fields>` | Comma-separated extras: `questions`, `member_email`, `member_username`, `member_realname` |

Returns (v2): `data` includes `id`, `name`, `channel`, `time`, `timezone`,
`days`, `questions` (array of `{ id, text, position, answer_type, choices }`),
`members` (array of `{ id, email?, username?, realname? }` — optional fields
populated by `--include`).

Notes:
- The `text` field replaces v1's `question` field.
- `choices` is always present (empty array for free-text questions, populated
  for multiple-choice questions).
- `answer_type` indicates the response shape (e.g. free-text vs choice).

This is the primary way to discover question IDs for report submission.

### standup create (v2)

Create a new standup via `POST /v2/standups`. Only `--channel` and `--questions`
are required.

```bash
# Minimum: channel + questions (free-text)
geekbot standup create \
  --channel "#engineering" \
  --questions '["What did you do?","Any blockers?"]'

# Full example with explicit member list and schedule
geekbot standup create \
  --name "Sprint Retro" \
  --channel "#engineering" \
  --time "15:00" \
  --timezone "America/Chicago" \
  --days "Fri" \
  --questions '[{"text":"What went well?"},{"text":"What could improve?"}]' \
  --users "U123,U456"

# Multiple-choice question
geekbot standup create \
  --channel C0123456789 \
  --questions '[{"text":"How are you?","choices":["Great","OK","Struggling"]}]'

# Sync members from a different channel + anonymous responses
geekbot standup create \
  --channel "#well-being" \
  --sync-channel "#everyone" \
  --is-anonymous \
  --questions '["How are you feeling this week?"]'
```

| Flag | Required | Default | Notes |
|------|----------|---------|-------|
| `--channel <channel>` | Yes | — | Broadcast channel **id or name** where reports are posted |
| `--questions <json>` | Yes | — | JSON. Strings `["q1","q2"]` or objects `[{"text":"q1","choices":["A","B"]}]` |
| `--name <name>` | No | API picks `"Standup #<broadcast channel>"` | Skill should infer a meaningful name from the questions when the user is vague rather than relying on the API default |
| `--time <HH:MM>` | No | `10:00` | 24-hour format |
| `--timezone <tz>` | No | `user_local` (API resolves) | IANA timezone (e.g. `Europe/Athens`) |
| `--days <days>` | No | `Mon,Tue,Wed,Thu,Fri` | Comma-separated abbreviations |
| `--users <ids>` | No¹ | — | Comma-separated user IDs (Slack-style, e.g. `U123,U456`) |
| `--sync-channel <channel>` | No¹ | — | Sync members from this channel (id or name). **Mutually exclusive with `--users`** |
| `--is-anonymous` | No | `false` | Make all responses anonymous |

¹ Member resolution is non-default: if neither `--users` nor `--sync-channel`
is passed, the API does not auto-populate members. The skill must ask the user
which approach to take rather than calling with neither flag.

**Questions schema:**
- Plain strings → free-text answer
- `{"text": "..."}` → free-text answer (object form)
- `{"text": "...", "choices": ["A","B","C"]}` → multiple-choice answer

**Idempotency:** the CLI auto-generates an `Idempotency-Key` (UUID v4) per
invocation. The API stores the request for **24h** scoped to `{teamId, userId, key}`
with a body hash. HTTP-level retries within the same CLI call reuse the key
and are safe. **Re-running the command produces a new key → a new standup.**
Don't re-run on ambiguous outcomes; list first with `geekbot standup list`.

Returns: `data` is the created standup object. `metadata.undo` is `null`
(the CLI cannot delete standups; use the Geekbot web dashboard).

**Tip:** If you know the user's timezone from `geekbot me show`, pass it
explicitly instead of relying on `user_local`.

**Limitation:** The `--days` flag controls which days of the week the standup
runs, but there is no flag for frequency (bi-weekly, monthly, etc.). For
non-weekly schedules, create via CLI and direct the user to adjust the
frequency in the Geekbot web dashboard.

**Removed in v2:** `--wait-time` is no longer supported.

**Not in the CLI:** updating, replacing, deleting, and duplicating standups
are not exposed by the v2 CLI. Direct the user to the Geekbot web dashboard
for those operations.

### standup start

Trigger a standup immediately (outside its normal schedule).

```bash
geekbot standup start 123
geekbot standup start 123 --users "U123,U456"    # target specific users
```

---

## Report

### report list

List reports with optional filters. All filters are optional.

```bash
# Recent reports for a standup
geekbot report list --standup-id 123 --limit 10

# A specific user's reports
geekbot report list --standup-id 123 --user-id U08LXSA31BJ --limit 5

# Date range
geekbot report list --standup-id 123 --after "2026-03-01" --before "2026-03-15"
```

| Flag | Notes |
|------|-------|
| `--standup-id <id>` | Filter by standup |
| `--user-id <id>` | Filter by user (Slack-style ID like `U08LXSA31BJ`) |
| `--before <date>` | ISO 8601 date or unix timestamp |
| `--after <date>` | ISO 8601 date or unix timestamp |
| `--limit <n>` | Max reports to return |

Returns: `data` is an array of report objects, each containing `id`,
`standup_id`, `questions` (array of `{ id, text, answer }`).

### report create

Submit a report. Answers are keyed by question ID.

```bash
geekbot report create \
  --standup-id 123 \
  --answers '{"101": "Finished auth module", "102": "Starting API tests", "103": "None right now"}'
```

| Flag | Required | Notes |
|------|----------|-------|
| `--standup-id <id>` | Yes | Which standup to report on |
| `--answers <json>` | Yes | JSON object: `{"<question_id>": "<answer>", ...}` |

Get question IDs from `geekbot standup get <standup_id>`.

**Critical**: Never submit a report without explicit user approval.

---

## Poll

Polls are Slack-only. Non-Slack teams will get a platform error.

### poll list

```bash
geekbot poll list
geekbot poll list --include questions
geekbot poll list --include member_email,member_realname
```

| Flag | Notes |
|------|-------|
| `--include <fields>` | Comma-separated extras: `questions`, `member_email`, `member_username`, `member_realname` |

Returns: array of poll objects. `members` is an array of
`{ id, email?, username?, realname? }` — optional fields populated by
`--include`.

### poll get

```bash
geekbot poll get 456
geekbot poll get 456 --include questions,member_realname
```

| Flag | Notes |
|------|-------|
| `--include <fields>` | Comma-separated extras: `questions`, `member_email`, `member_username`, `member_realname` |

Returns: poll details including question and choices. `members` has the same
shape as `poll list`.

### poll create (v2)

Creates a poll via `POST /v2/polls`.

```bash
geekbot poll create \
  --name "Team Lunch" \
  --channel "#general" \
  --question "Where should we eat?" \
  --choices '["Pizza","Sushi","Tacos"]'

# With a 60-minute window
geekbot poll create \
  --name "Quick decision" \
  --channel C0123456789 \
  --question "Ship today?" \
  --choices '["Yes","No"]' \
  --duration 60
```

| Flag | Required | Default | Notes |
|------|----------|---------|-------|
| `--name <name>` | Yes | — | Poll name |
| `--channel <channel>` | Yes | — | Broadcast channel **id or name** |
| `--question <text>` | Yes | — | Single question string |
| `--choices <json>` | Yes | — | JSON array of strings, **at least 2 entries** |
| `--duration <minutes>` | No | `120` | Positive integer; how long the poll stays open |

**Idempotency:** same behavior as `standup create` — UUID auto-generated per
call, 24h API window. Don't re-run on ambiguous outcomes; list first with
`geekbot poll list`.

### poll votes

View voting results for a poll.

```bash
geekbot poll votes 456
geekbot poll votes 456 --after "2026-03-01" --before "2026-03-15"
```

---

## Identity

### me show

Get the authenticated user's profile. Use this to discover the user's ID,
timezone, and admin status.

```bash
geekbot me show
```

Returns:
```json
{
  "id": "U08LXSA31BJ",
  "username": "mitch",
  "realname": "mitch",
  "email": "mitch@geekbot.com",
  "timezone": "Europe/Athens",
  "is_admin": true,
  "role": "admin"
}
```

The `id` field is a Slack-style user ID — use it for `--user-id` filters
and `--users` member lists.

The `timezone` field is an IANA timezone — use it as a default for standup
creation when the user doesn't specify one.

### me teams

List teams the user belongs to.

```bash
geekbot me teams
```

### team list

List all teams with their members.

```bash
geekbot team list
```

### team search

Search team members by name, username, or email. Case-insensitive
substring match across all three fields.

```bash
geekbot team search jenny                 # match by username or realname
geekbot team search "Smith"               # match by realname
geekbot team search @example.com          # match by email domain
```

Returns: `data` is an array of matching user objects with `id`, `role`,
`email`, `username`, `realname`, `profile_img`. Use the `id` field as
the `--user-id` value for `report list`.

---

## Auth

### auth setup

Configure and store the API key. Validates against the Geekbot API.

```bash
geekbot auth setup                        # interactive prompt
geekbot --api-key YOUR_KEY auth setup     # non-interactive
```

### auth status

Verify stored credentials work.

```bash
geekbot auth status
```

Returns `ok: true` if auth is valid.

### auth remove

Remove stored API key from OS keychain.

```bash
geekbot auth remove
```

---

## Global Options

Apply to all commands:

| Flag | Default | Notes |
|------|---------|-------|
| `--api-key <key>` | — | Override env var and keychain |
| `-v, --version` | — | Print version |
| `--help` | — | Show help text |

## Exit Codes

See the error handling table in `SKILL.md` for exit codes and agent actions.
For detailed recovery flows, see `error-recovery.md`.
