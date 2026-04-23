import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const scriptPath = join(import.meta.dir, "../../skills/geekbot-run/check-cli.sh");

describe("skills/geekbot-run/check-cli.sh", () => {
	test("has execute permission", () => {
		const stat = statSync(scriptPath);
		// Check owner execute bit (0o100)
		const hasExecute = (stat.mode & 0o111) !== 0;
		expect(hasExecute).toBe(true);
	});

	test("sanitizes version output before JSON interpolation", () => {
		const content = readFileSync(scriptPath, "utf-8");
		const lines = content.split("\n");
		const violations: string[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Flag lines that interpolate VERSION_OUTPUT directly into a JSON string
			// without prior sanitization (raw ${VERSION_OUTPUT} in an echo/printf with JSON)
			if (
				line.includes("VERSION_OUTPUT") &&
				line.includes('"') &&
				(line.includes("echo") || line.includes("printf")) &&
				!line.startsWith("#")
			) {
				// This line interpolates VERSION_OUTPUT into JSON — check that the
				// variable used is the sanitized form (SAFE_VERSION or similar),
				// not the raw VERSION_OUTPUT
				// biome-ignore lint/suspicious/noTemplateCurlyInString: literal pattern to detect in shell script
				if (line.includes("${VERSION_OUTPUT}")) {
					violations.push(`  line ${i + 1}: raw VERSION_OUTPUT in JSON: ${line.trim()}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});
});
