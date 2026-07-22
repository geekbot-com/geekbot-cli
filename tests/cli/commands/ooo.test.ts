import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const mockHandleError = mock();
const mockHandlers = {
	handleOooList: mock(() => Promise.resolve()),
	handleOooGet: mock(() => Promise.resolve()),
	handleOooCreate: mock(() => Promise.resolve()),
	handleOooEdit: mock(() => Promise.resolve()),
	handleOooDelete: mock(() => Promise.resolve()),
};
mock.module("../../../src/handlers/ooo-handlers.ts", () => mockHandlers);
mock.module("../../../src/errors/error-handler.ts", () => ({
	handleError: mockHandleError,
}));

import { createOooCommand } from "../../../src/cli/commands/ooo.ts";
import { addGlobalOptions } from "../../../src/cli/globals.ts";

afterAll(() => {
	mock.restore();
});

describe("createOooCommand", () => {
	beforeEach(() => {
		for (const fn of Object.values(mockHandlers)) fn.mockClear();
		mockHandleError.mockClear();
	});

	test("returns a Command named 'ooo'", () => {
		const cmd = createOooCommand();
		expect(cmd.name()).toBe("ooo");
	});

	test("registers 5 subcommands", () => {
		const cmd = createOooCommand();
		expect(cmd.commands.length).toBe(5);
	});

	test("registers 'list' subcommand", () => {
		const cmd = createOooCommand();
		expect(cmd.commands.find((c) => c.name() === "list")).toBeDefined();
	});

	test("registers 'get' subcommand", () => {
		const cmd = createOooCommand();
		expect(cmd.commands.find((c) => c.name() === "get")).toBeDefined();
	});

	test("registers 'create' subcommand", () => {
		const cmd = createOooCommand();
		expect(cmd.commands.find((c) => c.name() === "create")).toBeDefined();
	});

	test("registers 'edit' subcommand", () => {
		const cmd = createOooCommand();
		expect(cmd.commands.find((c) => c.name() === "edit")).toBeDefined();
	});

	test("registers 'delete' subcommand", () => {
		const cmd = createOooCommand();
		expect(cmd.commands.find((c) => c.name() === "delete")).toBeDefined();
	});

	test("list subcommand calls handleOooList", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(["ooo", "list", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleOooList).toHaveBeenCalled();
	});

	test("list subcommand passes mapped options to handler", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(
			[
				"ooo",
				"list",
				"--user",
				"U08LXSA31BJ",
				"--cursor",
				"opaque",
				"--page-size",
				"50",
				"--after",
				"2026-01-01",
				"--before",
				"2026-07-01",
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		expect(mockHandlers.handleOooList).toHaveBeenCalledWith(
			expect.objectContaining({
				user: "U08LXSA31BJ",
				cursor: "opaque",
				pageSize: "50",
				after: "2026-01-01",
				before: "2026-07-01",
			}),
			expect.anything(),
		);
	});

	test("get subcommand calls handleOooGet with the id", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(["ooo", "get", "12", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleOooGet).toHaveBeenCalledWith("12", expect.anything());
	});

	test("create subcommand calls handleOooCreate with mapped options", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(
			[
				"ooo",
				"create",
				"--start-date",
				"2026-08-01",
				"--end-date",
				"2026-08-15",
				"--user",
				"U123",
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		expect(mockHandlers.handleOooCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				startDate: "2026-08-01",
				endDate: "2026-08-15",
				user: "U123",
			}),
			expect.anything(),
		);
	});

	test("create subcommand fails without --start-date", async () => {
		const program = new Command();
		addGlobalOptions(program);
		const oooCmd = createOooCommand();
		program.addCommand(oooCmd);
		// Apply exitOverride to all commands in the tree so Commander
		// throws instead of calling process.exit
		program.exitOverride();
		program.configureOutput({ writeErr: () => {}, writeOut: () => {} });
		for (const sub of oooCmd.commands) {
			sub.exitOverride();
			sub.configureOutput({ writeErr: () => {}, writeOut: () => {} });
		}
		let thrownError: unknown;
		try {
			await program.parseAsync(["ooo", "create", "--end-date", "2026-08-15", "--api-key", "test"], {
				from: "user",
			});
		} catch (err) {
			thrownError = err;
		}
		expect(thrownError).toBeDefined();
		expect((thrownError as Error).message).toContain("start-date");
	});

	test("create subcommand fails without --end-date", async () => {
		const program = new Command();
		addGlobalOptions(program);
		const oooCmd = createOooCommand();
		program.addCommand(oooCmd);
		program.exitOverride();
		program.configureOutput({ writeErr: () => {}, writeOut: () => {} });
		for (const sub of oooCmd.commands) {
			sub.exitOverride();
			sub.configureOutput({ writeErr: () => {}, writeOut: () => {} });
		}
		let thrownError: unknown;
		try {
			await program.parseAsync(
				["ooo", "create", "--start-date", "2026-08-01", "--api-key", "test"],
				{ from: "user" },
			);
		} catch (err) {
			thrownError = err;
		}
		expect(thrownError).toBeDefined();
		expect((thrownError as Error).message).toContain("end-date");
	});

	test("edit subcommand calls handleOooEdit with id and mapped options", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(
			["ooo", "edit", "12", "--end-date", "2026-08-20", "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandlers.handleOooEdit).toHaveBeenCalledWith(
			"12",
			expect.objectContaining({ endDate: "2026-08-20" }),
			expect.anything(),
		);
	});

	test("delete subcommand calls handleOooDelete with id and options", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(["ooo", "delete", "12", "--yes", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleOooDelete).toHaveBeenCalledWith(
			"12",
			expect.objectContaining({ yes: true }),
			expect.anything(),
		);
	});

	test("delete subcommand passes yes=undefined when --yes omitted (handler refuses)", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(["ooo", "delete", "12", "--api-key", "test"], {
			from: "user",
		});
		const callArgs = mockHandlers.handleOooDelete.mock.calls[0] as unknown as [
			string,
			Record<string, unknown>,
		];
		expect(callArgs[1].yes).toBeUndefined();
	});

	test("list error is caught and passed to handleError", async () => {
		mockHandlers.handleOooList.mockRejectedValueOnce(new Error("list error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(["ooo", "list", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("get error is caught and passed to handleError", async () => {
		mockHandlers.handleOooGet.mockRejectedValueOnce(new Error("get error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(["ooo", "get", "12", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("create error is caught and passed to handleError", async () => {
		mockHandlers.handleOooCreate.mockRejectedValueOnce(new Error("create error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(
			[
				"ooo",
				"create",
				"--start-date",
				"2026-08-01",
				"--end-date",
				"2026-08-15",
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("edit error is caught and passed to handleError", async () => {
		mockHandlers.handleOooEdit.mockRejectedValueOnce(new Error("edit error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(
			["ooo", "edit", "12", "--end-date", "2026-08-20", "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("delete error is caught and passed to handleError", async () => {
		mockHandlers.handleOooDelete.mockRejectedValueOnce(new Error("delete error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createOooCommand());
		await program.parseAsync(["ooo", "delete", "12", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});
});
