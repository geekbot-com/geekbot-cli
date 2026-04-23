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

List standups the authenticated user participates in, with optional
client-side filtering and a brief output mode.

```bash
geekbot standup list                            # all your standups
geekbot standup list --admin                    # all team standups (admin only)
geekbot standup list --brief                    # compact: id, name, channel only
geekbot standup list --brief --limit 10         # first 10, compact
geekbot standup list --name "daily"             # filter by name (case-insensitive substring)
geekbot standup list --channel "#status"        # filter by channel (case-insensitive substring)
geekbot standup list --mine                     # only standups you are a member of
geekbot standup list --member "UHNM44125"       # only standups a specific user is in
geekbot standup list --mine --brief             # combine filters
```

| Flag | Default | Notes |
|------|---------|-------|
| `--admin` | `false` | Include all team standups (admin only) |
| `--brief` | `false` | Return only `id`, `name`, `channel` |
| `--limit <n>` | — | Cap results to first N standups (applied after filters) |
| `--name <name>` | — | Case-insensitive substring filter on standup name |
| `--channel <channel>` | — | Case-insensitive substring filter on channel name |
| `--mine` | `false` | Filter to standups where you appear in the members list |
| `--member <id>` | — | Filter to standups where the given user ID is a member |

**Note:** `--name`, `--channel`, `--mine`, `--member`, and `--limit` are
client-side filters applied after fetching. `--mine` makes one extra API call
(`GET /v1/me`) to resolve your user ID.

Returns: `data` is an array of standup objects. With `--brief`, each object
contains only `id`, `name`, `channel`. Without `--brief`, full standup
objects with `questions`, `users`, and all fields.

### standup get

Get full details of a standup including questions with their IDs.

```bash
geekbot standup get 123
```

Returns: `data` includes `id`, `name`, `channel`, `time`, `timezone`, `days`,
`questions` (array of `{ id, text }`), member info.

This is the primary way to discover question IDs for report submission.

### standup create

Create a new standup. Name and channel are required.

```bash
geekbot standup create \
  --name "Sprint Retro" \
  --channel "#engineering" \
  --time "15:00" \
  --timezone "America/Chicago" \
  --days "Fri" \
  --questions '[{"text": "What went well?"}, {"text": "What could improve?"}]' \
  --users "U123,U456" \
  --wait-time 0
```

| Flag | Required | Default | Notes |
|------|----------|---------|-------|
| `--name <name>` | Yes | — | Standup name |
| `--channel <channel>` | Yes | — | Slack/Teams channel name |
| `--time <HH:MM>` | No | `10:00` | 24-hour format |
| `--timezone <tz>` | No | `UTC` | IANA timezone (e.g. `Europe/Athens`) |
| `--days <days>` | No | `Mon,Tue,Wed,Thu,Fri` | Comma-separated |
| `--questions <json>` | Yes | — | JSON array: `[{"text": "..."},...]` |
| `--users <ids>` | No | — | Comma-separated user IDs |
| `--wait-time <min>` | No | `0` | Minutes between users |

Returns: `data` is the created standup object. `metadata` includes an
`undo` field with the delete command.

**Tip**: If you know the user's timezone from `geekbot me show`, use it
as the default instead of UTC.

**Limitation**: The `--days` flag controls which days of the week the standup
runs, but there is no flag for frequency (bi-weekly, monthly, etc.). For
non-weekly schedules, create the standup via CLI and direct the user to
adjust the frequency in the Geekbot web dashboard.

### standup update (PATCH)

Partially update a standup. Only pass the flags you want to change.

```bash
geekbot standup update 123 --time "09:30" --days "Mon,Wed,Fri"
geekbot standup update 123 --users "U123,U456,U789"
geekbot standup update 123 --questions '["What did you do?","Any blockers?"]'
```

| Flag | Notes |
|------|-------|
| `--name <name>` | New standup name |
| `--channel <channel>` | New channel |
| `--time <HH:MM>` | New time |
| `--timezone <tz>` | New timezone |
| `--days <days>` | New days (replaces all) |
| `--questions <json>` | New questions (replaces all) |
| `--wait-time <min>` | New wait time |
| `--users <ids>` | New member list (replaces all) |

**Important**: `--users` replaces the entire member list. To add a member,
fetch the current list first, append the new ID, and send the full list.

### standup replace (PUT)

Full replacement of a standup. Name and channel are required; everything
else uses create defaults if omitted.

```bash
geekbot standup replace 123 \
  --name "New Name" \
  --channel "#new-channel" \
  --time "11:00" \
  --timezone "UTC"
```

Use `replace` only when you want to reset the entire config. Prefer
`update` for partial changes.

### standup delete

Delete a standup permanently. Always pass `--yes` in agent context.

```bash
geekbot standup delete 123 --yes
```

The skill should confirm with the user conversationally before executing.

### standup duplicate

Clone an existing standup with a new name.

```bash
geekbot standup duplicate 123 --name "Backend Daily v2"
```

Returns: the new standup object with a new ID.

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
```

Returns: array of poll objects.

### poll get

```bash
geekbot poll get 456
```

Returns: poll details including question and choices.

### poll create

```bash
geekbot poll create \
  --name "Team Lunch" \
  --channel "#general" \
  --question "Where should we eat?" \
  --choices '["Pizza", "Sushi", "Tacos"]'
```

| Flag | Required |
|------|----------|
| `--name <name>` | Yes |
| `--channel <channel>` | Yes |
| `--question <text>` | Yes |
| `--choices <json>` | Yes — JSON array of strings |

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
| `--output <format>` | `json` | Only `json` currently supported |
| `--debug` | `false` | Debug output on stderr |
| `-v, --version` | — | Print version |
| `--help` | — | Show help text |

## Exit Codes

See the error handling table in `SKILL.md` for exit codes and agent actions.
For detailed recovery flows, see `error-recovery.md`.
