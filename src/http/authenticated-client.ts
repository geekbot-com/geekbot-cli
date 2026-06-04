import { resolveCredential as _resolveCredential } from "../auth/resolver.ts";
import type { GlobalOptions } from "../cli/globals.ts";
import { createHttpClient, type HttpClient } from "./client.ts";

/**
 * Resolve credentials and create an authenticated HTTP client.
 * Extracts the repeated resolveCredential + createHttpClient pattern
 * used across all handler modules.
 */
export async function createAuthenticatedClient(
	globalOpts: GlobalOptions,
	deps?: { resolveCredential?: typeof _resolveCredential },
): Promise<HttpClient> {
	const resolve = deps?.resolveCredential ?? _resolveCredential;
	const { apiKey } = await resolve({ apiKeyFlag: globalOpts.apiKey });
	return createHttpClient(apiKey);
}
