import { describe, expect, test } from "bun:test";
import { PollListSchema, PollSchema, PollVotesResponseSchema } from "../../src/schemas/poll.ts";

const sampleUser = {
	id: "U123",
	role: "admin" as const,
	email: "jane@example.com",
	username: "jane",
	realname: "Jane Doe",
	profile_img: "https://img.example.com/jane.png",
};

const samplePoll = {
	id: 1,
	name: "Daily Standup Poll",
	time: "09:00",
	timezone: "America/New_York",
	questions: [
		{
			id: 10,
			text: "How was your day?",
			answer_type: "multi_choice",
			answer_choices: ["Great", "Good", "Okay"],
			add_own_options: true,
			one_option_limit: false,
		},
	],
	users: [sampleUser],
	recurrence: {
		type: "weekly",
		repeat: 1,
		every: null,
		day: "Mon",
		month: null,
	},
	sync_channel_members: false,
	sync_channel: null,
	dm_mode: false,
	anonymous: false,
	intro: "Please fill out this poll",
	creator: sampleUser,
	users_total: 5,
	paused: false,
};

describe("PollSchema", () => {
	test("parses poll with creator as User object", () => {
		const poll = PollSchema.parse(samplePoll);
		expect(poll.creator.id).toBe("U123");
		expect(poll.creator.email).toBe("jane@example.com");
		expect(poll.id).toBe(1);
		expect(poll.name).toBe("Daily Standup Poll");
	});

	test("parses questions array with all fields", () => {
		const poll = PollSchema.parse(samplePoll);
		expect(poll.questions).toHaveLength(1);
		expect(poll.questions[0]?.text).toBe("How was your day?");
		expect(poll.questions[0]?.answer_choices).toEqual(["Great", "Good", "Okay"]);
		expect(poll.questions[0]?.add_own_options).toBe(true);
	});

	test("accepts null recurrence", () => {
		const poll = PollSchema.parse({ ...samplePoll, recurrence: null });
		expect(poll.recurrence).toBeNull();
	});

	test("accepts null sync_channel", () => {
		const poll = PollSchema.parse(samplePoll);
		expect(poll.sync_channel).toBeNull();
	});

	test("parses users array as FullUser objects", () => {
		const poll = PollSchema.parse(samplePoll);
		expect(poll.users).toHaveLength(1);
		expect(poll.users[0]?.username).toBe("jane");
	});

	test("#5: accepts weekly recurrence with object day", () => {
		const poll = PollSchema.parse({
			...samplePoll,
			recurrence: { type: "weekly", repeat: 1, every: null, day: { value: "monday" }, month: null },
		});
		expect(poll.recurrence?.day).toEqual({ value: "monday" });
	});

	test("#5: accepts monthly recurrence with nth-of-weekday day object", () => {
		const poll = PollSchema.parse({
			...samplePoll,
			recurrence: {
				type: "monthly",
				repeat: null,
				every: null,
				day: { order: "2nd", value: "wednesday" },
				month: null,
			},
		});
		expect(poll.recurrence?.day).toEqual({ order: "2nd", value: "wednesday" });
	});

	test("#5: accepts monthly recurrence with date-of-month day object", () => {
		const poll = PollSchema.parse({
			...samplePoll,
			recurrence: {
				type: "monthly",
				repeat: null,
				every: null,
				day: { order: "15", value: "day" },
				month: null,
			},
		});
		expect(poll.recurrence?.day).toEqual({ order: "15", value: "day" });
	});

	test("#5: accepts quarterly recurrence with object month and day", () => {
		const poll = PollSchema.parse({
			...samplePoll,
			recurrence: {
				type: "quarterly",
				repeat: null,
				every: null,
				day: { order: "3rd", value: "monday" },
				month: { order: "1st" },
			},
		});
		expect(poll.recurrence?.month).toEqual({ order: "1st" });
		expect(poll.recurrence?.day).toEqual({ order: "3rd", value: "monday" });
	});

	test("#5: accepts yearly recurrence with object month and day", () => {
		const poll = PollSchema.parse({
			...samplePoll,
			recurrence: {
				type: "yearly",
				repeat: null,
				every: null,
				day: { order: "1st", value: "monday" },
				month: { value: "july" },
			},
		});
		expect(poll.recurrence?.month).toEqual({ value: "july" });
	});

	test("#5: preserves legacy string day and month (backward compat)", () => {
		const poll = PollSchema.parse({
			...samplePoll,
			recurrence: {
				type: "monthly",
				repeat: 1,
				every: null,
				day: "Mon",
				month: "January",
			},
		});
		expect(poll.recurrence?.day).toBe("Mon");
		expect(poll.recurrence?.month).toBe("January");
	});

	test("#5: accepts null day and month inside a non-null recurrence", () => {
		const poll = PollSchema.parse({
			...samplePoll,
			recurrence: { type: "once", repeat: null, every: null, day: null, month: null },
		});
		expect(poll.recurrence?.day).toBeNull();
		expect(poll.recurrence?.month).toBeNull();
	});
});

