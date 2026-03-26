import { ZodError } from "zod";
import { failure } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import { CliError } from "./cli-error.ts";
import { ExitCode } from "./exit-codes.ts";

function formatZodMessage(error: ZodError): string {
	return error.issues
		.map((issue) => {
			const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
			return `${path}: ${issue.message}`;
		})
		.join("; ");
}

export function handleError(error: unknown, debug: boolean = false): never {
	if (error instanceof ZodError) {
		writeOutput(
			failure({
				code: "schema_validation_error",
				message: `Unexpected API response: ${formatZodMessage(error)}`,
				retryable: false,
				suggestion:
					"The API returned data in an unexpected format. The API may have changed or there may be a version mismatch.",
			}),
		);

		if (debug) {
			process.stderr.write(`[debug] ZodError issues: ${JSON.stringify(error.issues)}\n`);
		}

		process.exit(ExitCode.API_ERROR);
	}

	if (error instanceof CliError) {
		writeOutput(
			failure({
				code: error.code,
				message: error.message,
				retryable: error.retryable,
				suggestion: error.suggestion ?? null,
			}),
		);

		if (debug && error.context) {
			process.stderr.write(`[debug] Error context: ${JSON.stringify(error.context)}\n`);
		}

		process.exit(error.exitCode);
	}

	// Unknown/unexpected error
	writeOutput(
		failure({
			code: "internal_error",
			message: error instanceof Error ? error.message : String(error),
			retryable: false,
			suggestion: "This is an unexpected error. Please report it.",
		}),
	);

	process.exit(ExitCode.GENERAL);
}
