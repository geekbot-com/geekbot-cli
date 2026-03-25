import { describe, expect, test } from "bun:test";
import { failure, success, successList } from "../../src/output/envelope.ts";

describe("success", () => {
	test("produces ok=true with data and null error", () => {
		const env = success({ id: 1, name: "test" });
		expect(env.ok).toBe(true);
		expect(env.data).toEqual({ id: 1, name: "test" });
		expect(env.error).toBeNull();
	});

	test("includes ISO timestamp in metadata", () => {
		const env = success("data");
		expect(env.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	test("merges extra metadata", () => {
		const env = success("data", { extra: "value" });
		expect(env.metadata.extra).toBe("value");
	});
});

describe("successList", () => {
	test("includes count in metadata", () => {
		const env = successList([{ id: 1 }, { id: 2 }, { id: 3 }]);
		expect(env.metadata.count).toBe(3);
	});

	test("count is 0 for empty list", () => {
		const env = successList([]);
		expect(env.metadata.count).toBe(0);
	});

	test("data is the array", () => {
		const items = [{ id: 1 }];
		const env = successList(items);
		expect(env.data).toEqual(items);
	});
});

describe("failure", () => {
	test("produces ok=false with null data and error", () => {
		const env = failure({ code: "test", message: "msg", retryable: false, suggestion: null });
		expect(env.ok).toBe(false);
		expect(env.data).toBeNull();
		expect(env.error.code).toBe("test");
	});

	test("includes suggestion when provided", () => {
		const env = failure({
			code: "err",
			message: "msg",
			retryable: false,
			suggestion: "try this",
		});
		expect(env.error.suggestion).toBe("try this");
	});
});
