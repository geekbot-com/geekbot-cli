# geekbot-cli

A cross-platform CLI tool for interacting with the Geekbot API, designed for AI agents and humans. Built with Bun and TypeScript.

Manage standups, reports, polls, teams, and user profiles programmatically with structured JSON output, machine-readable exit codes, and actionable error messages.

## Installation

### Prerequisites

- [Bun](https://bun.sh/) runtime (v1.3.5 or later)

### Install via npm

```shell
npm install -g geekbot-cli
```

This installs the `geekbot` binary globally. The postinstall script checks for Bun and prints a hint about skill registration.

> **Note:** `npx geekbot-cli` also requires Bun on PATH — the CLI uses a `#!/usr/bin/env bun` shebang, so it is not a Node.js fallback.

Verify the installation:

```shell
geekbot --version
# 0.2.0
```

### Register the AI agent skill

To register the Geekbot skill with your AI coding agents (Claude Code, Cursor, Windsurf, Copilot, etc.):

```shell
npx skills add geekbot-com/geekbot-cli
```

This uses the [Vercel Skills](https://github.com/vercel-labs/skills) ecosystem to detect installed agents and register the skill with all of them.

<details>
<summary>Manual skill installation (without npx skills)</summary>

If you prefer not to use `npx skills`, copy the `skills/geekbot/` directory into your agent's skill directory:

```shell
# Claude Code
cp -r node_modules/geekbot-cli/skills/geekbot ~/.claude/skills/geekbot

# Universal (.agents/skills/ — works with Cursor, Codex, Gemini CLI, etc.)
mkdir -p .agents/skills
cp -r node_modules/geekbot-cli/skills/geekbot .agents/skills/geekbot

# Windsurf
cp -r node_modules/geekbot-cli/skills/geekbot ~/.codeium/windsurf/skills/geekbot

# Roo Code
cp -r node_modules/geekbot-cli/skills/geekbot ~/.roo/skills/geekbot
```

The skill directory must contain `SKILL.md` and its sibling reference files (`cli-commands.md`, `manager-workflows.md`, etc.) — they are loaded by relative path.

</details>

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
3. **OS keychain** (lowest priority) -- persistent, secure storage via `geekbot auth setup`

### OS Keychain Storage

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

## Global Options

These options apply to all commands:

| Option | Description | Default |
|--------|-------------|---------|
| `--api-key <key>` | Geekbot API key (overrides `GEEKBOT_API_KEY` env var) | -- |
| `--output <format>` | Output format (`json` only) | `json` |
| `--debug` | Show debug output on stderr | `false` |
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
| `update` | `geekbot standup update <id> [options]` | Partially update a standup (PATCH) |
| `replace` | `geekbot standup replace <id> --name <name> --channel <channel> [options]` | Fully replace a standup (PUT) |
| `delete` | `geekbot standup delete <id> --yes` | Delete a standup |
| `duplicate` | `geekbot standup duplicate <id> --name <name>` | Duplicate an existing standup |
| `start` | `geekbot standup start <id> [--users <ids>]` | Trigger a standup immediately |

#### `standup list` options

| Option | Default | Description |
|--------|---------|-------------|
| `--admin` | `false` | Include all team standups (admin only) |
| `--brief` | `false` | Return only id, name, channel, time, timezone, days |
| `--name <name>` | -- | Filter by name (case-insensitive substring match) |
| `--channel <channel>` | -- | Filter by channel (case-insensitive substring match) |
| `--mine` | `false` | Show only standups you are a member of |

#### `standup create` options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--name <name>` | Yes | -- | Standup name |
| `--channel <channel>` | Yes | -- | Slack channel name |
| `--time <time>` | No | `10:00` | Time in HH:MM 24-hour format |
| `--timezone <tz>` | No | `UTC` | IANA timezone |
| `--days <days>` | No | `Mon,Tue,Wed,Thu,Fri` | Comma-separated days |
| `--questions <json>` | Yes | -- | Questions as JSON array |
| `--users <ids>` | No | -- | Comma-separated user IDs |
| `--wait-time <minutes>` | No | `0` | Minutes between users |

#### `standup update` options

| Option | Required | Description |
|--------|----------|-------------|
| `--name <name>` | No | New standup name |
| `--channel <channel>` | No | New channel |
| `--time <time>` | No | New time (HH:MM) |
| `--timezone <tz>` | No | New timezone |
| `--days <days>` | No | New days (comma-separated) |
| `--wait-time <minutes>` | No | New wait time in minutes |

#### `standup replace` options

Same options as `create`. `--name` and `--channel` are required; all other options have the same defaults as `create`.

#### `standup delete` options

| Option | Description |
|--------|-------------|
| `--yes` | Confirm deletion (required; deletion fails with an error if omitted) |

### `report` -- Manage reports

| Subcommand | Syntax | Description |
|------------|--------|-------------|
| `list` | `geekbot report list [options]` | List reports with optional filters |
| `create` | `geekbot report create --standup-id <id> --answers <json>` | Submit a report for a standup |

#### `report list` options

| Option | Description |
|--------|-------------|
| `--standup-id <id>` | Filter by standup ID |
| `--user-id <id>` | Filter by user ID |
| `--before <date>` | Reports before date (ISO 8601 or unix timestamp) |
| `--after <date>` | Reports after date (ISO 8601 or unix timestamp) |
| `--limit <n>` | Max number of reports to return |

#### `report create` options

| Option | Required | Description |
|--------|----------|-------------|
| `--standup-id <id>` | Yes | Standup ID to report on |
| `--answers <json>` | Yes | Answers as JSON object: `{"question_id": "answer", ...}` |

### `poll` -- Manage polls (Slack teams only)

Polls are only available for Slack-connected teams. Non-Slack teams will receive a platform error.

| Subcommand | Syntax | Description |
|------------|--------|-------------|
| `list` | `geekbot poll list` | List all polls |
| `get` | `geekbot poll get <id>` | Get a poll by ID |
| `create` | `geekbot poll create --name <name> --channel <channel> --question <text> --choices <json>` | Create a new poll |
| `votes` | `geekbot poll votes <id> [--after <date>] [--before <date>]` | Get voting results for a poll |

#### `poll create` options

| Option | Required | Description |
|--------|----------|-------------|
| `--name <name>` | Yes | Poll name |
| `--channel <channel>` | Yes | Slack channel |
| `--question <text>` | Yes | Poll question text |
| `--choices <json>` | Yes | Choices as JSON array of strings |

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
| `setup` | `geekbot auth setup [--api-key <key>]` | Interactively configure and store API key |
| `status` | `geekbot auth status` | Verify stored credentials work |
| `remove` | `geekbot auth remove` | Remove stored API key from OS keychain |

## Output Format

All command output is written to **stdout** as a JSON envelope. Diagnostic messages (debug output, Commander.js help/errors) go to **stderr**.

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
geekbot standup list --output json
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
    "undo": "geekbot standup delete 789 --yes"
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

### Integration tests

Integration tests run against the live Geekbot API and require a valid API key:

```shell
GEEKBOT_INTEGRATION_TEST_API_KEY=your-key bun test:integration
```

Tests are automatically skipped when `GEEKBOT_INTEGRATION_TEST_API_KEY` is not set. Tests that require a Slack channel (`#geekbot-skill-tests`) will gracefully skip with a warning if the channel does not exist in the workspace.

## License

See LICENSE.
