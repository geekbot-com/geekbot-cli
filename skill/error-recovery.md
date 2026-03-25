# Error Recovery Guide

How to handle CLI failures gracefully. The CLI's structured error responses
make most failures recoverable without user intervention.

## Error Response Structure

Every error produces a valid JSON envelope:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "standup_not_found",
    "message": "Standup 999 not found",
    "retryable": false,
    "suggestion": "Available standups: 123 (Daily Standup), 456 (Weekly Sync). Run `geekbot standup list` to see all."
  },
  "metadata": { "timestamp": "2026-03-17T10:15:00.000Z" }
}
```

The `suggestion` field is the agent's best friend — it contains actionable
recovery instructions, often including valid resource IDs.

## Recovery Behaviors by Exit Code

Exit codes and their meanings are in `SKILL.md`. This section focuses on
**what the agent should do** for each failure type.

### Exit 3: NOT_FOUND — Self-correct from suggestion

This is the most common recoverable error. Parse `error.suggestion` to
extract valid IDs and names, present alternatives to the user, and re-run
with the correct ID. Don't ask the user to find the right ID manually.

### Exit 4: AUTH — Stop and guide, never retry

Auth errors are never transient. Recommend `geekbot auth setup` (OS keychain)
as the simplest path. Also mention `GEEKBOT_API_KEY` env var and `--api-key`
flag as alternatives.

### Exit 5: FORBIDDEN — Check role, explain permissions

Check the user's role via `geekbot me show` → `data.role`. If non-admin,
suggest contacting their team admin. For `standup list --admin`, suggest
trying without `--admin`.

### Exit 6: VALIDATION — Fix input and retry

Show the specific error from `error.message` and help fix it. Common fixes:
- Dates: ISO 8601 (`2026-03-17`) or unix timestamp
- Times: 24-hour `HH:MM`
- Timezone: IANA format (`Europe/Athens`, not `EET`)
- JSON: check for unescaped quotes, missing brackets
- Days: comma-separated, capitalised (`Mon,Tue,Wed`)

### Exit 7: NETWORK — Conditional retry

If `retryable: true`: retry once silently after 2 seconds. If the retry
also fails, report the error. If `retryable: false`: report immediately.

### Exit 8: CONFLICT — Explain and suggest resolution

Typically a duplicate name or concurrent modification. For duplicate names,
suggest a different name. For concurrent modification, re-fetch and retry.

### Exits 1, 2, 9 — Report clearly

Report `error.message` to the user. For exit 2 (usage), check the command
against `cli-commands.md` and rebuild with correct syntax. For exit 9
(API error), suggest checking https://status.geekbot.com/ if persistent.

## General Principles

1. **Always parse JSON** — even errors produce valid envelopes. Don't parse
   stderr or raw text.
2. **Use the suggestion field** — it's there specifically for agent recovery.
3. **Never retry non-retryable errors** — check `error.retryable` first.
4. **Be transparent about retries** — if a network retry also fails, tell
   the user. Don't silently loop.
