import { describe, expect, test } from "bun:test";
import { CliError } from "../../src/errors/cli-error.ts";
import {
	parseAnswersInput,
	parseChoicesInput,
	parseDateFilter,
	parseQuestionsInput,
	parseQuestionsInputV2,
	parseV2DateFilter,
} from "../../src/utils/input-parsers.ts";

describe("parseQuestionsInput", () => {
	test("converts string array items to {question: text} objects", () => {
		const result = parseQuestionsInput('["What did you do?"]');
		expect(result).toEqual([{ question: "What did you do?" }]);
	});

	test("converts multiple string items", () => {
		const result = parseQuestionsInput('["What did you do?", "Any blockers?"]');
		expect(result).toEqual([{ question: "What did you do?" }, { question: "Any blockers?" }]);
	});

	test("passes through full question config objects unchanged", () => {
		const input = '[{"question":"text","answer_type":"text"}]';
		const result = parseQuestionsInput(input);
		expect(result).toEqual([{ question: "text", answer_type: "text" }]);
	});

	test("handles mix of strings and objects", () => {
		const input = '["Simple question", {"question":"Complex","answer_type":"text"}]';
		const result = parseQuestionsInput(input);
		expect(result).toEqual([
			{ question: "Simple question" },
			{ question: "Complex", answer_type: "text" },
		]);
	});

	test("throws CliError with json_parse_error for invalid JSON", () => {
		try {
			parseQuestionsInput("not json");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("json_parse_error");
			expect((e as CliError).exitCode).toBe(6);
		}
	});

	test("throws CliError with validation_error for non-array JSON", () => {
		try {
			parseQuestionsInput('"a string"');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).exitCode).toBe(6);
		}
	});

	test("throws CliError with validation_error for bad item type at index", () => {
		try {
			parseQuestionsInput("[123]");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).exitCode).toBe(6);
			expect((e as CliError).message).toContain("index 0");
		}
	});

	test("accepts objects with text property and maps to question", () => {
		const result = parseQuestionsInput('[{"text": "What went well?"}]');
		expect(result).toEqual([{ question: "What went well?" }]);
	});

	test("maps text to question while preserving other properties", () => {
		const input = '[{"text": "What went well?", "answer_type": "text"}]';
		const result = parseQuestionsInput(input);
		expect(result).toEqual([{ question: "What went well?", answer_type: "text" }]);
	});

	test("handles mix of text objects, question objects, and strings", () => {
		const input = '["Simple", {"question": "With question key"}, {"text": "With text key"}]';
		const result = parseQuestionsInput(input);
		expect(result).toEqual([
			{ question: "Simple" },
			{ question: "With question key" },
			{ question: "With text key" },
		]);
	});

	test("prefers question property when both question and text are present", () => {
		const input = '[{"question": "From question", "text": "From text"}]';
		const result = parseQuestionsInput(input);
		expect(result).toEqual([{ question: "From question", text: "From text" }]);
	});

	test("throws CliError for object with neither question nor text property", () => {
		try {
			parseQuestionsInput('[{"answer_type":"text"}]');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain("index 0");
			expect((e as CliError).message).toContain('"question"');
			expect((e as CliError).message).toContain('"text"');
		}
	});

	test("suggestion includes example usage", () => {
		try {
			parseQuestionsInput("not json");
			throw new Error("should have thrown");
		} catch (e) {
			expect((e as CliError).suggestion).toContain("--questions");
		}
	});

	test("throws CliError when question property is a number", () => {
		try {
			parseQuestionsInput('[{"question":123}]');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain('"question"');
			expect((e as CliError).message).toContain("string");
		}
	});

	test("throws CliError when question property is a boolean", () => {
		try {
			parseQuestionsInput('[{"question":true}]');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain('"question"');
			expect((e as CliError).message).toContain("string");
		}
	});

	test("throws CliError when text property is null", () => {
		try {
			parseQuestionsInput('[{"text":null}]');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain('"text"');
			expect((e as CliError).message).toContain("string");
		}
	});

	test("accepts empty array and returns empty result", () => {
		const result = parseQuestionsInput("[]");
		expect(result).toEqual([]);
	});

	test("accepts empty question string and wraps it", () => {
		const result = parseQuestionsInput('[""]');
		expect(result).toEqual([{ question: "" }]);
	});

	test("accepts object with empty question property", () => {
		const result = parseQuestionsInput('[{"question":""}]');
		expect(result).toEqual([{ question: "" }]);
	});
});

