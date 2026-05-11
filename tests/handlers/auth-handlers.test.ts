import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Auth handlers test suite.
 *
 * Strategy: mock resolveCredential, createHttpClient, keychain functions,
 * and writeOutput to isolate handler logic.
 */

// ── Fixtures ──────────────────────────────────────────────────────────

const ME_RESPONSE = {
	user: {
		id: "1",
		username: "testuser",
		realname: "Test User",
		firstname: "Test",
		email: "test@example.com",
		profile_img: "https://example.com/img.png",
		timezone: "UTC",
		is_admin: true,
		is_billing_admin: false,
		role: "admin" as const,
	},
	team: {
		id: 1,
		name: "Test Team",
	},
};

// ── Mock Setup ────────────────────────────────────────────────────────

const mockGet = mock(() => Promise.resolve(ME_RESPONSE));
const mockClient = {
	get: mockGet,
	post: mock(() => Promise.resolve(null)),
	patch: mock(() => Promise.resolve(null)),
	put: mock(() => Promise.resolve(null)),
	delete: mock(() => Promise.resolve(null)),
};

const mockResolveCredential = mock(() =>
	Promise.resolve({ apiKey: "test-key", source: "env" as const }),
);

mock.module("../../src/auth/resolver.ts", () => ({
	resolveCredential: mockResolveCredential,
}));

mock.module("../../src/http/client.ts", () => ({
	createHttpClient: mock(() => mockClient),
}));

const mockGetKeychainKey = mock(() => null as string | null);
const mockSetKeychainKey = mock((_key: string) => {});
const mockDeleteKeychainKey = mock(() => {});

mock.module("../../src/auth/keychain.ts", () => ({
	getKeychainKey: mockGetKeychainKey,
	setKeychainKey: mockSetKeychainKey,
	deleteKeychainKey: mockDeleteKeychainKey,
}));

const mockWriteOutput = mock(() => {});
mock.module("../../src/output/formatter.ts", () => ({
	writeOutput: mockWriteOutput,
}));

// Import handlers AFTER mocks
const { handleAuthSetup, handleAuthStatus, handleAuthRemove, handleAuthLogin } = await import(
	"../../src/handlers/auth-handlers.ts"
);
const { CliError } = await import("../../src/errors/cli-error.ts");

const GLOBAL_OPTS = {
	apiKey: undefined,
	output: "json" as const,
	debug: false,
};

beforeEach(() => {
	mockGet.mockReset();
	mockGet.mockReturnValue(Promise.resolve(ME_RESPONSE));
	mockResolveCredential.mockReset();
	mockResolveCredential.mockReturnValue(
		Promise.resolve({ apiKey: "test-key", source: "env" as const }),
	);
	mockGetKeychainKey.mockReset();
	mockGetKeychainKey.mockReturnValue(null);
	mockSetKeychainKey.mockReset();
	mockDeleteKeychainKey.mockReset();
	mockWriteOutput.mockReset();
});

afterAll(() => {
	mock.restore();
});

// ── handleAuthSetup ──────────────────────────────────────────────────

