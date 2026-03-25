import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";

/**
 * Parse error body from API response.
 * Handles two formats:
 *   1. Object: { "error": "message" }
 *   2. Bare JSON string: "Template not found"
 */
export async function parseErrorBody(response: Response): Promise<string> {
	const text = await response.text();
	try {
		const json = JSON.parse(text);
		if (typeof json === "object" && json !== null && typeof json.error === "string") {
			return json.error;
		}
		if (typeof json === "string") {
			return json;
		}
		return text;
	} catch {
		return text;
	}
}

/**
 * Map HTTP status code + error body to a CliError with correct exit code.
 */
export function mapHttpError(status: number, message: string, path: string): CliError {
	switch (status) {
		case 400:
			return new CliError(
				message || "Bad request",
				"validation_error",
				ExitCode.VALIDATION,
				false,
				"Check the request parameters and try again.",
				{ path, status },
			);
		case 401:
			return new CliError(
				message || "Unauthorized",
				"unauthorized",
				ExitCode.AUTH,
				false,
				"Check your API key (GEEKBOT_API_KEY or --api-key). This error can also mean insufficient permissions for the resource.",
				{ path, status },
			);
		case 403:
			return new CliError(
				message || "Forbidden",
				"forbidden",
				ExitCode.FORBIDDEN,
				false,
				"You don't have permission for this operation.",
				{ path, status },
			);
		case 404:
			return new CliError(
				message || "Not found",
				"not_found",
				ExitCode.NOT_FOUND,
				false,
				undefined, // suggestion populated by buildNotFoundSuggestion when called from command handlers
				{ path, status },
			);
		case 422:
			return new CliError(
				message || "Unprocessable entity",
				"unprocessable",
				ExitCode.VALIDATION,
				false,
				"The request was understood but could not be processed. Check field values.",
				{ path, status },
			);
		case 429:
			return new CliError(
				message || "Rate limited",
				"rate_limited",
				ExitCode.API_ERROR,
				true,
				"Rate limited. Wait a moment and try again.",
				{ path, status },
			);
		default:
			if (status >= 500) {
				return new CliError(
					message || "Server error",
					"server_error",
					ExitCode.API_ERROR,
					true,
					"Geekbot API server error. Try again later.",
					{ path, status },
				);
			}
			return new CliError(
				message || `HTTP ${status}`,
				"api_error",
				ExitCode.API_ERROR,
				false,
				undefined,
				{ path, status },
			);
	}
}

/**
 * Check if an HTTP status code is retryable.
 * Only 429 (rate limit) and 5xx (server errors) are retried.
 */
export function isRetryable(status: number): boolean {
	return status === 429 || status >= 500;
}

/** Maximum backoff delay in milliseconds (60 seconds). */
export const MAX_BACKOFF_MS = 60_000;

/**
 * Calculate backoff delay for a retry attempt.
 * Respects Retry-After header on 429 responses.
 * All values are capped at MAX_BACKOFF_MS to prevent unbounded waits.
 */
export function getBackoffMs(response: Response, attempt: number, initialMs = 1000): number {
	if (response.status === 429) {
		const retryAfter = response.headers.get("Retry-After");
		if (retryAfter) {
			const seconds = Number.parseInt(retryAfter, 10);
			if (!Number.isNaN(seconds) && seconds > 0) {
				return Math.min(seconds * 1000, MAX_BACKOFF_MS);
			}
		}
	}
	return Math.min(initialMs * 2 ** attempt, MAX_BACKOFF_MS);
}