describe("PollListSchema", () => {
	test("parses array of polls", () => {
		const polls = PollListSchema.parse([samplePoll, samplePoll]);
		expect(polls).toHaveLength(2);
	});

	test("parses empty array", () => {
		const polls = PollListSchema.parse([]);
		expect(polls).toHaveLength(0);
	});

	test("#5: accepts list where recurrence.day and recurrence.month are objects", () => {
		// Exact failure path from issue #5 — error was `0.recurrence.day`, `0.recurrence.month`.
		const polls = PollListSchema.parse([
			{
				...samplePoll,
				recurrence: {
					type: "yearly",
					repeat: null,
					every: null,
					day: { order: "1st", value: "monday" },
					month: { value: "july" },
				},
			},
		]);
		expect(polls).toHaveLength(1);
		expect(polls[0]?.recurrence?.day).toEqual({ order: "1st", value: "monday" });
		expect(polls[0]?.recurrence?.month).toEqual({ value: "july" });
	});
});

describe("PollVotesResponseSchema", () => {
	const sampleVotesResponse = {
		total_results: 15,
		questions: [
			{
				id: 10,
				text: "How was your day?",
				answer_type: "multi_choice",
				categories: [],
				total_responses: 15,
				total_responders: 5,
				results: [
					{
						date: "2024-01-15",
						answers: [
							{
								text: "Great",
								catergory_id: "uncategorized",
								votes: 3,
								percentage: 60,
								users: [sampleUser],
							},
							{
								text: "Good",
								catergory_id: 1,
								votes: 2,
								percentage: 40,
							},
						],
					},
				],
			},
		],
		instances: [
			{
				id: 100,
				date: "2024-01-15",
				answer_count: 5,
			},
		],
	};

	test("parses aggregated votes response", () => {
		const response = PollVotesResponseSchema.parse(sampleVotesResponse);
		expect(response.total_results).toBe(15);
		expect(response.questions).toHaveLength(1);
		expect(response.instances).toHaveLength(1);
	});

	test("parses vote answers with string catergory_id", () => {
		const response = PollVotesResponseSchema.parse(sampleVotesResponse);
		const answers = response.questions[0]?.results[0]?.answers;
		expect(answers[0]?.catergory_id).toBe("uncategorized");
		expect(answers[0]?.votes).toBe(3);
	});

	test("parses vote answers with numeric catergory_id", () => {
		const response = PollVotesResponseSchema.parse(sampleVotesResponse);
		const answers = response.questions[0]?.results[0]?.answers;
		expect(answers[1]?.catergory_id).toBe(1);
	});

	test("parses optional users on answers", () => {
		const response = PollVotesResponseSchema.parse(sampleVotesResponse);
		const answers = response.questions[0]?.results[0]?.answers;
		expect(answers[0]?.users).toHaveLength(1);
		expect(answers[1]?.users).toBeUndefined();
	});

	test("accepts null date on results", () => {
		const modified = {
			...sampleVotesResponse,
			questions: [
				{
					...(sampleVotesResponse.questions[0] as (typeof sampleVotesResponse.questions)[number]),
					results: [
						{
							date: null,
							answers: [],
						},
					],
				},
			],
		};
		const response = PollVotesResponseSchema.parse(modified);
		expect(response.questions[0]?.results[0]?.date).toBeNull();
	});

	test("accepts null date on instances", () => {
		const modified = {
			...sampleVotesResponse,
			instances: [{ id: 100, date: null, answer_count: 0 }],
		};
		const response = PollVotesResponseSchema.parse(modified);
		expect(response.instances[0]?.date).toBeNull();
	});
});
