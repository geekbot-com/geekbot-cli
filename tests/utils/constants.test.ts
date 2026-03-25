import { describe, expect, test } from "bun:test";
import packageJson from "../../package.json";
import { API_BASE_URL, APP_NAME, APP_VERSION } from "../../src/utils/constants.ts";

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
});
