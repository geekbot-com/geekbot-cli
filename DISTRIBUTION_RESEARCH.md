# Distribution, Installation & Auto-Update Research

> Research on how popular agent CLI projects handle distribution, installation, and updates.
> Conducted March 2026 for the `geekbot-cli` project (Bun + TypeScript CLI).

---

## Table of Contents

1. [How Popular Projects Do It](#1-how-popular-projects-do-it)
2. [Distribution Strategies](#2-distribution-strategies)
3. [Auto-Update Mechanisms](#3-auto-update-mechanisms)
4. [Multi-Environment Integration](#4-multi-environment-integration)
5. [Recommended Strategy for geekbot-cli](#5-recommended-strategy-for-geekbot-cli)

---

## 1. How Popular Projects Do It

### OpenAI Codex CLI (~66k stars)
- **Install**: `npm i -g @openai/codex` or `brew install --cask codex`
- **Update**: Manual (`npm update -g`). No built-in auto-update — [open issue #9274](https://github.com/openai/codex/issues/9274) requesting `codex upgrade`
- **Platforms**: macOS, Linux; Windows experimental
- **Language**: TypeScript/Node.js

### OpenCode (~122k stars)
- **Install**: `curl -fsSL https://opencode.ai/install | bash`, `npm i -g opencode-ai`, `brew install opencode`, `choco install opencode`, `pacman -S opencode`
- **Update**: Package manager updates
- **Platforms**: Full Mac/Linux/Windows — broadest coverage of any project
- **Language**: Go

### Obra Superpowers (~82k stars)
- **Install**: Claude Code marketplace (`/plugin install superpowers`) or `claude-code plugin install <github-url>`
- **Update**: Plugin marketplace handles updates; git pull for manual installs
- **Platforms**: Platform-agnostic (markdown skill files)
- **Takeaway**: Pure skills model — no binary distribution, relies on host agent's plugin system

### Open Interpreter (~63k stars)
- **Install**: `pip install open-interpreter`, experimental standalone installers
- **Update**: `pip install --upgrade open-interpreter`
- **Platforms**: Requires Python 3.10+; Mac/Linux/Windows

### Cline (~59k stars)
- **Install**: VS Code Extension Marketplace only
- **Update**: VS Code auto-updates extensions
- **Platforms**: Wherever VS Code runs
- **Takeaway**: IDE-locked distribution

### Goose by Block (~33k stars)
- **Install**: `brew install block-goose-cli`, curl script, desktop app
- **Update**: `brew upgrade`, re-run curl script
- **Platforms**: Mac/Linux natively; Windows via Git Bash/MSYS2
- **Language**: Rust — compiles to native binary, curl script auto-detects platform

### Aider (~30k stars)
- **Install**: `pip install aider-chat`, `uv tool install aider-chat`, `curl -LsSf https://aider.chat/install.sh | sh`, PowerShell script for Windows
- **Update**: `pip install -U aider-chat`
- **Platforms**: Mac/Linux/Windows (Python 3.9-3.12)
- **Takeaway**: Dedicated `aider-install` bootstrap package handles Python env setup

### Continue (~32k stars)
- **Install**: VS Code and JetBrains extension marketplaces
- **Update**: IDE auto-updates
- **Platforms**: IDE-dependent

### Vercel Skills CLI (emerging)
- **Install**: `npx skills add <github-shorthand>` — supports 42+ agents
- **Takeaway**: Universal skills package manager, registry at skills.sh

### antfu/skills-npm (~211 stars)
- **Install**: `npx skills-npm` discovers skills shipped inside npm packages
- **Takeaway**: Skills bundled with npm packages, update together via `npm update`

---

## 2. Distribution Strategies

### Strategy A: npm Global Install

The dominant pattern for TypeScript/Node.js CLI tools.

**How it works:**
```jsonc
// package.json
{
  "name": "geekbot-cli",
  "version": "1.0.0",
  "bin": {
    "geekbot": "./dist/cli.js"  // or compiled binary
  },
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  }
}
```

```bash
# Users install with:
npm install -g geekbot-cli
# or
bunx geekbot-cli    # zero-install one-shot
npx geekbot-cli     # zero-install one-shot
```

**Pros:**
- Largest ecosystem — every JS dev has npm/npx
- Built-in versioning, semver, lockfiles
- Zero config CI publishing via `npm publish`
- `npx`/`bunx` enables zero-install trial runs
- Works on Mac, Linux, Windows out of the box
- Users already trust npm packages

**Cons:**
- Requires Node.js/Bun runtime installed
- Global installs can conflict with other packages
- npm audit/security concerns for some orgs
- `npx` has cold-start latency (~2-5s)
- Bun-specific features (e.g., native `@napi-rs/keyring`) may not work via `npx`

**Key decision: Bun-only vs Node-compatible.**
If you target Node users too, the shebang must be `#!/usr/bin/env node` and you must transpile TS to JS. If Bun-only, users must have Bun installed but you can ship `.ts` directly. For maximum reach, build with `--target node` for npm distribution.

**Handling native dependencies (`@napi-rs/keyring`):**
The `@napi-rs/keyring` package already uses the platform-specific optional dependency pattern (publishing separate packages per OS/arch like `@napi-rs/keyring-darwin-arm64`). npm/bun automatically installs only the matching platform package. This works out of the box for npm installs — no special handling needed.

**CI/CD for npm publish:**
```yaml
# .github/workflows/publish.yml
name: Publish to npm
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

### Strategy B: Compiled Binaries via GitHub Releases

Bun can compile TypeScript directly to standalone executables — no runtime needed.

**How it works:**
```bash
# Build standalone binaries for each platform
bun build --compile --target=bun-linux-x64 ./src/cli/index.ts --outfile geekbot-linux-x64
bun build --compile --target=bun-linux-arm64 ./src/cli/index.ts --outfile geekbot-linux-arm64
bun build --compile --target=bun-darwin-x64 ./src/cli/index.ts --outfile geekbot-darwin-x64
bun build --compile --target=bun-darwin-arm64 ./src/cli/index.ts --outfile geekbot-darwin-arm64
bun build --compile --target=bun-windows-x64 ./src/cli/index.ts --outfile geekbot-windows-x64.exe
```

**CI/CD workflow:**
```yaml
# .github/workflows/release-binaries.yml
name: Release Binaries
on:
  release:
    types: [published]

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: bun-linux-x64
            artifact: geekbot-linux-x64
          - os: ubuntu-latest
            target: bun-linux-arm64
            artifact: geekbot-linux-arm64
          - os: macos-latest
            target: bun-darwin-x64
            artifact: geekbot-darwin-x64
          - os: macos-latest
            target: bun-darwin-arm64
            artifact: geekbot-darwin-arm64
          - os: ubuntu-latest
            target: bun-windows-x64
            artifact: geekbot-windows-x64.exe
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun build --compile --target=${{ matrix.target }} ./src/cli/index.ts --outfile ${{ matrix.artifact }}
      - uses: softprops/action-gh-release@v2
        with:
          files: ${{ matrix.artifact }}
```

**Pros:**
- Zero runtime dependency — users don't need Node.js or Bun installed
- Single binary download, fast startup
- Natural for Homebrew distribution (formula wraps the binary)
- Works great with curl install scripts

**All available Bun cross-compilation targets:**
- `bun-darwin-arm64` (macOS Apple Silicon)
- `bun-darwin-x64` (macOS Intel)
- `bun-linux-x64` (Linux x64 glibc)
- `bun-linux-arm64` (Linux ARM64 glibc)
- `bun-linux-x64-musl` (Linux x64 musl/Alpine)
- `bun-linux-arm64-musl` (Linux ARM64 musl)
- `bun-windows-x64` (Windows x64)

**Cons:**
- Larger binary size (~50-90MB per platform due to embedded Bun runtime)
- **`@napi-rs/keyring` caveat:** There is an [open issue (oven-sh/bun#14676)](https://github.com/oven-sh/bun/issues/14676) where `bun build --compile` may not produce fully standalone executables when native addons are involved. You must test that the compiled binary works without Bun installed on the target machine. If it doesn't, consider bundling a fallback credential storage (e.g., encrypted file-based) or shipping the npm package instead of compiled binaries
- Build matrix increases CI time and complexity
- Users can't easily inspect/modify the source

---

### Strategy C: Curl / Shell Install Script

The universal fallback used by Goose, OpenCode, Aider, and many others.

**How it works (install.sh):**
```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="geekbot-com/geekbot-cli"
INSTALL_DIR="${GEEKBOT_INSTALL_DIR:-$HOME/.geekbot/bin}"

# Detect OS and architecture
detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux*)  os="linux" ;;
    Darwin*) os="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) os="windows" ;;
    *) echo "Unsupported OS: $os" >&2; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
  esac

  echo "${os}-${arch}"
}

# Get latest version from GitHub API
get_latest_version() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | sed -E 's/.*"v?([^"]+)".*/\1/'
}

main() {
  local platform version url binary_name
  platform="$(detect_platform)"
  version="$(get_latest_version)"

  binary_name="geekbot-${platform}"
  [[ "$platform" == windows-* ]] && binary_name="${binary_name}.exe"

  url="https://github.com/${REPO}/releases/download/v${version}/${binary_name}"

  echo "Installing geekbot v${version} for ${platform}..."
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "$url" -o "${INSTALL_DIR}/geekbot"
  chmod +x "${INSTALL_DIR}/geekbot"

  # Add to PATH if not already there
  if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
    local shell_rc
    case "$SHELL" in
      */zsh)  shell_rc="$HOME/.zshrc" ;;
      */bash) shell_rc="$HOME/.bashrc" ;;
      *)      shell_rc="$HOME/.profile" ;;
    esac
    echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "$shell_rc"
    echo "Added ${INSTALL_DIR} to PATH in ${shell_rc}"
    echo "Run 'source ${shell_rc}' or restart your terminal."
  fi

  echo "geekbot v${version} installed successfully!"
}

