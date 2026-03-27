import { describe, expect, test } from "bun:test";
import type { Standup } from "../../src/schemas/standup.ts";
import {
	buildDeleteUndoCommand,
	buildReceipt,
	buildUpdateUndoCommand,
	shellEscape,
} from "../../src/utils/receipt.ts";

/** Minimal standup fixture for testing undo command generation */
const STANDUP_FIXTURE: Standup = {
	id: 1,
	name: "Daily Standup",
	channel: "#general",
	time: "10:00:00",
	timezone: "America/New_York",
	days: ["Mon", "Wed", "Fri"],
	questions: [
		{
			id: 101,
			color: "#000",
			text: "What did you do?",
			schedule: null,
			answer_type: "text",
			answer_choices: [],
			hasAnswers: false,
			is_random: false,
			random_texts: [],
			prefilled_by: null,
			text_id: null,
			preconditions: [],
			label: null,
			flavor: "default",
		},
		{
			id: 102,
			color: "#000",
			text: "Any blockers?",
			schedule: null,
			answer_type: "text",
			answer_choices: [],
			hasAnswers: false,
			is_random: false,
			random_texts: [],
			prefilled_by: null,
			text_id: null,
			preconditions: [],
			label: null,
			flavor: "default",
		},
	],
	users: [],
	wait_time: 10, // already normalized to minutes
	personalised: false,
	confidential: false,
	anonymous: false,
};

describe("shellEscape", () => {
	test("wraps value in single quotes", () => {
		expect(shellEscape("hello")).toBe("'hello'");
	});

	test("escapes embedded single quotes", () => {
		expect(shellEscape("it's")).toBe("'it'\\''s'");
	});

	test("handles double quotes safely", () => {
		expect(shellEscape('say "hi"')).toBe("'say \"hi\"'");
	});

	test("handles dollar signs and backticks safely", () => {
		expect(shellEscape("$HOME `whoami`")).toBe("'$HOME `whoami`'");
	});

	test("handles values with special shell characters", () => {
		const dangerous = 'test"; rm -rf /; echo "';
		const escaped = shellEscape(dangerous);
		expect(escaped).toBe("'test\"; rm -rf /; echo \"'");
	});

	test("handles multiple single quotes", () => {
		expect(shellEscape("it's a 'test'")).toBe("'it'\\''s a '\\''test'\\'''");
	});
});

describe("buildReceipt", () => {
	test("returns {operation, undo} metadata object", () => {
		const receipt = buildReceipt("created", "geekbot standup delete 1 --yes");
		expect(receipt).toEqual({
			operation: "created",
			undo: "geekbot standup delete 1 --yes",
		});
	});

	test("handles null undo command", () => {
		const receipt = buildReceipt("started", null);
		expect(receipt).toEqual({
			operation: "started",
			undo: null,
		});
	});

	test("handles all operation types", () => {
		expect(buildReceipt("updated", "cmd").operation).toBe("updated");
		expect(buildReceipt("deleted", "cmd").operation).toBe("deleted");
		expect(buildReceipt("duplicated", "cmd").operation).toBe("duplicated");
	});
});

