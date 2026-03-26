import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { resolveCredential } from "../../src/auth/resolver.ts";
import { CliError } from "../../src/errors/cli-error.ts";

const mockGetKeychainKey = mock(() => null as string | null);

describe("resolveCredential", () => {
	const originalEnv = process.env.GEEKBOT_API_KEY;

	beforeEach(() => {
		mockGetKeychainKey.mockReset();
		mockGetKeychainKey.mockReturnValue(null);
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.GEEKBOT_API_KEY = originalEnv;
		} else {
			delete process.env.GEEKBOT_API_KEY;
		}
	});

	test("returns flag source when --api-key is provided", async () => {
		const result = await resolveCredential(
			{
				apiKeyFlag: "flag-key",
			},
			mockGetKeychainKey,
		);
		expect(result.apiKey).toBe("flag-key");
		expect(result.source).toBe("flag");
	});

	test("flag takes priority over env var", async () => {
		process.env.GEEKBOT_API_KEY = "env-key";
		const result = await resolveCredential(
			{
				apiKeyFlag: "flag-key",
			},
			mockGetKeychainKey,
		);
		expect(result.source).toBe("flag");
		expect(result.apiKey).toBe("flag-key");
	});

	test("returns env source when GEEKBOT_API_KEY is set and no flag", async () => {
		process.env.GEEKBOT_API_KEY = "env-key";
		const result = await resolveCredential({}, mockGetKeychainKey);
		expect(result.apiKey).toBe("env-key");
		expect(result.source).toBe("env");
	});

	test("returns keychain source when no flag or env var but keychain has key", async () => {
		delete process.env.GEEKBOT_API_KEY;
		mockGetKeychainKey.mockReturnValue("keychain-key");
		const result = await resolveCredential({}, mockGetKeychainKey);
		expect(result.apiKey).toBe("keychain-key");
		expect(result.source).toBe("keychain");
	});

	test("flag takes priority over keychain", async () => {
		delete process.env.GEEKBOT_API_KEY;
		mockGetKeychainKey.mockReturnValue("keychain-key");
		const result = await resolveCredential(
			{
				apiKeyFlag: "flag-key",
			},
			mockGetKeychainKey,
		);
		expect(result.source).toBe("flag");
		expect(result.apiKey).toBe("flag-key");
	});

	test("env takes priority over keychain", async () => {
		process.env.GEEKBOT_API_KEY = "env-key";
		mockGetKeychainKey.mockReturnValue("keychain-key");
		const result = await resolveCredential({}, mockGetKeychainKey);
		expect(result.source).toBe("env");
		expect(result.apiKey).toBe("env-key");
	});

	test("throws auth_missing when keychain throws (unavailable)", async () => {
		delete process.env.GEEKBOT_API_KEY;
		mockGetKeychainKey.mockImplementation(() => {
			throw new Error("keychain unavailable");
		});
		try {
			await resolveCredential({}, mockGetKeychainKey);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("auth_missing");
		}
	});

	test("throws CliError with auth_missing when no credential found", async () => {
		delete process.env.GEEKBOT_API_KEY;
		try {
			await resolveCredential({}, mockGetKeychainKey);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("auth_missing");
			expect((e as CliError).exitCode).toBe(4);
		}
	});

	test("auth error message names all credential sources checked", async () => {
		delete process.env.GEEKBOT_API_KEY;
		try {
			await resolveCredential({}, mockGetKeychainKey);
		} catch (e) {
			expect((e as CliError).message).toContain("--api-key flag");
			expect((e as CliError).message).toContain("GEEKBOT_API_KEY");
			expect((e as CliError).message).toContain("OS keychain");
		}
	});

	test("auth error suggestion mentions auth setup", async () => {
		delete process.env.GEEKBOT_API_KEY;
		try {
			await resolveCredential({}, mockGetKeychainKey);
		} catch (e) {
			expect((e as CliError).suggestion).toContain("geekbot auth setup");
		}
	});

	test("trims whitespace from flag API key", async () => {
		const result = await resolveCredential(
			{
				apiKeyFlag: "  flag-key\n",
			},
			mockGetKeychainKey,
		);
		expect(result.apiKey).toBe("flag-key");
		expect(result.source).toBe("flag");
	});

	test("trims whitespace from env var API key", async () => {
		process.env.GEEKBOT_API_KEY = "  env-key\t\n";
		const result = await resolveCredential({}, mockGetKeychainKey);
		expect(result.apiKey).toBe("env-key");
		expect(result.source).toBe("env");
	});

	test("trims whitespace from keychain API key", async () => {
		delete process.env.GEEKBOT_API_KEY;
		mockGetKeychainKey.mockReturnValue("  keychain-key\n");
		const result = await resolveCredential({}, mockGetKeychainKey);
		expect(result.apiKey).toBe("keychain-key");
		expect(result.source).toBe("keychain");
	});
});