main
```

**Windows PowerShell equivalent (install.ps1):**
```powershell
$repo = "geekbot-com/geekbot-cli"
$installDir = "$env:USERPROFILE\.geekbot\bin"

# Get latest release
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
$version = $release.tag_name -replace '^v', ''

$url = "https://github.com/$repo/releases/download/v$version/geekbot-windows-x64.exe"

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Invoke-WebRequest -Uri $url -OutFile "$installDir\geekbot.exe"

# Add to user PATH
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$installDir;$userPath", "User")
    Write-Host "Added $installDir to PATH"
}

Write-Host "geekbot v$version installed successfully!"
```

**Usage:**
```bash
# Mac/Linux
curl -fsSL https://geekbot.com/install.sh | bash

# Windows
powershell -ExecutionPolicy ByPass -c "irm https://geekbot.com/install.ps1 | iex"
```

**Pros:**
- Zero prerequisites (just curl/PowerShell)
- Full control over install location, PATH setup, post-install hooks
- Can include environment setup (skill registration in AI tools)
- Single URL to share — great for README and onboarding docs
- Can auto-detect platform and download correct binary

**Cons:**
- `curl | bash` has trust/security stigma — users must trust the source
- Two scripts to maintain (bash + PowerShell)
- No built-in versioning or dependency resolution
- Manual PATH management can fail on exotic setups
- No automatic updates

---

### Strategy D: Homebrew Tap

Used by Goose, OpenCode, Codex. Excellent for Mac/Linux users.

**How it works — create a tap repository:**

```ruby
# homebrew-tap/Formula/geekbot.rb
class Geekbot < Formula
  desc "CLI for Geekbot — async standups, polls, and reports from the terminal"
  homepage "https://github.com/geekbot-com/geekbot-cli"
  version "1.0.0"

  on_macos do
    on_arm do
      url "https://github.com/geekbot-com/geekbot-cli/releases/download/v1.0.0/geekbot-darwin-arm64"
      sha256 "abc123..."
    end
    on_intel do
      url "https://github.com/geekbot-com/geekbot-cli/releases/download/v1.0.0/geekbot-darwin-x64"
      sha256 "def456..."
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/geekbot-com/geekbot-cli/releases/download/v1.0.0/geekbot-linux-arm64"
      sha256 "ghi789..."
    end
    on_intel do
      url "https://github.com/geekbot-com/geekbot-cli/releases/download/v1.0.0/geekbot-linux-x64"
      sha256 "jkl012..."
    end
  end

  def install
    binary_name = "geekbot-#{OS.mac? ? "darwin" : "linux"}-#{Hardware::CPU.arm? ? "arm64" : "x64"}"
    bin.install binary_name => "geekbot"
  end

  test do
    assert_match "geekbot", shell_output("#{bin}/geekbot --version")
  end
