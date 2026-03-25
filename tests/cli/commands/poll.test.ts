import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const mockHandleError = mock();
const mockHandlers = {
	handlePollList: mock(() => Promise.resolve()),
	handlePollGet: mock(() => Promise.resolve()),
	handlePollCreate: mock(() => Promise.resolve()),
	handlePollVotes: mock(() => Promise.resolve()),
};
mock.module("../../../src/handlers/poll-handlers.ts", () => mockHandlers);
mock.module("../../../src/errors/error-handler.ts", () => ({
	handleError: mockHandleError,
}));

import { createPollCommand } from "../../../src/cli/commands/poll.ts";
import { addGlobalOptions } from "../../../src/cli/globals.ts";

describe("createPollCommand", () => {
	beforeEach(() => {
		for (const fn of Object.values(mockHandlers)) fn.mockClear();
		mockHandleError.mockClear();
	});

	test("returns a Command named 'poll'", () => {
		const cmd = createPollCommand();
		expect(cmd.name()).toBe("poll");
	});

	test("registers 4 subcommands", () => {
		const cmd = createPollCommand();
		expect(cmd.commands.length).toBe(4);
	});

	test("registers 'list' subcommand", () => {
		const cmd = createPollCommand();
		expect(cmd.commands.find((c) => c.name() === "list")).toBeDefined();
	});

	test("registers 'get' subcommand", () => {
		const cmd = createPollCommand();
		expect(cmd.commands.find((c) => c.name() === "get")).toBeDefined();
	});

	test("registers 'create' subcommand", () => {
		const cmd = createPollCommand();
		expect(cmd.commands.find((c) => c.name() === "create")).toBeDefined();
	});

	test("registers 'votes' subcommand", () => {
		const cmd = createPollCommand();
		expect(cmd.commands.find((c) => c.name() === "votes")).toBeDefined();
	});

	test("list subcommand calls handlePollList", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createPollCommand());
		await program.parseAsync(["poll", "list", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handlePollList).toHaveBeenCalled();
	});

	test("get subcommand calls handlePollGet", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createPollCommand());
		await program.parseAsync(["poll", "get", "42", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handlePollGet).toHaveBeenCalled();
	});

	test("create subcommand calls handlePollCreate", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createPollCommand());
		await program.parseAsync(
			[
				"poll",
				"create",
				"--name",
				"Test Poll",
				"--channel",
				"#test",
				"--question",
				"Lunch?",
				"--choices",
				'["Pizza","Sushi"]',
				"--api-key",
				"test",
			],
			{ from: "user" },
		);
		expect(mockHandlers.handlePollCreate).toHaveBeenCalled();
	});

	test("votes subcommand calls handlePollVotes", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createPollCommand());
		await program.parseAsync(["poll", "votes", "42", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handlePollVotes).toHaveBeenCalled();
	});

	test("action error is caught and passed to handleError", async () => {
		mockHandlers.handlePollList.mockRejectedValueOnce(new Error("test error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createPollCommand());
		await program.parseAsync(["poll", "list", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});
});
