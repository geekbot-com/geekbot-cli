import { resolveCredential } from "../auth/resolver.ts";
import type { GlobalOptions } from "../cli/globals.ts";
import { createHttpClient, type HttpClient } from "./client.ts";

/**
 * Resolve credentials and create an authenticated HTTP client.
 * Extracts the repeated resolveCredential + createHttpClient pattern
 * used across all handler modules.
 */
export async function createAuthenticatedClient(globalOpts: GlobalOptions): Promise<HttpClient> {
	const { apiKey } = await resolveCredential({ apiKeyFlag: globalOpts.apiKey });
	return createHttpClient(apiKey, { debug: globalOpts.debug });
}