end
```

**CI to auto-update the tap on release:**
```yaml
# .github/workflows/update-homebrew.yml
name: Update Homebrew Tap
on:
  release:
    types: [published]

jobs:
  update-tap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: geekbot-com/homebrew-tap
          token: ${{ secrets.TAP_GITHUB_TOKEN }}
      - name: Update formula
        run: |
          VERSION="${{ github.event.release.tag_name }}"
          VERSION="${VERSION#v}"
          # Download binaries and compute sha256
          for platform in darwin-arm64 darwin-x64 linux-arm64 linux-x64; do
            URL="https://github.com/geekbot-com/geekbot-cli/releases/download/v${VERSION}/geekbot-${platform}"
            SHA=$(curl -fsSL "$URL" | shasum -a 256 | awk '{print $1}')
            # Update formula with new version and sha
            sed -i "s|geekbot-${platform}.*|geekbot-${platform}\"|" Formula/geekbot.rb
            # ... update sha256 and version
          done
      - run: |
          git add Formula/geekbot.rb
          git commit -m "Update geekbot to ${VERSION}"
          git push
```

**Usage:**
```bash
brew tap geekbot-com/tap
brew install geekbot
# Updates:
brew upgrade geekbot
```

**Pros:**
- Native Mac/Linux package management — users know and trust it
- Auto-updates via `brew upgrade`
- Handles binary selection per OS/arch automatically
- Integrates with Homebrew's audit and security model
- Professional credibility signal

**Cons:**
- Mac/Linux only — no Windows
- Requires maintaining a separate `homebrew-tap` repository
- Formula updates are not instant (CI pipeline delay)
- Homebrew core inclusion requires meeting strict criteria
- Extra CI complexity to compute sha256 for each binary

---

### Strategy E: Vercel Skills CLI / Universal Agent Installer

Emerging pattern for distributing skills across 42+ AI agents.

**How it works:**
```bash
# Install the geekbot skill into any supported agent
npx skills add geekbot-com/geekbot-cli

