import { describe, expect, test } from "bun:test";
import { buildReceipt } from "../../src/utils/receipt.ts";

describe("buildReceipt", () => {
	test("returns {operation, undo} metadata object", () => {
		const receipt = buildReceipt("created", "geekbot report delete 1 --yes");
		expect(receipt).toEqual({
			operation: "created",
			undo: "geekbot report delete 1 --yes",
		});
	});

	test("handles null undo command", () => {
		const receipt = buildReceipt("started", null);
		expect(receipt).toEqual({
			operation: "started",
			undo: null,
		});
	});

	test("handles all operation types", () => {
		expect(buildReceipt("created", null).operation).toBe("created");
		expect(buildReceipt("updated", null).operation).toBe("updated");
		expect(buildReceipt("deleted", null).operation).toBe("deleted");
		expect(buildReceipt("started", null).operation).toBe("started");
	});
});
