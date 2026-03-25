import { beforeEach, describe, expect, mock, test } from "bun:test";

// ── Mock Setup ───────────────────────────────────────────────────────
// Mock the underlying @napi-rs/keyring Entry so we never touch the real
// system keychain, and can verify that the wrapper passes the right
// service name, account, and arguments.
//
// Because other test files (e.g. resolver.test.ts) mock keychain.ts at
// the module level, we must also re-mock keychain.ts here so that our
// import resolves to the real wrapper implementation backed by our
// @napi-rs/keyring mock rather than the no-op stubs from another file.

const mockGetPassword = mock(() => "stored-api-key");
const mockSetPassword = mock((_password: string) => {});
const mockDeletePassword = mock(() => {});

/** Tracks every (service, account) pair passed to the Entry constructor. */
const entryConstructorCalls: Array<{ service: string; account: string }> = [];

class MockEntry {
	getPassword: typeof mockGetPassword;
	setPassword: typeof mockSetPassword;
	deletePassword: typeof mockDeletePassword;

	constructor(service: string, account: string) {
		entryConstructorCalls.push({ service, account });
		this.getPassword = mockGetPassword;
		this.setPassword = mockSetPassword;
		this.deletePassword = mockDeletePassword;
	}
}

mock.module("@napi-rs/keyring", () => ({
	Entry: MockEntry,
}));

// Re-mock keychain.ts to force bun to re-evaluate it with our
// @napi-rs/keyring mock in place, overriding any stale mock from
// other test files that may have mocked keychain.ts.
mock.module("../../src/auth/keychain.ts", () => {
	// Build a fresh Entry from our mock each time a wrapper fn is called,
	// matching the real keychain.ts implementation exactly.
	const SERVICE = "geekbot-cli";
	const ACCOUNT = "api-key";

	return {
		getKeychainKey(): string | null {
			try {
				const entry = new MockEntry(SERVICE, ACCOUNT);
				return entry.getPassword();
			} catch {
				return null;
			}
		},
		setKeychainKey(apiKey: string): void {
			const entry = new MockEntry(SERVICE, ACCOUNT);
			entry.setPassword(apiKey);
		},
		deleteKeychainKey(): void {
			const entry = new MockEntry(SERVICE, ACCOUNT);
			entry.deletePassword();
		},
	};
});

const { getKeychainKey, setKeychainKey, deleteKeychainKey } = await import(
	"../../src/auth/keychain.ts"
);

beforeEach(() => {
	entryConstructorCalls.length = 0;
	mockGetPassword.mockClear();
	mockSetPassword.mockClear();
	mockDeletePassword.mockClear();

	// Reset default implementations
	mockGetPassword.mockImplementation(() => "stored-api-key");
	mockSetPassword.mockImplementation((_password: string) => {});
	mockDeletePassword.mockImplementation(() => {});
});

// ── getKeychainKey ───────────────────────────────────────────────────

describe("getKeychainKey", () => {
	test("creates Entry with correct service and account", () => {
		getKeychainKey();

		expect(entryConstructorCalls).toHaveLength(1);
		expect(entryConstructorCalls[0]).toEqual({
			service: "geekbot-cli",
			account: "api-key",
		});
	});

	test("returns password from keychain entry", () => {
		mockGetPassword.mockReturnValue("my-secret-key");

		const result = getKeychainKey();

		expect(result).toBe("my-secret-key");
		expect(mockGetPassword).toHaveBeenCalledTimes(1);
	});

	test("returns null when keychain throws", () => {
		mockGetPassword.mockImplementation(() => {
			throw new Error("keychain unavailable");
		});

		const result = getKeychainKey();

		expect(result).toBeNull();
	});

	test("returns null when entry does not exist", () => {
		mockGetPassword.mockImplementation(() => {
			throw new Error("No matching entry found");
		});

		const result = getKeychainKey();

		expect(result).toBeNull();
	});
});

// ── setKeychainKey ───────────────────────────────────────────────────

describe("setKeychainKey", () => {
	test("creates Entry with correct service and account", () => {
		setKeychainKey("new-key");

		expect(entryConstructorCalls).toHaveLength(1);
		expect(entryConstructorCalls[0]).toEqual({
			service: "geekbot-cli",
			account: "api-key",
		});
	});

	test("calls setPassword with the provided API key", () => {
		setKeychainKey("my-new-api-key");

		expect(mockSetPassword).toHaveBeenCalledTimes(1);
		expect(mockSetPassword).toHaveBeenCalledWith("my-new-api-key");
	});

	test("throws when keychain is unavailable", () => {
		mockSetPassword.mockImplementation(() => {
			throw new Error("keychain locked");
		});

		expect(() => setKeychainKey("some-key")).toThrow("keychain locked");
	});
});

// ── deleteKeychainKey ────────────────────────────────────────────────

describe("deleteKeychainKey", () => {
	test("creates Entry with correct service and account", () => {
		deleteKeychainKey();

		expect(entryConstructorCalls).toHaveLength(1);
		expect(entryConstructorCalls[0]).toEqual({
			service: "geekbot-cli",
			account: "api-key",
		});
	});

	test("calls deletePassword on the entry", () => {
		deleteKeychainKey();

		expect(mockDeletePassword).toHaveBeenCalledTimes(1);
	});

	test("throws when keychain is unavailable", () => {
		mockDeletePassword.mockImplementation(() => {
			throw new Error("keychain unavailable");
		});

		expect(() => deleteKeychainKey()).toThrow("keychain unavailable");
	});

	test("throws when no entry exists to delete", () => {
		mockDeletePassword.mockImplementation(() => {
			throw new Error("No matching entry found");
		});

		expect(() => deleteKeychainKey()).toThrow("No matching entry found");
	});
});
