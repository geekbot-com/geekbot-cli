---
name: geekbot-setup
description: Install, authenticate, and verify the geekbot CLI end to end. User-triggered via /geekbot:geekbot-setup.
disable-model-invocation: true
allowed-tools: Bash
---

# Geekbot — Setup

Goal: get the user fully ready — CLI installed, CLI authenticated, and a clear "you're ready" or "here's what to do next" message at the end.

## Steps

1. **Check the CLI is on `$PATH`:**

   ```bash
   command -v geekbot
   ```

2. **Install if missing:**

   ```bash
   npm install -g geekbot-cli
   ```

   If `npm` isn't available, mention `bun install -g geekbot-cli` as an alternative and let the user run it themselves.

3. **Verify the install:**

   ```bash
   geekbot --version
   ```

4. **Check auth (does not prompt):**

   ```bash
   geekbot auth status
   ```

   - If `data.authenticated == true` → skip to step 6.
   - Otherwise → step 5.

5. **Walk the user through auth — do NOT handle the API key in-session:**

   > Get your API key from https://app.geekbot.com/dashboard/api-webhooks
   >
   > Then run (in your own shell, not here):
   >
   > ```
   > ! geekbot auth setup --api-key <YOUR_KEY>
   > ```
   >
   > The `!` prefix runs it in your shell so the key lands in the OS keychain, not the conversation transcript.

   After the user reports back, re-run `geekbot auth status` to confirm.

6. **Report final state.** Example:

   ```
   geekbot CLI: installed (v0.2.4)
   Auth:        authenticated as sabpap@geekbot.com
   Next:        you're ready — try "fetch my standups"
   ```

   If auth is still missing, end with "run `/geekbot:geekbot-setup` again after completing the `geekbot auth setup` step."

## Why not handle the API key directly

API keys are secrets. Pasting one into the conversation puts it in the transcript and any logs/exports that derive from it. The CLI's `auth setup` command writes to the OS keychain — that's where it belongs. Once stored, every later `geekbot …` call authenticates silently.