describe("parseAnswersInput", () => {
	test("converts shorthand string values to {text: value} objects", () => {
		const result = parseAnswersInput('{"101":"Done X"}');
		expect(result).toEqual({ "101": { text: "Done X" } });
	});

	test("passes through full answer objects unchanged", () => {
		const result = parseAnswersInput('{"101":{"text":"Done X"}}');
		expect(result).toEqual({ "101": { text: "Done X" } });
	});

	test("handles multiple answers", () => {
		const result = parseAnswersInput('{"101":"Done X","102":"Working on Y"}');
		expect(result).toEqual({
			"101": { text: "Done X" },
			"102": { text: "Working on Y" },
		});
	});

	test("throws CliError with json_parse_error for invalid JSON", () => {
		try {
			parseAnswersInput("not json");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("json_parse_error");
			expect((e as CliError).exitCode).toBe(6);
		}
	});

	test("throws CliError with validation_error for array input", () => {
		try {
			parseAnswersInput('["array"]');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).exitCode).toBe(6);
		}
	});

	test("throws CliError with validation_error for bad answer value type", () => {
		try {
			parseAnswersInput('{"101":123}');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).exitCode).toBe(6);
		}
	});

	test("suggestion includes example usage", () => {
		try {
			parseAnswersInput("not json");
			throw new Error("should have thrown");
		} catch (e) {
			expect((e as CliError).suggestion).toContain("--answers");
		}
	});

	test("accepts empty object and returns empty result", () => {
		const result = parseAnswersInput("{}");
		expect(result).toEqual({});
	});

	test("accepts empty string answer values", () => {
		const result = parseAnswersInput('{"101":"","102":""}');
		expect(result).toEqual({
			"101": { text: "" },
			"102": { text: "" },
		});
	});
});

describe("parseChoicesInput", () => {
	test("happy path: parses valid JSON array of strings", () => {
		const result = parseChoicesInput('["Pizza", "Sushi", "Tacos"]');
		expect(result).toEqual(["Pizza", "Sushi", "Tacos"]);
	});

	test("throws CliError with json_parse_error for invalid JSON", () => {
		try {
			parseChoicesInput("not json");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("json_parse_error");
			expect((e as CliError).exitCode).toBe(6);
		}
	});

	test("throws CliError with validation_error for non-array input", () => {
		try {
			parseChoicesInput('"a string"');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).exitCode).toBe(6);
		}
	});

	test("throws CliError for too few choices (1 item)", () => {
		try {
			parseChoicesInput('["Only"]');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain("2-20");
		}
	});

	test("throws CliError for too many choices (21 items)", () => {
		try {
			parseChoicesInput(JSON.stringify(Array.from({ length: 21 }, (_, i) => String(i))));
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain("2-20");
		}
	});

	test("throws CliError for non-string item at index", () => {
		try {
			parseChoicesInput("[1, 2]");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain("index 0");
		}
	});

	test("boundary: exactly 2 choices succeeds", () => {
		const result = parseChoicesInput('["A", "B"]');
		expect(result).toEqual(["A", "B"]);
	});

	test("boundary: exactly 20 choices succeeds", () => {
		const input = Array.from({ length: 20 }, (_, i) => String(i));
		const result = parseChoicesInput(JSON.stringify(input));
		expect(result).toHaveLength(20);
	});

	test("accepts empty strings as choices", () => {
		const result = parseChoicesInput('["", ""]');
		expect(result).toEqual(["", ""]);
	});

	test("accepts whitespace-only strings as choices", () => {
		const result = parseChoicesInput('[" ", "  "]');
		expect(result).toEqual([" ", "  "]);
	});

	test("throws CliError for empty array (below minimum of 2)", () => {
		try {
			parseChoicesInput("[]");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain("2-20");
		}
	});
});

