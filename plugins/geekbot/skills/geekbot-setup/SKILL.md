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

5. **Authenticate via OAuth — you drive `geekbot auth login` yourself.**
   Do NOT tell the user to run anything in their shell. Do NOT ask for an
   API key. The CLI's loopback flow only exposes a public authorize URL
   (no secrets), and writes the resulting `cli_*` token to the user's OS
   keychain on their own machine when the flow completes.

   **Procedure:**

   a. **Start the login command in the background.** Use Bash with
      `run_in_background: true` so you can read the verification URL while
      the CLI waits on its loopback listener. Always pass `--no-browser` —
      you can't pick the user's browser for them, especially on WSL where
      `xdg-open` would launch the Linux default rather than the browser
      that holds the user's Geekbot dashboard session.

      ```bash
      geekbot auth login --no-browser --ttl-days 30
      ```

   b. **Capture the authorize URL.** Call `BashOutput` on the background
      shell once, then again a second later if needed, until stderr
      contains a line that starts with `https://` and a URL pointing at
      `/v2/authorize?...`. The CLI prints a block like:

      ```
      Listening on http://127.0.0.1:<port>/callback for the OAuth callback…
      Open this URL in a browser to sign in:
        https://oauth.geekbot.com/v2/authorize?...&state=...&code_challenge=...
      Only open it ONCE — the state is single-use.
      ```

   c. **Show the URL to the user, exactly once.** Reply with something
      like:

      > To finish signing in to Geekbot, open this URL in any browser
      > you're already logged into your dashboard with:
      >
      >   `<URL>`
      >
      > Only open it once — the OAuth `state` is single-use, so a second
      > browser will fail.

   d. **Wait for the command to exit.** Continue calling `BashOutput`
      periodically until the background shell completes. Don't pre-empt
      with a timeout shorter than the CLI's own (~5 min).

   e. **Parse the outcome:**
      - **Exit 0** — stdout contains a JSON envelope of shape
        `{"ok": true, "data": {"authenticated": true, "method": "oauth_loopback", "username": ..., "email": ...}}`.
        Proceed to step 6.
      - **Non-zero exit** — stdout/stderr contains an error envelope.
        Common codes:
        - `oauth_callback_timeout` — user didn't click in time. Offer to
          retry from step 5a.
        - `oauth_access_denied` — user clicked "Cancel" at the IdP.
        - `oauth_state_mismatch` / `oauth_invalid_request` — they opened
          the URL twice; retry, remind them once is enough.
        - `oauth_invalid_client` — the CLI's `client_id` isn't registered
          on the auth server; this is an environment issue, not a user
          one — report it and stop.

   **Fallback only — do NOT suggest unless OAuth login fails twice in a row
   or the user explicitly asks for it.** Long-lived dashboard API keys
   still work via:
   - Get the key from https://app.geekbot.com/dashboard/api-webhooks
   - Then run: `! geekbot auth setup --api-key <YOUR_KEY>`

6. **Report final state.** Example:

   ```
   geekbot CLI: installed (v0.2.4)
   Auth:        authenticated as sabpap@geekbot.com (oauth_loopback)
   Next:        you're ready — try "fetch my standups"
   ```

   If auth is still missing, end with "run `/geekbot:geekbot-setup` again after completing the `geekbot auth login` step."

## Why not handle the credential directly

API keys and CLI tokens are secrets. Pasting one into the conversation puts it
in the transcript and any logs/exports derived from it. The CLI's `auth login`
flow keeps the token on the user's machine end-to-end: the auth server hands
it to the local CLI, which writes it straight to the OS keychain. Once stored,
every later `geekbot …` call authenticates silently.
