#!/usr/bin/env bash
# Verify geekbot CLI is installed and authenticated.
# Run at the start of any skill invocation.
# Exit 0 = ready, Exit 1 = not installed, Exit 2 = not authed

set -euo pipefail

# Check CLI exists on PATH
if ! command -v geekbot &>/dev/null; then
  cat <<'EOF'
{"ok":false,"error":"cli_not_found","message":"geekbot CLI not found on PATH.","suggestion":"Install: npm install -g geekbot-cli (requires Bun >= 1.0). Or use npx geekbot-cli for one-off commands."}
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

# Check auth — use exit code instead of jq to avoid extra dependency
if ! geekbot auth status &>/dev/null; then
  cat <<'EOF'
{"ok":false,"error":"auth_not_configured","message":"geekbot CLI is not authenticated.","suggestion":"Run: geekbot auth setup"}
EOF
  exit 2
fi

# All good — embed version as plain string (safe: version output is alphanumeric + dots)
echo "{\"ok\":true,\"version\":\"${VERSION_OUTPUT}\",\"message\":\"geekbot CLI is installed and authenticated\"}"
exit 0
