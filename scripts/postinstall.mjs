// Runs after npm install. Checks for Bun and hints about skill registration.
// Must work in plain Node.js (no Bun, no dependencies).

import { execSync } from "node:child_process";
import { platform } from "node:os";

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
			"geekbot:   Then the `geekbot` command will work.",
	);
}

// ── Skill registration hint ─────────────────────────────────────────────────
console.log(
	"geekbot: to register the skill with your AI agents, run:\n" +
		"geekbot:   npx skills add geekbot-com/geekbot-cli",
);
