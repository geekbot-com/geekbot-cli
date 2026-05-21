import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";

/**
 * Parse JSON input for --questions flag.
 * Accepts an array of strings (simple) or objects with question config (full).
 * String items are converted to {question: text} objects.
 */
export function parseQuestionsInput(raw: string): Array<Record<string, unknown>> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new CliError(
			"Invalid JSON for --questions input.",
			"json_parse_error",
			ExitCode.VALIDATION,
			false,
			'Expected a JSON array. Example: --questions \'["What did you do?", "Any blockers?"]\'',
		);
	}

	if (!Array.isArray(parsed)) {
		throw new CliError(
			"--questions input must be a JSON array.",
			"validation_error",
			ExitCode.VALIDATION,
			false,
			'Expected a JSON array. Example: --questions \'["What did you do?", "Any blockers?"]\'',
		);
	}

	return parsed.map((item: unknown, index: number) => {
		if (typeof item === "string") {
			return { question: item };
		}
		if (typeof item === "object" && item !== null && !Array.isArray(item)) {
			const obj = item as Record<string, unknown>;
			if ("question" in obj) {
				if (typeof obj.question !== "string") {
					throw new CliError(
						`Invalid question at index ${index}. The "question" property must be a string, got ${typeof obj.question}.`,
						"validation_error",
						ExitCode.VALIDATION,
						false,
						'Expected a JSON array. Example: --questions \'["What did you do?", "Any blockers?"]\'',
					);
				}
				return obj;
			}
			if ("text" in obj) {
				if (typeof obj.text !== "string") {
					throw new CliError(
						`Invalid question at index ${index}. The "text" property must be a string, got ${typeof obj.text}.`,
						"validation_error",
						ExitCode.VALIDATION,
						false,
						'Expected a JSON array. Example: --questions \'["What did you do?", "Any blockers?"]\'',
					);
				}
				const { text, ...rest } = obj;
				return { question: text, ...rest };
			}
		}
		throw new CliError(
			`Invalid question at index ${index}. Each item must be a string or an object with a "question" or "text" property.`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			'Expected a JSON array. Example: --questions \'["What did you do?", "Any blockers?"]\'',
		);
	});
}

/**
 * Parse JSON input for --answers flag.
 * Accepts an object keyed by question ID with string values (shorthand)
 * or {text: string} objects (full).
 */
export function parseAnswersInput(raw: string): Record<string, { text: string }> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new CliError(
			"Invalid JSON for --answers input.",
			"json_parse_error",
			ExitCode.VALIDATION,
			false,
			'Example: --answers \'{"101": "Done X", "102": "Working on Y"}\'',
		);
	}

	if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
		throw new CliError(
			"--answers input must be a JSON object (not an array).",
			"validation_error",
			ExitCode.VALIDATION,
			false,
			'Example: --answers \'{"101": "Done X", "102": "Working on Y"}\'',
		);
	}

	const result: Record<string, { text: string }> = {};
	for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
		if (typeof value === "string") {
			result[key] = { text: value };
		} else if (
			typeof value === "object" &&
			value !== null &&
			!Array.isArray(value) &&
			"text" in value &&
			typeof (value as Record<string, unknown>).text === "string"
		) {
			result[key] = value as { text: string };
		} else {
			throw new CliError(
				`Invalid answer for question "${key}". Each value must be a string or an object with a "text" property.`,
				"validation_error",
				ExitCode.VALIDATION,
				false,
				'Example: --answers \'{"101": "Done X", "102": "Working on Y"}\'',
			);
		}
	}

	return result;
}

/**
 * Parse JSON input for --choices flag.
 * Accepts a JSON array of 2-20 strings.
 */
export function parseChoicesInput(raw: string): string[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new CliError(
			"Invalid JSON for --choices input.",
			"json_parse_error",
			ExitCode.VALIDATION,
			false,
			'Expected a JSON array of strings. Example: --choices \'["Pizza", "Sushi", "Tacos"]\'',
		);
	}

	if (!Array.isArray(parsed)) {
		throw new CliError(
			"--choices input must be a JSON array.",
			"validation_error",
			ExitCode.VALIDATION,
			false,
			'Expected a JSON array of strings. Example: --choices \'["Pizza", "Sushi", "Tacos"]\'',
		);
	}

	if (parsed.length < 2 || parsed.length > 20) {
		throw new CliError(
			`--choices must have 2-20 items, got ${parsed.length}.`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			"Provide between 2 and 20 choices.",
		);
	}

	for (const [i, item] of parsed.entries()) {
		if (typeof item !== "string") {
			throw new CliError(
				`Invalid choice at index ${i}: must be a string.`,
				"validation_error",
				ExitCode.VALIDATION,
				false,
				'Each choice must be a string. Example: --choices \'["Option A", "Option B"]\'',
			);
		}
	}

	return parsed as string[];
}

/**
 * Parse date filter input for --before/--after flags.
 * Accepts ISO 8601 dates (2024-01-15) or unix timestamps (1705276800).
 */
export function parseDateFilter(raw: string, label: string): string {
	// If all digits, treat as unix timestamp passthrough
	if (/^\d+$/.test(raw)) {
		return raw;
	}

	// Enforce strict ISO 8601 date format (YYYY-MM-DD) to reject ambiguous formats
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		throw new CliError(
			`Invalid date for ${label}: "${raw}".`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			"Accepted formats: YYYY-MM-DD (2024-01-15) or unix timestamp (1705276800)",
		);
	}

	const date = new Date(raw);
	if (Number.isNaN(date.getTime())) {
		throw new CliError(
			`Invalid date for ${label}: "${raw}".`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			"Accepted formats: YYYY-MM-DD (2024-01-15) or unix timestamp (1705276800)",
		);
	}

	// Validate that the Date object matches the input components.
	// new Date() auto-corrects impossible dates (e.g., Feb 31 -> Mar 3),
	// so we must check the parsed components against the original input.
	const [inputYear, inputMonth, inputDay] = raw.split("-").map(Number);
	if (
		date.getUTCFullYear() !== inputYear ||
		date.getUTCMonth() + 1 !== inputMonth ||
		date.getUTCDate() !== inputDay
	) {
		throw new CliError(
			`Invalid date for ${label}: "${raw}" is not a valid calendar date.`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			"Accepted formats: YYYY-MM-DD (2024-01-15) or unix timestamp (1705276800)",
		);
	}

	return String(Math.floor(date.getTime() / 1000));
}

/**
 * Validate a date filter for v2 API endpoints.
 *
 * v2 accepts YYYY-MM-DD or ISO 8601 datetime strings; unix timestamps are rejected
 * because the v2 ListQuery parser expects RFC 3339 / YYYY-MM-DD format.
 * Returns the input unchanged after validation so it can be passed as-is.
 */
export function parseV2DateFilter(raw: string, label: string): string {
	// Accept YYYY-MM-DD (delegate calendar validation to parseDateFilter)
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		// Reuse parseDateFilter's calendar validation — discard its unix-timestamp output.
		parseDateFilter(raw, label);
		return raw;
	}

	// Accept ISO 8601 datetime: 2026-01-15T10:00:00Z or 2026-01-15T10:00:00+02:00
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
		const d = new Date(raw);
		if (!Number.isNaN(d.getTime())) {
			return raw;
		}
	}

	throw new CliError(
		`Invalid date for ${label}: "${raw}".`,
		"validation_error",
		ExitCode.VALIDATION,
		false,
		"Accepted formats: YYYY-MM-DD (2026-01-15) or ISO 8601 (2026-01-15T10:00:00Z)",
	);
}
