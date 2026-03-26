import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { getKeychainKey as _getKeychainKey } from "./keychain.ts";

export interface CredentialResult {
	apiKey: string;
	source: "flag" | "env" | "keychain";
}

export async function resolveCredential(
	options: { apiKeyFlag?: string },
	getKeychainKeyImpl?: typeof _getKeychainKey,
): Promise<CredentialResult> {
	// Priority 1: --api-key flag
	if (options.apiKeyFlag) {
		return { apiKey: options.apiKeyFlag.trim(), source: "flag" };
	}

	// Priority 2: GEEKBOT_API_KEY env var
	const envKey = process.env.GEEKBOT_API_KEY;
	if (envKey) {
		return { apiKey: envKey.trim(), source: "env" };
	}

	// Priority 3: OS keychain
	const getKey = getKeychainKeyImpl ?? _getKeychainKey;
	try {
		const keychainKey = getKey();
		if (keychainKey) {
			return { apiKey: keychainKey.trim(), source: "keychain" };
		}
	} catch {
		// Keychain unavailable (headless, CI) -- fall through to error
	}

	// No credential found -- list all sources checked
	throw new CliError(
		"No API key found. Checked: --api-key flag, GEEKBOT_API_KEY environment variable, OS keychain.",
		"auth_missing",
		ExitCode.AUTH,
		false,
		"Set GEEKBOT_API_KEY environment variable or run: geekbot auth setup",
	);
}
