import { createHash, randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import {
	APP_VERSION,
	OAUTH_BASE_URL,
	OAUTH_CLI_ALLOWED_TTL_DAYS,
	OAUTH_CLIENT_ID,
	type OAuthCliTtlDays,
} from "../utils/constants.ts";

const USER_AGENT = `geekbot-skill-cli/${APP_VERSION}`;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export interface PkcePair {
	verifier: string;
	challenge: string;
	method: "S256";
}

export interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number | null;
	scope: string;
}

export interface CallbackResult {
	code: string;
	state: string;
}

export interface LoopbackServer {
	port: number;
	redirectUri: string;
	awaitCallback: (expectedState: string, timeoutMs?: number) => Promise<CallbackResult>;
	close: () => Promise<void>;
}

export interface LoopbackDeps {
	fetchImpl?: typeof globalThis.fetch;
	openBrowser?: (url: string) => Promise<void> | void;
	startServer?: () => Promise<LoopbackServer>;
	baseUrl?: string;
	clientId?: string;
	prompt?: (text: string) => void;
	debug?: boolean;
}

export interface RunLoopbackOptions {
	deviceName?: string;
	ttlDays?: OAuthCliTtlDays;
	scope?: string;
	noBrowser?: boolean;
	timeoutMs?: number;
}

// ── PKCE helpers ─────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
	return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkce(): PkcePair {
	// 32 bytes -> 43-char base64url verifier, well within RFC 7636's 43-128 range.
	const verifier = base64url(randomBytes(32));
	const challenge = base64url(createHash("sha256").update(verifier).digest());
	return { verifier, challenge, method: "S256" };
}

export function generateState(): string {
	return base64url(randomBytes(16));
}

// ── URL building ─────────────────────────────────────────────────────

export interface AuthorizeUrlParams {
	baseUrl?: string;
	clientId?: string;
	redirectUri: string;
	state: string;
	codeChallenge: string;
	scope: string;
	deviceName: string;
	ttlDays: OAuthCliTtlDays;
}

export function buildAuthorizeUrl(params: AuthorizeUrlParams): string {
	const base = (params.baseUrl ?? OAUTH_BASE_URL).replace(/\/+$/, "");
	const query = new URLSearchParams({
		response_type: "code",
		client_id: params.clientId ?? OAUTH_CLIENT_ID,
		redirect_uri: params.redirectUri,
		state: params.state,
		code_challenge: params.codeChallenge,
		code_challenge_method: "S256",
		scope: params.scope,
		device_name: params.deviceName,
		ttl_days: String(params.ttlDays),
	});
	return `${base}/v2/authorize?${query.toString()}`;
}

// ── Token exchange ───────────────────────────────────────────────────

export interface ExchangeCodeParams {
	code: string;
	codeVerifier: string;
	redirectUri: string;
	baseUrl?: string;
	clientId?: string;
	fetchImpl?: typeof globalThis.fetch;
}

