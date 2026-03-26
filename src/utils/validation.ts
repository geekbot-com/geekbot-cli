import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";

/**
 * Validate that a string is a valid numeric ID (positive integer).
 * Rejects before API call to give a clear local error (CLI-09).
 */
export function validateNumericId(value: string, label: string = "ID"): number {
	const num = Number(value);
	if (!Number.isSafeInteger(num) || num <= 0) {
		throw new CliError(
			`Invalid ${label}: "${value}". Must be a positive integer.`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			`Provide a numeric ${label}, e.g.: geekbot standup get 123`,
		);
	}
	return num;
}

/**
 * Validate time format (HH:MM in 24-hour format).
 */
export function validateTimeFormat(value: string): string {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
	if (!match) {
		throw new CliError(
			`Invalid time format: "${value}". Expected HH:MM (24-hour).`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			'Use 24-hour format, e.g.: --time "09:30" or --time "14:00"',
		);
	}
	return value;
}

/**
 * Validate that a string is a Slack-style user ID (e.g. "UHNM44125", "U08LXSA31BJ").
 * Slack IDs start with an uppercase letter followed by uppercase alphanumeric characters.
 */
export function validateSlackId(value: string, label: string = "user ID"): string {
	if (!/^[A-Z][A-Z0-9]+$/.test(value)) {
		throw new CliError(
			`Invalid ${label}: "${value}". Must be a Slack-style ID (e.g. U08LXSA31BJ).`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			`Provide a Slack-style ${label}, e.g.: --user-id U08LXSA31BJ`,
		);
	}
	return value;
}

/**
 * Validate a comma-separated list of Slack-style user IDs.
 */
export function validateSlackIdList(value: string, label: string): string[] {
	const parts = value.split(",");
	const result: string[] = [];
	for (const part of parts) {
		result.push(validateSlackId(part.trim(), label));
	}
	return result;
}

/**
 * Validate that a string is a valid non-negative integer (for wait_time etc.).
 */
export function validateWaitTime(value: string): number {
	const num = Number(value);
	if (!Number.isSafeInteger(num) || num < 0) {
		throw new CliError(
			`Invalid wait time: "${value}". Must be a non-negative integer.`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			`Provide a numeric value in minutes, e.g.: --wait-time 15`,
		);
	}
	return num;
}

/**
 * Validate that a string is a valid positive integer for use as a limit.
 */
export function validateLimit(value: string): number {
	const num = Number(value);
	if (!Number.isSafeInteger(num) || num < 1) {
		throw new CliError(
			`Invalid limit: "${value}" — must be a positive integer`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			"Example: --limit 10",
		);
	}
	return num;
}

/**
 * Validate day abbreviations (Mon, Tue, Wed, Thu, Fri, Sat, Sun).
 */
export function validateDayAbbreviations(values: string[]): string[] {
	const validMap = new Map([
		["mon", "Mon"],
		["tue", "Tue"],
		["wed", "Wed"],
		["thu", "Thu"],
		["fri", "Fri"],
		["sat", "Sat"],
		["sun", "Sun"],
	]);
	return values.map((day) => {
		const normalized = validMap.get(day.toLowerCase());
		if (!normalized) {
			throw new CliError(
				`Invalid day abbreviation: "${day}". Valid values: Mon, Tue, Wed, Thu, Fri, Sat, Sun.`,
				"validation_error",
				ExitCode.VALIDATION,
				false,
				'Use three-letter abbreviations: --days "Mon,Wed,Fri"',
			);
		}
		return normalized;
	});
}
