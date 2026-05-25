# geekbot-cli

[![npm version](https://img.shields.io/npm/v/geekbot-cli)](https://www.npmjs.com/package/geekbot-cli)
[![CI](https://github.com/geekbot-com/geekbot-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/geekbot-com/geekbot-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A cross-platform CLI tool for interacting with the [Geekbot](https://geekbot.com) API, designed for AI agents and humans. Built with Bun and TypeScript.

**Why geekbot-cli?**

- **Structured JSON output** on every command -- pipe results into scripts, dashboards, or AI agents
- **Machine-readable exit codes** and actionable error messages -- no guessing what went wrong
- **Secure credential storage** via OS keychain -- no API keys in dotfiles or env scripts
- **AI-agent ready** -- ships as a [Claude Code plugin](#install-as-a-claude-code-plugin-recommended-for-claude-code-users) (also works in [Claude Desktop](#install-in-claude-desktop)), a [Codex CLI plugin](#install-as-a-codex-cli-plugin), a [Gemini CLI extension](#install-as-a-gemini-cli-extension), and a [Vercel Skill](https://github.com/vercel-labs/skills) for Cursor, Windsurf, Copilot, and more

## Table of Contents

- [Installation](#installation)
  - [Install as a Claude Code plugin](#install-as-a-claude-code-plugin-recommended-for-claude-code-users)
  - [Install in Claude Desktop](#install-in-claude-desktop)
  - [Install as a Codex CLI plugin](#install-as-a-codex-cli-plugin)
  - [Install as a Gemini CLI extension](#install-as-a-gemini-cli-extension)
  - [Manual installation](#manual-installation)
- [Authentication](#authentication)
- [Security](#security)
- [Global Options](#global-options)
- [Commands](#commands)
  - [standup](#standup----manage-standups)
  - [report](#report----manage-reports)
  - [poll](#poll----manage-polls-slack-teams-only)
  - [me](#me----view-your-profile-and-teams)
  - [team](#team----view-team-information)
  - [auth](#auth----manage-authentication)
- [Output Format](#output-format)
- [Exit Codes](#exit-codes)
- [Error Handling](#error-handling)
- [Examples](#examples)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) + [npm](https://www.npmjs.com/) (or [Bun](https://bun.sh/) v1.3.5+ if you prefer) — needed to install the `geekbot` binary.

> If you're installing through a Claude Code plugin, Codex plugin, or Gemini extension, **you don't need to do anything manually**. The `/geekbot:geekbot-setup` skill checks for the CLI and runs `npm install -g geekbot-cli` for you; authentication is prompted interactively.

### Install as a Claude Code plugin (recommended for Claude Code users)

Install the plugin from this repo's built-in marketplace — it bundles the CLI skills and a one-shot setup command that installs and authenticates the CLI for you.

```shell
# Inside Claude Code:
/plugin marketplace add geekbot-com/geekbot-cli
/plugin install geekbot@geekbot-cli
/reload-plugins
```

Then run `/geekbot:geekbot-setup`. Claude will:

1. Install the `geekbot` CLI globally via `npm install -g geekbot-cli` (if it isn't on your `$PATH`)
2. Walk you through `geekbot auth login` (OAuth in your browser — no API key paste, token written to your OS keychain). Falls back to `geekbot auth setup --api-key …` if OAuth isn't available.
3. Verify everything and report the final state

The plugin ships three skills:

| Skill | Slash command | What it does |
|---|---|---|
| geekbot-setup | `/geekbot:geekbot-setup` | Install the CLI, authenticate, and verify — end to end |
| geekbot-status | `/geekbot:geekbot-status` | Show CLI version + auth state |
| geekbot-run | auto-invoked | Handles standup / report / poll workflows when you ask in natural language |

The third skill is auto-invoked — no slash command needed. Say *"fetch my standups"*, *"draft my report"*, or *"who hasn't posted today"* and Claude will drive the CLI for you.


### Install in Claude Desktop

Claude Desktop installs plugins directly from the same marketplace used by Claude Code.

**1. Add the marketplace and install the plugin:**

Open **Settings → Extensions → Install from GitHub…** and enter:

```
geekbot-com/geekbot-cli
```

Claude Desktop will fetch the repo, read `.claude-plugin/marketplace.json`, and offer to install the **geekbot** plugin. Restart Claude Desktop when prompted.

**2. Allowlist the Geekbot API domain:**

Claude Desktop runs tool calls inside a per-conversation network sandbox. The `geekbot` CLI talks to `api.geekbot.com`, so you need to allow that host or every call will fail with a network error.

Allowlisting happens in two independent places — **admins and individual users both need to act**:

- **Admin (organization-wide)** — in the Anthropic console, add `api.geekbot.com` to the organization's network allowlist so the domain isn't blocked by policy. Without this, individual user overrides won't help.

- **Individual user (per workspace / per session)** — in Claude Desktop: **Settings → Sandbox → Allowed domains** (or the per-message "Allow network access" prompt), add:

  ```
  api.geekbot.com
  ```

  Apply it to **all conversations** (not just the current one) so you don't re-add it each time.

  > **Cowork sessions specifically:** even when the admin allowlist has `api.geekbot.com`, each participant still sees the per-session network prompt the first time a tool call reaches that host. Accept it (or pre-add it under Allowed domains) for the skill to work on your side. Other participants must do the same for their own turns.

If requests still fail after both steps, check the request path — calls must go directly to `https://api.geekbot.com/...`. Proxy domains and redirects aren't covered by allowlisting just `api.geekbot.com`.

**3. Use it:**

Plugin-provided slash commands and skills only surface in the surfaces that support tool use — in Claude Desktop today that's **cowork sessions** and **code chats**. Regular text chats won't invoke the skill. In a cowork or code chat:

- Say *"fetch my standups"* or *"draft my standup report"* — the auto-invoked `geekbot-run` skill will run `geekbot standup list` (or equivalent) for you.
- The CLI itself is installed inside the sandbox on first use via `/geekbot:geekbot-setup`, which runs `npm install -g geekbot-cli` and walks you through authentication (paste your API key into the sandbox shell, not the conversation).

### Install as a Codex CLI plugin

The repo ships a Codex plugin under `plugins/geekbot/.codex-plugin/` and a marketplace manifest at `.agents/plugins/marketplace.json`.

**Step 1 — register the marketplace (shell command):**

```shell
# From a published GitHub repo:
codex plugin marketplace add geekbot-com/geekbot-cli

# Or from a local checkout (for testing):
codex plugin marketplace add /path/to/geekbot-cli
```

This writes the marketplace into `~/.codex/config.toml`. The Codex `/plugins` TUI doesn't currently expose an "add marketplace" action — use the shell command.

**Step 2 — install the plugin (from the Codex TUI):**

```shell
codex
```

Then inside the session type:

```
/plugins
```

Find **geekbot** under the `geekbot-cli` marketplace and install it.

**Step 3 — use it.** Slash commands like `/geekbot:geekbot-setup` don't surface in Codex (Codex doesn't document skill-based slash commands), so invoke the skills via:

- **Natural language** — *"fetch my standups"*, *"draft my report"*. Codex auto-discovers the `geekbot-run` skill by its description and shells out to the CLI.
- **`@`-mention** — `@geekbot fetch my standups` to force invocation.

For first-time setup, ask in chat:

```
run the geekbot setup
```

— or handle it manually with `npm install -g geekbot-cli` and `geekbot auth login` (browser OAuth), or `geekbot auth setup --api-key <YOUR_KEY>` (API key from https://app.geekbot.com/dashboard/api-webhooks).

**Managing the marketplace:**

```shell
codex plugin marketplace remove geekbot-cli    # uninstall
codex plugin marketplace upgrade geekbot-cli   # refresh (git-backed only)
```

### Install as a Gemini CLI extension

The repo also ships a Gemini CLI extension manifest (`gemini-extension.json`). Gemini auto-discovers the `skills/` directory next to it.

```shell
# Local development / testing against your cloned repo:
cd /path/to/geekbot-cli
gemini extensions link .

# Or scaffold-install from a published extension (once released):
gemini extensions new geekbot --from geekbot-com/geekbot-cli
```

Once linked, the skills become available. Invoke them with natural language (*"fetch my standups"*) — Gemini matches the skill's `description` frontmatter.

> **Note:** Slash commands in Gemini CLI use TOML files under `commands/` (different from Claude Code / Codex). This extension does not ship slash-command TOMLs — install and auth are handled by running the CLI directly (`npm install -g geekbot-cli`, then `geekbot auth login` for browser OAuth or `geekbot auth setup --api-key …` for an API key) and day-to-day workflows are driven by the auto-invoked skill. Ask for it in plain English and Gemini will shell out to `geekbot`.

### Manual installation

If you don't use one of the plugin/extension frameworks above — or want full control — install everything by hand.

#### 1. Install the CLI globally

```shell
# via npm (most common)
npm install -g geekbot-cli

# or via Bun (v1.3.5+)
bun install -g geekbot-cli
```

Either way, the `geekbot` binary lands on your `$PATH`. Verify:

```shell
geekbot --version
```

> **Note:** `npx geekbot-cli` still requires Bun on `$PATH` — the CLI uses a `#!/usr/bin/env bun` shebang, so it is not a Node.js fallback.

#### 2. Authenticate

Browser-based OAuth (recommended):

```shell
geekbot auth login
```

Opens your default browser, you approve in the Geekbot dashboard, and a short-lived `cli_*` token is written to your OS keychain — no API key paste, no shell history. Use `geekbot auth login --no-browser` on headless / WSL / SSH boxes; the CLI will print the authorize URL for you to open manually.

API-key alternative (handy for CI or when OAuth isn't available):

```shell
geekbot auth setup --api-key <YOUR_KEY>
```

Grab the key at https://app.geekbot.com/dashboard/api-webhooks. Either flow stores credentials in your OS keychain — no dotfiles, no plaintext.

#### 3. Register the skill with your AI agents

**Easy path** — use [Vercel Skills](https://github.com/vercel-labs/skills). It auto-detects which agents you have installed and copies the skill files into each:

```shell
npx skills add geekbot-com/geekbot-cli
```

**Finer control** — symlink the skill directory into each agent's skill path. Symlinks mean `npm update -g geekbot-cli` (or `bun update -g geekbot-cli`) propagates to every registered agent automatically, no re-copy:

```shell
# Resolve the global install path (once):
SKILL_SRC="$(npm root -g)/geekbot-cli/skills/geekbot-run"    # npm installs
# For Bun installs, the path differs per platform — check $(bun pm ls -g).

# Claude Code (user-wide)
mkdir -p ~/.claude/skills
ln -sfn "$SKILL_SRC" ~/.claude/skills/geekbot-run

# Universal .agents/skills/ — picked up by Cursor, Codex, Gemini CLI, Windsurf, and more
mkdir -p .agents/skills
ln -sfn "$SKILL_SRC" .agents/skills/geekbot-run

# Windsurf (user-wide)
mkdir -p ~/.codeium/windsurf/skills
ln -sfn "$SKILL_SRC" ~/.codeium/windsurf/skills/geekbot-run

# Roo Code (user-wide)
mkdir -p ~/.roo/skills
ln -sfn "$SKILL_SRC" ~/.roo/skills/geekbot-run
```

> `ln -sfn` forces replace-in-place. Without `-n`, re-running on an existing symlink creates a nested link instead of updating it.

> On Windows or filesystems that don't support symlinks, substitute `cp -r "$SKILL_SRC" <dest>` for each `ln -sfn` line above. You'll need to re-copy after each CLI upgrade.

The skill directory contains `SKILL.md` and its sibling reference files (`cli-commands.md`, `manager-workflows.md`, etc.) — they are loaded by relative path, so the whole directory must be linked as a unit.

#### 4. Verify end-to-end

```shell
geekbot auth status       # authenticated: true
geekbot standup list      # returns your standups
```

Then ask your AI agent in natural language (*"fetch my standups"*) — it should pick up the skill and shell out to the CLI.

### Install from source (for development)

```shell
git clone https://github.com/geekbot-com/geekbot-cli.git
cd geekbot-cli
bun install
bun link
```

### Platform support

| Platform | Status |
|----------|--------|
| macOS (x64, ARM64) | Supported |
| Linux (x64, ARM64) | Supported |
| Windows (x64) | Supported (requires Bun >= 1.3.5) |
| Windows (ARM64) | Not supported (Bun does not yet ship ARM64 Windows binaries) |

## Authentication

The CLI resolves API credentials using a three-level priority chain. The first source found wins:

1. **`--api-key` flag** (highest priority) -- per-command override, useful for scripts and CI
2. **`GEEKBOT_API_KEY` environment variable** -- session or shell-level credential
3. **OS keychain** (lowest priority) -- persistent, secure storage via `geekbot auth login` (OAuth) or `geekbot auth setup` (API key)

### OAuth login (recommended)

```shell
geekbot auth login
```

Runs the OAuth 2.0 authorization-code flow with PKCE: the CLI starts a `127.0.0.1:<port>/callback` loopback listener, opens your default browser at `https://oauth.geekbot.com/v2/authorize?...`, and after you approve in the browser, exchanges the returned code for a short-lived `cli_*` token that is written to your OS keychain — same storage as the API-key flow. No secret is ever pasted into your terminal or shell history.

| Option | Default | Description |
|--------|---------|-------------|
| `--no-browser` | -- | Print the authorize URL instead of trying to launch a browser (useful in WSL, SSH sessions, headless CI, or when piping the URL elsewhere) |
| `--device-name <name>` | hostname | Friendly name shown on the token in the dashboard, so you can revoke it later |
| `--ttl-days <days>` | `30` | CLI token lifetime. Allowed values: `7`, `30`, `90`, `180`, `365` |

Override the OAuth endpoint via `GEEKBOT_OAUTH_BASE_URL` (must be `https://`); defaults to `https://oauth.geekbot.com`.

### API-key setup (alternative)

The CLI uses [`@napi-rs/keyring`](https://github.com/nicola-nicolo/keyring) to store your API key in the platform-native credential store:

- **macOS**: Keychain
- **Windows**: Credential Vault
- **Linux**: Secret Service (GNOME Keyring / KDE Wallet)

Store a key interactively:

```shell
geekbot auth setup
```

Or non-interactively:

```shell
geekbot auth setup --api-key YOUR_API_KEY
```

The setup command validates the key against the Geekbot API before storing it.

### Verify credentials

```shell
geekbot auth status
```

### Remove stored key

```shell
geekbot auth remove
```

## Security

- **API keys are never written to disk in plaintext.** The CLI stores credentials in your OS keychain (macOS Keychain, Windows Credential Vault, or Linux Secret Service). No config files, no dotfiles.
- **Keys passed via `--api-key` or `GEEKBOT_API_KEY` are not logged.**
- **Validate before storing.** `geekbot auth setup` checks that the key is valid against the Geekbot API before persisting it, preventing silent failures from typos or revoked keys.
- **Prefer the keychain over environment variables** for workstations. Environment variables are visible to other processes and may leak into shell history. Use `GEEKBOT_API_KEY` for CI/CD and ephemeral environments where a keychain is unavailable.

## Global Options

These options apply to all commands:

| Option | Description | Default |
|--------|-------------|---------|
| `--api-key <key>` | Geekbot API key (overrides `GEEKBOT_API_KEY` env var) | -- |
| `-v, --version` | Print version number | -- |
| `--help` | Show help text | -- |

## Commands

The CLI follows a noun-verb pattern: `geekbot <resource> <action> [options]`.

### `standup` -- Manage standups

| Subcommand | Syntax | Description |
|------------|--------|-------------|
| `list` | `geekbot standup list [options]` | List standups you participate in |
| `get` | `geekbot standup get <id>` | Get a standup by ID |
| `create` | `geekbot standup create --name <name> --channel <channel> [options]` | Create a new standup |
| `start` | `geekbot standup start <id> [--users <ids>]` | Trigger a standup immediately |

#### `standup list` options

| Option | Default | Description |
|--------|---------|-------------|
| `--state <states>` | -- | Comma-separated subset of `active`, `paused` |
| `--is-anonymous <bool>` | -- | Filter by anonymity (`true`/`false`) |
| `--broadcast-channel <id>` | -- | Restrict to a specific channel id (e.g. `C12345`) |
| `--created-since <date>` | -- | ISO 8601 or `YYYY-MM-DD` (inclusive) |
| `--created-until <date>` | -- | ISO 8601 or `YYYY-MM-DD` (exclusive) |
| `--cursor <token>` | -- | Opaque pagination cursor from a previous response |
| `--page-size <n>` | `25` | Page size (1-100) |
| `--include <fields>` | -- | Comma-separated extras: `questions`, `member_email`, `member_username`, `member_realname` |

#### `standup create` options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--name <name>` | No | `Standup #<broadcast channel>` | Standup name |
| `--channel <channel>` | Yes | -- | Broadcast channel id or name where reports are posted |
| `--sync-channel <channel>` | No | -- | Channel id or name to sync members from (mutually exclusive with `--users`) |
| `--time <time>` | No | `10:00` | Time in HH:MM 24-hour format |
| `--timezone <tz>` | No | `user_local` | IANA timezone |
| `--days <days>` | No | `Mon,Tue,Wed,Thu,Fri` | Comma-separated days |
| `--questions <json>` | Yes | -- | Questions as JSON. `["q1","q2"]` or `[{"text":"q1","choices":["A","B"]}]` |
| `--users <ids>` | No | -- | Comma-separated user IDs (mutually exclusive with `--sync-channel`) |
| `--is-anonymous` | No | `false` | Make responses anonymous |

#### `standup start` options

| Option | Required | Description |
|--------|----------|-------------|
| `--users <ids>` | No | Comma-separated user IDs to trigger (omit to trigger all members) |

The `<id>` argument is the ID of the standup to trigger immediately.

### `report` -- Manage reports

| Subcommand | Syntax | Description |
|------------|--------|-------------|
| `list` | `geekbot report list [options]` | List reports with optional filters |
| `get` | `geekbot report get <id>` | Get a single report by ID |
| `create` | `geekbot report create --standup-id <id> --answers <json>` | Submit a report for a standup |
| `edit` | `geekbot report edit <id> --answers <json>` | Update one or more answers on an existing report |
| `delete` | `geekbot report delete <id> --yes` | Delete a report |

#### `report list` options

| Option | Default | Description |
|--------|---------|-------------|
| `--standup-id <id>` | -- | Filter by standup ID |
| `--user-id <id>` | -- | Filter by Slack user ID (e.g. `U123`) |
| `--before <date>` | -- | Reports before date (maps to v2 `until` — ISO 8601 or unix timestamp) |
| `--after <date>` | -- | Reports after date (maps to v2 `since` — ISO 8601 or unix timestamp) |
| `--page-size <n>` | `25` | Page size (1-100) |
| `--limit <n>` | -- | Page size (1-100, alias for `--page-size`) |
| `--cursor <token>` | -- | Opaque pagination cursor from a previous response |
| `--view <view>` | `full` | Response shape: `summary` (omits answers) or `full` |

#### `report create` options

| Option | Required | Description |
|--------|----------|-------------|
| `--standup-id <id>` | Yes | Standup ID to report on |
| `--answers <json>` | Yes | Answers as JSON object: `{"question_id": "answer", ...}` |

#### `report edit` options

| Option | Required | Description |
|--------|----------|-------------|
| `--answers <json>` | Yes | Answers to update as JSON object: `{"question_id": "new answer"}` |

The `<id>` argument is the ID of the report to edit.

#### `report delete` options

| Option | Description |
|--------|-------------|
| `--yes` | Confirm deletion (required; deletion fails with an error if omitted) |

The `<id>` argument is the ID of the report to delete.

### `poll` -- Manage polls (Slack teams only)

Polls are only available for Slack-connected teams. Non-Slack teams will receive a platform error.

| Subcommand | Syntax | Description |
|------------|--------|-------------|
| `list` | `geekbot poll list` | List all polls |
| `get` | `geekbot poll get <id>` | Get a poll by ID |
| `create` | `geekbot poll create --name <name> --channel <channel> --question <text> --choices <json>` | Create a new poll |
| `votes` | `geekbot poll votes <id> [--after <date>] [--before <date>]` | Get voting results for a poll |

#### `poll list` options

| Option | Default | Description |
|--------|---------|-------------|
| `--state <states>` | -- | Comma-separated subset of `active`, `paused` |
| `--is-anonymous <bool>` | -- | Filter by anonymity (`true`/`false`) |
| `--broadcast-channel <id>` | -- | Restrict to a specific channel id (e.g. `C12345`) |
| `--created-since <date>` | -- | ISO 8601 or `YYYY-MM-DD` (inclusive) |
| `--created-until <date>` | -- | ISO 8601 or `YYYY-MM-DD` (exclusive) |
| `--cursor <token>` | -- | Opaque pagination cursor from a previous response |
| `--page-size <n>` | `25` | Page size (1-100) |
| `--include <fields>` | -- | Comma-separated extras: `questions`, `member_email`, `member_username`, `member_realname` |

#### `poll get` options

| Option | Description |
|--------|-------------|
| `--include <fields>` | Comma-separated extras: `questions`, `member_email`, `member_username`, `member_realname` |

#### `poll create` options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--name <name>` | Yes | -- | Poll name |
| `--channel <channel>` | Yes | -- | Broadcast channel id or name |
| `--question <text>` | Yes | -- | Poll question text |
| `--choices <json>` | Yes | -- | Choices as JSON array of strings (at least 2) |
| `--duration <minutes>` | No | `120` | How long the poll stays open, in minutes |

#### `poll votes` options

| Option | Description |
|--------|-------------|
| `--after <date>` | Votes after date |
| `--before <date>` | Votes before date |

### `me` -- View your profile and teams

| Subcommand | Syntax | Description |
|------------|--------|-------------|
| `show` | `geekbot me show` | Show your Geekbot profile |
| `teams` | `geekbot me teams` | List teams you belong to |

### `team` -- View team information

| Subcommand | Syntax | Description |
|------------|--------|-------------|
| `list` | `geekbot team list` | List all teams with members |

### `auth` -- Manage authentication

| Subcommand | Syntax | Description |
|------------|--------|-------------|
| `login` | `geekbot auth login [--no-browser] [--device-name <name>] [--ttl-days <days>]` | Sign in via OAuth (PKCE + loopback redirect) |
| `setup` | `geekbot auth setup [--api-key <key>]` | Interactively configure and store API key |
| `status` | `geekbot auth status` | Verify stored credentials work |
| `remove` | `geekbot auth remove` | Remove stored API key from OS keychain |

## Output Format

All command output is written to **stdout** as a JSON envelope. Diagnostic messages (Commander.js help/errors) go to **stderr**.

### JSON Envelope

Every response follows this structure:

```typescript
interface OutputEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: ErrorObject | null;
  metadata: MetadataObject;
}
```

### Success Response

```json
{
  "ok": true,
  "data": {
    "id": 123,
    "name": "Daily Standup",
    "channel": "#engineering",
    "time": "10:00",
    "timezone": "America/New_York",
    "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "questions": [
      { "id": 101, "text": "What did you do yesterday?" },
      { "id": 102, "text": "What will you do today?" }
    ]
  },
  "error": null,
  "metadata": {
    "timestamp": "2026-03-17T10:30:00.000Z"
  }
}
```

### Error Response

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
  "metadata": {
    "timestamp": "2026-03-17T10:30:00.000Z"
  }
}
```

## Exit Codes

The CLI uses specific exit codes for programmatic error handling:

| Code | Name | Meaning |
|------|------|---------|
| 0 | `SUCCESS` | Operation completed successfully |
| 1 | `GENERAL` | Unexpected or unclassified error |
| 2 | `USAGE` | Invalid command syntax or missing required options |
| 3 | `NOT_FOUND` | Requested resource does not exist |
| 4 | `AUTH` | Authentication failed (missing or invalid API key) |
| 5 | `FORBIDDEN` | Insufficient permissions for the operation |
| 6 | `VALIDATION` | Input validation failed (bad format, invalid values) |
| 7 | `NETWORK` | Network error (DNS failure, timeout, connection refused) |
| 8 | `CONFLICT` | Resource conflict (duplicate name, concurrent modification) |
| 9 | `API_ERROR` | Geekbot API returned an unexpected error |

## Error Handling

Errors include machine-readable fields designed for programmatic consumption:

```typescript
interface ErrorObject {
  code: string;       // Machine-readable error code (e.g., "standup_not_found")
  message: string;    // Human-readable description
  retryable: boolean; // Whether retrying may succeed (e.g., network errors)
  suggestion: string | null; // Actionable next step
}
```

Key behaviors:

- **Not-found errors suggest alternatives**: When a resource ID is not found, the CLI queries for valid IDs and includes them in the `suggestion` field.
- **Retryable flag**: Network errors and rate limits are marked `retryable: true`. Auth and validation errors are not.
- **Structured output on failure**: Even errors produce a valid JSON envelope on stdout, so parsers never encounter unexpected output.

## Examples

### List standups

```shell
geekbot standup list
```

```json
{
  "ok": true,
  "data": [
    { "id": 123, "name": "Daily Standup", "channel": "#engineering", "time": "10:00", "timezone": "UTC" },
    { "id": 456, "name": "Weekly Sync", "channel": "#team", "time": "09:00", "timezone": "America/New_York" }
  ],
  "error": null,
  "metadata": { "timestamp": "2026-03-17T10:00:00.000Z" }
}
```

### Create a standup

```shell
geekbot standup create \
  --name "Sprint Retro" \
  --channel "#engineering" \
  --time "15:00" \
  --timezone "America/Chicago" \
  --days "Fri" \
  --questions '[{"question": "What went well?"}, {"question": "What could improve?"}]'
```

```json
{
  "ok": true,
  "data": {
    "id": 789,
    "name": "Sprint Retro",
    "channel": "#engineering",
    "time": "15:00",
    "timezone": "America/Chicago",
    "days": ["Fri"]
  },
  "error": null,
  "metadata": {
    "timestamp": "2026-03-17T10:05:00.000Z",
    "operation": "created",
    "undo": null
  }
}
```

### Submit a report

```shell
geekbot report create \
  --standup-id 123 \
  --answers '{"101": "Finished auth module", "102": "Starting API tests"}'
```

```json
{
  "ok": true,
  "data": {
    "id": 5001,
    "standup_id": 123,
    "questions": [
      { "id": 101, "text": "What did you do yesterday?", "answer": "Finished auth module" },
      { "id": 102, "text": "What will you do today?", "answer": "Starting API tests" }
    ]
  },
  "error": null,
  "metadata": { "timestamp": "2026-03-17T10:10:00.000Z" }
}
```

### Handle a not-found error

```shell
geekbot standup get 999
```

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

Exit code: `3` (NOT_FOUND)

### Create a poll (Slack only)

```shell
geekbot poll create \
  --name "Team Lunch" \
  --channel "#general" \
  --question "Where should we eat?" \
  --choices '["Pizza", "Sushi", "Tacos"]'
```

### Use environment variable for auth

```shell
export GEEKBOT_API_KEY=your-api-key
geekbot standup list
```

## Development

### Run tests

```shell
bun test
```

### Lint

```shell
bun run lint
```

### Format

```shell
bun run format
```

### Lint and auto-fix

```shell
bun run check
```

### Pre-commit hook

The repo ships a hook at `.githooks/pre-commit` that runs `bun run lint` and `bunx tsc --noEmit` — the same two gates CI blocks PRs on. Opt in once per clone:

```shell
git config core.hooksPath .githooks
```

To skip the hook for a single commit (avoid as a habit): `git commit --no-verify`.

### Integration tests

Integration tests run against the live Geekbot API and require a valid API key:

```shell
GEEKBOT_INTEGRATION_TEST_API_KEY=your-key bun test:integration
```

Tests are automatically skipped when `GEEKBOT_INTEGRATION_TEST_API_KEY` is not set. Tests that require a Slack channel (`#geekbot-skill-tests`) will gracefully skip with a warning if the channel does not exist in the workspace.

## Contributing

Contributions are welcome! Please open an issue or pull request on [GitHub](https://github.com/geekbot-com/geekbot-cli).

1. Fork the repository
2. Create a feature branch (`git checkout -b my-feature`)
3. Make your changes and add tests
4. Run `bun test` and `bun run lint` to verify
5. Commit and push your branch
6. Open a pull request against `main`

## License

[MIT](LICENSE)
