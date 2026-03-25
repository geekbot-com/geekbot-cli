import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const mockHandlers = {
	handleTeamList: mock(() => Promise.resolve()),
	handleTeamSearch: mock(() => Promise.resolve()),
};
mock.module("../../../src/handlers/team-handlers.ts", () => mockHandlers);
mock.module("../../../src/errors/error-handler.ts", () => ({
	handleError: mock(),
}));

import { createTeamCommand } from "../../../src/cli/commands/team.ts";
import { addGlobalOptions } from "../../../src/cli/globals.ts";

afterAll(() => {
	mock.restore();
});

describe("createTeamCommand", () => {
	beforeEach(() => {
		for (const fn of Object.values(mockHandlers)) fn.mockClear();
	});

	test("returns a Command named 'team'", () => {
		const cmd = createTeamCommand();
		expect(cmd.name()).toBe("team");
	});

	test("registers 2 subcommands", () => {
		const cmd = createTeamCommand();
		expect(cmd.commands.length).toBe(2);
	});

	test("registers 'list' subcommand", () => {
		const cmd = createTeamCommand();
		expect(cmd.commands.find((c) => c.name() === "list")).toBeDefined();
	});

	test("registers 'search' subcommand", () => {
		const cmd = createTeamCommand();
		expect(cmd.commands.find((c) => c.name() === "search")).toBeDefined();
	});

	test("list subcommand calls handleTeamList", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createTeamCommand());
		await program.parseAsync(["team", "list", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleTeamList).toHaveBeenCalled();
	});

	test("search subcommand calls handleTeamSearch with query", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createTeamCommand());
		await program.parseAsync(["team", "search", "jenny", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleTeamSearch).toHaveBeenCalledWith(
			"jenny",
			expect.objectContaining({ apiKey: "test" }),
		);
	});
});
