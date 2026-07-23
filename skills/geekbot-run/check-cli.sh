#!/usr/bin/env bash
# Verify geekbot CLI is installed, new enough for this plugin, and authenticated.
# Run at the start of any skill invocation.
# Exit 0 = ready, 1 = not installed/broken, 2 = not authed,
# Exit 3 = installed CLI is older than the plugin's minCliVersion

set -euo pipefail

# --- plugin manifest (plugin version + CLI requirement) ---------------------
# Prefer CLAUDE_PLUGIN_ROOT (set by Claude Code for plugin components, but
# unreliable in some contexts), then walk up from this script's location:
# <plugin root>/skills/geekbot-run/check-cli.sh in both the Claude and Codex
# packagings. Standalone skill installs (npx skills add) ship no manifest —
# the plugin/requirement checks are skipped there.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PLUGIN_MANIFEST=""
for candidate in \
  "${CLAUDE_PLUGIN_ROOT:-}/.claude-plugin/plugin.json" \
  "$SCRIPT_DIR/../../.claude-plugin/plugin.json" \
  "$SCRIPT_DIR/../../.codex-plugin/plugin.json"; do
  if [ -f "$candidate" ]; then
    PLUGIN_MANIFEST="$candidate"
    break
  fi
done

# First string value for a key in a flat JSON manifest (no jq dependency).
json_field() {
  sed -n 's/.*"'"$2"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -1
}

PLUGIN_VERSION=""
REQUIRED_CLI=""
if [ -n "$PLUGIN_MANIFEST" ]; then
  PLUGIN_VERSION=$(json_field "$PLUGIN_MANIFEST" version)
  REQUIRED_CLI=$(json_field "$PLUGIN_MANIFEST" minCliVersion)
fi

# Check CLI exists on PATH
if ! command -v geekbot &>/dev/null; then
  cat <<'EOF'
{"ok":false,"error":"cli_not_found","message":"geekbot CLI not found on PATH.","suggestion":"Install: npm install -g geekbot-cli (requires Bun >= 1.3.5). Then run: npx skills add geekbot-com/geekbot-cli to register the skill with your AI agents."}
EOF
  exit 1
fi

# Check version (confirms the binary actually runs)
VERSION_OUTPUT=$(geekbot --version 2>&1 || true)
if [ -z "$VERSION_OUTPUT" ]; then
  cat <<'EOF'
{"ok":false,"error":"cli_broken","message":"geekbot CLI found but failed to run.","suggestion":"Try: bun install in the geekbot-cli directory, then bun link again"}
EOF
  exit 1
fi

# Sanitize version to alphanumeric + dots before comparing/embedding in JSON
SAFE_VERSION=$(echo "$VERSION_OUTPUT" | tr -cd '[:alnum:].')

# Enforce the plugin's CLI requirement before anything else — an outdated
# CLI may be missing flags the skill documentation relies on.
if [ -n "$REQUIRED_CLI" ] && [ -n "$SAFE_VERSION" ]; then
  LOWEST=$(printf '%s\n%s\n' "$REQUIRED_CLI" "$SAFE_VERSION" | sort -V | head -1)
  if [ "$LOWEST" != "$REQUIRED_CLI" ]; then
    echo "{\"ok\":false,\"error\":\"cli_outdated\",\"cli_version\":\"${SAFE_VERSION}\",\"plugin_version\":\"${PLUGIN_VERSION}\",\"required_cli\":\"${REQUIRED_CLI}\",\"message\":\"geekbot CLI ${SAFE_VERSION} is older than the ${REQUIRED_CLI} this plugin version (${PLUGIN_VERSION}) requires.\",\"suggestion\":\"Update: npm install -g geekbot-cli@latest\"}"
    exit 3
  fi
fi

# Check auth. `geekbot auth status` exits 0 whenever it can report (even
# unauthenticated), so read the JSON instead — grep, not jq, to avoid the
# extra dependency.
AUTH_OUTPUT=$(geekbot auth status 2>/dev/null || true)
if ! echo "$AUTH_OUTPUT" | grep -q '"authenticated":[[:space:]]*true'; then
  cat <<'EOF'
{"ok":false,"error":"auth_not_configured","message":"geekbot CLI is not authenticated.","suggestion":"Run: geekbot auth setup"}
EOF
  exit 2
fi

echo "{\"ok\":true,\"cli_version\":\"${SAFE_VERSION}\",\"plugin_version\":\"${PLUGIN_VERSION}\",\"required_cli\":\"${REQUIRED_CLI}\",\"message\":\"geekbot CLI is installed and authenticated\"}"
exit 0
