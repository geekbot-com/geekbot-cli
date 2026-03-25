import { describe, expect, test } from "bun:test";
import { isTTY } from "../../src/utils/tty.ts";

describe("tty utilities", () => {
	test("isTTY() returns a boolean", () => {
		expect(typeof isTTY()).toBe("boolean");
	});

	test("isTTY() returns false in non-TTY context (test/CI)", () => {
		// In test/CI environments, stdout is piped not connected to a terminal
		expect(isTTY()).toBe(false);
	});
});
