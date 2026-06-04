// Configures git to use .githooks/ for this repo. Runs from `prepare` so it
// fires on `npm install`/`bun install` in the working copy. No-op when not in
// a git checkout (e.g. when consumers install from the npm registry).

import { execSync } from "node:child_process";

try {
	execSync("git rev-parse --git-dir", { stdio: "ignore" });
} catch {
	process.exit(0);
}

try {
	execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
} catch {
	// Non-fatal: hook setup is a convenience, not a requirement.
}
