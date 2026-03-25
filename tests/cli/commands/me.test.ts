import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const mockHandleError = mock();
const mockHandlers = {
	handleMeShow: mock(() => Promise.resolve()),
	handleMeTeams: mock(() => Promise.resolve()),
};
mock.module("../../../src/handlers/me-handlers.ts", () => mockHandlers);
mock.module("../../../src/errors/error-handler.ts", () => ({
	handleError: mockHandleError,
}));

import { createMeCommand } from "../../../src/cli/commands/me.ts";
import { addGlobalOptions } from "../../../src/cli/globals.ts";

afterAll(() => {
	mock.restore();
});

describe("createMeCommand", () => {
	beforeEach(() => {
		for (const fn of Object.values(mockHandlers)) fn.mockClear();
		mockHandleError.mockClear();
	});

	test("returns a Command named 'me'", () => {
		const cmd = createMeCommand();
		expect(cmd.name()).toBe("me");
	});

	test("registers 2 subcommands", () => {
		const cmd = createMeCommand();
		expect(cmd.commands.length).toBe(2);
	});

	test("registers 'show' subcommand", () => {
		const cmd = createMeCommand();
		expect(cmd.commands.find((c) => c.name() === "show")).toBeDefined();
	});

	test("registers 'teams' subcommand", () => {
		const cmd = createMeCommand();
		expect(cmd.commands.find((c) => c.name() === "teams")).toBeDefined();
	});

	test("show subcommand calls handleMeShow", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createMeCommand());
		await program.parseAsync(["me", "show", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleMeShow).toHaveBeenCalled();
	});

	test("teams subcommand calls handleMeTeams", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createMeCommand());
		await program.parseAsync(["me", "teams", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleMeTeams).toHaveBeenCalled();
	});

	test("action error is caught and passed to handleError", async () => {
		mockHandlers.handleMeShow.mockRejectedValueOnce(new Error("test error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createMeCommand());
		await program.parseAsync(["me", "show", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});
});
