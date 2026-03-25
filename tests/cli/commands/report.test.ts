import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const mockHandleError = mock();
const mockHandlers = {
	handleReportList: mock(() => Promise.resolve()),
	handleReportCreate: mock(() => Promise.resolve()),
};
mock.module("../../../src/handlers/report-handlers.ts", () => mockHandlers);
mock.module("../../../src/errors/error-handler.ts", () => ({
	handleError: mockHandleError,
}));

import { createReportCommand } from "../../../src/cli/commands/report.ts";
import { addGlobalOptions } from "../../../src/cli/globals.ts";

afterAll(() => {
	mock.restore();
});

describe("createReportCommand", () => {
	beforeEach(() => {
		for (const fn of Object.values(mockHandlers)) fn.mockClear();
		mockHandleError.mockClear();
	});

	test("returns a Command named 'report'", () => {
		const cmd = createReportCommand();
		expect(cmd.name()).toBe("report");
	});

	test("registers 2 subcommands", () => {
		const cmd = createReportCommand();
		expect(cmd.commands.length).toBe(2);
	});

	test("registers 'list' subcommand", () => {
		const cmd = createReportCommand();
		expect(cmd.commands.find((c) => c.name() === "list")).toBeDefined();
	});

	test("registers 'create' subcommand", () => {
		const cmd = createReportCommand();
		expect(cmd.commands.find((c) => c.name() === "create")).toBeDefined();
	});

	test("list subcommand calls handleReportList", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createReportCommand());
		await program.parseAsync(["report", "list", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleReportList).toHaveBeenCalled();
	});

	test("create subcommand calls handleReportCreate", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createReportCommand());
		await program.parseAsync(
			[
				"report",
				"create",
				"--standup-id",
				"123",
				"--answers",
				'{"101":"Done feature X"}',
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		expect(mockHandlers.handleReportCreate).toHaveBeenCalled();
	});

	test("action error is caught and passed to handleError", async () => {
		mockHandlers.handleReportList.mockRejectedValueOnce(new Error("test error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createReportCommand());
		await program.parseAsync(["report", "list", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});
});
