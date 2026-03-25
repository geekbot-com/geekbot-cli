import { afterAll, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { CliError } from "../../src/errors/cli-error.ts";
import { createHttpClient } from "../../src/http/client.ts";
import { APP_VERSION } from "../../src/utils/constants.ts";

const mockFetch = spyOn(globalThis, "fetch");

const originalSleep = Bun.sleep;

beforeEach(() => {
	mockFetch.mockReset();
	// Mock Bun.sleep to avoid real delays during retry tests
	(Bun as { sleep: typeof Bun.sleep }).sleep = mock(() => Promise.resolve()) as typeof Bun.sleep;
});

afterAll(() => {
	mockFetch.mockRestore();
	(Bun as { sleep: typeof Bun.sleep }).sleep = originalSleep;
});

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function errorResponse(
	message: string,
	status: number,
	headers?: Record<string, string>,
): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

describe("createHttpClient", () => {
	test("returns object with all 5 HTTP methods", () => {
		const client = createHttpClient("test-key");
		expect(typeof client.get).toBe("function");
		expect(typeof client.post).toBe("function");
		expect(typeof client.patch).toBe("function");
		expect(typeof client.put).toBe("function");
		expect(typeof client.delete).toBe("function");
	});

	test("accepts debug option", () => {
		const client = createHttpClient("test-key", { debug: true });
		expect(typeof client.get).toBe("function");
	});

	test("accepts debug: false option", () => {
		const client = createHttpClient("test-key", { debug: false });
		expect(typeof client.get).toBe("function");
	});
});

describe("GET requests", () => {
	test("calls fetch with correct method and headers", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }));
		const client = createHttpClient("my-api-key");
		await client.get("/v1/standups");

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0]!;
		expect(url).toContain("/v1/standups");
		expect(init?.method).toBe("GET");
		expect(init?.headers).toEqual({
			Authorization: "my-api-key",
			"Content-Type": "application/json",
			"User-Agent": `geekbot-skill-cli/${APP_VERSION}`,
		});
	});

	test("appends query params to URL", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse([]));
		const client = createHttpClient("test-key");
		await client.get("/v1/standups", { user_id: "5" });

		const [url] = mockFetch.mock.calls[0]!;
		expect(String(url)).toContain("?user_id=5");
	});

	test("returns parsed JSON body on success", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Daily" }));
		const client = createHttpClient("test-key");
		const result = await client.get<{ id: number; name: string }>("/v1/standups");
		expect(result).toEqual({ id: 42, name: "Daily" });
	});

	test("returns null for 204 No Content", async () => {
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
		const client = createHttpClient("test-key");
		const result = await client.get("/v1/standups/1");
		expect(result).toBeNull();
	});
});

describe("DELETE requests", () => {
	test("delete method returns null for 204 response", async () => {
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
		const client = createHttpClient("test-key");
		const result = await client.delete("/v1/standups/42");
		expect(result).toBeNull();
	});

	test("delete calls fetch with DELETE method", async () => {
		mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
		const client = createHttpClient("test-key");
		await client.delete("/v1/standups/42");

		const [, init] = mockFetch.mock.calls[0]!;
		expect(init?.method).toBe("DELETE");
	});
});

describe("POST requests", () => {
	test("calls fetch with POST method and stringified body", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }));
		const client = createHttpClient("test-key");
		await client.post("/v1/standups", { name: "Test" });

		const [, init] = mockFetch.mock.calls[0]!;
		expect(init?.method).toBe("POST");
		expect(init?.body).toBe(JSON.stringify({ name: "Test" }));
	});

	test("returns parsed JSON on success", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ id: 99 }));
		const client = createHttpClient("test-key");
		const result = await client.post<{ id: number }>("/v1/standups", {
			name: "New",
		});
		expect(result).toEqual({ id: 99 });
	});
});

