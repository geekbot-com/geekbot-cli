import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const mockHandleError = mock();
const mockHandlers = {
	handleStandupList: mock(() => Promise.resolve()),
	handleStandupGet: mock(() => Promise.resolve()),
	handleStandupCreate: mock(() => Promise.resolve()),
	handleStandupUpdate: mock(() => Promise.resolve()),
	handleStandupReplace: mock(() => Promise.resolve()),
	handleStandupDelete: mock(() => Promise.resolve()),
	handleStandupDuplicate: mock(() => Promise.resolve()),
	handleStandupStart: mock(() => Promise.resolve()),
};
mock.module("../../../src/handlers/standup-handlers.ts", () => mockHandlers);
mock.module("../../../src/errors/error-handler.ts", () => ({
	handleError: mockHandleError,
}));

import { createStandupCommand } from "../../../src/cli/commands/standup.ts";
import { addGlobalOptions } from "../../../src/cli/globals.ts";

afterAll(() => {
	mock.restore();
});

describe("createStandupCommand", () => {
	beforeEach(() => {
		for (const fn of Object.values(mockHandlers)) fn.mockClear();
		mockHandleError.mockClear();
	});

	test("returns a Command named 'standup'", () => {
		const cmd = createStandupCommand();
		expect(cmd.name()).toBe("standup");
	});

	test("registers 8 subcommands", () => {
		const cmd = createStandupCommand();
		expect(cmd.commands.length).toBe(8);
	});

	test("registers 'list' subcommand", () => {
		const cmd = createStandupCommand();
		expect(cmd.commands.find((c) => c.name() === "list")).toBeDefined();
	});

	test("registers 'get' subcommand", () => {
		const cmd = createStandupCommand();
		expect(cmd.commands.find((c) => c.name() === "get")).toBeDefined();
	});

	test("registers 'create' subcommand", () => {
		const cmd = createStandupCommand();
		expect(cmd.commands.find((c) => c.name() === "create")).toBeDefined();
	});

	test("registers 'update' subcommand", () => {
		const cmd = createStandupCommand();
		expect(cmd.commands.find((c) => c.name() === "update")).toBeDefined();
	});

	test("registers 'replace' subcommand", () => {
		const cmd = createStandupCommand();
		expect(cmd.commands.find((c) => c.name() === "replace")).toBeDefined();
	});

	test("registers 'delete' subcommand", () => {
		const cmd = createStandupCommand();
		expect(cmd.commands.find((c) => c.name() === "delete")).toBeDefined();
	});

	test("registers 'duplicate' subcommand", () => {
		const cmd = createStandupCommand();
		expect(cmd.commands.find((c) => c.name() === "duplicate")).toBeDefined();
	});

	test("registers 'start' subcommand", () => {
		const cmd = createStandupCommand();
		expect(cmd.commands.find((c) => c.name() === "start")).toBeDefined();
	});

	test("list subcommand calls handleStandupList", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "list", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleStandupList).toHaveBeenCalled();
	});

	test("list subcommand passes --brief flag to handler", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "list", "--brief", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleStandupList).toHaveBeenCalledWith(
			expect.objectContaining({ brief: true }),
			expect.anything(),
		);
	});

	test("list subcommand passes --name filter to handler", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "list", "--name", "daily", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleStandupList).toHaveBeenCalledWith(
			expect.objectContaining({ name: "daily" }),
			expect.anything(),
		);
	});

	test("list subcommand passes --channel filter to handler", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "list", "--channel", "#status", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleStandupList).toHaveBeenCalledWith(
			expect.objectContaining({ channel: "#status" }),
			expect.anything(),
		);
	});

	test("list subcommand passes --mine flag to handler", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "list", "--mine", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleStandupList).toHaveBeenCalledWith(
			expect.objectContaining({ mine: true }),
			expect.anything(),
		);
	});

	test("list subcommand passes --member flag to handler", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "list", "--member", "UHNM44125", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleStandupList).toHaveBeenCalledWith(
			expect.objectContaining({ member: "UHNM44125" }),
			expect.anything(),
		);
	});

	test("list subcommand passes all filter options together", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			[
				"standup",
				"list",
				"--admin",
				"--brief",
				"--name",
				"daily",
				"--mine",
				"--member",
				"U123",
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		expect(mockHandlers.handleStandupList).toHaveBeenCalledWith(
			expect.objectContaining({
				admin: true,
				brief: true,
				name: "daily",
				mine: true,
				member: "U123",
			}),
			expect.anything(),
		);
	});

	test("get subcommand calls handleStandupGet", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "get", "42", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleStandupGet).toHaveBeenCalled();
	});

	test("create subcommand calls handleStandupCreate", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			[
				"standup",
				"create",
				"--name",
				"Test",
				"--channel",
				"#test",
				"--questions",
				'["Q1"]',
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		expect(mockHandlers.handleStandupCreate).toHaveBeenCalled();
	});

	test("create subcommand fails without --questions", async () => {
		const program = new Command();
		addGlobalOptions(program);
		const standupCmd = createStandupCommand();
		program.addCommand(standupCmd);
		// Apply exitOverride to all commands in the tree so Commander
		// throws instead of calling process.exit
		program.exitOverride();
		program.configureOutput({ writeErr: () => {}, writeOut: () => {} });
		for (const sub of standupCmd.commands) {
			sub.exitOverride();
			sub.configureOutput({ writeErr: () => {}, writeOut: () => {} });
		}
		let thrownError: unknown;
		try {
			await program.parseAsync(
				["standup", "create", "--name", "Test", "--channel", "#test", "--api-key", "test"],
				{ from: "user" },
			);
		} catch (err) {
			thrownError = err;
		}
		expect(thrownError).toBeDefined();
		expect((thrownError as Error).message).toContain("questions");
	});

	test("create subcommand passes undefined for time and days when omitted (handler provides defaults)", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			[
				"standup",
				"create",
				"--name",
				"Test",
				"--channel",
				"#test",
				"--questions",
				'["Q1"]',
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		const callArgs = mockHandlers.handleStandupCreate.mock.calls[0] as [Record<string, unknown>];
		const opts = callArgs[0];
		expect(opts.time).toBeUndefined();
		expect(opts.days).toBeUndefined();
	});

	test("update subcommand calls handleStandupUpdate", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			["standup", "update", "42", "--name", "Updated", "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandlers.handleStandupUpdate).toHaveBeenCalled();
	});

	test("update subcommand passes --users to handler", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			["standup", "update", "42", "--users", "111,222", "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandlers.handleStandupUpdate).toHaveBeenCalledWith(
			"42",
			expect.objectContaining({ users: "111,222" }),
			expect.anything(),
		);
	});

	test("replace subcommand calls handleStandupReplace", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			["standup", "replace", "42", "--name", "Replaced", "--channel", "#new", "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandlers.handleStandupReplace).toHaveBeenCalled();
	});

	test("delete subcommand calls handleStandupDelete", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "delete", "42", "--yes", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleStandupDelete).toHaveBeenCalled();
	});

	test("delete subcommand without --yes passes yes=undefined to handler", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "delete", "42", "--api-key", "test"], { from: "user" });
		expect(mockHandlers.handleStandupDelete).toHaveBeenCalled();
		const callArgs = mockHandlers.handleStandupDelete.mock.calls[0] as [
			string,
			Record<string, unknown>,
		];
		const opts = callArgs[1];
		expect(opts.yes).toBeUndefined();
	});

	test("duplicate subcommand calls handleStandupDuplicate", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			["standup", "duplicate", "42", "--name", "Copy", "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandlers.handleStandupDuplicate).toHaveBeenCalled();
	});

	test("start subcommand calls handleStandupStart", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "start", "42", "--api-key", "test"], { from: "user" });
		expect(mockHandlers.handleStandupStart).toHaveBeenCalled();
	});

	test("action error is caught and passed to handleError", async () => {
		mockHandlers.handleStandupList.mockRejectedValueOnce(new Error("test error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "list", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("get error is caught and passed to handleError", async () => {
		mockHandlers.handleStandupGet.mockRejectedValueOnce(new Error("get error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "get", "42", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("create error is caught and passed to handleError", async () => {
		mockHandlers.handleStandupCreate.mockRejectedValueOnce(new Error("create error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			[
				"standup",
				"create",
				"--name",
				"Test",
				"--channel",
				"#test",
				"--questions",
				'["Q1"]',
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("update error is caught and passed to handleError", async () => {
		mockHandlers.handleStandupUpdate.mockRejectedValueOnce(new Error("update error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			["standup", "update", "42", "--name", "Updated", "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("replace error is caught and passed to handleError", async () => {
		mockHandlers.handleStandupReplace.mockRejectedValueOnce(new Error("replace error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			["standup", "replace", "42", "--name", "R", "--channel", "#c", "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("delete error is caught and passed to handleError", async () => {
		mockHandlers.handleStandupDelete.mockRejectedValueOnce(new Error("delete error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "delete", "42", "--yes", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("duplicate error is caught and passed to handleError", async () => {
		mockHandlers.handleStandupDuplicate.mockRejectedValueOnce(new Error("duplicate error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(
			["standup", "duplicate", "42", "--name", "Copy", "--api-key", "test"],
			{ from: "user" },
		);
		expect(mockHandleError).toHaveBeenCalled();
	});

	test("start error is caught and passed to handleError", async () => {
		mockHandlers.handleStandupStart.mockRejectedValueOnce(new Error("start error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createStandupCommand());
		await program.parseAsync(["standup", "start", "42", "--api-key", "test"], { from: "user" });
		expect(mockHandleError).toHaveBeenCalled();
	});
});
