# geekbot-cli

[![npm version](https://img.shields.io/npm/v/geekbot-cli)](https://www.npmjs.com/package/geekbot-cli)
[![CI](https://github.com/geekbot-com/geekbot-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/geekbot-com/geekbot-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Geekbot](https://geekbot.com) runs asynchronous standups, check-ins, and polls in Slack and Microsoft Teams. This CLI lets you run them straight from your AI coding agent — or the terminal.

Every command returns structured JSON with machine-readable exit codes, credentials live in your OS keychain (never in dotfiles), and it works wherever your agent does — Claude Code, Claude Desktop, Codex CLI, Gemini CLI, and any Agent Skills tool (Cursor, Windsurf, Copilot, …).

## 🚀 Quick Start

Two steps, then you're talking to Geekbot in plain English.

### Step 1 — Add Geekbot to your agent

Pick your tool:

<details open>
<summary><b>Claude Code</b></summary>

```shell
# Inside Claude Code:
/plugin marketplace add geekbot-com/geekbot-cli
/plugin install geekbot@geekbot-cli
/reload-plugins
```
</details>

<details>
<summary><b>Claude Desktop</b></summary>

1. **Settings → Extensions → Install from GitHub…** and enter `geekbot-com/geekbot-cli`, then restart when prompted.
2. **Allowlist the API domain.** Claude Desktop sandboxes network access, so add `api.geekbot.com` under **Settings → Sandbox → Allowed domains** and apply it to *all conversations*. (Org admins must also allow it in the Anthropic console.)

> Skills only run in surfaces that support tools — today that's **cowork sessions** and **code chats**, not regular text chats.
</details>

<details>
<summary><b>Codex CLI</b></summary>

```shell
# Register the marketplace (shell):
codex plugin marketplace add geekbot-com/geekbot-cli
```

Then start `codex`, open `/plugins`, find **geekbot** under the `geekbot-cli` marketplace, and install it.
</details>

<details>
<summary><b>Gemini CLI</b></summary>

```shell
gemini extensions new geekbot --from geekbot-com/geekbot-cli
```
</details>

<details>
<summary><b>Cursor, Windsurf, Copilot & 60+ other agents</b></summary>

These tools don't use plugins — they support the open **Agent Skills** convention (a `SKILL.md` file the agent auto-discovers). Install the Geekbot skill into all of them at once with [Vercel Skills](https://github.com/vercel-labs/skills), which detects your installed agents and copies (or symlinks) the skill into each one's `skills/` directory:

```shell
npx skills add geekbot-com/geekbot-cli
```

This covers Cursor, Windsurf, GitHub Copilot, Cline, Roo Code, Zed, and [dozens more](https://github.com/vercel-labs/skills#supported-agents).
</details>

### Step 2 — Ask your agent to set up Geekbot

Just say it in plain English:

> **"Set up Geekbot."**

Your agent will:

1. **Install the `geekbot` CLI** (`npm install -g geekbot-cli`) if it isn't already on your `$PATH`.
2. **Log you in** — browser-based OAuth, no API key to paste. The token is stored securely in your OS keychain.
3. **Verify everything** and report back.

That's it. Now just ask for what you want:

> *"Fetch my standups."*
> *"Draft my standup report for today."*
> *"Who hasn't posted in the daily standup?"*
> *"Create a poll asking the team where to go for lunch."*

---

### Not using an AI agent?

You can drive the CLI directly. See [Manual installation](#manual-installation) below.

```shell
npm install -g geekbot-cli   # install
geekbot auth login           # browser OAuth (or: geekbot auth setup --api-key <KEY>)
geekbot standup list         # structured JSON on stdout
```

---

### Keeping Geekbot up to date

Plugin updates are **pull-based** — when a new version ships, your agent won't pick it up on its own (auto-update is off by default for third-party marketplaces). Refresh it yourself:

<details open>
<summary><b>Claude Code</b></summary>

```shell
# Inside Claude Code:
/plugin marketplace update geekbot-cli
/reload-plugins
```

Or turn on auto-update once: run `/plugin` → **Marketplaces** → select `geekbot-cli` → **Enable auto-update**. Claude Code then refreshes after each session starts.
</details>

<details>
<summary><b>Codex CLI</b></summary>

```shell
# Refresh the marketplace snapshot, then re-install to pick up the new version:
codex plugin marketplace upgrade geekbot-cli
codex plugin add geekbot@geekbot-cli
```
</details>

> The `geekbot` CLI binary updates independently of the plugin: `npm install -g geekbot-cli@latest` (or `bun install -g geekbot-cli`).

---

## 🛠️ Commands

The CLI follows a `geekbot <resource> <action> [options]` pattern. Run `geekbot <resource> <action> --help` for the full option list on any command. It wraps the Geekbot API — see [developers.geekbot.com](https://developers.geekbot.com) for the underlying endpoints and full data shapes.

| Resource | Actions | What it does |
|----------|---------|--------------|
| `standup` | `list` · `get <id>` · `participation <id>` · `create` · `start <id>` | List, inspect, create, trigger standups, or read participation |
| `report` | `list` · `get <id>` · `create` · `edit <id>` · `delete <id>` | Read and submit standup reports |
| `poll` | `list` · `get <id>` · `votes <id>` · `participation <id>` · `create` | Manage polls, read results and response rate *(Slack teams only)* |
| `me` | `show` · `teams` | Show your profile or the teams you belong to |
| `team` | `list` | List teams with their members |
| `auth` | `login` · `setup` · `status` · `remove` | Manage authentication (see below) |

A few common examples:

```shell
geekbot standup list
geekbot standup create --name "Sprint Retro" --channel "#engineering" \
  --questions '["What went well?","What could improve?"]'
geekbot standup participation 123 --since 2026-01-01 --until 2026-02-01
geekbot report create --standup-id 123 --answers '{"101":"Shipped auth","102":"Writing tests"}'
geekbot poll create --name "Lunch" --channel "#general" \
  --question "Where to?" --choices '["Pizza","Sushi","Tacos"]'
geekbot poll participation 456
```

## 🔑 Authentication

The CLI resolves credentials from the first source it finds, in this order:

1. **`--api-key <key>`** — per-command override, handy for scripts and CI
2. **`GEEKBOT_API_KEY`** environment variable — session/shell-level credential
3. **OS keychain** — persistent, secure storage written by `geekbot auth login` or `geekbot auth setup`

**OAuth (`geekbot auth login`) is the preferred way to sign in** — a quick browser approval that stores a short-lived, revocable token in your OS keychain and never exposes a secret in your terminal. The API key is an alternative for cases where OAuth isn't an option, such as CI or headless environments.

### OAuth login (recommended)

```shell
geekbot auth login
```

Runs the OAuth 2.0 authorization-code flow with PKCE: opens your browser, you approve in the Geekbot dashboard, and a short-lived `cli_*` token is written to your OS keychain — nothing is pasted into your terminal or shell history.

| Option | Default | Description |
|--------|---------|-------------|
| `--no-browser` | — | Print the authorize URL instead of launching a browser (use on WSL, SSH, or headless boxes) |
| `--device-name <name>` | hostname | Friendly name shown on the token in the dashboard, so you can revoke it later |
| `--ttl-days <days>` | `30` | Token lifetime. Allowed: `7`, `30`, `90`, `180`, `365` |

### API-key setup (alternative)

Handy for CI or where OAuth isn't available. Grab a key at <https://app.geekbot.com/dashboard/api-webhooks>.

```shell
geekbot auth setup --api-key <YOUR_KEY>   # or run `geekbot auth setup` to enter it interactively
```

The key is validated against the API before being stored in your OS keychain (macOS Keychain, Windows Credential Vault, or Linux Secret Service) — never on disk in plaintext.

### Manage credentials

```shell
geekbot auth status     # verify stored credentials work
geekbot auth remove     # delete the stored key from the keychain
```

## 🔒 Privacy

- **The CLI talks only to Geekbot.** Network requests go to `api.geekbot.com` (and `oauth.geekbot.com` during login).
- **Credentials never leave your machine** except to authenticate with Geekbot.
- **Command output is your team's data** — standups, reports, poll votes. When you run the CLI through an AI agent, that output enters the agent's context and may be sent to the model provider. Keep that in mind for anything sensitive.

## 📦 Output format

Every command writes a JSON envelope to **stdout**; diagnostics (help, parse errors) go to **stderr**.

```json
{
  "ok": true,
  "data": { "id": 123, "name": "Daily Standup", "channel": "#engineering" },
  "error": null,
  "metadata": { "timestamp": "2026-03-17T10:30:00.000Z" }
}
```

On failure, `ok` is `false` and `error` carries machine-readable fields — including a `retryable` flag and an actionable `suggestion`:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "standup_not_found",
    "message": "Standup 999 not found",
    "retryable": false,
    "suggestion": "Run `geekbot standup list` to see available standups."
  },
  "metadata": { "timestamp": "2026-03-17T10:30:00.000Z" }
}
```

Each error class maps to a distinct exit code, so scripts can branch without parsing text:

| Code | Name | Meaning |
|------|------|---------|
| 0 | `SUCCESS` | Completed successfully |
| 1 | `GENERAL` | Unexpected / unclassified error |
| 2 | `USAGE` | Invalid syntax or missing required options |
| 3 | `NOT_FOUND` | Resource does not exist |
| 4 | `AUTH` | Authentication failed (missing or invalid key) |
| 5 | `FORBIDDEN` | Insufficient permissions |
| 6 | `VALIDATION` | Input validation failed |
| 7 | `NETWORK` | Network error (DNS, timeout, connection refused) |
| 8 | `CONFLICT` | Resource conflict (duplicate, concurrent change) |
| 9 | `API_ERROR` | Geekbot API returned an unexpected error |

## 🩺 Troubleshooting

| Symptom | Fix |
|---------|-----|
| **`geekbot: command not found`** after install | The global bin isn't on your `$PATH`. Reopen your shell, or check `npm bin -g` / `bun pm bin -g` and add it to `$PATH`. |
| **`npx geekbot-cli` fails** with a shebang/`bun` error | The CLI uses a `#!/usr/bin/env bun` shebang — `npx` is *not* a Node fallback. Install globally (`npm install -g geekbot-cli`) and run `geekbot`, or put Bun ≥ 1.3.5 on your `$PATH`. |
| **Browser doesn't open on `auth login`** (WSL, SSH, headless) | Run `geekbot auth login --no-browser` and open the printed URL manually. |
| **Calls fail in Claude Desktop** with a network error | Allowlist `api.geekbot.com` under **Settings → Sandbox → Allowed domains** (apply to all conversations). Org admins must also allow it in the Anthropic console. |
| **`auth status` reports not authenticated** | Re-run `geekbot auth login`, or confirm `GEEKBOT_API_KEY` isn't set to a stale value (env vars override the keychain). |

## 💬 What you can ask for

New to Geekbot, or not sure what's possible? Once it's set up, here are the kinds of things you can ask your agent in plain English — it picks the right commands for you.

**Standups** — recurring async check-ins where teammates answer a few questions on a schedule.
- *"What standups am I in?"*
- *"Set up a daily standup for #engineering at 10am asking what people did yesterday and what's planned today."*
- *"Trigger the daily standup now."*

**Reports** — the answers people submit to a standup.
- *"Draft my standup report for today."*
- *"Did everyone post in today's standup? Who's missing?"*
- *"Summarize this week's reports — what are the blockers?"*

**Polls** *(Slack teams only)* — quick team votes.
- *"Create a poll asking where we should go for the team lunch."*
- *"Show me the results of the lunch poll."*

**Team & profile**
- *"Who's on my team?"*
- *"Show my Geekbot profile."*

## 🤝 Contributing

Contributions are welcome! To get set up:

```shell
git clone https://github.com/geekbot-com/geekbot-cli.git
cd geekbot-cli
bun install
bun test          # run the suite
bun run check     # lint + format
```

Then:

1. Fork the repo and create a feature branch (`git checkout -b my-feature`).
2. Make your changes and add tests.
3. Run `bun test` and `bun run check` to verify.
4. Open a pull request against `main`.

Found a bug or have an idea? [Open an issue](https://github.com/geekbot-com/geekbot-cli/issues).

Maintainers: see [RELEASING.md](RELEASING.md) for how the npm CLI and the agent plugin are versioned and published — they're two separate release lines.

## 📄 License

[MIT](LICENSE) © Geekbot