describe("PATCH requests", () => {
	test("calls fetch with PATCH method and stringified body", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Updated" }));
		const client = createHttpClient("test-key");
		await client.patch("/v1/standups/42", { name: "Updated" });

		const [, init] = mockFetch.mock.calls[0]!;
		expect(init?.method).toBe("PATCH");
		expect(init?.body).toBe(JSON.stringify({ name: "Updated" }));
	});

	test("returns parsed JSON on success", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Patched" }));
		const client = createHttpClient("test-key");
		const result = await client.patch<{ id: number; name: string }>("/v1/standups/42", {
			name: "Patched",
		});
		expect(result).toEqual({ id: 42, name: "Patched" });
	});
});

describe("PUT requests", () => {
	test("calls fetch with PUT method and stringified body", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Replaced" }));
		const client = createHttpClient("test-key");
		await client.put("/v1/standups/42", { name: "Replaced", channel: "#new" });

		const [, init] = mockFetch.mock.calls[0]!;
		expect(init?.method).toBe("PUT");
		expect(init?.body).toBe(JSON.stringify({ name: "Replaced", channel: "#new" }));
	});

	test("returns parsed JSON on success", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Replaced" }));
		const client = createHttpClient("test-key");
		const result = await client.put<{ id: number; name: string }>("/v1/standups/42", {
			name: "Replaced",
		});
		expect(result).toEqual({ id: 42, name: "Replaced" });
	});
});

describe("error handling", () => {
	test("401 throws CliError with code 'unauthorized' and exitCode 4", async () => {
		mockFetch.mockResolvedValueOnce(errorResponse("Unauthorized", 401));
		const client = createHttpClient("bad-key");
		try {
			await client.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("unauthorized");
			expect(err.exitCode).toBe(4);
		}
	});

	test("404 throws CliError with code 'not_found' and exitCode 3", async () => {
		mockFetch.mockResolvedValueOnce(errorResponse("Not found", 404));
		const client = createHttpClient("test-key");
		try {
			await client.get("/v1/standups/999");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("not_found");
			expect(err.exitCode).toBe(3);
		}
	});

	test("400 throws CliError with code 'validation_error' and exitCode 6", async () => {
		mockFetch.mockResolvedValueOnce(errorResponse("Bad request", 400));
		const client = createHttpClient("test-key");
		try {
			await client.post("/v1/standups", {});
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("validation_error");
			expect(err.exitCode).toBe(6);
		}
	});
});

