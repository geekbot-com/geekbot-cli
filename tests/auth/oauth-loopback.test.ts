import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
	buildAuthorizeUrl,
	exchangeCodeForToken,
	generatePkce,
	generateState,
	type LoopbackServer,
	runLoopbackFlow,
	startLoopbackServer,
} from "../../src/auth/oauth-loopback.ts";
import { CliError } from "../../src/errors/cli-error.ts";

const BASE = "https://oauth.test.geekbot.com";
const CLIENT_ID = "geekbot-cli";

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function base64urlSha256(input: string): string {
	return createHash("sha256")
		.update(input)
		.digest("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

// ── PKCE / state ─────────────────────────────────────────────────────

describe("generatePkce", () => {
	test("verifier is base64url-safe, 43+ chars", () => {
		const pkce = generatePkce();
		expect(pkce.method).toBe("S256");
		expect(pkce.verifier.length).toBeGreaterThanOrEqual(43);
		expect(pkce.verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
	});

	test("challenge is the base64url(sha256(verifier))", () => {
		const pkce = generatePkce();
		expect(pkce.challenge).toBe(base64urlSha256(pkce.verifier));
	});

	test("each call returns a different verifier", () => {
		const a = generatePkce();
		const b = generatePkce();
		expect(a.verifier).not.toBe(b.verifier);
	});
});

describe("generateState", () => {
	test("returns a base64url string", () => {
		const s = generateState();
		expect(s.length).toBeGreaterThanOrEqual(20);
		expect(s).toMatch(/^[A-Za-z0-9\-_]+$/);
	});

	test("each call is unique", () => {
		expect(generateState()).not.toBe(generateState());
	});
});

// ── buildAuthorizeUrl ────────────────────────────────────────────────

describe("buildAuthorizeUrl", () => {
	test("encodes every required parameter into /v2/authorize", () => {
		const url = buildAuthorizeUrl({
			baseUrl: BASE,
			clientId: CLIENT_ID,
			redirectUri: "http://127.0.0.1:12345/callback",
			state: "state-xyz",
			codeChallenge: "challenge-abc",
			scope: "cli",
			deviceName: "laptop",
			ttlDays: 30,
		});
		const parsed = new URL(url);
		expect(parsed.origin + parsed.pathname).toBe(`${BASE}/v2/authorize`);
		expect(parsed.searchParams.get("response_type")).toBe("code");
		expect(parsed.searchParams.get("client_id")).toBe(CLIENT_ID);
		expect(parsed.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:12345/callback");
		expect(parsed.searchParams.get("state")).toBe("state-xyz");
		expect(parsed.searchParams.get("code_challenge")).toBe("challenge-abc");
		expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
		expect(parsed.searchParams.get("scope")).toBe("cli");
		expect(parsed.searchParams.get("device_name")).toBe("laptop");
		expect(parsed.searchParams.get("ttl_days")).toBe("30");
	});
});

// ── exchangeCodeForToken ─────────────────────────────────────────────

describe("exchangeCodeForToken", () => {
	test("POSTs form-encoded grant=authorization_code with PKCE verifier", async () => {
		let captured: { url: string; init: RequestInit } | null = null;
		const fetchImpl = (async (input: unknown, init?: RequestInit) => {
			captured = {
				url: typeof input === "string" ? input : (input as Request).url,
				init: init ?? {},
			};
			return jsonResponse(200, {
				access_token: "cli_xyz",
				token_type: "Bearer",
				expires_in: 2592000,
				scope: "cli",
			});
		}) as unknown as typeof globalThis.fetch;

		const token = await exchangeCodeForToken({
			code: "auth-code-abc",
			codeVerifier: "verifier-abc",
			redirectUri: "http://127.0.0.1:5555/callback",
			baseUrl: BASE,
			clientId: CLIENT_ID,
			fetchImpl,
		});

		expect(token.access_token).toBe("cli_xyz");
		expect(token.scope).toBe("cli");
		expect(token.token_type).toBe("Bearer");

		if (!captured) throw new Error("fetchImpl was not called");
		expect(captured.url).toBe(`${BASE}/v2/token`);
		expect(captured.init.method).toBe("POST");
		const body = new URLSearchParams(captured.init.body as string);
		expect(body.get("grant_type")).toBe("authorization_code");
		expect(body.get("code")).toBe("auth-code-abc");
		expect(body.get("code_verifier")).toBe("verifier-abc");
		expect(body.get("client_id")).toBe(CLIENT_ID);
		expect(body.get("redirect_uri")).toBe("http://127.0.0.1:5555/callback");
	});

	test("maps an invalid_grant error to a CliError with oauth_invalid_grant code", async () => {
		const fetchImpl = (async () =>
			jsonResponse(400, {
				error: "invalid_grant",
				error_description: "authorization code is invalid or expired",
			})) as unknown as typeof globalThis.fetch;

		try {
			await exchangeCodeForToken({
				code: "x",
				codeVerifier: "y",
				redirectUri: "http://127.0.0.1:1/callback",
				baseUrl: BASE,
				clientId: CLIENT_ID,
				fetchImpl,
			});
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("oauth_invalid_grant");
			expect(err.message).toContain("invalid or expired");
		}
	});

	test("rejects token responses missing access_token", async () => {
		const fetchImpl = (async () =>
			jsonResponse(200, { token_type: "Bearer" })) as unknown as typeof globalThis.fetch;
		try {
			await exchangeCodeForToken({
				code: "x",
				codeVerifier: "y",
				redirectUri: "http://127.0.0.1:1/callback",
				baseUrl: BASE,
				clientId: CLIENT_ID,
				fetchImpl,
			});
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("oauth_invalid_response");
		}
	});

	test("network failures surface as retryable network_error", async () => {
		const fetchImpl = (async () => {
			throw new Error("ECONNREFUSED");
		}) as unknown as typeof globalThis.fetch;
		try {
			await exchangeCodeForToken({
				code: "x",
				codeVerifier: "y",
				redirectUri: "http://127.0.0.1:1/callback",
				baseUrl: BASE,
				clientId: CLIENT_ID,
				fetchImpl,
			});
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("network_error");
			expect((e as CliError).retryable).toBe(true);
		}
	});
});

// ── Loopback server ──────────────────────────────────────────────────

describe("startLoopbackServer", () => {
	test("binds 127.0.0.1, exposes a redirect URI with the actual port, and resolves on /callback", async () => {
		const server = await startLoopbackServer();
		try {
			expect(server.port).toBeGreaterThan(0);
			expect(server.redirectUri).toBe(`http://127.0.0.1:${server.port}/callback`);

			const callback = server.awaitCallback("state-xyz", 5000);
			const response = await fetch(`${server.redirectUri}?code=abc&state=state-xyz`);
			expect(response.status).toBe(200);
			expect(await response.text()).toContain("Signed in to Geekbot CLI");

			const result = await callback;
			expect(result.code).toBe("abc");
			expect(result.state).toBe("state-xyz");
		} finally {
			await server.close();
		}
	});

	test("state mismatch throws oauth_state_mismatch", async () => {
		const server = await startLoopbackServer();
		try {
			const callback = server.awaitCallback("expected-state", 5000).catch((e) => e);
			await fetch(`${server.redirectUri}?code=abc&state=evil-state`);
			const e = await callback;
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("oauth_state_mismatch");
		} finally {
			await server.close();
		}
	});

	test("error callback rejects with oauth_<error>", async () => {
		const server = await startLoopbackServer();
		try {
			const callback = server.awaitCallback("s", 5000).catch((e) => e);
			const res = await fetch(
				`${server.redirectUri}?error=access_denied&error_description=user%20said%20no&state=s`,
			);
			expect(res.status).toBe(400);
			const e = await callback;
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("oauth_access_denied");
			expect((e as CliError).message).toContain("user said no");
		} finally {
			await server.close();
		}
	});

	test("non-/callback paths return 404", async () => {
		const server = await startLoopbackServer();
		try {
			const res = await fetch(`http://127.0.0.1:${server.port}/something-else`);
			expect(res.status).toBe(404);
		} finally {
			await server.close();
		}
	});

	test("missing code returns 400 and rejects with oauth_invalid_callback", async () => {
		const server = await startLoopbackServer();
		try {
			const callback = server.awaitCallback("s", 5000).catch((e) => e);
			const res = await fetch(`${server.redirectUri}?state=s`);
			expect(res.status).toBe(400);
			const e = await callback;
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("oauth_invalid_callback");
		} finally {
			await server.close();
		}
	});

	test("awaitCallback times out", async () => {
		const server = await startLoopbackServer();
		try {
			const start = Date.now();
			const e = await server.awaitCallback("s", 50).catch((err) => err);
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("oauth_callback_timeout");
			expect(Date.now() - start).toBeGreaterThanOrEqual(40);
		} finally {
			await server.close();
		}
	});
});

// ── runLoopbackFlow ──────────────────────────────────────────────────

describe("runLoopbackFlow", () => {
	function fakeServer(callback: { code: string; state?: string }): LoopbackServer {
		let actualState = "";
		return {
			port: 0,
			redirectUri: "http://127.0.0.1:9999/callback",
			awaitCallback: async (expectedState: string) => {
				actualState = callback.state ?? expectedState;
				return { code: callback.code, state: actualState };
			},
			close: async () => {},
		};
	}

	test("end-to-end: opens browser, awaits callback, exchanges code", async () => {
		let openedUrl: string | null = null;
		let exchangedBody: string | null = null;
		const fetchImpl = (async (_input: unknown, init?: RequestInit) => {
			exchangedBody = (init?.body as string) ?? null;
			return jsonResponse(200, {
				access_token: "cli_zzz",
				token_type: "Bearer",
				expires_in: 2592000,
				scope: "cli",
			});
		}) as unknown as typeof globalThis.fetch;

		const token = await runLoopbackFlow(
			{ deviceName: "test-device", ttlDays: 30 },
			{
				baseUrl: BASE,
				clientId: CLIENT_ID,
				fetchImpl,
				openBrowser: (url) => {
					openedUrl = url;
				},
				startServer: async () => fakeServer({ code: "the-auth-code" }),
				prompt: () => {},
			},
		);

		expect(token.access_token).toBe("cli_zzz");
		expect(openedUrl).toContain(`${BASE}/v2/authorize?`);
		expect(openedUrl).toContain("device_name=test-device");
		expect(openedUrl).toContain("ttl_days=30");
		expect(openedUrl).toContain("code_challenge=");
		expect(openedUrl).toContain("code_challenge_method=S256");
		expect(openedUrl).toContain("redirect_uri=http%3A%2F%2F127.0.0.1%3A9999%2Fcallback");

		if (!exchangedBody) throw new Error("token exchange request body was never captured");
		const body = new URLSearchParams(exchangedBody);
		expect(body.get("code")).toBe("the-auth-code");
		expect(body.get("grant_type")).toBe("authorization_code");
		expect(body.get("code_verifier")?.length ?? 0).toBeGreaterThan(40);
	});

	test("--no-browser skips opener but still runs", async () => {
		const opener = (() => {
			throw new Error("should not be called");
		}) as (url: string) => void;
		const fetchImpl = (async () =>
			jsonResponse(200, { access_token: "cli_x" })) as unknown as typeof globalThis.fetch;

		const token = await runLoopbackFlow(
			{ noBrowser: true, ttlDays: 30 },
			{
				baseUrl: BASE,
				clientId: CLIENT_ID,
				fetchImpl,
				openBrowser: opener,
				startServer: async () => fakeServer({ code: "abc" }),
				prompt: () => {},
			},
		);
		expect(token.access_token).toBe("cli_x");
	});

	test("rejects ttlDays not in the allowed list", async () => {
		try {
			await runLoopbackFlow(
				// @ts-expect-error -- intentionally invalid
				{ ttlDays: 14 },
				{
					baseUrl: BASE,
					clientId: CLIENT_ID,
					startServer: async () => fakeServer({ code: "abc" }),
					fetchImpl: (async () => jsonResponse(200, {})) as unknown as typeof globalThis.fetch,
					prompt: () => {},
				},
			);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("closes the loopback server even on token-exchange failure", async () => {
		let closed = false;
		const server: LoopbackServer = {
			port: 0,
			redirectUri: "http://127.0.0.1:1/callback",
			awaitCallback: async () => ({ code: "abc", state: "s" }),
			close: async () => {
				closed = true;
			},
		};
		const fetchImpl = (async () =>
			jsonResponse(400, { error: "invalid_grant" })) as unknown as typeof globalThis.fetch;

		try {
			await runLoopbackFlow(
				{ ttlDays: 30 },
				{
					baseUrl: BASE,
					clientId: CLIENT_ID,
					fetchImpl,
					openBrowser: () => {},
					startServer: async () => server,
					prompt: () => {},
				},
			);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("oauth_invalid_grant");
		}
		expect(closed).toBe(true);
	});
});
