import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("dependency version pinning", () => {
	test("devDependencies do not use 'latest' as version specifier", () => {
		const pkgPath = join(import.meta.dir, "../../package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		const latestDeps: string[] = [];

		for (const [name, version] of Object.entries(
			(pkg.devDependencies ?? {}) as Record<string, string>,
		)) {
			if (version === "latest") {
				latestDeps.push(name);
			}
		}

		expect(latestDeps).toEqual([]);
	});
});