describe("retry logic", () => {
	test("retries 429 then succeeds", async () => {
		mockFetch
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(jsonResponse({ id: 1 }));

		const client = createHttpClient("test-key");
		const result = await client.get<{ id: number }>("/v1/standups");

		expect(result).toEqual({ id: 1 });
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});

	test("retries 500 then succeeds", async () => {
		mockFetch
			.mockResolvedValueOnce(errorResponse("Server error", 500))
			.mockResolvedValueOnce(jsonResponse({ ok: true }));

		const client = createHttpClient("test-key");
		const result = await client.get<{ ok: boolean }>("/v1/standups");

		expect(result).toEqual({ ok: true });
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	test("does NOT retry 401 -- throws immediately", async () => {
		mockFetch.mockResolvedValueOnce(errorResponse("Unauthorized", 401));
		const client = createHttpClient("test-key");

		try {
			await client.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
		}
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	test("exhausts retries on persistent 429 and throws", async () => {
		mockFetch
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(errorResponse("Rate limited", 429));

		const client = createHttpClient("test-key");
		try {
			await client.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("rate_limited");
		}
		// 1 initial + 3 retries = 4 calls
		expect(mockFetch).toHaveBeenCalledTimes(4);
	});
});

describe("network errors", () => {
	test("throws CliError with code 'network_error' after retries exhausted", async () => {
		mockFetch
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"));

		const client = createHttpClient("test-key");
		try {
			await client.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("network_error");
			expect(err.exitCode).toBe(7);
		}
	});

	test("network error is retryable", async () => {
		mockFetch
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"));

		const client = createHttpClient("test-key");
		try {
			await client.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			const err = e as CliError;
			expect(err.retryable).toBe(true);
		}
	});

	test("network error message contains original error", async () => {
		mockFetch
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"));

		const client = createHttpClient("test-key");
		try {
			await client.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			const err = e as CliError;
			expect(err.message).toContain("Network error: Connection refused");
		}
	});
});

describe("path normalization", () => {
	test("strips trailing slash from path", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse([]));
		const client = createHttpClient("test-key");
		await client.get("/v1/standups/");

		const [url] = mockFetch.mock.calls[0]!;
		expect(String(url)).toContain("/v1/standups");
		expect(String(url)).not.toContain("/v1/standups/");
	});
});

describe("debug mode", () => {
	test("writes retry debug message to stderr", async () => {
		const stderrMessages: string[] = [];
		const origWrite = process.stderr.write;
		process.stderr.write = ((chunk: string) => {
			stderrMessages.push(chunk);
			return true;
		}) as typeof process.stderr.write;

		mockFetch
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(jsonResponse({ id: 1 }));

		const client = createHttpClient("test-key", { debug: true });

		try {
			await client.get("/v1/standups");
		} finally {
			process.stderr.write = origWrite;
		}

		const allOutput = stderrMessages.join("");
		expect(allOutput).toContain("[debug]");
		expect(allOutput).toContain("Retry attempt 1");
	});

	test("writes debug network error message to stderr on retry", async () => {
		const stderrMessages: string[] = [];
		const origWrite = process.stderr.write;
		process.stderr.write = ((chunk: string) => {
			stderrMessages.push(chunk);
			return true;
		}) as typeof process.stderr.write;

		mockFetch
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockResolvedValueOnce(jsonResponse({ id: 1 }));

		const client = createHttpClient("test-key", { debug: true });
		try {
			await client.get("/v1/standups");
		} finally {
			process.stderr.write = origWrite;
		}

		const allOutput = stderrMessages.join("");
		expect(allOutput).toContain("[debug] Network error (attempt 1/4)");
		expect(allOutput).toContain("Connection refused");
	});

	test("writes debug HTTP error message to stderr", async () => {
		const stderrMessages: string[] = [];
		const origWrite = process.stderr.write;
		process.stderr.write = ((chunk: string) => {
			stderrMessages.push(chunk);
			return true;
		}) as typeof process.stderr.write;

		mockFetch.mockResolvedValueOnce(errorResponse("Bad request", 400));

		const client = createHttpClient("test-key", { debug: true });
		try {
			await client.get("/v1/standups");
		} catch {
			/* expected */
		} finally {
			process.stderr.write = origWrite;
		}

		const allOutput = stderrMessages.join("");
		expect(allOutput).toContain("[debug] HTTP 400");
	});

	test("debug output never contains the API key", async () => {
		const stderrMessages: string[] = [];
		const origWrite = process.stderr.write;
		process.stderr.write = ((chunk: string) => {
			stderrMessages.push(chunk);
			return true;
		}) as typeof process.stderr.write;

		mockFetch
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(jsonResponse({ id: 1 }));

		const secretKey = "super-secret-api-key-12345";
		const client = createHttpClient(secretKey, { debug: true });

		try {
			await client.get("/v1/standups");
		} finally {
			process.stderr.write = origWrite;
		}

		const allOutput = stderrMessages.join("");
		expect(allOutput).not.toContain(secretKey);
		// Verify debug output was actually produced
		expect(allOutput).toContain("[debug]");
	});

	test("handles non-Error network failures", async () => {
		mockFetch
			.mockRejectedValueOnce("string error")
			.mockRejectedValueOnce("string error")
			.mockRejectedValueOnce("string error")
			.mockRejectedValueOnce("string error");

		const client = createHttpClient("test-key");
		try {
			await client.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).message).toContain("string error");
		}
	});
});
