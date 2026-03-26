import packageJson from "../../package.json";
import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";

export const APP_NAME = "geekbot";
export const APP_VERSION: string = packageJson.version;

export function resolveApiBaseUrl(envValue?: string): string {
	if (envValue === undefined) {
		return "https://api.geekbot.com";
	}
	if (!envValue.startsWith("https://")) {
		throw new CliError(
			"GEEKBOT_API_BASE_URL must use HTTPS to prevent API key exfiltration.",
			"validation_error",
			ExitCode.VALIDATION,
			false,
			"Set GEEKBOT_API_BASE_URL to an https:// URL.",
		);
	}
	return envValue;
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.GEEKBOT_API_BASE_URL);
