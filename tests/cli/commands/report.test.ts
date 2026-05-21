import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const mockHandleError = mock();
const mockHandlers = {
	handleReportList: mock(() => Promise.resolve()),
	handleReportCreate: mock(() => Promise.resolve()),
	handleReportGet: mock(() => Promise.resolve()),
	handleReportEdit: mock(() => Promise.resolve()),
	handleReportDelete: mock(() => Promise.resolve()),
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

	test("registers 5 subcommands (list, create, get, edit, delete)", () => {
		const cmd = createReportCommand();
		expect(cmd.commands.length).toBe(5);
		const names = cmd.commands.map((c) => c.name()).sort();
		expect(names).toEqual(["create", "delete", "edit", "get", "list"]);
	});

	test("list subcommand calls handleReportList with v2 flags", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createReportCommand());
		await program.parseAsync(
			[
				"report",
				"list",
				"--view",
				"summary",
				"--page-size",
				"50",
				"--cursor",
				"abc",
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		expect(mockHandlers.handleReportList).toHaveBeenCalled();
		const opts = mockHandlers.handleReportList.mock.calls[0]?.[0] as Record<string, string>;
		expect(opts.view).toBe("summary");
		expect(opts.pageSize).toBe("50");
		expect(opts.cursor).toBe("abc");
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

	test("get subcommand calls handleReportGet with id and view", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createReportCommand());
		await program.parseAsync(["report", "get", "456", "--view", "full", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleReportGet).toHaveBeenCalled();
		const [id, opts] = mockHandlers.handleReportGet.mock.calls[0] as [string, { view?: string }];
		expect(id).toBe("456");
		expect(opts.view).toBe("full");
	});

	test("edit subcommand calls handleReportEdit", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createReportCommand());
		await program.parseAsync(
			["report", "edit", "456", "--answers", '{"101":"Corrected"}', "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandlers.handleReportEdit).toHaveBeenCalled();
	});

	test("delete subcommand calls handleReportDelete with --yes", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createReportCommand());
		await program.parseAsync(["report", "delete", "456", "--yes", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleReportDelete).toHaveBeenCalled();
		const [, opts] = mockHandlers.handleReportDelete.mock.calls[0] as [string, { yes?: boolean }];
		expect(opts.yes).toBe(true);
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