export async function exchangeCodeForToken(params: ExchangeCodeParams): Promise<TokenResponse> {
	const _fetch = params.fetchImpl ?? globalThis.fetch;
	const base = (params.baseUrl ?? OAUTH_BASE_URL).replace(/\/+$/, "");
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code: params.code,
		redirect_uri: params.redirectUri,
		client_id: params.clientId ?? OAUTH_CLIENT_ID,
		code_verifier: params.codeVerifier,
	});

	let response: Response;
	try {
		response = await _fetch(`${base}/v2/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
				"User-Agent": USER_AGENT,
			},
			body: body.toString(),
		});
	} catch (error) {
		throw new CliError(
			`Network error contacting OAuth server: ${error instanceof Error ? error.message : String(error)}`,
			"network_error",
			ExitCode.NETWORK,
			true,
			"Check your internet connection and try again.",
		);
	}

	const payload = await readJson(response);

	if (!response.ok) {
		throw oauthError(payload, response.status);
	}

	if (
		!isObject(payload) ||
		typeof payload.access_token !== "string" ||
		payload.access_token === ""
	) {
		throw new CliError(
			"OAuth server returned an invalid token response.",
			"oauth_invalid_response",
			ExitCode.API_ERROR,
			false,
		);
	}

	return {
		access_token: payload.access_token,
		token_type: typeof payload.token_type === "string" ? payload.token_type : "Bearer",
		expires_in: typeof payload.expires_in === "number" ? payload.expires_in : null,
		scope: typeof payload.scope === "string" ? payload.scope : "cli",
	};
}

// ── Loopback HTTP server ─────────────────────────────────────────────

const SUCCESS_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Geekbot CLI</title>
<style>body{font-family:system-ui;text-align:center;padding:48px;color:#222}
.box{max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px}
h1{margin:0 0 8px;font-size:20px}</style></head>
<body><div class="box"><h1>✓ Signed in to Geekbot CLI</h1>
<p>You can close this tab and return to your terminal.</p></div></body></html>`;

const ERROR_PAGE = (msg: string): string =>
	`<!doctype html><html><head><meta charset="utf-8"><title>Geekbot CLI</title></head>
<body style="font-family:system-ui;padding:48px"><h1>Sign-in failed</h1>
<p>${msg.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c)}</p>
<p>Return to your terminal for details.</p></body></html>`;

/**
 * Starts a loopback HTTP listener on 127.0.0.1:<random port> and resolves
 * with the redirect_uri + a one-shot promise for the callback parameters.
 *
 * The server handles a single GET /callback and then closes. Subsequent or
 * mismatched requests get a 404.
 */
export async function startLoopbackServer(): Promise<LoopbackServer> {
	let resolveCallback: (value: CallbackResult) => void;
	let rejectCallback: (err: unknown) => void;
	const callbackPromise = new Promise<CallbackResult>((res, rej) => {
		resolveCallback = res;
		rejectCallback = rej;
	});
	let consumed = false;

	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(req) {
			const url = new URL(req.url);
			if (url.pathname !== "/callback") {
				return new Response("Not found", { status: 404 });
			}
			if (consumed) {
				return new Response("Already handled", { status: 410 });
			}
			const error = url.searchParams.get("error");
			const code = url.searchParams.get("code");
			const state = url.searchParams.get("state");

			if (error) {
				consumed = true;
				const description = url.searchParams.get("error_description") ?? "";
				rejectCallback(
					new CliError(
						description ? `${error}: ${description}` : error,
						`oauth_${error}`,
						ExitCode.AUTH,
						false,
					),
				);
				return new Response(ERROR_PAGE(`${error}${description ? `: ${description}` : ""}`), {
					status: 400,
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

			if (!code || !state) {
				consumed = true;
				rejectCallback(
					new CliError(
						"OAuth callback missing code or state",
						"oauth_invalid_callback",
						ExitCode.AUTH,
						false,
					),
				);
				return new Response(ERROR_PAGE("Missing code or state in callback."), {
					status: 400,
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

			consumed = true;
			resolveCallback({ code, state });
			return new Response(SUCCESS_PAGE, {
				status: 200,
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		},
	});

	const port = server.port as number;
	const redirectUri = `http://127.0.0.1:${port}/callback`;

	const awaitCallback = async (
		expectedState: string,
		timeoutMs: number = DEFAULT_TIMEOUT_MS,
	): Promise<CallbackResult> => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			const result = await Promise.race([
				callbackPromise,
				new Promise<never>((_resolve, reject) => {
					timer = setTimeout(() => {
						reject(
							new CliError(
								"Timed out waiting for OAuth callback.",
								"oauth_callback_timeout",
								ExitCode.AUTH,
								false,
								"Restart `geekbot auth login` and complete the sign-in within a few minutes.",
							),
						);
					}, timeoutMs);
				}),
			]);
			if (result.state !== expectedState) {
				throw new CliError(
					"OAuth callback state did not match.",
					"oauth_state_mismatch",
					ExitCode.AUTH,
					false,
					"The login response did not match this CLI session. Run `geekbot auth login` again.",
				);
			}
			return result;
		} finally {
			if (timer) clearTimeout(timer);
		}
	};

	return {
		port,
		redirectUri,
		awaitCallback,
		close: async () => {
			server.stop(true);
		},
	};
}

// ── Browser opener ───────────────────────────────────────────────────

export async function openInBrowser(url: string): Promise<void> {
	const platform = process.platform;
	let command: string;
	let args: string[];
	if (platform === "darwin") {
		command = "open";
		args = [url];
	} else if (platform === "win32") {
		command = "cmd";
		args = ["/c", "start", "", url];
	} else {
		command = "xdg-open";
		args = [url];
	}
	const proc = Bun.spawn([command, ...args], {
		stdout: "ignore",
		stderr: "ignore",
		stdin: "ignore",
	});
	proc.unref?.();
}

// ── Orchestrator ─────────────────────────────────────────────────────

export async function runLoopbackFlow(
	options: RunLoopbackOptions,
	deps: LoopbackDeps = {},
): Promise<TokenResponse> {
	const ttlDays = (options.ttlDays ?? 30) as OAuthCliTtlDays;
	if (!OAUTH_CLI_ALLOWED_TTL_DAYS.includes(ttlDays)) {
		throw new CliError(
			`ttl_days must be one of ${OAUTH_CLI_ALLOWED_TTL_DAYS.join(", ")}`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
		);
	}
	const deviceName = (options.deviceName ?? safeHostname()).slice(0, 128);
	const scope = options.scope ?? "cli";
	const baseUrl = deps.baseUrl ?? OAUTH_BASE_URL;
	const clientId = deps.clientId ?? OAUTH_CLIENT_ID;
	const writePrompt =
		deps.prompt ??
		((text: string) => {
			process.stderr.write(text);
		});

	const start = deps.startServer ?? startLoopbackServer;
	const server = await start();

	try {
		const pkce = generatePkce();
		const state = generateState();
		const authUrl = buildAuthorizeUrl({
			baseUrl,
			clientId,
			redirectUri: server.redirectUri,
			state,
			codeChallenge: pkce.challenge,
			scope,
			deviceName,
			ttlDays,
		});

		writePrompt(`\nListening on ${server.redirectUri} for the OAuth callback…\n`);

		let browserOpened = false;
		if (!options.noBrowser) {
			try {
				if (deps.openBrowser) {
					await deps.openBrowser(authUrl);
				} else {
					await openInBrowser(authUrl);
				}
				browserOpened = true;
			} catch {
				// Fall through to prompting the user with the URL.
			}
		}

		if (browserOpened) {
			writePrompt(
				"Opened your browser to sign in. Complete the flow there — do NOT open this URL\nin a second browser (the state is single-use).\n\n",
			);
		} else {
			writePrompt(
				[
					"Open this URL in a browser to sign in:",
					`  ${authUrl}`,
					"",
					"Only open it ONCE — the state is single-use.",
					"",
				].join("\n"),
			);
		}

		const { code } = await server.awaitCallback(state, options.timeoutMs);

		return await exchangeCodeForToken({
			code,
			codeVerifier: pkce.verifier,
			redirectUri: server.redirectUri,
			baseUrl,
			clientId,
			fetchImpl: deps.fetchImpl,
		});
	} finally {
		await server.close();
	}
}

function safeHostname(): string {
	try {
		const h = hostname();
		return h && h.trim() !== "" ? h : "geekbot-cli";
	} catch {
		return "geekbot-cli";
	}
}

function oauthError(payload: unknown, status: number): CliError {
	const error =
		isObject(payload) && typeof payload.error === "string" ? payload.error : `HTTP ${status}`;
	const description =
		isObject(payload) && typeof payload.error_description === "string"
			? payload.error_description
			: "";
	const message = description ? `${error}: ${description}` : error;
	const exitCode = status === 401 || status === 403 ? ExitCode.AUTH : ExitCode.API_ERROR;
	return new CliError(
		`OAuth error — ${message}`,
		`oauth_${error}`,
		exitCode,
		status >= 500,
		undefined,
		{ status },
	);
}

async function readJson(response: Response): Promise<unknown> {
	const text = await response.text();
	if (text === "") return {};
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