# Or from a registry
npx skills add geekbot
```

The `skills` CLI reads a `SKILL.md` file from the repo:

```markdown
---
name: geekbot
description: Interact with Geekbot from any AI agent
triggers:
  - standup
  - geekbot
  - daily check-in
  - async report
agents:
  - claude-code
  - codex
  - cursor
  - opencode
---

Use when the user asks to interact with Geekbot...
```

The CLI then installs appropriate config files for each agent:
- Claude Code: writes to `~/.claude/skills/` or project `.claude/skills/`
- Codex: writes to `AGENTS.md`
- Cursor: writes to `.cursor/rules/`

**Pros:**
- One command installs into any agent environment
- Growing ecosystem with registry
- Handles agent-specific config format differences
- Easy discovery via `npx skills search`

**Cons:**
- Young ecosystem — may change rapidly
- Depends on third-party tool (Vercel)
- Limited to skill/instruction files — doesn't install CLI binaries
- Registration in the registry requires additional setup

---

## 3. Auto-Update Mechanisms

### Approach 1: Startup Version Check (Most Common)

Check for new versions on CLI startup and notify the user.

```typescript
// src/utils/update-check.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const STATE_FILE = join(homedir(), ".geekbot", "update-check.json");

interface UpdateState {
  lastCheck: number;
  latestVersion: string;
  dismissed: boolean;
}

export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    // Read previous state
    const stateDir = join(homedir(), ".geekbot");
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });

    let state: UpdateState = { lastCheck: 0, latestVersion: currentVersion, dismissed: false };
    if (existsSync(STATE_FILE)) {
      state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    }

    // Skip if checked recently
    if (Date.now() - state.lastCheck < UPDATE_CHECK_INTERVAL) {
      if (state.latestVersion !== currentVersion && !state.dismissed) {
        printUpdateNotice(currentVersion, state.latestVersion);
      }
      return;
    }

    // Fetch latest version from npm registry
    const response = await fetch("https://registry.npmjs.org/geekbot-cli/latest");
    if (!response.ok) return;
    const data = await response.json();
    const latest = data.version;

    // Save state
    state = { lastCheck: Date.now(), latestVersion: latest, dismissed: false };
    writeFileSync(STATE_FILE, JSON.stringify(state));

    // Notify if outdated
    if (latest !== currentVersion) {
      printUpdateNotice(currentVersion, latest);
    }
  } catch {
    // Silently fail — update checks should never break the CLI
  }
}

function printUpdateNotice(current: string, latest: string): void {
  console.error(`\n  Update available: ${current} → ${latest}`);
  console.error(`  Run "npm install -g geekbot-cli" to update\n`);
}
```

**Used by:** update-notifier (npm package, 300M+ weekly downloads), most npm CLI tools

**Bun-aware alternative — `cli-update-notifier`:**
```typescript
import { checkUpdate } from 'cli-update-notifier';

