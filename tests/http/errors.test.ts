import { describe, expect, test } from "bun:test";
import {
	getBackoffMs,
	isRetryable,
	MAX_BACKOFF_MS,
	mapHttpError,
	parseErrorBody,
} from "../../src/http/errors.ts";

describe("mapHttpError", () => {
	test("400 maps to exitCode 6 (VALIDATION)", () => {
		const err = mapHttpError(400, "Bad request", "/v1/standups");
		expect(err.exitCode).toBe(6);
		expect(err.code).toBe("validation_error");
	});

	test("401 maps to exitCode 4 (AUTH)", () => {
		const err = mapHttpError(401, "Unauthorized", "/v1/standups");
		expect(err.exitCode).toBe(4);
		expect(err.code).toBe("unauthorized");
	});

	test("403 maps to exitCode 5 (FORBIDDEN)", () => {
		const err = mapHttpError(403, "Forbidden", "/v1/standups");
		expect(err.exitCode).toBe(5);
	});

	test("404 maps to exitCode 3 (NOT_FOUND) with no suggestion", () => {
		const err = mapHttpError(404, "Not found", "/v1/standups/999");
		expect(err.exitCode).toBe(3);
		expect(err.code).toBe("not_found");
		expect(err.suggestion).toBeUndefined();
	});

	test("422 maps to exitCode 6 (VALIDATION)", () => {
		const err = mapHttpError(422, "Unprocessable", "/v1/standups");
		expect(err.exitCode).toBe(6);
		expect(err.code).toBe("unprocessable");
	});

	test("429 maps to retryable=true", () => {
		const err = mapHttpError(429, "Rate limited", "/v1/standups");
		expect(err.retryable).toBe(true);
	});

	test("500 maps to retryable=true", () => {
		const err = mapHttpError(500, "Server error", "/v1/standups");
		expect(err.retryable).toBe(true);
	});

	test("unknown status maps to api_error", () => {
		const err = mapHttpError(418, "", "/v1/standups");
		expect(err.code).toBe("api_error");
		expect(err.exitCode).toBe(9);
		expect(err.message).toBe("HTTP 418");
	});
});

describe("isRetryable", () => {
	test("401 is NOT retryable", () => expect(isRetryable(401)).toBe(false));
	test("404 is NOT retryable", () => expect(isRetryable(404)).toBe(false));
	test("400 is NOT retryable", () => expect(isRetryable(400)).toBe(false));
	test("429 IS retryable", () => expect(isRetryable(429)).toBe(true));
	test("500 IS retryable", () => expect(isRetryable(500)).toBe(true));
	test("503 IS retryable", () => expect(isRetryable(503)).toBe(true));
});

describe("parseErrorBody", () => {
	test("parses object format { error: 'msg' }", async () => {
		const response = new Response(JSON.stringify({ error: "Bad input" }), {
			status: 400,
		});
		expect(await parseErrorBody(response)).toBe("Bad input");
	});

	test("parses bare JSON string format", async () => {
		const response = new Response(JSON.stringify("Template not found"), { status: 404 });
		expect(await parseErrorBody(response)).toBe("Template not found");
	});

	test("returns raw text for non-JSON", async () => {
		const response = new Response("Something broke", { status: 500 });
		expect(await parseErrorBody(response)).toBe("Something broke");
	});
});

describe("getBackoffMs", () => {
	test("respects Retry-After header on 429", () => {
		const response = new Response("", {
			status: 429,
			headers: { "Retry-After": "5" },
		});
		expect(getBackoffMs(response, 0)).toBe(5000);
	});

	test("uses exponential backoff when no Retry-After", () => {
		const response = new Response("", { status: 500 });
		expect(getBackoffMs(response, 0, 1000)).toBe(1000); // 1000 * 2^0
		expect(getBackoffMs(response, 1, 1000)).toBe(2000); // 1000 * 2^1
		expect(getBackoffMs(response, 2, 1000)).toBe(4000); // 1000 * 2^2
	});

	test("caps Retry-After at 60 seconds", () => {
		const response = new Response("", {
			status: 429,
			headers: { "Retry-After": "86400" },
		});
		expect(getBackoffMs(response, 0)).toBe(MAX_BACKOFF_MS);
	});

	test("caps exponential backoff at 60 seconds", () => {
		const response = new Response("", { status: 500 });
		// 1000 * 2^10 = 1024000, should be capped
		expect(getBackoffMs(response, 10, 1000)).toBe(MAX_BACKOFF_MS);
	});
});