describe("handleAuthSetup", () => {
	test("with --api-key flag: verifies key, stores in keychain, outputs success", async () => {
		await handleAuthSetup({ apiKey: "my-api-key" }, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/me");
		expect(mockSetKeychainKey).toHaveBeenCalledWith("my-api-key");
		expect(mockWriteOutput).toHaveBeenCalledTimes(1);

		const envelope = mockWriteOutput.mock.calls[0][0] as {
			ok: boolean;
			data: { authenticated: boolean; username: string; email: string };
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.authenticated).toBe(true);
		expect(envelope.data.username).toBe("testuser");
		expect(envelope.data.email).toBe("test@example.com");
	});

	test("interactive TTY prompt reads API key from stdin", async () => {
		const origIsTTY = process.stdin.isTTY;
		Object.defineProperty(process.stdin, "isTTY", {
			value: true,
			configurable: true,
		});

		const mockQuestion = mock((_prompt: string, callback: (answer: string) => void) => {
			callback("  user-entered-key  "); // with whitespace to test trim
		});
		const mockClose = mock(() => {});

		mock.module("readline", () => ({
			createInterface: mock(() => ({
				question: mockQuestion,
				close: mockClose,
			})),
		}));

		try {
			await handleAuthSetup({}, GLOBAL_OPTS);

			// Should have used the key from readline (trimmed)
			expect(mockSetKeychainKey).toHaveBeenCalledWith("user-entered-key");
			expect(mockGet).toHaveBeenCalledWith("/v1/me");
		} finally {
			Object.defineProperty(process.stdin, "isTTY", {
				value: origIsTTY,
				configurable: true,
			});
		}
	});

	test("interactive TTY prompt does not echo the API key to output", async () => {
		const origIsTTY = process.stdin.isTTY;
		Object.defineProperty(process.stdin, "isTTY", {
			value: true,
			configurable: true,
		});

		// Track what output stream was given to createInterface
		let capturedOutput: { write: (...args: unknown[]) => unknown } | null = null;
		const mockQuestion = mock((_prompt: string, callback: (answer: string) => void) => {
			callback("secret-api-key-12345");
		});
		const mockClose = mock(() => {});

		mock.module("readline", () => ({
			createInterface: mock((opts: { output: { write: (...args: unknown[]) => unknown } }) => {
				capturedOutput = opts.output;
				return {
					question: mockQuestion,
					close: mockClose,
				};
			}),
		}));

		// Capture everything written to stderr during the call
		const stderrWrites: string[] = [];
		const origStderrWrite = process.stderr.write;
		process.stderr.write = mock((...args: unknown[]) => {
			stderrWrites.push(String(args[0]));
			return true;
		}) as unknown as typeof process.stderr.write;

		try {
			await handleAuthSetup({}, GLOBAL_OPTS);

			// The readline output stream should NOT be process.stderr or process.stdout.
			// It should be a muted/no-op writable that discards data.
			expect(capturedOutput).not.toBe(process.stderr);
			expect(capturedOutput).not.toBe(process.stdout);

			// Verify the muted output stream actually discards data (write is a no-op)
			expect(capturedOutput).not.toBeNull();
			// Write some data to the captured output; it should silently discard it
			const writeResult = await new Promise<void>((resolve, reject) => {
				capturedOutput?.write(
					"should-be-discarded",
					"utf8" as unknown,
					((err: Error | null | undefined) => {
						if (err) reject(err);
						else resolve();
					}) as unknown,
				);
			});
			expect(writeResult).toBeUndefined(); // completed without error

			// The API key must not appear in anything written to stderr
			const allStderr = stderrWrites.join("");
			expect(allStderr).not.toContain("secret-api-key-12345");

			// The prompt text should still be printed to stderr
			expect(allStderr).toContain("Enter your Geekbot API key:");
		} finally {
			process.stderr.write = origStderrWrite;
			Object.defineProperty(process.stdin, "isTTY", {
				value: origIsTTY,
				configurable: true,
			});
		}
	});

	test("non-TTY without --api-key throws auth_setup_non_interactive", async () => {
		// Save original
		const origIsTTY = process.stdin.isTTY;
		Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });

		try {
			await handleAuthSetup({}, GLOBAL_OPTS);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("auth_setup_non_interactive");
		} finally {
			Object.defineProperty(process.stdin, "isTTY", { value: origIsTTY, configurable: true });
		}
	});

	test("warns when replacing existing key", async () => {
		mockGetKeychainKey.mockReturnValue("old-key");
		const stderrSpy = mock(() => true);
		const origWrite = process.stderr.write;
		process.stderr.write = stderrSpy as unknown as typeof process.stderr.write;

		try {
			await handleAuthSetup({ apiKey: "new-key" }, GLOBAL_OPTS);
			const calls = stderrSpy.mock.calls.map((c) => String(c[0]));
			expect(calls.some((c) => c.includes("Replacing existing API key in keychain"))).toBe(true);
			// Must NOT contain the new key's email (that would be misleading)
			expect(calls.some((c) => c.includes("test@example.com"))).toBe(false);
		} finally {
			process.stderr.write = origWrite;
		}
	});

	test("throws keychain_unavailable when setKeychainKey fails", async () => {
		mockSetKeychainKey.mockImplementation(() => {
			throw new Error("keychain locked");
		});

		try {
			await handleAuthSetup({ apiKey: "my-key" }, GLOBAL_OPTS);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("keychain_unavailable");
		}
	});
});

