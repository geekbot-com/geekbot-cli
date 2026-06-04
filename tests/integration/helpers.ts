import type { HttpClient } from "../../src/http/client.ts";
import { createHttpClient } from "../../src/http/client.ts";

export const API_KEY = process.env.GEEKBOT_INTEGRATION_TEST_API_KEY;

/**
 * Creates an authenticated HTTP client for integration tests.
 * Only call inside describe blocks guarded by `describe.skipIf(!API_KEY)`.
 */
export function testClient(): HttpClient {
	return createHttpClient(API_KEY ?? "");
}
