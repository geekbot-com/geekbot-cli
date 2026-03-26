import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("tty module", () => {
	test("src/utils/tty.ts should not exist (dead code — no production imports)", () => {
		const ttyPath = join(import.meta.dir, "../../src/utils/tty.ts");
		expect(existsSync(ttyPath)).toBe(false);
	});
});