await checkUpdate({
  pkg: { name: 'geekbot-cli', version: '0.1.0' },
  updateCheckInterval: 86400000
});
// Auto-detects package manager, shows: "Update available! Run `bun install -g geekbot-cli`"
```

**For compiled binaries (no npm registry):**
```typescript
async function checkForUpdate(currentVersion: string): Promise<void> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/geekbot-com/geekbot-cli/releases/latest',
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return;
    const data = await res.json();
    const latest = data.tag_name?.replace(/^v/, '');
    if (latest && latest !== currentVersion) {
      process.stderr.write(
        `\nUpdate available: ${currentVersion} → ${latest}\n` +
        `Run: curl -fsSL https://geekbot.com/install.sh | sh\n\n`
      );
    }
  } catch {
    // Silently ignore — never block CLI usage for update checks
  }
}
```

**Pros:** Non-blocking, respects user control, simple to implement
**Cons:** User must manually run update command, easy to ignore

---

### Approach 2: Self-Updating Binary

The CLI updates itself in-place — like `rustup self update`.

```typescript
// src/utils/self-update.ts
import { execSync } from "child_process";

export async function selfUpdate(): Promise<void> {
  const currentVersion = require("../../package.json").version;

  // Fetch latest release from GitHub
  const response = await fetch(
    "https://api.github.com/repos/geekbot-com/geekbot-cli/releases/latest"
  );
  const release = await response.json();
  const latestVersion = release.tag_name.replace(/^v/, "");

  if (latestVersion === currentVersion) {
    console.log(`Already on latest version (${currentVersion})`);
    return;
  }

  console.log(`Updating from ${currentVersion} to ${latestVersion}...`);

  // Detect how CLI was installed and update accordingly
  const installMethod = detectInstallMethod();

  switch (installMethod) {
    case "npm":
      execSync("npm install -g geekbot-cli@latest", { stdio: "inherit" });
      break;
    case "homebrew":
      execSync("brew upgrade geekbot", { stdio: "inherit" });
      break;
    case "binary":
      await downloadAndReplaceBinary(release);
      break;
    default:
      console.log(`Please update manually. Latest version: ${latestVersion}`);
  }
}

function detectInstallMethod(): "npm" | "homebrew" | "binary" | "unknown" {
  try {
    const binPath = process.execPath;
    if (binPath.includes("node_modules")) return "npm";
    if (binPath.includes("Cellar") || binPath.includes("homebrew")) return "homebrew";
    if (binPath.includes(".geekbot/bin")) return "binary";
  } catch {}
  return "unknown";
}

async function downloadAndReplaceBinary(release: any): Promise<void> {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const ext = os === "windows" ? ".exe" : "";
  const assetName = `geekbot-${os}-${arch}${ext}`;

  const asset = release.assets.find((a: any) => a.name === assetName);
  if (!asset) throw new Error(`No binary found for ${os}-${arch}`);

  const binPath = process.execPath;
  const tempPath = `${binPath}.tmp`;

  // Download to temp file, then atomic rename
  const resp = await fetch(asset.browser_download_url);
  const buffer = await resp.arrayBuffer();
  const fs = await import("fs");
  fs.writeFileSync(tempPath, Buffer.from(buffer));
  fs.chmodSync(tempPath, 0o755);
  fs.renameSync(tempPath, binPath);

  console.log(`Updated to v${release.tag_name.replace(/^v/, "")}!`);
}
```

**Register the command:**
```typescript
// In CLI setup
program
  .command("update")
  .description("Update geekbot to the latest version")
  .action(selfUpdate);
```

**Pros:** Single command, works regardless of install method, great UX
**Cons:** Needs write permissions to install dir, more complex, security considerations

---

### Approach 3: Background Auto-Update (Most Aggressive)

Silently download updates in the background, apply on next run. Similar to VS Code / Chrome.

```typescript
// src/utils/background-update.ts
import { spawn } from "child_process";
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync, writeFileSync, renameSync, chmodSync } from "fs";

const PENDING_UPDATE_DIR = join(homedir(), ".geekbot", "pending-update");

