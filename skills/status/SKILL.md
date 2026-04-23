---
name: status
description: Report the install + auth state of the geekbot CLI. Safe for Claude to invoke proactively before running Geekbot actions.
allowed-tools: Bash
---

# Geekbot — Status

Goal: emit a compact health check for the CLI. Useful both as a user-triggered `/geekbot:status` and as a pre-flight check before any action skill that shells out to `geekbot`.

## Steps

1. Locate the binary:

   ```bash
   command -v geekbot
   ```

2. If found, capture its version:

   ```bash
   geekbot --version
   ```

3. Check auth state (JSON):

   ```bash
   geekbot auth status
   ```

## Output

A single compact markdown table. Report only what was checked — no "next step" row.

| Check | Value |
|---|---|
| Binary | `/home/user/.nvm/versions/node/vX/bin/geekbot` |
| Version | `0.2.4` |
| Authenticated | yes (sabpap@geekbot.com) |

If the binary is missing, show `Binary: not installed` and leave Version/Authenticated blank.
If the binary exists but auth is missing, show `Authenticated: no`.

Keep it to the table — no prose about remediation.

## Failure recovery (only when status or an action skill fails)

This guidance applies when `/geekbot:status`, the main action skill, or any geekbot-dependent flow hits a blocker — **not** as part of the status table itself.

- Binary missing → recommend running `/geekbot:setup`.
- Auth missing or invalid → recommend running `/geekbot:setup`.

Surface the recommendation as a short follow-up line after the failure, e.g. *"Run `/geekbot:setup` to install and authenticate the CLI."*
