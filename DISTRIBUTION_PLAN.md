# Distribution Plan: npm + Vercel Skills Ecosystem

> How geekbot-cli will be distributed via npm with skill registration delegated to the [Vercel Skills](https://github.com/vercel-labs/skills) ecosystem.

---

## Overview

```
npm install -g geekbot-cli               →  CLI binary on PATH (checks for Bun)
npx skills add geekbot-com/geekbot-cli    →  skill registered with all detected AI agents
```

Two commands, two concerns. `npm install` handles the CLI binary and runtime check. `npx skills add` handles skill registration with **44+ AI coding agents** — universal and non-universal — using the ecosystem's standard tooling. No custom agent detection code to maintain.

---

## 1. Package Changes

### package.json

```jsonc
{
  "name": "geekbot-cli",
  "version": "0.1.0",
  "type": "module",
  // Remove "private": true
  "bin": {
    "geekbot": "./src/cli/index.ts"
  },
  "files": [
    "src/",
    "skills/",
    "scripts/"
  ],
  "scripts": {
    "postinstall": "node scripts/postinstall.mjs",
    "dev": "bun run src/cli/index.ts",
    "test": "bun test",
    "test:integration": "bun test tests/integration/",
    "lint": "bunx biome check .",
    "format": "bunx biome format --write .",
    "check": "bunx biome check --write ."
  },
  "dependencies": {
    "@napi-rs/keyring": "^1.2.0",
    "commander": "^14.0.3",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.7",
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  },
  "publishConfig": {
    "access": "public"
  },
  "keywords": ["geekbot", "standup", "cli", "ai-agent", "skill"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/geekbot-com/geekbot-cli"
  }
}
```

**Key decisions:**
- Keep `"bin"` pointing to `./src/cli/index.ts` with `#!/usr/bin/env bun` — this is a Bun-only CLI, no Node transpilation needed
- `"files"` includes `src/`, `skills/`, and `scripts/` so the CLI source, skill directory, and postinstall script all ship with the package
- `postinstall` is a lightweight Node.js script (~15 lines) that only checks for Bun availability and prints a hint about `npx skills add` — it does **not** handle skill registration. Could be inlined as `"postinstall": "node -e '...'"` to drop the `scripts/` directory entirely, but a separate file is easier to read
- No `"engines"` field — npm doesn't enforce Bun engines; the postinstall checks for Bun and warns instead
- `skills/` ships with the package so `npx skills add` can also install directly from the npm package as a local path

---

## 2. Skill Directory

### Rename: `skill/` → `skills/geekbot/`

The existing `skill/` directory is renamed to `skills/geekbot/` for compatibility with the [Vercel Skills](https://github.com/vercel-labs/skills) convention (`skills/<name>/SKILL.md`). All 7 files move into the new location:

```
skills/
  geekbot/
    SKILL.md                    # Agent workflow guide (intent routing, confirmation
                                #   policies, MCP enrichment, output patterns)
    cli-commands.md             # Full CLI command reference (all flags/examples)
    manager-workflows.md        # Standup creation, analytics, member summary
    reporter-workflows.md       # Report drafting pipeline, tone calibration
    error-recovery.md           # Recovery flows by exit code
    standup-templates.json      # Pre-built standup templates
    check-cli.sh                # Prerequisite checker script
```

The SKILL.md references supporting files by relative name (e.g. "read `cli-commands.md`"). This works because the `npx skills` CLI copies or symlinks the entire directory — all files remain siblings.

### SKILL.md frontmatter

The [Agent Skills specification](https://agentskills.io/specification) requires YAML frontmatter with `name` and `description`. The `name` must match the directory name and follow the pattern `^[a-z0-9]+(-[a-z0-9]+)*$`:

```yaml
---
name: geekbot
description: Geekbot standup management — drafting reports, managing standups, viewing analytics, and running polls via the geekbot CLI.
---
```

This frontmatter is how `npx skills add` discovers and indexes the skill. The `description` is loaded at startup (~100 tokens) for all installed skills so agents can decide when to activate it — keep it concise and specific about triggers.

### Skill content updates

Two files need their installation instructions updated from `git clone` to `npm install`:

**SKILL.md** — Replace the "CLI not found" prerequisite guidance:

```markdown
- **CLI not found**: Install via `npm install -g geekbot-cli` (requires
  Bun >= 1.0 runtime). Alternatively, use `npx geekbot-cli` for one-off
  commands without global install.
```

**check-cli.sh** — Replace the suggestion in the `cli_not_found` JSON output:

```json
{"ok":false,"error":"cli_not_found","message":"geekbot CLI not found on PATH.","suggestion":"Install: npm install -g geekbot-cli (requires Bun >= 1.0). Or use npx geekbot-cli for one-off commands."}
```

---

## 3. Why Delegate to `npx skills add`

### The ecosystem handles agent registration

The [Vercel Skills CLI](https://github.com/vercel-labs/skills) (`npx skills add`) is the standard package manager for AI agent skills. It:

1. **Detects installed agents** — checks config directories, marker files, and env vars for all known agents
2. **Handles directory conventions** — knows each agent's skill path (project and global)
3. **Uses symlinks by default** — stores skills once in `.agents/skills/`, symlinks to each agent-specific directory; falls back to copies on Windows
4. **Supports 44+ agents** — and grows automatically as new agents are added upstream

### Agent coverage comparison

Previously our custom `agents.json` + `postinstall.mjs` registered with 4 agents. By delegating to `npx skills add`, we cover the full ecosystem:

#### Universal agents (read from `.agents/skills/` natively)

| Agent | Notes |
|-------|-------|
| Amp (Sourcegraph) | Also reads `AGENTS.md` |
| Antigravity | |
| Cline | |
| Codex (OpenAI) | Canonical `.agents/skills/` consumer |
| Cursor | Cross-reads `.claude/skills/` and `.agents/skills/` |
| Deep Agents | |
| Gemini CLI | `.agents/skills/` is an alias for `.gemini/skills/` |
| GitHub Copilot | As of VS Code 1.108+ (Jan 2026) |
| Kimi Code CLI | |
| OpenCode | Also reads `.opencode/skills/` |
| Warp | |

#### Non-universal agents (need agent-specific directories)

| Agent | Project Skills Path | Global Skills Path |
|-------|--------------------|--------------------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Windsurf | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |
| Augment | `.augment/skills/` | `~/.augment/skills/` |
| Roo Code | `.roo/skills/` | `~/.roo/skills/` |
| Goose | `.goose/skills/` | `~/.config/goose/skills/` |
| Kiro CLI | `.kiro/skills/` | `~/.kiro/skills/` |
| Continue | `.continue/skills/` | `~/.continue/skills/` |
| Trae | `.trae/skills/` | `~/.trae/skills/` |
| Kilo Code | `.kilocode/skills/` | `~/.kilocode/skills/` |
| Junie (JetBrains) | `.junie/skills/` | `~/.junie/skills/` |
| Qwen Code | `.qwen/skills/` | `~/.qwen/skills/` |
| Droid | `.factory/skills/` | `~/.factory/skills/` |
| ...and 20+ more | See [registry](https://github.com/vercel-labs/skills) | |

All of this is handled by `npx skills add` — zero custom code on our side.

### What we removed

| Removed | Reason |
|---------|--------|
| `skills/agents.json` | Agent registry lives upstream in `vercel-labs/skills` |
| `scripts/postinstall.mjs` agent detection | Duplicated `npx skills` functionality for 4 of 44 agents |
| `src/cli/commands/setup.ts` | Replaced by `npx skills add geekbot-com/geekbot-cli` |
| `geekbot setup` command | No longer needed |
| `geekbot setup --clean` | Replaced by `npx skills remove geekbot` |

### Corrections from prior plan

Our previous `agents.json` had classification errors:

- **Cursor** was listed as non-universal — it is actually **universal** (reads `.agents/skills/` natively). Our explicit entry was redundant.
- **Gemini CLI** was listed as non-universal — it is actually **universal** (`.agents/skills/` is an alias for `.gemini/skills/`). Our explicit entry was redundant.

These errors don't matter anymore since we no longer maintain our own agent registry.

---

## 4. Postinstall Script

### scripts/postinstall.mjs

Stripped down to a single concern: Bun availability check + a hint about skill registration. Runs in Node.js context (not Bun). No dependencies.

```javascript
// scripts/postinstall.mjs
// Runs after npm install. Checks for Bun and hints about skill registration.
// Must work in plain Node.js (no Bun, no dependencies).

import { platform } from "os";
import { execSync } from "child_process";

// ── Bun availability check ──────────────────────────────────────────────────
// The geekbot CLI binary requires Bun. Warn early if it's missing.
try {
  execSync("bun --version", { stdio: "ignore" });
} catch {
  const installCmd =
    platform() === "win32"
      ? 'powershell -c "irm bun.sh/install.ps1 | iex"'
      : "curl -fsSL https://bun.sh/install | bash";
  console.warn(
    "geekbot: warning: Bun runtime not found. The geekbot CLI requires Bun.\n" +
      `geekbot:   Install it: ${installCmd}\n` +
      "geekbot:   Then the \`geekbot\` command will work."
  );
}

// ── Skill registration hint ─────────────────────────────────────────────────
console.log(
  "geekbot: to register the skill with your AI agents, run:\n" +
    "geekbot:   npx skills add geekbot-com/geekbot-cli"
);
```

---

## 5. File Structure

```
geekbot-cli/
  package.json                               # bin + postinstall + files
  scripts/
    postinstall.mjs                          # Plain Node.js — Bun check only
  skills/
    geekbot/
      SKILL.md                               # Agent workflow guide (updated install instructions)
      cli-commands.md                        # Full command reference (existing, unchanged)
      manager-workflows.md                   # Manager workflows (existing, unchanged)
      reporter-workflows.md                  # Reporter workflows (existing, unchanged)
      error-recovery.md                      # Error recovery flows (existing, unchanged)
      standup-templates.json                 # Pre-built templates (existing, unchanged)
      check-cli.sh                           # Prerequisite checker (updated install suggestions)
  src/
    cli/
      index.ts                               # CLI entry point (no setup command)
      commands/
        auth.ts
        standup.ts
        report.ts
        poll.ts
        me.ts
        team.ts
```

---

## 6. Publishing Workflow

### GitHub Actions: `.github/workflows/publish.yml`

```yaml
name: Publish to npm
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write     # For npm provenance
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"

      - uses: oven-sh/setup-bun@v2

      - run: bun install

      - run: bun test

      - run: npm publish --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Release process

```bash
# 1. Bump version
npm version patch    # or minor, major

# 2. Push tag
git push --follow-tags

# 3. Create GitHub release from the tag
gh release create v$(node -p "require('./package.json').version") --generate-notes
# -> triggers the publish workflow
```

---

## 7. What Users Experience

### Install CLI + register skill

```
$ npm install -g geekbot-cli
added 1 package in 2s
geekbot: to register the skill with your AI agents, run:
geekbot:   npx skills add geekbot-com/geekbot-cli

$ npx skills add geekbot-com/geekbot-cli
Installed skill "geekbot" for claude-code, windsurf, augment, roo, goose,
  kiro-cli, universal (.agents/skills/)

$ geekbot auth setup
Enter your Geekbot API key: ****
Authenticated successfully.
```

### Install without Bun

```
$ npm install -g geekbot-cli
added 1 package in 2s
geekbot: warning: Bun runtime not found. The geekbot CLI requires Bun.
geekbot:   Install it: curl -fsSL https://bun.sh/install | bash
geekbot:   Then the `geekbot` command will work.
geekbot: to register the skill with your AI agents, run:
geekbot:   npx skills add geekbot-com/geekbot-cli
```

The skill can still be registered — AI agents will discover it and guide the user through Bun installation.

### Skill-only install (no CLI binary)

```
$ npx skills add geekbot-com/geekbot-cli
Installed skill "geekbot" for claude-code, cursor, universal (.agents/skills/)
```

This installs only the skill content. The SKILL.md tells agents to use `npx geekbot-cli` as a fallback if the binary isn't on PATH.

### Project-level install

```
$ cd my-project
$ npx skills add geekbot-com/geekbot-cli
Installed skill "geekbot" for claude-code, cursor, universal (.agents/skills/)

# Now any AI agent in this project knows about geekbot
# Skill files are in .agents/skills/geekbot/ (symlinked to agent dirs)
```

### Remove skill

```
$ npx skills remove geekbot
Removed skill "geekbot" from all agent directories.
```

### List installed skills

```
$ npx skills list
  geekbot    Geekbot standup management skill
  ...
```

---

## 8. Compatibility

### Vercel Skills ecosystem

Because our skill lives at `skills/geekbot/SKILL.md`, the repo is fully compatible with:

- `npx skills add geekbot-com/geekbot-cli` — install from GitHub
- `npx skills add ./path/to/geekbot-cli` — install from local checkout
- `npx skills find geekbot` — discoverable via the skills registry
- [skills.sh](https://skills.sh) — auto-listed once installed by users

### Agents without SKILL.md support

Some agents have their own rules conventions and don't read SKILL.md:

| Agent | Convention | Status |
|-------|-----------|--------|
| Amazon Q | `.amazonq/rules/*.md` | Not supported — different format |
| Aider | `CONVENTIONS.md` (manual load) | Not supported — no auto-discovery |
| Tabnine | `.tabnine/guidelines/*.md` | Not supported — different format |
| Zed AI | `.rules` (single file) | Partial — delegates to external agents (Claude Code, Gemini CLI) which do support skills |

These agents represent a small fraction of the market. If any adopt the SKILL.md standard in the future, they'll work automatically via `npx skills add`.

---

## 9. Edge Cases

| Scenario | Behavior |
|---|---|
| `npm install --ignore-scripts` | Postinstall skipped. No Bun warning, no hint. User runs `npx skills add` independently. |
| `bunx geekbot-cli standup list` | Ephemeral — no postinstall, no skill registration. Works fine for one-off use. |
| Bun not installed | Postinstall warns with install instructions. Skill can still be registered separately. CLI binary will fail until Bun is installed. |
| User installs new agent after geekbot | Run `npx skills add geekbot-com/geekbot-cli` again — detects the new agent. |
| Skill content changes in an update | User runs `npx skills add geekbot-com/geekbot-cli` again to overwrite with latest. Note: `npx skills add` fetches from GitHub (latest main branch), while `npm install` gets a specific npm version. There is no version-lock between the two — the skill content describes stable CLI commands, so minor drift is acceptable. For strict version matching, users can install from the local package: `npx skills add ./node_modules/geekbot-cli`. |
| Windows without symlink permissions | `npx skills` falls back to copy mode automatically. |
| CI/CD environment | `npx skills add` detects no agents — installs to `.agents/skills/` (universal). Silent, no failure. |
| New agent added to ecosystem | If universal, works automatically. If non-universal, works once `vercel-labs/skills` adds it — no change needed on our side. |
| `npm uninstall -g geekbot-cli` | Removes CLI binary. Skill files installed by `npx skills add` are independent and remain — remove with `npx skills remove geekbot`. |
| Offline / air-gapped | `npx skills add` needs network for GitHub fetch. Alternative: `npx skills add ./node_modules/geekbot-cli` from a local npm install. |
