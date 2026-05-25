import { describe, expect, test } from "bun:test";
import packageJson from "../../package.json";
import { CliError } from "../../src/errors/cli-error.ts";
import {
	API_BASE_URL,
	APP_NAME,
	APP_VERSION,
	OAUTH_BASE_URL,
	OAUTH_CLI_ALLOWED_TTL_DAYS,
	OAUTH_CLIENT_ID,
	resolveApiBaseUrl,
	resolveOAuthBaseUrl,
} from "../../src/utils/constants.ts";

describe("constants", () => {
	test("APP_NAME equals 'geekbot'", () => {
		expect(APP_NAME).toBe("geekbot");
	});

	test("APP_VERSION matches package.json version", () => {
		expect(APP_VERSION).toBe(packageJson.version);
	});

	test("APP_VERSION is a valid semver string", () => {
		expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});

	test("API_BASE_URL defaults to https://api.geekbot.com", () => {
		expect(API_BASE_URL).toBe("https://api.geekbot.com");
	});

	test("OAUTH_BASE_URL defaults to https://oauth.geekbot.com", () => {
		expect(OAUTH_BASE_URL).toBe("https://oauth.geekbot.com");
	});

	test("OAUTH_CLIENT_ID equals 'geekbot-cli'", () => {
		expect(OAUTH_CLIENT_ID).toBe("geekbot-cli");
	});

	test("OAUTH_CLI_ALLOWED_TTL_DAYS exposes the auth server's whitelist", () => {
		expect([...OAUTH_CLI_ALLOWED_TTL_DAYS]).toEqual([7, 30, 90, 180, 365]);
	});
});

describe("resolveApiBaseUrl", () => {
	test("returns default when no override provided", () => {
		expect(resolveApiBaseUrl(undefined)).toBe("https://api.geekbot.com");
	});

	test("accepts valid HTTPS override", () => {
		expect(resolveApiBaseUrl("https://staging.geekbot.com")).toBe("https://staging.geekbot.com");
	});

	test("rejects HTTP override (plaintext exfiltrates API key)", () => {
		expect(() => resolveApiBaseUrl("http://evil.com")).toThrow(CliError);
	});

	test("rejects non-URL override", () => {
		expect(() => resolveApiBaseUrl("not-a-url")).toThrow(CliError);
	});

	test("rejects FTP override", () => {
		expect(() => resolveApiBaseUrl("ftp://files.example.com")).toThrow(CliError);
	});

	test("error message mentions HTTPS requirement", () => {
		expect(() => resolveApiBaseUrl("http://evil.com")).toThrow(/HTTPS/i);
	});

	test("rejects empty string", () => {
		expect(() => resolveApiBaseUrl("")).toThrow(CliError);
	});

	test("rejects uppercase HTTPS scheme (case-sensitive check)", () => {
		expect(() => resolveApiBaseUrl("HTTPS://api.geekbot.com")).toThrow(CliError);
	});
});

describe("resolveOAuthBaseUrl", () => {
	test("returns default when no override provided", () => {
		expect(resolveOAuthBaseUrl(undefined)).toBe("https://oauth.geekbot.com");
	});

	test("accepts valid HTTPS override", () => {
		expect(resolveOAuthBaseUrl("https://staging-oauth.geekbot.com")).toBe(
			"https://staging-oauth.geekbot.com",
		);
	});

	test("rejects HTTP override (plaintext exfiltrates token)", () => {
		expect(() => resolveOAuthBaseUrl("http://evil.com")).toThrow(CliError);
	});

	test("rejects non-URL override", () => {
		expect(() => resolveOAuthBaseUrl("not-a-url")).toThrow(CliError);
	});

	test("rejects empty string", () => {
		expect(() => resolveOAuthBaseUrl("")).toThrow(CliError);
	});

	test("error message mentions HTTPS requirement", () => {
		expect(() => resolveOAuthBaseUrl("http://evil.com")).toThrow(/HTTPS/i);
	});
});
