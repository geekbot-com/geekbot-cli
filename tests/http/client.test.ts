import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { CliError } from "../../src/errors/cli-error.ts";
import { createHttpClient } from "../../src/http/client.ts";
import { APP_VERSION } from "../../src/utils/constants.ts";

// ── Hand-written fetch spy (Bun's mock() doesn't track calls reliably on all platforms) ──

type FetchArgs = [string | URL | Request, RequestInit | undefined];

function createFetchSpy() {
	const calls: FetchArgs[] = [];
	const queue: (() => Promise<Response>)[] = [];

	const fn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		calls.push([input, init]);
		const next = queue.shift();
		if (!next) return Promise.resolve(new Response());
		return next();
	};

	return {
		fn: fn as typeof globalThis.fetch,
		calls,
		mockResolvedValueOnce(v: Response) {
			queue.push(() => Promise.resolve(v));
			return this;
		},
		mockRejectedValueOnce(v: unknown) {
			queue.push(() => Promise.reject(v));
			return this;
		},
		reset() {
			calls.length = 0;
			queue.length = 0;
		},
	};
}

const spy = createFetchSpy();

const originalSleep = Bun.sleep;

beforeEach(() => {
	spy.reset();
	(Bun as { sleep: typeof Bun.sleep }).sleep = mock(() => Promise.resolve()) as typeof Bun.sleep;
});

afterAll(() => {
	(Bun as { sleep: typeof Bun.sleep }).sleep = originalSleep;
});

function client(apiKey = "test-key", debug = false) {
	return createHttpClient(apiKey, { debug, fetch: spy.fn });
}

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
		const c = createHttpClient("test-key");
		expect(typeof c.get).toBe("function");
		expect(typeof c.post).toBe("function");
		expect(typeof c.patch).toBe("function");
		expect(typeof c.put).toBe("function");
		expect(typeof c.delete).toBe("function");
	});

	test("accepts debug option", () => {
		const c = createHttpClient("test-key", { debug: true });
		expect(typeof c.get).toBe("function");
	});

	test("accepts debug: false option", () => {
		const c = createHttpClient("test-key", { debug: false });
		expect(typeof c.get).toBe("function");
	});
});

describe("GET requests", () => {
	test("calls fetch with correct method and headers", async () => {
		spy.mockResolvedValueOnce(jsonResponse({ id: 1 }));
		const c = client("my-api-key");
		await c.get("/v1/standups");

		expect(spy.calls).toHaveLength(1);
		const [url, init] = spy.calls[0]!;
		expect(url).toContain("/v1/standups");
		expect(init?.method).toBe("GET");
		expect(init?.headers).toEqual({
			Authorization: "my-api-key",
			"Content-Type": "application/json",
			"User-Agent": `geekbot-skill-cli/${APP_VERSION}`,
		});
	});

	test("appends query params to URL", async () => {
		spy.mockResolvedValueOnce(jsonResponse([]));
		const c = client();
		await c.get("/v1/standups", { user_id: "5" });

		const [url] = spy.calls[0]!;
		expect(String(url)).toContain("?user_id=5");
	});

	test("returns parsed JSON body on success", async () => {
		spy.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Daily" }));
		const c = client();
		const result = await c.get<{ id: number; name: string }>("/v1/standups");
		expect(result).toEqual({ id: 42, name: "Daily" });
	});

	test("returns null for 204 No Content", async () => {
		spy.mockResolvedValueOnce(new Response(null, { status: 204 }));
		const c = client();
		const result = await c.get("/v1/standups/1");
		expect(result).toBeNull();
	});
});

describe("DELETE requests", () => {
	test("delete method returns null for 204 response", async () => {
		spy.mockResolvedValueOnce(new Response(null, { status: 204 }));
		const c = client();
		const result = await c.delete("/v1/standups/42");
		expect(result).toBeNull();
	});

	test("delete calls fetch with DELETE method", async () => {
		spy.mockResolvedValueOnce(new Response(null, { status: 204 }));
		const c = client();
		await c.delete("/v1/standups/42");

		const [, init] = spy.calls[0]!;
		expect(init?.method).toBe("DELETE");
	});
});

describe("POST requests", () => {
	test("calls fetch with POST method and stringified body", async () => {
		spy.mockResolvedValueOnce(jsonResponse({ id: 1 }));
		const c = client();
		await c.post("/v1/standups", { name: "Test" });

		const [, init] = spy.calls[0]!;
		expect(init?.method).toBe("POST");
		expect(init?.body).toBe(JSON.stringify({ name: "Test" }));
	});

	test("returns parsed JSON on success", async () => {
		spy.mockResolvedValueOnce(jsonResponse({ id: 99 }));
		const c = client();
		const result = await c.post<{ id: number }>("/v1/standups", { name: "New" });
		expect(result).toEqual({ id: 99 });
	});
});

describe("PATCH requests", () => {
	test("calls fetch with PATCH method and stringified body", async () => {
		spy.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Updated" }));
		const c = client();
		await c.patch("/v1/standups/42", { name: "Updated" });

		const [, init] = spy.calls[0]!;
		expect(init?.method).toBe("PATCH");
		expect(init?.body).toBe(JSON.stringify({ name: "Updated" }));
	});

	test("returns parsed JSON on success", async () => {
		spy.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Patched" }));
		const c = client();
		const result = await c.patch<{ id: number; name: string }>("/v1/standups/42", {
			name: "Patched",
		});
		expect(result).toEqual({ id: 42, name: "Patched" });
	});
});

