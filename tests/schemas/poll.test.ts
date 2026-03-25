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
		expect(poll.questions[0]!.text).toBe("How was your day?");
		expect(poll.questions[0]!.answer_choices).toEqual(["Great", "Good", "Okay"]);
		expect(poll.questions[0]!.add_own_options).toBe(true);
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
		expect(poll.users[0]!.username).toBe("jane");
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
		const answers = response.questions[0]!.results[0]!.answers;
		expect(answers[0]!.catergory_id).toBe("uncategorized");
		expect(answers[0]!.votes).toBe(3);
	});

	test("parses vote answers with numeric catergory_id", () => {
		const response = PollVotesResponseSchema.parse(sampleVotesResponse);
		const answers = response.questions[0]!.results[0]!.answers;
		expect(answers[1]!.catergory_id).toBe(1);
	});

	test("parses optional users on answers", () => {
		const response = PollVotesResponseSchema.parse(sampleVotesResponse);
		const answers = response.questions[0]!.results[0]!.answers;
		expect(answers[0]!.users).toHaveLength(1);
		expect(answers[1]!.users).toBeUndefined();
	});

	test("accepts null date on results", () => {
		const modified = {
			...sampleVotesResponse,
			questions: [
				{
					...sampleVotesResponse.questions[0]!,
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
		expect(response.questions[0]!.results[0]!.date).toBeNull();
	});

	test("accepts null date on instances", () => {
		const modified = {
			...sampleVotesResponse,
			instances: [{ id: 100, date: null, answer_count: 0 }],
		};
		const response = PollVotesResponseSchema.parse(modified);
		expect(response.instances[0]!.date).toBeNull();
	});
});
