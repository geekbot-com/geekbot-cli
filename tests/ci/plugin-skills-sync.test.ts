import { describe, expect, test } from "bun:test";
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// plugins/geekbot/skills must be a real, identical copy of skills/ — see
// scripts/sync-plugin-skills.mjs for why it cannot be a symlink.

const root = join(import.meta.dir, "../..");
const canonical = join(root, "skills");
const pluginCopy = join(root, "plugins/geekbot/skills");

function listFiles(dir: string): string[] {
	const out: string[] = [];
	const walk = (d: string) => {
		for (const entry of readdirSync(d, { withFileTypes: true })) {
			const full = join(d, entry.name);
			if (entry.isDirectory()) walk(full);
			else out.push(relative(dir, full));
		}
	};
	walk(dir);
	return out.sort();
}

describe("plugins/geekbot/skills mirrors skills/", () => {
	test("is a real directory, not a symlink", () => {
		expect(lstatSync(pluginCopy).isSymbolicLink()).toBe(false);
		expect(statSync(pluginCopy).isDirectory()).toBe(true);
	});

	test("contains exactly the same files with identical contents", () => {
		const expected = listFiles(canonical);
		expect(listFiles(pluginCopy)).toEqual(expected);

		const differing = expected.filter(
			(f) => !readFileSync(join(canonical, f)).equals(readFileSync(join(pluginCopy, f))),
		);
		// Fix with: bun run sync:skills
		expect(differing).toEqual([]);
	});

	test("check-cli.sh keeps its execute bit in the copy", () => {
		const mode = statSync(join(pluginCopy, "geekbot-run/check-cli.sh")).mode;
		expect(mode & 0o111).not.toBe(0);
	});
});