describe("PUT requests", () => {
	test("calls fetch with PUT method and stringified body", async () => {
		spy.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Replaced" }));
		const c = client();
		await c.put("/v1/standups/42", { name: "Replaced", channel: "#new" });

		const [, init] = spy.calls[0]!;
		expect(init?.method).toBe("PUT");
		expect(init?.body).toBe(JSON.stringify({ name: "Replaced", channel: "#new" }));
	});

	test("returns parsed JSON on success", async () => {
		spy.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Replaced" }));
		const c = client();
		const result = await c.put<{ id: number; name: string }>("/v1/standups/42", {
			name: "Replaced",
		});
		expect(result).toEqual({ id: 42, name: "Replaced" });
	});
});

describe("error handling", () => {
	test("401 throws CliError with code 'unauthorized' and exitCode 4", async () => {
		spy.mockResolvedValueOnce(errorResponse("Unauthorized", 401));
		const c = client("bad-key");
		try {
			await c.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("unauthorized");
			expect(err.exitCode).toBe(4);
		}
	});

	test("404 throws CliError with code 'not_found' and exitCode 3", async () => {
		spy.mockResolvedValueOnce(errorResponse("Not found", 404));
		const c = client();
		try {
			await c.get("/v1/standups/999");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("not_found");
			expect(err.exitCode).toBe(3);
		}
	});

	test("400 throws CliError with code 'validation_error' and exitCode 6", async () => {
		spy.mockResolvedValueOnce(errorResponse("Bad request", 400));
		const c = client();
		try {
			await c.post("/v1/standups", {});
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
		spy
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(jsonResponse({ id: 1 }));

		const c = client();
		const result = await c.get<{ id: number }>("/v1/standups");

		expect(result).toEqual({ id: 1 });
		expect(spy.calls).toHaveLength(3);
	});

	test("retries 500 then succeeds", async () => {
		spy
			.mockResolvedValueOnce(errorResponse("Server error", 500))
			.mockResolvedValueOnce(jsonResponse({ ok: true }));

		const c = client();
		const result = await c.get<{ ok: boolean }>("/v1/standups");

		expect(result).toEqual({ ok: true });
		expect(spy.calls).toHaveLength(2);
	});

	test("does NOT retry 401 -- throws immediately", async () => {
		spy.mockResolvedValueOnce(errorResponse("Unauthorized", 401));
		const c = client();

		try {
			await c.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
		}
		expect(spy.calls).toHaveLength(1);
	});

	test("exhausts retries on persistent 429 and throws", async () => {
		spy
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(errorResponse("Rate limited", 429));

		const c = client();
		try {
			await c.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("rate_limited");
		}
		expect(spy.calls).toHaveLength(4);
	});
});

describe("network errors", () => {
	test("throws CliError with code 'network_error' after retries exhausted", async () => {
		spy
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"));

		const c = client();
		try {
			await c.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("network_error");
			expect(err.exitCode).toBe(7);
		}
	});

	test("network error is retryable", async () => {
		spy
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"));

		const c = client();
		try {
			await c.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			const err = e as CliError;
			expect(err.retryable).toBe(true);
		}
	});

	test("network error message contains original error", async () => {
		spy
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockRejectedValueOnce(new Error("Connection refused"));

		const c = client();
		try {
			await c.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			const err = e as CliError;
			expect(err.message).toContain("Network error: Connection refused");
		}
	});
});

describe("path normalization", () => {
	test("strips trailing slash from path", async () => {
		spy.mockResolvedValueOnce(jsonResponse([]));
		const c = client();
		await c.get("/v1/standups/");

		const [url] = spy.calls[0]!;
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

		spy
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(jsonResponse({ id: 1 }));

		const c = client("test-key", true);

		try {
			await c.get("/v1/standups");
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

		spy
			.mockRejectedValueOnce(new Error("Connection refused"))
			.mockResolvedValueOnce(jsonResponse({ id: 1 }));

		const c = client("test-key", true);
		try {
			await c.get("/v1/standups");
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

		spy.mockResolvedValueOnce(errorResponse("Bad request", 400));

		const c = client("test-key", true);
		try {
			await c.get("/v1/standups");
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

		spy
			.mockResolvedValueOnce(errorResponse("Rate limited", 429))
			.mockResolvedValueOnce(jsonResponse({ id: 1 }));

		const secretKey = "super-secret-api-key-12345";
		const c = client(secretKey, true);

		try {
			await c.get("/v1/standups");
		} finally {
			process.stderr.write = origWrite;
		}

		const allOutput = stderrMessages.join("");
		expect(allOutput).not.toContain(secretKey);
		expect(allOutput).toContain("[debug]");
	});

	test("handles non-Error network failures", async () => {
		spy
			.mockRejectedValueOnce("string error")
			.mockRejectedValueOnce("string error")
			.mockRejectedValueOnce("string error")
			.mockRejectedValueOnce("string error");

		const c = client();
		try {
			await c.get("/v1/standups");
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).message).toContain("string error");
		}
	});
});