describe("parseDateFilter", () => {
	test("passes through unix timestamp strings unchanged", () => {
		const result = parseDateFilter("1705276800", "--before");
		expect(result).toBe("1705276800");
	});

	test("converts ISO 8601 date to unix timestamp string", () => {
		const result = parseDateFilter("2024-01-15", "--before");
		// Result should be a numeric string
		expect(result).toMatch(/^\d+$/);
		// Should represent the correct date
		const date = new Date(Number(result) * 1000);
		expect(date.getUTCFullYear()).toBe(2024);
		expect(date.getUTCMonth()).toBe(0); // January
		expect(date.getUTCDate()).toBe(15);
	});

	test("throws CliError with validation_error for invalid date", () => {
		try {
			parseDateFilter("not-a-date", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).exitCode).toBe(6);
		}
	});

	test("error message includes the label", () => {
		try {
			parseDateFilter("not-a-date", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect((e as CliError).message).toContain("--before");
		}
	});

	test("suggestion shows accepted formats", () => {
		try {
			parseDateFilter("not-a-date", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect((e as CliError).suggestion).toContain("YYYY-MM-DD");
			expect((e as CliError).suggestion).toContain("unix timestamp");
		}
	});

	test("rejects ambiguous date format 'March 5, 2024'", () => {
		try {
			parseDateFilter("March 5, 2024", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("rejects US date format '3/5/2024'", () => {
		try {
			parseDateFilter("3/5/2024", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("rejects ISO 8601 datetime '2024-01-15T10:00:00Z'", () => {
		try {
			parseDateFilter("2024-01-15T10:00:00Z", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("rejects impossible date Feb 31", () => {
		try {
			parseDateFilter("2024-02-31", "--after");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain("not a valid calendar date");
		}
	});

	test("rejects impossible month 13", () => {
		try {
			parseDateFilter("2024-13-01", "--after");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("rejects Apr 31 (April has 30 days)", () => {
		try {
			parseDateFilter("2024-04-31", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain("not a valid calendar date");
		}
	});

	test("rejects Feb 29 on a non-leap year", () => {
		try {
			parseDateFilter("2023-02-29", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
			expect((e as CliError).message).toContain("not a valid calendar date");
		}
	});

	test("accepts Feb 29 on a leap year", () => {
		const result = parseDateFilter("2024-02-29", "--before");
		expect(result).toMatch(/^\d+$/);
	});
});

describe("parseQuestionsInputV2", () => {
	test("converts string array items to {text} objects", () => {
		const result = parseQuestionsInputV2('["What did you do?"]');
		expect(result).toEqual([{ text: "What did you do?" }]);
	});

	test("maps {question} shape to {text}", () => {
		const result = parseQuestionsInputV2('[{"question":"Any blockers?"}]');
		expect(result).toEqual([{ text: "Any blockers?" }]);
	});

	test("passes through {text} unchanged", () => {
		const result = parseQuestionsInputV2('[{"text":"Today?"}]');
		expect(result).toEqual([{ text: "Today?" }]);
	});

	test("preserves choices array when present", () => {
		const result = parseQuestionsInputV2('[{"text":"Mood?","choices":["good","bad"]}]');
		expect(result).toEqual([{ text: "Mood?", choices: ["good", "bad"] }]);
	});

	test("throws validation_error when text is missing", () => {
		try {
			parseQuestionsInputV2('[{"answer_type":"text"}]');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("throws validation_error when choices is not a string array", () => {
		try {
			parseQuestionsInputV2('[{"text":"q","choices":[1,2,3]}]');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("throws validation_error when choices is not an array", () => {
		try {
			parseQuestionsInputV2('[{"text":"q","choices":"nope"}]');
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});
});

describe("parseV2DateFilter", () => {
	test("returns YYYY-MM-DD input unchanged", () => {
		expect(parseV2DateFilter("2026-01-15", "--before")).toBe("2026-01-15");
	});

	test("accepts ISO 8601 with Z suffix", () => {
		expect(parseV2DateFilter("2026-01-15T10:00:00Z", "--before")).toBe("2026-01-15T10:00:00Z");
	});

	test("accepts ISO 8601 with timezone offset", () => {
		expect(parseV2DateFilter("2026-01-15T10:00:00+02:00", "--before")).toBe(
			"2026-01-15T10:00:00+02:00",
		);
	});

	test("accepts ISO 8601 with fractional seconds", () => {
		expect(parseV2DateFilter("2026-01-15T10:00:00.123Z", "--after")).toBe(
			"2026-01-15T10:00:00.123Z",
		);
	});

	test("rejects unix timestamps", () => {
		try {
			parseV2DateFilter("1737000000", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("rejects invalid calendar dates", () => {
		try {
			parseV2DateFilter("2026-02-30", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
		}
	});

	test("rejects garbage input", () => {
		try {
			parseV2DateFilter("not-a-date", "--before");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			expect((e as CliError).code).toBe("validation_error");
		}
	});
});