// ── handleAuthStatus ─────────────────────────────────────────────────

describe("handleAuthStatus", () => {
	test("with valid credential: outputs source, username, email", async () => {
		await handleAuthStatus(GLOBAL_OPTS);

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0] as {
			ok: boolean;
			data: {
				authenticated: boolean;
				source: string;
				username: string;
				email: string;
			};
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.authenticated).toBe(true);
		expect(envelope.data.source).toBe("env");
		expect(envelope.data.username).toBe("testuser");
		expect(envelope.data.email).toBe("test@example.com");
	});

	test("with no credential: outputs authenticated false", async () => {
		const { CliError: CE } = await import("../../src/errors/cli-error.ts");
		mockResolveCredential.mockImplementation(() => {
			throw new CE("No API key found", "auth_missing", 4, false);
		});

		await handleAuthStatus(GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0][0] as {
			ok: boolean;
			data: { authenticated: boolean; source: null };
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.authenticated).toBe(false);
		expect(envelope.data.source).toBe(null);
	});

	test("rethrows non-auth errors", async () => {
		mockResolveCredential.mockImplementation(() => {
			throw new Error("network failure");
		});

		try {
			await handleAuthStatus(GLOBAL_OPTS);
			throw new Error("should have thrown");
		} catch (e) {
			expect((e as Error).message).toBe("network failure");
		}
	});
});

// ── handleAuthLogin ──────────────────────────────────────────────────