describe("buildDeleteUndoCommand", () => {
	test("returns string starting with 'geekbot standup create --name'", () => {
		const cmd = buildDeleteUndoCommand(STANDUP_FIXTURE);
		expect(cmd.startsWith("geekbot standup create --name")).toBe(true);
	});

	test("includes --channel flag from standup", () => {
		const cmd = buildDeleteUndoCommand(STANDUP_FIXTURE);
		expect(cmd).toContain("--channel '#general'");
	});

	test("includes --time flag (sliced to HH:MM)", () => {
		const cmd = buildDeleteUndoCommand(STANDUP_FIXTURE);
		expect(cmd).toContain("--time '10:00'");
	});

	test("includes --timezone flag", () => {
		const cmd = buildDeleteUndoCommand(STANDUP_FIXTURE);
		expect(cmd).toContain("--timezone 'America/New_York'");
	});

	test("includes --days flag with comma-separated values", () => {
		const cmd = buildDeleteUndoCommand(STANDUP_FIXTURE);
		expect(cmd).toContain("--days 'Mon,Wed,Fri'");
	});

	test("includes --wait-time flag when wait_time > 0", () => {
		const cmd = buildDeleteUndoCommand(STANDUP_FIXTURE);
		expect(cmd).toContain("--wait-time 10");
	});

	test("includes --questions flag with JSON array of question texts", () => {
		const cmd = buildDeleteUndoCommand(STANDUP_FIXTURE);
		expect(cmd).toContain("--questions");
		expect(cmd).toContain("What did you do?");
		expect(cmd).toContain("Any blockers?");
	});

	test("omits --wait-time when wait_time is 0", () => {
		const standup = { ...STANDUP_FIXTURE, wait_time: 0 };
		const cmd = buildDeleteUndoCommand(standup);
		expect(cmd).not.toContain("--wait-time");
	});

	test("P2-2: includes --wait-time for wait_time=-1 (exact time)", () => {
		const standup = { ...STANDUP_FIXTURE, wait_time: -1 };
		const cmd = buildDeleteUndoCommand(standup);
		expect(cmd).toContain("--wait-time -1");
	});

	test("P2-2: includes --users when users are present", () => {
		const standup = {
			...STANDUP_FIXTURE,
			users: [
				{
					id: "U123",
					role: "member",
					email: "a@b.com",
					username: "alice",
					realname: "Alice",
					profile_img: "",
				},
				{
					id: "U456",
					role: "member",
					email: "b@b.com",
					username: "bob",
					realname: "Bob",
					profile_img: "",
				},
			],
		};
		const cmd = buildDeleteUndoCommand(standup);
		expect(cmd).toContain("--users U123,U456");
	});

	test("omits --questions when questions array is empty", () => {
		const standup = { ...STANDUP_FIXTURE, questions: [] };
		const cmd = buildDeleteUndoCommand(standup);
		expect(cmd).not.toContain("--questions");
	});

	test("escapes special characters in standup name", () => {
		const standup = { ...STANDUP_FIXTURE, name: 'test"; rm -rf /; echo "' };
		const cmd = buildDeleteUndoCommand(standup);
		expect(cmd).toContain("--name 'test\"; rm -rf /; echo \"'");
		expect(cmd).not.toContain('--name "');
	});

	test("escapes single quotes in values", () => {
		const standup = { ...STANDUP_FIXTURE, name: "it's a standup" };
		const cmd = buildDeleteUndoCommand(standup);
		expect(cmd).toContain("--name 'it'\\''s a standup'");
	});
});

describe("buildUpdateUndoCommand", () => {
	test("builds undo command with only changed fields using previous values", () => {
		const cmd = buildUpdateUndoCommand(123, STANDUP_FIXTURE, { name: "New Name" });
		expect(cmd).toBe("geekbot standup update 123 --name 'Daily Standup'");
	});

	test("handles multiple changed fields", () => {
		const cmd = buildUpdateUndoCommand(123, STANDUP_FIXTURE, {
			name: "New",
			channel: "#other",
		});
		expect(cmd).toContain("--name 'Daily Standup'");
		expect(cmd).toContain("--channel '#general'");
	});

	test("formats time field with HH:MM slice", () => {
		const cmd = buildUpdateUndoCommand(123, STANDUP_FIXTURE, { time: "14:00:00" });
		expect(cmd).toContain("--time '10:00'");
	});

	test("formats days as comma-separated", () => {
		const cmd = buildUpdateUndoCommand(123, STANDUP_FIXTURE, { days: ["Tue", "Thu"] });
		expect(cmd).toContain("--days 'Mon,Wed,Fri'");
	});

	test("formats wait_time as number (no quotes)", () => {
		const cmd = buildUpdateUndoCommand(123, STANDUP_FIXTURE, { wait_time: 15 });
		expect(cmd).toContain("--wait-time 10");
	});

	test("starts with 'geekbot standup update <id>'", () => {
		const cmd = buildUpdateUndoCommand(456, STANDUP_FIXTURE, { name: "X" });
		expect(cmd.startsWith("geekbot standup update 456")).toBe(true);
	});

	test("escapes special characters in string values", () => {
		const standup = { ...STANDUP_FIXTURE, name: "$HOME `whoami`" };
		const cmd = buildUpdateUndoCommand(123, standup, { name: "New" });
		expect(cmd).toContain("--name '$HOME `whoami`'");
	});
});
