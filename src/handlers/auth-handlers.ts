import { deleteKeychainKey, getKeychainKey, setKeychainKey } from "../auth/keychain.ts";
import { type LoopbackDeps, runLoopbackFlow } from "../auth/oauth-loopback.ts";
import { resolveCredential } from "../auth/resolver.ts";
import type { GlobalOptions } from "../cli/globals.ts";
import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { createHttpClient } from "../http/client.ts";
import { success } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import { MeResponseSchema } from "../schemas/user.ts";
import type { OAuthCliTtlDays } from "../utils/constants.ts";

// ── Option Interfaces ─────────────────────────────────────────────────

export interface AuthSetupOptions {
	apiKey?: string;
}

export interface AuthLoginOptions {
	/** Skip the browser-open attempt — used in tests and headless agents. */
	noBrowser?: boolean;
	/** Friendly name shown next to the issued CLI token. Defaults to hostname. */
	deviceName?: string;
	/** Token lifetime in days. Must be one of 7, 30, 90, 180, 365. */
	ttlDays?: OAuthCliTtlDays;
	/** Override callback wait timeout (ms). */
	timeoutMs?: number;
	/** Hook for tests to mock fetch / server / browser opener / prompt. */
	loopback?: LoopbackDeps;
}

// ── Handlers ──────────────────────────────────────────────────────────

/**
 * Handle `geekbot auth setup` command.
 * Acquires API key (flag, interactive prompt, or error),
 * verifies it via GET /v1/me, then stores in OS keychain.
 */
export async function handleAuthSetup(
	options: AuthSetupOptions,
	_globalOpts: GlobalOptions,
): Promise<void> {
	let key: string;

	if (options.apiKey) {
		key = options.apiKey.trim();
	} else if (process.stdin.isTTY) {
		const readline = await import("node:readline");
		const { Writable } = await import("node:stream");
		// Use a muted output stream so the API key is not echoed to the terminal
		const mutedOutput = new Writable({
			write(_chunk, _encoding, callback) {
				callback();
			},
		});
		const reader = readline.createInterface({
			input: process.stdin,
			output: mutedOutput,
			terminal: true,
		});
		// Print the prompt ourselves since the muted stream swallows it
		process.stderr.write("Enter your Geekbot API key: ");
		key = await new Promise<string>((resolve) => {
			reader.question("", (answer: string) => {
				resolve(answer.trim());
				reader.close();
			});
		});
		// Print a newline after the user presses Enter (since echo is suppressed)
		process.stderr.write("\n");
	} else {
		throw new CliError(
			"Non-interactive mode requires --api-key flag.",
			"auth_setup_non_interactive",
			ExitCode.USAGE,
			false,
			"Run: geekbot auth setup --api-key YOUR_KEY",
		);
	}

	// Verify key by calling /v1/me
	const client = createHttpClient(key);
	const raw = await client.get<unknown>("/v1/me");
	const meResponse = MeResponseSchema.parse(raw);

	// Check for existing keychain key and warn
	const existing = getKeychainKey();
	if (existing) {
		process.stderr.write("Replacing existing API key in keychain\n");
	}

	// Store in keychain
	try {
		setKeychainKey(key);
	} catch {
		throw new CliError(
			"Failed to store API key in OS keychain.",
			"keychain_unavailable",
			ExitCode.GENERAL,
			false,
			'OS keychain may be unavailable. Use GEEKBOT_API_KEY environment variable instead: export GEEKBOT_API_KEY="your-key"',
		);
	}

	writeOutput(
		success({
			authenticated: true,
			username: meResponse.user.username,
			email: meResponse.user.email,
		}),
	);
}

/**
 * Handle `geekbot auth login` command.
 *
 * Runs the OAuth 2.1 authorization-code + PKCE flow with a loopback redirect:
 *   1. Start a 127.0.0.1 HTTP listener on a random port
 *   2. Open the browser at /v2/authorize?...&redirect_uri=http://127.0.0.1:<port>/callback
 *   3. Wait for the callback containing { code, state }, validate state, exchange code → cli_* token
 *   4. Verify the token via GET /v1/me, then store it in the OS keychain
 */
export async function handleAuthLogin(
	options: AuthLoginOptions,
	_globalOpts: GlobalOptions,
): Promise<void> {
	const token = await runLoopbackFlow(
		{
			noBrowser: options.noBrowser,
			deviceName: options.deviceName,
			ttlDays: options.ttlDays,
			timeoutMs: options.timeoutMs,
		},
		options.loopback,
	);

	// Verify the token works against the api before persisting it.
	const client = createHttpClient(token.access_token);
	const raw = await client.get<unknown>("/v1/me");
	const meResponse = MeResponseSchema.parse(raw);

	const existing = getKeychainKey();
	if (existing) {
		process.stderr.write("Replacing existing API key in keychain\n");
	}

	try {
		setKeychainKey(token.access_token);
	} catch {
		throw new CliError(
			"Failed to store CLI token in OS keychain.",
			"keychain_unavailable",
			ExitCode.GENERAL,
			false,
			'OS keychain may be unavailable. Use GEEKBOT_API_KEY environment variable instead: export GEEKBOT_API_KEY="your-token"',
		);
	}

	writeOutput(
		success({
			authenticated: true,
			method: "oauth_loopback",
			username: meResponse.user.username,
			email: meResponse.user.email,
			token_type: token.token_type,
			scope: token.scope,
			expires_in: token.expires_in,
		}),
	);
}

/**
 * Handle `geekbot auth status` command.
 * Resolves current credential, verifies it, and shows source + profile.
 */
export async function handleAuthStatus(globalOpts: GlobalOptions): Promise<void> {
	try {
		const { apiKey, source } = await resolveCredential({
			apiKeyFlag: globalOpts.apiKey,
		});
		const client = createHttpClient(apiKey);
		const raw = await client.get<unknown>("/v1/me");
		const meResponse = MeResponseSchema.parse(raw);
		writeOutput(
			success({
				authenticated: true,
				source,
				username: meResponse.user.username,
				email: meResponse.user.email,
			}),
		);
	} catch (error) {
		if (error instanceof CliError && error.code === "auth_missing") {
			writeOutput(
				success({
					authenticated: false,
					source: null,
					username: null,
					email: null,
				}),
			);
			return;
		}
		throw error;
	}
}

/**
 * Handle `geekbot auth remove` command.
 * Deletes API key from OS keychain.
 */
export async function handleAuthRemove(_globalOpts: GlobalOptions): Promise<void> {
	try {
		deleteKeychainKey();
		writeOutput(success({ removed: true }));
	} catch {
		throw new CliError(
			"No API key found in OS keychain to remove.",
			"keychain_not_found",
			ExitCode.NOT_FOUND,
			false,
			"Key may not be stored in the OS keychain. Check: geekbot auth status",
		);
	}
}
