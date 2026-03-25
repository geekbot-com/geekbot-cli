import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { API_BASE_URL, APP_VERSION } from "../utils/constants.ts";
import { getBackoffMs, isRetryable, mapHttpError, parseErrorBody } from "./errors.ts";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export interface HttpClient {
	get<T>(path: string, params?: Record<string, string>): Promise<T>;
	post<T>(path: string, body: unknown): Promise<T>;
	patch<T>(path: string, body: unknown): Promise<T>;
	put<T>(path: string, body: unknown): Promise<T>;
	delete(path: string): Promise<null>;
}

export function createHttpClient(apiKey: string, options?: { debug?: boolean }): HttpClient {
	const debug = options?.debug ?? false;

	async function request<T>(
		method: string,
		path: string,
		body?: unknown,
		params?: Record<string, string>,
	): Promise<T> {
		// Strip trailing slashes to avoid 301 redirects (API quirk)
		const cleanPath = path.replace(/\/+$/, "");

		let url = `${API_BASE_URL}${cleanPath}`;
		if (params) {
			const searchParams = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== "") {
					searchParams.set(key, value);
				}
			}
			const qs = searchParams.toString();
			if (qs) {
				url = `${url}?${qs}`;
			}
		}

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				if (debug && attempt > 0) {
					process.stderr.write(`[debug] Retry attempt ${attempt} for ${method} ${cleanPath}\n`);
				}

				const response = await fetch(url, {
					method,
					headers: {
						// Geekbot API expects raw token, NOT "Bearer <token>"
						// WARNING: Authorization contains the raw API key.
						// Never log request/response headers in debug mode.
						Authorization: apiKey,
						"Content-Type": "application/json",
						"User-Agent": `geekbot-skill-cli/${APP_VERSION}`,
					},
					body: body !== undefined ? JSON.stringify(body) : undefined,
				});

				if (response.ok) {
					// Handle 204 No Content (e.g., DELETE responses)
					if (response.status === 204) {
						return null as T;
					}
					// Runtime type validation is handled by Zod schema parsing at the call site
					return (await response.json()) as T;
				}

				// Non-OK response -- parse error and decide retry vs throw
				const errorMessage = await parseErrorBody(response);

				if (debug) {
					process.stderr.write(
						`[debug] HTTP ${response.status} from ${method} ${cleanPath}: ${errorMessage}\n`,
					);
				}

				if (isRetryable(response.status) && attempt < MAX_RETRIES) {
					const backoff = getBackoffMs(response, attempt, INITIAL_BACKOFF_MS);
					if (debug) {
						process.stderr.write(`[debug] Retrying in ${backoff}ms\n`);
					}
					await Bun.sleep(backoff);
					continue;
				}

				throw mapHttpError(response.status, errorMessage, cleanPath);
			} catch (error) {
				// Re-throw CliErrors (already mapped)
				if (error instanceof CliError) throw error;

				// Network-level errors (DNS failure, connection refused, timeout)
				if (attempt < MAX_RETRIES) {
					const backoff = INITIAL_BACKOFF_MS * 2 ** attempt;
					if (debug) {
						process.stderr.write(
							`[debug] Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${error instanceof Error ? error.message : String(error)}\n`,
						);
					}
					await Bun.sleep(backoff);
					continue;
				}

				throw new CliError(
					`Network error: ${error instanceof Error ? error.message : String(error)}`,
					"network_error",
					ExitCode.NETWORK,
					true,
					"Check your internet connection and try again.",
				);
			}
		}
		// Unreachable: loop always returns or throws, but satisfies TS return check
		throw new CliError(
			"Request failed after all retries",
			"network_error",
			ExitCode.NETWORK,
			true,
			"Check your internet connection and try again.",
		);
	}

	return {
		get: <T>(path: string, params?: Record<string, string>) =>
			request<T>("GET", path, undefined, params),
		post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
		patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
		put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
		delete: (path: string) => request<null>("DELETE", path),
	};
}
