---
name: geekbot-status
description: Report the install + auth state of the geekbot CLI. Safe for Claude to invoke proactively before running Geekbot actions.
allowed-tools: Bash
---

# Geekbot — Status

Goal: emit a compact health check for the CLI. Useful both as a user-triggered `/geekbot:geekbot-status` and as a pre-flight check before any action skill that shells out to `geekbot`.

## Steps

1. Locate the binary:

   ```bash
   command -v geekbot
   ```

2. Run the shared health check (emits JSON with `cli_version`, `plugin_version`, `required_cli`, and on failure an `error` + `suggestion`):

   ```bash
   bash "$(dirname of this skill)/../geekbot-run/check-cli.sh"
   ```

   (Resolve the path relative to this skill's directory — `geekbot-run` is a sibling skill.)

3. If auth needs detail beyond the check's yes/no, capture it:

   ```bash
   geekbot auth status
   ```

## Output

A single compact markdown table. Report only what was checked — no "next step" row.

| Check | Value |
|---|---|
| Binary | `/home/user/.nvm/versions/node/vX/bin/geekbot` |
| Version | `2.0.0` |
| Plugin | `0.4.0` (requires CLI >= `2.0.0`) |
| Authenticated | yes (sabpap@geekbot.com) |

- `Version` is `cli_version`; `Plugin` combines `plugin_version` and `required_cli`.
- If `plugin_version` is empty (skills installed standalone, no plugin manifest), omit the Plugin row.
- If the binary is missing, show `Binary: not installed` and leave the other rows blank.
- If the binary exists but auth is missing, show `Authenticated: no`.
- If the check reports `cli_outdated`, show the installed version in `Version` and mark it, e.g. `1.2.0` (outdated — plugin requires >= `2.0.0`).

Keep it to the table — no prose about remediation, except the outdated case below.

## Failure recovery (only when status or an action skill fails)

This guidance applies when `/geekbot:geekbot-status`, the main action skill, or any geekbot-dependent flow hits a blocker — **not** as part of the status table itself.

- Binary missing → recommend running `/geekbot:geekbot-setup`.
- Auth missing or invalid → recommend running `/geekbot:geekbot-setup`.
- `cli_outdated` → prompt the user to update, e.g. *"The installed geekbot CLI (1.2.0) is older than this plugin requires (2.0.0). Run `npm install -g geekbot-cli@latest` to update."* Offer to run the update for them.

Surface the recommendation as a short follow-up line after the failure, e.g. *"Run `/geekbot:geekbot-setup` to install and authenticate the CLI."*