describe("handleAuthLogin", () => {
	const BASE = "https://oauth.test";

	function jsonResponse(status: number, body: unknown): Response {
		return new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});
	}

	/** Builds a fake loopback server that resolves with a fixed code/state. */
	function fakeServer(opts: { code?: string; state?: string; throwAt?: "callback" } = {}) {
		let closed = false;
		return {
			port: 0,
			redirectUri: "http://127.0.0.1:9999/callback",
			awaitCallback: async (expectedState: string) => {
				if (opts.throwAt === "callback") {
					throw new CliError("access_denied", "oauth_access_denied", 4, false);
				}
				return { code: opts.code ?? "auth-code", state: opts.state ?? expectedState };
			},
			close: async () => {
				closed = true;
			},
			get closed(): boolean {
				return closed;
			},
		};
	}

	test("runs loopback flow, stores token, verifies via /v1/me, writes success envelope", async () => {
		const openBrowser = mock((_url: string) => {});
		const promptWrites: string[] = [];
		const prompt = (text: string) => {
			promptWrites.push(text);
		};

		const fetchImpl = mock(async () =>
			jsonResponse(200, {
				access_token: "cli_minted_xyz",
				token_type: "Bearer",
				expires_in: 2592000,
				scope: "cli",
			}),
		) as unknown as typeof globalThis.fetch;

		const server = fakeServer({ code: "the-auth-code" });

		await handleAuthLogin(
			{
				deviceName: "test-device",
				ttlDays: 30,
				loopback: {
					baseUrl: BASE,
					clientId: "geekbot-cli",
					fetchImpl,
					openBrowser,
					startServer: async () => server,
					prompt,
				},
			},
			GLOBAL_OPTS,
		);

		expect(mockGet).toHaveBeenCalledWith("/v1/me");
		expect(mockSetKeychainKey).toHaveBeenCalledWith("cli_minted_xyz");
		expect(openBrowser).toHaveBeenCalledTimes(1);
		expect(openBrowser.mock.calls[0][0]).toContain(`${BASE}/v2/authorize`);
		expect(openBrowser.mock.calls[0][0]).toContain("device_name=test-device");
		expect(openBrowser.mock.calls[0][0]).toContain("ttl_days=30");

		const promptText = promptWrites.join("");
		expect(promptText).toContain("Listening on http://127.0.0.1:9999/callback");
		expect(promptText).toContain("state is single-use");

		const envelope = mockWriteOutput.mock.calls[0][0] as {
			ok: boolean;
			data: {
				authenticated: boolean;
				method: string;
				username: string;
				email: string;
				token_type: string;
				scope: string;
			};
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.authenticated).toBe(true);
		expect(envelope.data.method).toBe("oauth_loopback");
		expect(envelope.data.username).toBe("testuser");
		expect(envelope.data.email).toBe("test@example.com");
		expect(envelope.data.token_type).toBe("Bearer");
		expect(envelope.data.scope).toBe("cli");

		expect(server.closed).toBe(true);
	});

	test("--no-browser skips opener but still completes", async () => {
		const openBrowser = mock(() => {});
		const fetchImpl = mock(async () =>
			jsonResponse(200, { access_token: "cli_2" }),
		) as unknown as typeof globalThis.fetch;

		await handleAuthLogin(
			{
				noBrowser: true,
				ttlDays: 30,
				loopback: {
					baseUrl: BASE,
					clientId: "geekbot-cli",
					fetchImpl,
					openBrowser,
					startServer: async () => fakeServer(),
					prompt: () => {},
				},
			},
			GLOBAL_OPTS,
		);

		expect(openBrowser).not.toHaveBeenCalled();
		expect(mockSetKeychainKey).toHaveBeenCalledWith("cli_2");
	});

	test("does not store token if /v1/me verification fails", async () => {
		mockGet.mockImplementation(() =>
			Promise.reject(new CliError("Unauthorized", "unauthorized", 4, false)),
		);
		const fetchImpl = mock(async () =>
			jsonResponse(200, { access_token: "cli_bad" }),
		) as unknown as typeof globalThis.fetch;

		try {
			await handleAuthLogin(
				{
					noBrowser: true,
					ttlDays: 30,
					loopback: {
						baseUrl: BASE,
						clientId: "geekbot-cli",
						fetchImpl,
						openBrowser: () => {},
						startServer: async () => fakeServer(),
						prompt: () => {},
					},
				},
				GLOBAL_OPTS,
			);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as InstanceType<typeof CliError>).code).toBe("unauthorized");
		}

		expect(mockSetKeychainKey).not.toHaveBeenCalled();
	});

	test("warns when replacing an existing keychain entry", async () => {
		mockGetKeychainKey.mockReturnValue("old-key");
		const stderrSpy = mock(() => true);
		const origWrite = process.stderr.write;
		process.stderr.write = stderrSpy as unknown as typeof process.stderr.write;

		try {
			const fetchImpl = mock(async () =>
				jsonResponse(200, { access_token: "cli_new" }),
			) as unknown as typeof globalThis.fetch;

			await handleAuthLogin(
				{
					noBrowser: true,
					ttlDays: 30,
					loopback: {
						baseUrl: BASE,
						clientId: "geekbot-cli",
						fetchImpl,
						openBrowser: () => {},
						startServer: async () => fakeServer(),
						prompt: () => {},
					},
				},
				GLOBAL_OPTS,
			);

			const text = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
			expect(text).toContain("Replacing existing API key in keychain");
		} finally {
			process.stderr.write = origWrite;
		}
	});

	test("propagates access_denied from the callback step without calling /v1/me", async () => {
		const fetchImpl = mock(async () =>
			jsonResponse(500, { error: "should_not_be_called" }),
		) as unknown as typeof globalThis.fetch;

		try {
			await handleAuthLogin(
				{
					noBrowser: true,
					ttlDays: 30,
					loopback: {
						baseUrl: BASE,
						clientId: "geekbot-cli",
						fetchImpl,
						openBrowser: () => {},
						startServer: async () => fakeServer({ throwAt: "callback" }),
						prompt: () => {},
					},
				},
				GLOBAL_OPTS,
			);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as InstanceType<typeof CliError>).code).toBe("oauth_access_denied");
		}

		expect(mockSetKeychainKey).not.toHaveBeenCalled();
		expect(mockGet).not.toHaveBeenCalled();
	});
});

// ── handleAuthRemove ─────────────────────────────────────────────────

describe("handleAuthRemove", () => {
	test("success: calls deleteKeychainKey and outputs removed true", async () => {
		await handleAuthRemove(GLOBAL_OPTS);

		expect(mockDeleteKeychainKey).toHaveBeenCalledTimes(1);
		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0] as {
			ok: boolean;
			data: { removed: boolean };
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.removed).toBe(true);
	});

	test("when no key exists: throws keychain_not_found", async () => {
		mockDeleteKeychainKey.mockImplementation(() => {
			throw new Error("no entry");
		});

		try {
			await handleAuthRemove(GLOBAL_OPTS);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("keychain_not_found");
		}
	});
});
