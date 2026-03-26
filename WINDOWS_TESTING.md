# Windows Testing Checklist

Two validation tests must pass before publishing v0.2.0. Both require a Windows 10+ machine (x64) with [Bun](https://bun.sh/) installed.

---

## Test 1: npm Global Install + Shebang Shims

**What we're validating:** That `npm install -g` creates working `.cmd` shims from the `#!/usr/bin/env bun` shebang, and the `geekbot` command works in both cmd.exe and PowerShell.

### Steps

1. Install Node.js 22+ and Bun >= 1.3.5
2. Pack the package locally (avoids needing to publish first):
   ```powershell
   # On the dev machine
   npm pack
   # Copy geekbot-cli-0.2.0.tgz to the Windows machine
   ```
3. Install globally from the tarball:
   ```cmd
   npm install -g geekbot-cli-0.2.0.tgz
   ```
4. Verify the shim was created:
   ```cmd
   where geekbot
   :: Expected: C:\Users\<user>\AppData\Roaming\npm\geekbot
   :: Expected: C:\Users\<user>\AppData\Roaming\npm\geekbot.cmd
   ```
5. Run in **cmd.exe**:
   ```cmd
   geekbot --version
   geekbot --help
   geekbot auth status
   ```
6. Run in **PowerShell**:
   ```powershell
   geekbot --version
   geekbot --help
   geekbot auth status
   ```

### What to look for

- [ ] `geekbot --version` prints the version and exits cleanly
- [ ] `geekbot --help` prints help text to stderr and exits cleanly
- [ ] `geekbot auth status` returns a JSON envelope (ok: false with auth_not_configured is fine)
- [ ] **cmd.exe prompt bug**: After each command, does the prompt (`C:\>`) reappear normally? There is an [open Bun bug](https://github.com/oven-sh/bun/issues/18721) where the prompt is cleared after shebang'd scripts run in cmd.exe. If this reproduces, document it as a known issue.
- [ ] **PowerShell**: Check that both `.cmd` and `.ps1` shims work (npm should generate both)
- [ ] **Elevated terminal**: Run one command from an Administrator terminal to check for the [admin symlink bug](https://github.com/tailwindlabs/tailwindcss/issues/18695) where Bun shows its own help instead of running the script

### Pass criteria

All commands produce correct output in both shells. If the cmd.exe prompt-clearing bug reproduces, it's a known Bun issue — document it but don't block the release.

---

## Test 2: @napi-rs/keyring Under Bun on Windows

**What we're validating:** That the OS keychain integration (`@napi-rs/keyring`) works correctly under Bun on Windows. This is the native N-API module that stores API keys in Windows Credential Vault.

### Background

`@napi-rs/keyring` ships prebuilt native binaries via `optionalDependencies` (e.g., `@napi-rs/keyring-win32-x64-msvc`). Bun had a critical N-API bug fixed in v1.3.5 where the `napi_register_module_v1` symbol was not found. This test confirms the fix holds for our specific dependency.

### Steps

1. Ensure Bun >= 1.3.5 is installed:
   ```cmd
   bun --version
   ```
2. With geekbot-cli installed globally (from Test 1), run the full auth flow:
   ```cmd
   :: Store a key (use a test/throwaway API key)
   geekbot auth setup --api-key test-key-12345

   :: Verify it was stored
   geekbot auth status

   :: Verify the key is in Windows Credential Manager
   :: Open: Control Panel > Credential Manager > Windows Credentials
   :: Look for an entry containing "geekbot"

   :: Remove the key
   geekbot auth remove

   :: Verify removal
   geekbot auth status
   ```
3. Test the env var fallback (confirms the CLI works even if keyring has issues):
   ```cmd
   set GEEKBOT_API_KEY=test-key-12345
   geekbot auth status
   set GEEKBOT_API_KEY=
   ```

### What to look for

- [ ] `auth setup --api-key` stores the key without errors (no N-API symbol errors, no segfaults)
- [ ] `auth status` after setup returns `{"ok": true, ...}` confirming the key is stored
- [ ] The key appears in Windows Credential Manager
- [ ] `auth remove` deletes the key cleanly
- [ ] `auth status` after remove confirms no key is stored
- [ ] `GEEKBOT_API_KEY` env var works as a fallback
- [ ] No native module loading errors (specifically: no `napi_register_module_v1` errors)

### Pass criteria

The full store/verify/remove cycle completes without native module errors. The key is visible in Windows Credential Manager after storage and gone after removal.

---

## If a Test Fails

If **Test 1 fails** (shebang shims don't work): The CLI cannot be distributed via `npm install -g` on Windows. Options are to defer Windows support to a later version, or add a Node.js wrapper script that spawns Bun.

If **Test 2 fails** (keyring doesn't work): The CLI can still work on Windows using the `GEEKBOT_API_KEY` env var or `--api-key` flag. Document keychain storage as unsupported on Windows and default to env var guidance in error messages. This is not a release blocker.