export function checkAndApplyPendingUpdate(): boolean {
  const pendingBinary = join(PENDING_UPDATE_DIR, "geekbot");
  const pendingMeta = join(PENDING_UPDATE_DIR, "meta.json");

  if (existsSync(pendingBinary) && existsSync(pendingMeta)) {
    const meta = JSON.parse(readFileSync(pendingMeta, "utf-8"));
    console.log(`Applying update to v${meta.version}...`);

    // Replace current binary
    renameSync(pendingBinary, process.execPath);
    chmodSync(process.execPath, 0o755);

    // Clean up
    require("fs").rmSync(PENDING_UPDATE_DIR, { recursive: true });
    console.log(`Updated to v${meta.version}. Restarting...`);
    return true; // Signal caller to re-exec
  }
  return false;
}

export function triggerBackgroundUpdateCheck(): void {
  // Spawn a detached process that checks for updates
  const child = spawn(process.execPath, ["--internal-update-check"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
```

**Pros:** Zero friction, always up to date, great for active projects
**Cons:** Users may not want silent updates, can break workflows, harder to debug version issues

---

### Comparison of Update Approaches

| Approach | User Friction | Reliability | Complexity | User Control |
|---|---|---|---|---|
| **Startup check + notify** | Low (notification only) | High | Low | Full — user decides when |
| **`geekbot update` command** | Medium (must run command) | High | Medium | Full — explicit action |
| **Background auto-update** | None | Medium | High | Low — may surprise users |
| **Package manager** (npm/brew) | Medium | Highest | None (delegated) | Full |

**Recommendation:** Combine **startup check + notify** with a **`geekbot update`** command. This gives users visibility without friction, and an easy path to update when ready.

---

## 4. Multi-Environment Integration

### Target Directories Per Environment

| Environment | Skills/Rules Path | Instruction File | Format |
|---|---|---|---|
| Claude Code | `.claude/skills/` or `~/.claude/skills/` | `CLAUDE.md` | `.md` with YAML frontmatter |
| Cursor | `.cursor/rules/` | (embedded in .mdc files) | `.mdc` with YAML frontmatter |
| Codex CLI | `.codex/skills/` | `AGENTS.md` | Plain markdown |
| GitHub Copilot | `.github/copilot-instructions.md` | same | Plain markdown |
| Gemini CLI | `.gemini/` | `GEMINI.md` | Plain markdown |
| Universal (Vercel) | `.agents/skills/` | varies | `.md` with YAML frontmatter |

### Claude Code

Skills are installed as `.md` files with YAML frontmatter:

```
~/.claude/skills/geekbot.md          # Global skill (all projects)
.claude/skills/geekbot.md            # Project-level skill
```

Additional extension points available:
- `.claude/commands/<namespace>/<cmd>.md` — slash commands with `name`, `description`, `argument-hint`, `allowed-tools` frontmatter
- `.claude/agents/<name>.md` — subagent definitions with `name`, `description`, `tools`, `color`
- `.claude/hooks/*.js` — event-triggered scripts (`SessionStart`, `PostToolUse`)
- `CLAUDE.md` — always-loaded project instructions

The skill file format:
```markdown
---
name: geekbot
description: Interact with Geekbot standups, polls, and reports
---

Use when the user wants to interact with Geekbot. The CLI is available as `geekbot`.

## Available Commands
- `geekbot standup` — manage standups
- `geekbot report` — view reports
- `geekbot poll` — manage polls
...
```

**Installation methods observed in the wild:**
- Plugin marketplace: `/plugin marketplace add anthropics/skills` then `/plugin install <name>`
- Vercel Skills CLI: `npx skills add geekbot-com/geekbot-cli --skill using-geekbot-cli`
- OpenSkills: `npx openskills add geekbot`
- Curl scripts: `curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash`
- Manual: clone repo, copy skill files into `.claude/skills/`

### Codex CLI

Codex reads `AGENTS.md` from multiple locations, merged in precedence order:
1. `~/.codex/AGENTS.md` (global)
2. Repo root `AGENTS.md`
3. Working directory `AGENTS.md`
4. `AGENTS.override.md` in any location (takes priority)

Codex also adopted the SKILL.md standard — skills go in `.codex/skills/` or install via `npx skills add <package> --agent codex`.

```markdown
# Geekbot CLI

The `geekbot` command is available for interacting with Geekbot.

## Usage
- `geekbot standup` — manage async standups
- `geekbot report` — view team reports
...
```

### Cursor

Cursor uses `.cursor/rules/*.mdc` files (replaced the deprecated single `.cursorrules` file):

```markdown
---
description: Geekbot CLI integration
globs: *.ts,*.tsx
alwaysApply: true
---

The `geekbot` CLI is available for Geekbot operations...
```

**Rule activation modes:**
- `alwaysApply: true` — always loaded into context
- `globs: "*.ts"` — auto-attached when matching files are open
- Agent-requested — agent picks up based on `description` field
- Manual — user invokes with `@ruleName`

### Claude Desktop

Claude Desktop uses MCP servers configured in `~/Library/Application Support/Claude/claude_desktop_config.json`. For a CLI tool (not MCP), the integration path is limited — there is no equivalent of CLAUDE.md or AGENTS.md for Claude Desktop. Users would need to either:
1. Wrap the CLI as an MCP server (adds complexity)
2. Manually reference the CLI in their system prompt

### Cross-Environment Installer Tools

Three real projects provide single-install, multi-environment setups:

**a) `npx skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills))** — The "npm of agent skills". Supports 39+ agents. Installs to canonical `.agents/skills/` then creates symlinks to agent-specific directories. Auto-detects which agents are present.

**b) `npx ai-nexus install` ([JSK9999/ai-nexus](https://github.com/JSK9999/ai-nexus))** — Write rules once in plain `.md`, auto-converts to each tool's format (`.mdc` for Cursor, `AGENTS.md` for Codex, `.claude/rules/` for Claude Code). Interactive wizard for setup.

**c) `ai-rules-sync` ([lbb00/ai-rules-sync](https://github.com/lbb00/ai-rules-sync))** — Synchronizes rules across Cursor, Claude Code, Copilot, OpenCode, Trae AI, Codex, Gemini CLI, and Warp.

### Universal Install Script (Multi-Environment)

An install script can set up all environments at once:

```bash
#!/usr/bin/env bash
# install.sh — installs geekbot CLI and registers with AI agents

set -euo pipefail

# ... [binary installation from Strategy C above] ...

# Register with Claude Code (if installed)
setup_claude_code() {
  local skills_dir="$HOME/.claude/skills"
  if command -v claude &>/dev/null || [ -d "$HOME/.claude" ]; then
    mkdir -p "$skills_dir"
    cat > "$skills_dir/geekbot.md" << 'SKILL'
---
name: geekbot
description: Interact with Geekbot — standups, reports, polls
---

Use when the user mentions Geekbot, standups, daily check-ins, async reports, or polls.
The `geekbot` CLI is installed and available on PATH.

## Commands
- `geekbot standup list` — list standups
- `geekbot report list` — view reports
- `geekbot poll list` — list polls
SKILL
    echo "Registered with Claude Code"
  fi
}

# Register with Codex (if AGENTS.md exists in common locations)
setup_codex() {
  # Codex uses AGENTS.md — we don't auto-modify project files
  echo "For Codex: add geekbot instructions to your project's AGENTS.md"
}

# Register with Cursor (if installed)
setup_cursor() {
  if [ -d "$HOME/.cursor" ] || [ -d "$HOME/Library/Application Support/Cursor" ]; then
    echo "For Cursor: run 'geekbot setup cursor' to add rules to your project"
  fi
}

setup_claude_code
setup_codex
setup_cursor
```

Add a `geekbot setup <environment>` command for per-project registration:

```typescript
program
  .command("setup <environment>")
  .description("Register geekbot with an AI coding environment")
  .action(async (env: string) => {
    switch (env) {
      case "claude-code":
        // Write .claude/skills/geekbot.md in current project
        break;
      case "cursor":
        // Write .cursor/rules/geekbot.mdc in current project
        break;
      case "codex":
        // Append to AGENTS.md in current project
        break;
      default:
        console.log(`Supported environments: claude-code, cursor, codex`);
    }
  });
```

---

## 5. Recommended Strategy for geekbot-cli

Given that geekbot-cli is a **Bun TypeScript CLI** with **cross-platform support** and **active development**, here is the recommended multi-layered approach:

### Phase 1: npm + npx (Immediate)

**Effort: Low | Coverage: Mac/Linux/Windows**

1. Remove `"private": true` from package.json
2. Add build step: `bun build ./src/cli/index.ts --outdir dist --target node`
3. Update `"bin"` to point to `./dist/cli.js`
4. Publish to npm: `npm publish`
5. Users install with `npm install -g geekbot-cli` or try with `npx geekbot-cli`

**Why start here:** Lowest effort, broadest reach, built-in versioning.

### Phase 2: Compiled Binaries + Curl Script (Short-term)

**Effort: Medium | Coverage: Mac/Linux/Windows without runtime**

1. Set up GitHub Actions to build `bun build --compile` binaries on release
2. Attach binaries to GitHub Releases
3. Create `install.sh` and `install.ps1` scripts
4. Host scripts on a stable URL (GitHub raw or project website)

**Why:** Eliminates runtime dependency, enables Homebrew tap later.

### Phase 3: Auto-Update + `geekbot update` (Short-term)

**Effort: Medium | Coverage: All install methods**

1. Add startup version check (non-blocking, once per 24h)
2. Add `geekbot update` command that detects install method
3. Print update notice when new version available

**Why:** Active project needs users on latest version without friction.

### Phase 4: Homebrew Tap (Medium-term)

**Effort: Medium | Coverage: Mac/Linux**

1. Create `geekbot-com/homebrew-tap` repository
2. Add formula pointing to GitHub Release binaries
3. CI auto-updates formula on new releases

**Why:** Professional credibility, native Mac experience, `brew upgrade` updates.

### Phase 5: Multi-Environment Setup Command (Medium-term)

**Effort: Low-Medium | Coverage: Claude Code, Cursor, Codex**

1. Add `geekbot setup <env>` command
2. Include environment registration in install scripts
3. Publish a SKILL.md for Vercel Skills registry

**Why:** Makes geekbot discoverable by AI agents without manual configuration.

### Priority Matrix

| Strategy | Effort | Reach | Priority |
|---|---|---|---|
| npm publish | Low | High (all JS devs) | **P0 — Do first** |
| `geekbot update` + version check | Medium | All users | **P0 — Do first** |
| GitHub Release binaries | Medium | All platforms | **P1 — Next** |
| Curl/PowerShell install scripts | Medium | Non-JS users | **P1 — Next** |
| `geekbot setup` for AI envs | Low-Med | AI agent users | **P1 — Next** |
| Homebrew tap | Medium | Mac/Linux power users | **P2 — Later** |
| Vercel Skills registry | Low | Skills ecosystem | **P2 — Later** |
| Background auto-update | High | All users | **P3 — Maybe** |

---

## Sources

**Projects researched:**
- [OpenAI Codex](https://github.com/openai/codex) (~66k stars) — npm + Homebrew cask
- [OpenCode](https://github.com/opencode-ai/opencode) (~122k stars) — curl + npm + brew + choco + pacman
- [Obra Superpowers](https://github.com/obra/superpowers) (~82k stars) — Claude Code plugin marketplace
- [Open Interpreter](https://github.com/openinterpreter/open-interpreter) (~63k stars) — pip + standalone installers
- [Cline](https://github.com/cline/cline) (~59k stars) — VS Code marketplace
- [Goose by Block](https://github.com/block/goose) (~33k stars) — Homebrew + curl script
- [Continue](https://github.com/continuedev/continue) (~32k stars) — VS Code + JetBrains marketplace
- [Aider](https://github.com/Aider-AI/aider) (~30k stars) — pip + curl + PowerShell
- [Vercel Skills](https://github.com/vercel-labs/skills) — universal skills installer
- [antfu/skills-npm](https://github.com/antfu/skills-npm) (~211 stars) — npm-bundled skills

**Technical references:**
- [Bun single-file executables](https://bun.sh/docs/bundler/executables) — standalone binary compilation
- [Bun cross-compilation](https://bun.sh/blog/bun-v1.1.5) — all target platforms
- [bun build --compile native addon issue #14676](https://github.com/oven-sh/bun/issues/14676)
- [Codex upgrade feature request #9274](https://github.com/openai/codex/issues/9274)
- [update-notifier](https://www.npmjs.com/package/update-notifier) — npm startup update checks (300M+ weekly downloads)
- [cli-update-notifier](https://www.npmjs.com/package/cli-update-notifier) — Bun-aware alternative
- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Homebrew tap guide](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
- [Publishing binaries on npm (Sentry)](https://sentry.engineering/blog/publishing-binaries-on-npm) — platform-specific optional deps pattern

**AI environment docs:**
- [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- [Cursor Rules docs](https://cursor.com/docs/context/rules)
- [Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)
- [Codex Skills](https://developers.openai.com/codex/skills)

**Cross-environment tools:**
- [ai-nexus](https://github.com/JSK9999/ai-nexus) — multi-format rule converter
- [ai-rules-sync](https://github.com/lbb00/ai-rules-sync) — cross-agent rule syncer
- [OpenSkills](https://github.com/numman-ali/openskills) — universal skill loader
