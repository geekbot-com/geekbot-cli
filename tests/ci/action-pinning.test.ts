import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("GitHub Actions pinned to commit SHAs", () => {
	const workflowDir = join(import.meta.dir, "../../.github/workflows");
	const workflowFiles = readdirSync(workflowDir).filter((f) => f.endsWith(".yml"));

	// Matches `uses: owner/repo@ref` where ref is NOT a 40-char hex SHA
	const mutableRefPattern = /uses:\s+[\w-]+\/[\w-]+@(?![0-9a-f]{40}\b)/;

	for (const file of workflowFiles) {
		test(`${file} pins all actions to full commit SHAs`, () => {
			const content = readFileSync(join(workflowDir, file), "utf-8");
			const lines = content.split("\n");
			const violations: string[] = [];

			for (let i = 0; i < lines.length; i++) {
				if (mutableRefPattern.test(lines[i])) {
					violations.push(`  line ${i + 1}: ${lines[i].trim()}`);
				}
			}

			expect(violations).toEqual([]);
		});
	}
});
