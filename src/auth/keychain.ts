import { Entry } from "@napi-rs/keyring";

const SERVICE = "geekbot-cli";
const ACCOUNT = "api-key";

/**
 * Retrieve API key from OS keychain.
 * Returns null if keychain is unavailable or no entry exists.
 */
export function getKeychainKey(): string | null {
	try {
		const entry = new Entry(SERVICE, ACCOUNT);
		return entry.getPassword();
	} catch {
		return null;
	}
}

/**
 * Store API key in OS keychain.
 * Throws if keychain is unavailable (caller should catch and suggest env var).
 */
export function setKeychainKey(apiKey: string): void {
	const entry = new Entry(SERVICE, ACCOUNT);
	entry.setPassword(apiKey);
}

/**
 * Delete API key from OS keychain.
 * Throws if keychain is unavailable or no entry exists.
 */
export function deleteKeychainKey(): void {
	const entry = new Entry(SERVICE, ACCOUNT);
	entry.deletePassword();
}
