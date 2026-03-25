# Geekbot API Documentation

Complete reference for the Geekbot public API (v1) and Template endpoints.

**Base URL:** `https://api.geekbot.com`

---

## Table of Contents

- [Authentication](#authentication)
- [Request & Response Format](#request--response-format)
- [Error Handling](#error-handling)
- [Common Data Structures](#common-data-structures)
- [Endpoints](#endpoints)
  - [User (Me)](#user-me)
  - [Teams](#teams)
  - [Standups](#standups)
  - [Reports](#reports)
  - [Polls](#polls)
  - [Standup Templates](#standup-templates)
  - [Poll Templates](#poll-templates)

---

## Authentication

All v1 API endpoints require authentication via an API token sent in the `Authorization` header.

```
Authorization: API_TOKEN
```

The API key can be obtained from your [Geekbot Dashboard](https://app.geekbot.com/dashboard/api-webhooks).

> **Note:** API key authentication is only accepted on `/v1/*` routes. Template endpoints (`/standups/templates`, `/polls/templates`, `/templates/recommended`) require session or JWT authentication.

**Unauthorized requests** return:

```
HTTP 401
{ "error": "Unauthorized" }
```

Deleted users are automatically rejected with the same 401 response.

---

## Request & Response Format

- **Content-Type:** `application/json` for all request bodies (POST, PATCH, PUT)
- **Response format:** JSON (`application/json`), pretty-printed with unescaped slashes
- **CORS headers:** `Access-Control-Allow-Origin: *`
- **Timestamps:** Unix timestamps (seconds since epoch) unless noted otherwise
- **Timezones:** IANA timezone strings (e.g., `"America/New_York"`, `"Europe/London"`)
- **Days of week:** Three-letter abbreviations: `"Mon"`, `"Tue"`, `"Wed"`, `"Thu"`, `"Fri"`, `"Sat"`, `"Sun"`
- **Trailing slashes:** Requests to `/v1/*` paths with trailing slashes are permanently redirected (301) to the path without the trailing slash

---

## Error Handling

Most errors return a JSON object with an `error` field:

```json
{ "error": "<error message>" }
```

> **Note:** Some endpoints return the error message as a raw JSON string (e.g., `"Template not found"`) rather than wrapped in an error object. These cases are noted in the individual endpoint documentation.

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 201  | Resource created |
| 301  | Permanent redirect (trailing slash removal on `/v1/*`) |
| 400  | Bad request — validation error or missing required parameters |
| 401  | Unauthorized — missing or invalid API token, or insufficient permissions |
| 403  | Forbidden — access denied (feature or team requirements not met) |
| 404  | Not found — resource does not exist or user lacks access |
| 422  | Unprocessable — request is valid but cannot be fulfilled (e.g., cannot duplicate a confidential standup) |
| 500  | Internal server error |

---

## Common Data Structures

### User Object

Returned inside standup, poll, and team responses. The exact fields vary by context.

**Full User Object** (used in standup `users`, poll `users`, team `users`):

```json
{
  "id": "U12345ABC",
  "role": "admin",
  "email": "jane@example.com",
  "username": "jane.doe",
  "realname": "Jane Doe",
  "profile_img": "https://avatars.example.com/jane_48.png"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique user identifier (Slack user ID for Slack teams) |
| `role` | string | One of `"admin"`, `"billing_admin"`, or `"member"` |
| `email` | string | User's email address |
| `username` | string | Display username |
| `realname` | string\|null | Full name |
| `profile_img` | string | Avatar URL. Size varies by context (48px in lists, 192px for detailed views) |

**Compact User Object** (used in report `member` from GET /v1/reports):

```json
{
  "id": "U12345ABC",
  "username": "jane.doe",
  "realname": "Jane Doe",
  "profileImg": "https://avatars.example.com/jane_192.png"
}
```

> **Note:** The report member object uses camelCase `profileImg` (not `profile_img`) and does not include `role` or `email`.

### Question Object (Standups)

Returned inside standup responses via `Question::jsonSerialize()`.

```json
{
  "id": 101,
  "color": "#FF5733",
  "text": "What did you work on yesterday?",
  "schedule": null,
  "answer_type": "text",
  "answer_choices": [],
  "hasAnswers": true,
  "is_random": false,
  "random_texts": [],
  "prefilled_by": null,
  "text_id": 42,
  "preconditions": [],
  "label": null,
  "flavor": ""
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number\|null | Unique question ID |
| `color` | string\|null | Hex color code associated with the question |
| `text` | string\|null | Question text |
| `schedule` | array\|null | Per-question schedule override |
| `answer_type` | string | Answer type: `"text"`, `"multiple_choice"`, etc. |
| `answer_choices` | array | Available choices for multiple-choice questions |
| `hasAnswers` | bool | Whether this question has any submitted answers |
| `is_random` | bool | Whether the question text is randomly selected |
| `random_texts` | array | Alternative question texts for random selection |
| `prefilled_by` | number\|null | ID of the source that pre-fills this answer |
| `text_id` | number\|null | Text identifier |
| `preconditions` | array | Array of precondition objects (`target_question_id`, `target_value`) |
| `label` | string\|null | Display label |
| `flavor` | string | Question flavor/variant (empty string if unset) |

### Question Object (Polls)

Returned inside poll responses. Extends the standup Question with additional fields via `PollQuestion::jsonSerialize()`.

**In the v1 poll response** (`getResponseDataV1`), poll questions are returned in a simplified format:

```json
{
  "id": 201,
  "text": "How would you rate team collaboration?",
  "answer_type": "multiple_choice",
  "answer_choices": ["Excellent", "Good", "Needs improvement"],
  "add_own_options": false,
  "one_option_limit": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique question ID |
| `text` | string | Question text |
| `answer_type` | string | Answer type: `"multiple_choice"`, `"open_ended"`, `"agree_disagree"`, `"yes_no"`, `"1_5"`, `"0_10"`, `"emoji"` |
| `answer_choices` | array | Available answer choices |
| `add_own_options` | bool | Whether respondents can add their own options |
| `one_option_limit` | bool | Whether only one answer can be selected |

**Full PollQuestion serialization** (used in non-v1 contexts) includes all base Question fields plus:

| Field | Type | Description |
|-------|------|-------------|
| `add_own_options` | bool | Whether respondents can add their own options |
| `one_option_limit` | bool | Whether only one answer can be selected |
| `answer_template` | string\|null | Preset answer template (e.g., `"agree_disagree"`, `"yes_no"`) |

### Webhook Object

```json
{
  "id": 42,
  "url": "https://example.com/webhook",
  "standup_id": 123
}
```

---

## Endpoints

---

## User (Me)

### GET /v1/me

Returns the authenticated user's profile and team information.

**Parameters:** None

**Response (200):**

```json
{
  "user": {
    "id": "U12345ABC",
    "username": "jane.doe",
    "realname": "Jane Doe",
    "firstname": "Jane",
    "email": "jane@example.com",
    "profile_img": "https://avatars.example.com/jane_192.png",
    "timezone": "America/New_York",
    "is_admin": true,
    "is_billing_admin": false,
    "role": "admin"
  },
  "team": {
    "id": 456,
    "name": "Acme Corp"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `user.id` | string | Unique user ID |
| `user.username` | string | Username |
| `user.realname` | string | Full name |
| `user.firstname` | string | First name |
| `user.email` | string | Email address |
| `user.profile_img` | string | Profile image URL (192px) |
| `user.timezone` | string | IANA timezone |
| `user.is_admin` | bool | Whether the user is a team admin |
| `user.is_billing_admin` | bool | Whether the user is the billing admin |
| `user.role` | string | Role label: `"admin"`, `"billing_admin"`, or `"member"` |
| `team.id` | number | Team ID |
| `team.name` | string | Team name |

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 404 | `"User not found"` | User no longer exists in the system |

---

### GET /v1/me/teams

Returns all teams the authenticated user belongs to.

**Parameters:** None

**Response (200):**

```json
{
  "teams": [
    {
      "id": 456,
      "name": "Acme Corp",
      "is_admin": true,
      "standup_count": 5
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Team ID |
| `name` | string | Team name |
| `is_admin` | bool | Whether the user is an admin of this team |
| `standup_count` | number | Number of standups in the team |

---

### GET /v1/me/standups

Returns all standups the authenticated user participates in. Identical to `GET /v1/standups`.

---

## Teams

### GET /v1/teams

Returns the authenticated user's team information, including all members visible across the user's standups.

**Parameters:** None

**Response (200):**

```json
{
  "id": 456,
  "name": "Acme Corp",
  "users": [
    {
      "id": "U12345ABC",
      "role": "admin",
      "email": "jane@example.com",
      "username": "jane.doe",
      "realname": "Jane Doe",
      "profile_img": "https://avatars.example.com/jane_48.png"
    }
  ]
}
```

---

## Standups

### Standup Object

The full standup object returned by all standup endpoints (via `getResponseDataV1()`):

```json
{
  "id": 123,
  "name": "Daily Standup",
  "time": "10:00:00",
  "wait_time": 600,
  "timezone": "America/New_York",
  "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "channel": "#general",
  "channel_ready": true,
  "questions": [ /* Question objects */ ],
  "users": [ /* User objects */ ],
  "users_total": 8,
  "webhooks": [ /* Webhook objects */ ],
  "master": "U12345ABC",
  "sync_channel_members": false,
  "sync_channel_ready": false,
  "sync_channel": null,
  "confidential": false,
  "anonymous": false,
  "draft": false,
  "paused": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique standup ID |
| `name` | string | Standup name |
| `time` | string | Time the standup starts (`HH:MM:SS`) |
| `wait_time` | number | **Seconds** to wait after user comes online before asking. The input when creating/updating is in **minutes** and is converted to seconds (e.g., input `10` returns `600`). `-1` = ask at exact meeting time even if offline |
| `timezone` | string | IANA timezone for the standup time |
| `days` | string[] | Days when the standup is active |
| `channel` | string | Channel where standup updates are posted |
| `channel_ready` | bool | Whether the bot has joined the channel |
| `questions` | Question[] | Standup questions (see [Question Object](#question-object-standups)) |
| `users` | User[] | Participating users (see [User Object](#user-object)) |
| `users_total` | number | Total number of participants |
| `webhooks` | Webhook[] | Configured webhooks |
| `master` | string | User ID of the standup creator |
| `sync_channel_members` | bool | Whether participants are synced from a channel |
| `sync_channel_ready` | bool | Whether the sync channel is accessible |
| `sync_channel` | string\|null | Channel used for member syncing |
| `confidential` | bool | Whether reports are only visible to the creator |
| `anonymous` | bool | Whether reports are posted anonymously |
| `draft` | bool | Whether the standup is in draft state |
| `paused` | bool | Whether the standup is paused |

---

### GET /v1/standups

Returns standups the authenticated user participates in.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `admin` | bool | No | If `true` and the user is an admin, returns all team standups |

**Response (200):** Array of [Standup objects](#standup-object).

---

### GET /v1/standups/{standupId}

Returns a single standup by ID.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `standupId` | number | Yes | Standup unique ID |

**Response (200):** Single [Standup object](#standup-object).

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 404 | `"Standup not found"` | Standup does not exist, belongs to another team, user is not a member and not the creator, or standup is confidential/draft and user is not the creator |

---

### POST /v1/standups

Creates a new standup.

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Standup name |
| `channel` | string | Yes | Channel name or ID (e.g., `"#general"`) |
| `time` | string | Yes | Start time in `HH:MM:SS` format (24-hour) |
| `timezone` | string | No | IANA timezone (defaults to user's timezone) |
| `wait_time` | number\|null | No | Minutes to wait after user login before asking. `null` is converted to `-1` internally |
| `days` | string[] | Yes | Days to run the standup |
| `questions` | object[] | Yes | Array of `{ "question": "..." }` objects |
| `users` | number[] | Conditional | User IDs to include. Required if `sync_channel_members` is `false` |
| `sync_channel_members` | bool | No | Sync participants from the channel |
| `personalised` | bool | No | Allow users to set their own personal schedule |

**Example:**

```json
{
  "name": "Daily Standup",
  "channel": "#engineering",
  "time": "09:30:00",
  "timezone": "Europe/London",
  "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "questions": [
    { "question": "What did you work on yesterday?" },
    { "question": "What will you work on today?" },
    { "question": "Any blockers?" }
  ],
  "users": [10, 11, 12]
}
```

**Response (200):** Created [Standup object](#standup-object).

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 400 | `"You should send an array with users to add to the standup or use the sync channel members option"` | `sync_channel_members` is false and `users` is missing |
| 400 | `"time amd days must be set"` | `time` or `days` is missing |
| 400 | `"Please define questions"` | `questions` is not provided |
| 400 | `"Could not find members in channel{channelName}"` | `sync_channel_members` is true but the channel is empty or inaccessible (note: no space before channel name) |
| 400 | `"Time should be in format xx:xx:xx (24 hours format)"` | Invalid time format |
| 400 | `'"questions" must be an array of objects having a "question" property'` | Questions format is invalid |
| 400 | `'Each question must have a "question" property'` | A question object is missing the `question` field |

---

### PATCH /v1/standups/{standupId}

Partially updates a standup. Only the provided fields are updated.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `standupId` | number | Yes | Standup unique ID |

**Request Body:** Same fields as [POST /v1/standups](#post-v1standups), but all fields are **optional**.

**Response (200):** Updated [Standup object](#standup-object).

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 400 | `"You tried to set participants manually but "users" param is missing"` | `sync_channel_members` is false but `users` not provided |
| 400 | `"Could not found members in channel{channelName}"` | Sync channel is empty (note: typo "found" is in the actual code) |
| 401 | `"Unauthorized"` | User does not have `edit` access on the standup |
| 404 | `"Standup not found"` | Standup does not exist or belongs to another team |

---

### PUT /v1/standups/{standupId}

Fully replaces a standup. All fields are required.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `standupId` | number | Yes | Standup unique ID |

**Request Body:** Same fields as [POST /v1/standups](#post-v1standups) — all required.

**Response (200):** Replaced [Standup object](#standup-object).

**Errors:** Same as [PATCH /v1/standups/{standupId}](#patch-v1standupsstanupid).

---

### DELETE /v1/standups/{standupId}

Deletes a standup.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `standupId` | number | Yes | Standup unique ID |

**Response (200):** The deleted [Standup object](#standup-object).

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 401 | `"Unauthorized"` | User does not have `edit` access on the standup |
| 404 | `"Not found"` | Standup does not exist |

---

### POST /v1/standups/{standupId}/duplicate

Duplicates an existing standup. Fields not provided in the request body are inherited from the original.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `standupId` | number | Yes | ID of the standup to duplicate |

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name for the new standup |
| `channel` | string | No | Overrides original channel |
| `time` | string | No | Overrides original time |
| `timezone` | string | No | Overrides original timezone |
| `wait_time` | number | No | Overrides original wait time |
| `days` | string[] | No | Overrides original days |
| `questions` | object[] | No | Overrides original questions |
| `users` | number[] | No | Overrides original users |
| `sync_channel_members` | bool | No | Overrides original sync setting |
| `personalised` | bool | No | Overrides original personalised setting |

**Response (200):** The newly created [Standup object](#standup-object).

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 400 | `"You should send a name as body parameter in order to create a new standup"` | `name` is missing |
| 400 | `"You should send an array with users to add to the standup or use the sync channel members option"` | Sync channel members is false but users array missing |
| 400 | `"Could not find members in channel{channelName}"` | Sync channel is empty |
| 401 | `"Unauthorized"` | User does not have `edit` access |
| 404 | `"Not found"` | Original standup does not exist |
| 404 | `"Standup not found"` | The standup is actually a poll |
| 422 | `"Unprocessable"` | Standup is dynamic or confidential and cannot be duplicated |

---

### POST /v1/standups/{standupId}/start

Triggers a standup immediately for specific users or all members.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `standupId` | number | Yes | Standup unique ID |

**Request Body (optional — omit to start for all members):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `users` | number[] | No | Array of user IDs to start the standup for |
| `emails` | string[] | No | Array of email addresses to start the standup for |

Provide either `users` or `emails`, not both. If neither is provided, the standup starts for all members.

> **Note:** Email-based lookup excludes remote alias users.

**Response (200):**

```json
"ok"
```

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 404 | `"User is not member of the standup"` | A specified user is not a participant |
| 404 | `"Standup not found"` | Standup does not exist |

---

## Reports

Reports have two different response formats depending on the endpoint:
- **GET /v1/reports** uses the Timeline format
- **POST /v1/reports** uses the Report format

### Report Object (GET — Timeline Format)

```json
{
  "id": 789,
  "slack_ts": 1678901234,
  "standup_id": 123,
  "timestamp": 1678901234,
  "channel": "#general",
  "is_anonymous": false,
  "broadcast_thread": false,
  "is_confidential": false,
  "member": {
    "id": "U12345ABC",
    "username": "jane.doe",
    "realname": "Jane Doe",
    "profileImg": "https://avatars.example.com/jane_192.png"
  },
  "questions": [
    {
      "id": 1001,
      "question": "What did you work on yesterday?",
      "question_id": 101,
      "color": "#FF5733",
      "answer": "Finished the API documentation",
      "images": [
        { "title": "screenshot", "image_url": "https://..." }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique report ID |
| `slack_ts` | number | Slack timestamp |
| `standup_id` | number | ID of the standup this report belongs to |
| `timestamp` | number | Unix timestamp (same as `slack_ts`) |
| `channel` | string | Channel the report was posted to |
| `is_anonymous` | bool | Whether the standup is anonymous |
| `broadcast_thread` | bool | Whether the standup uses broadcast threads |
| `is_confidential` | bool | Whether the standup is confidential |
| `member` | object | The user who submitted the report (see note below) |
| `member.id` | string | User ID |
| `member.username` | string | Username |
| `member.realname` | string\|null | Full name |
| `member.profileImg` | string | Profile image URL (camelCase) |
| `questions` | array | Array of answered questions |
| `questions[].id` | number | Answer ID |
| `questions[].question` | string | Question text |
| `questions[].question_id` | number | Question ID |
| `questions[].color` | string | Color associated with the question |
| `questions[].answer` | string\|null | Answer text (may be HTML if `html` param is set) |
| `questions[].images` | array | Images attached to the answer (`{ title, image_url }`) |

> **Note:** For anonymous standups, the `member` field is omitted from the response.

### Report Object (POST — Report Format)

```json
{
  "id": 789,
  "slack_ts": "1678901234.000100",
  "standup_id": 123,
  "timestamp": 1678901200,
  "started_at": 1678901200,
  "done_at": 1678901234,
  "broadcasted_at": "1678901234.000100",
  "channel": "#general",
  "member": {
    "id": "U12345ABC",
    "role": "admin",
    "username": "jane.doe",
    "realname": "Jane Doe",
    "profileImg": "https://avatars.example.com/jane_192.png"
  },
  "answers": [
    {
      "id": 1001,
      "answer": "Finished the API documentation",
      "question": "What did you work on yesterday?",
      "question_id": 101,
      "color": "#FF5733",
      "images": []
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique report ID |
| `slack_ts` | string\|null | Slack message timestamp |
| `standup_id` | number | ID of the standup |
| `timestamp` | number\|null | Unix timestamp when the report started |
| `started_at` | number\|null | Unix timestamp when the user started answering |
| `done_at` | number\|null | Unix timestamp when the user finished answering |
| `broadcasted_at` | string\|null | Slack timestamp of the broadcast message |
| `channel` | string | Channel the report was posted to |
| `member` | object | The user who submitted the report (includes `role`) |
| `answers` | array | Array of answer objects |
| `answers[].id` | number | Unique answer ID |
| `answers[].answer` | string | Answer text |
| `answers[].question` | string | The question that was answered |
| `answers[].question_id` | number | Question ID |
| `answers[].color` | string | Color associated with the question |
| `answers[].images` | array | Images attached to the answer |

> **Note:** The POST response always includes the `member` field, even for anonymous standups.

---

### GET /v1/reports

Returns standup reports, filtered by the provided parameters.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `standup_id` | number | No | — | Filter by standup ID |
| `user_id` | number | No | — | Filter by a single user ID |
| `user_ids` | number[] | No | — | Filter by multiple user IDs |
| `before` | number | No | — | Only reports before this Unix timestamp |
| `after` | number | No | — | Only reports after this Unix timestamp |
| `question_ids` | string | No | — | Comma-separated question IDs to filter answers |
| `html` | bool | No | false | Return answers with HTML formatting |
| `limit` | number | No | 30 | Number of reports to return (max: 100) |

**Response (200):** Array of [Report objects (Timeline format)](#report-object-get--timeline-format).

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 400 | `"since expects a timestamp"` | `before` is not a valid timestamp |
| 400 | `"after expects a timestamp"` | `after` is not a valid timestamp |

---

### POST /v1/reports

Submits a new report for a standup. All questions must be answered at once.

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `standup_id` | number | Yes | ID of the standup to report on |
| `answers` | object | Yes | Object keyed by question ID, each value containing a `text` field |

**Example:**

```json
{
  "standup_id": 123,
  "answers": {
    "101": { "text": "Finished the API docs" },
    "102": { "text": "Working on tests today" },
    "103": { "text": "No blockers" }
  }
}
```

Each answer object supports:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | The answer text |
| `_timestamp` | number | No | Custom Unix timestamp for this answer |

**Response (200):** Created [Report object (Report format)](#report-object-post--report-format).

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 400 | `"Required parameter "standup_id" not specified."` | Missing `standup_id` |
| 400 | `"Required parameter "answers" not specified."` | Missing `answers` |
| 400 | `"Parameter "answers" must be an array."` | `answers` is not an object |
| 400 | `"There should be as many answers as standup questions. All questions must be answered at once."` | Number of answers doesn't match number of questions |
| 400 | `"No such question "{questionId}". The keys of "answers" object should be valid questions for standup "{standupId}"."` | Invalid question ID |
| 400 | `"Answer for question "{questionId}" is missing "text" attribute."` | Answer object lacks `text` |

---

## Polls

> **Note:** Poll endpoints are only available for **Slack** platform teams. Non-Slack teams receive a 404 response: `"Not available on this platform"`.

### Poll Object

The full poll object returned by poll endpoints (via `getResponseDataV1()`):

```json
{
  "id": 500,
  "name": "Team Satisfaction Survey",
  "time": "14:00:00",
  "timezone": "America/New_York",
  "questions": [
    {
      "id": 201,
      "text": "How satisfied are you with team communication?",
      "answer_type": "multiple_choice",
      "answer_choices": ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied"],
      "add_own_options": false,
      "one_option_limit": true
    }
  ],
  "users": [ /* User objects */ ],
  "recurrence": {
    "type": "once",
    "repeat": null,
    "every": null,
    "day": null,
    "month": null
  },
  "sync_channel_members": true,
  "sync_channel": "#general",
  "dm_mode": false,
  "anonymous": false,
  "intro": "Please take a moment to answer this poll",
  "creator": { /* User object */ },
  "users_total": 12,
  "paused": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique poll ID |
| `name` | string | Poll name |
| `time` | string | Scheduled time (`HH:MM:SS`) |
| `timezone` | string | IANA timezone |
| `questions` | Question[] | Poll questions (see [Poll Question Object](#question-object-polls)) |
| `users` | User[] | Poll participants |
| `recurrence` | object\|null | Recurrence configuration |
| `recurrence.type` | string | Recurrence type (e.g., `"once"`, `"weekly"`, `"monthly"`) |
| `recurrence.repeat` | number\|null | Repeat count |
| `recurrence.every` | string\|null | Repeat interval |
| `recurrence.day` | string\|null | Day of recurrence |
| `recurrence.month` | string\|null | Month of recurrence |
| `sync_channel_members` | bool | Whether participants are synced from a channel |
| `sync_channel` | string\|null | Channel for member syncing |
| `dm_mode` | bool | Whether the poll runs in DM mode (true when no broadcast channel is set) |
| `anonymous` | bool | Whether votes are anonymous |
| `intro` | string | Introduction message shown before the poll |
| `creator` | User | The user who created the poll |
| `users_total` | number | Total number of participants |
| `paused` | bool | Whether the poll is paused |

---

### GET /v1/polls

Returns polls the authenticated user participates in.

**Parameters:** None

**Response (200):** Array of [Poll objects](#poll-object).

---

### GET /v1/polls/{pollId}

Returns a single poll. The authenticated user must be both a member of the poll and its creator.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pollId` | number | Yes | Poll unique ID |

**Response (200):** Single [Poll object](#poll-object).

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 404 | `"Poll not found"` | Poll does not exist, is deleted, or user is not a member/creator |

---

### POST /v1/polls

Creates a new poll.

**Request Body:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes | — | Poll name |
| `channel` | string | Yes | — | Channel where the poll is posted |
| `question` | string | Yes | — | The poll question |
| `choices` | string[] | Yes | — | Answer choices (minimum 2) |
| `duration` | number | No | 120 | Poll duration in minutes |

**Example:**

```json
{
  "name": "Lunch Preference",
  "channel": "#general",
  "question": "Where should we go for team lunch?",
  "choices": ["Italian", "Japanese", "Mexican", "Indian"],
  "duration": 60
}
```

**Response (200):** Created [Poll object](#poll-object).

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 400 | `"Name is required"` | Missing `name` |
| 400 | `"Question is required"` | Missing `question` |
| 400 | `"At least 2 choices are required"` | Fewer than 2 choices provided |
| 400 | `"Channel is required"` | Missing `channel` |

---

### GET /v1/polls/{pollId}/votes

Returns voting results for a poll, optionally filtered by date range.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pollId` | number | Yes | Poll unique ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | No | Start date (any format parseable by `strtotime`, e.g., `"2025-01-01"`) |
| `to` | string | No | End date |

**Response (200):**

```json
{
  "total_results": 15,
  "questions": [
    {
      "id": 201,
      "text": "Where should we go for team lunch?",
      "answer_type": "multiple_choice",
      "categories": [],
      "total_responses": 45,
      "total_responders": 12,
      "results": [
        {
          "date": "2025-04-15",
          "answers": [
            {
              "text": "Italian",
              "catergory_id": "uncategorized",
              "votes": 5,
              "percentage": 33,
              "users": [ /* User objects */ ]
            },
            {
              "text": "Japanese",
              "catergory_id": "uncategorized",
              "votes": 4,
              "percentage": 27,
              "users": [ /* User objects */ ]
            }
          ]
        }
      ]
    }
  ],
  "instances": [
    {
      "id": 1,
      "date": "2025-04-15",
      "answer_count": 9
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `total_results` | number | Total number of voting sessions (instances) |
| `questions` | array | Results grouped by question |
| `questions[].id` | number | Question ID |
| `questions[].text` | string | Question text |
| `questions[].answer_type` | string | Answer type (e.g., `"multiple_choice"`, `"open_ended"`) |
| `questions[].categories` | array | Answer categories |
| `questions[].total_responses` | number | Total number of individual responses |
| `questions[].total_responders` | number | Total number of unique responders |
| `questions[].results` | array | Results grouped by date |
| `results[].date` | string\|null | Date of the voting session |
| `results[].answers` | array | Answers with vote counts |
| `answers[].text` | string | Answer choice text |
| `answers[].catergory_id` | string | Category ID (note: the typo `catergory_id` is in the actual API response) |
| `answers[].votes` | number | Number of votes |
| `answers[].percentage` | number | Percentage of total votes, rounded to whole number (0 decimal places) |
| `answers[].users` | User[] | Users who voted for this option (omitted if poll is anonymous) |
| `instances` | array | List of voting sessions |
| `instances[].id` | number | Instance ID |
| `instances[].date` | string\|null | Instance date |
| `instances[].answer_count` | number | Number of answers in this instance |

**Errors:**

| Code | Message | Condition |
|------|---------|-----------|
| 400 | `"Invalid date"` | `from` or `to` is not a valid date |
| 404 | `"Poll not found"` | Poll does not exist or user lacks access |

---

## Standup Templates

Template endpoints allow you to browse pre-built standup configurations.

> **Note:** Template endpoints require session or JWT authentication. API key authentication is **not** supported for these routes.

### Template Object (Standup)

```json
{
  "id": 1,
  "name": "Daily Standup",
  "kind": "daily_standup",
  "is_v2": false,
  "descriptions_json": [
    { "title": "Overview", "text": "A classic daily standup..." }
  ],
  "description": "Keep your team aligned with a daily check-in",
  "images_json": ["https://geekbot.com/images/template1.png"],
  "image_url": "https://geekbot.com/images/template1_hero.png",
  "category": "standup",
  "tags": ["agile", "daily"],
  "order": 100,
  "is_new": "2025-06-01",
  "is_featured": 1,
  "trigger": "schedule",
  "related": [2, 5],
  "is_poll": false,
  "intro": "Good morning! Time for your standup.",
  "videoUrl": "https://youtube.com/...",
  "usage": ["engineering", "product"],
  "questions": [
    {
      "id": 101,
      "text": "What did you do yesterday?",
      "text_id": 42,
      "color": "#FF5733"
    }
  ],
  "time": "10:00",
  "is_synced": false,
  "is_anonymous": false,
  "is_confidential": false,
  "schedule": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "outro": "Have a great day!"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Template unique ID |
| `name` | string | Template display name |
| `kind` | string | Template kind identifier (e.g., `"daily_standup"`, `"team_feedback"`) |
| `is_v2` | bool | Whether this is a v2-compatible template |
| `descriptions_json` | array | Array of description blocks with `title` and `text` |
| `description` | string | Short description |
| `images_json` | array | Array of image URLs |
| `image_url` | string | Hero/illustration image URL |
| `category` | string | Template category |
| `tags` | array | Tags for filtering/search |
| `order` | number\|null | Display sort order |
| `is_new` | string | Date until which the template is flagged as "new" |
| `is_featured` | number | Whether the template is featured (0 or 1) |
| `trigger` | string | Trigger type: `"schedule"` or `"calendar"` |
| `related` | array | IDs of related templates |
| `is_poll` | bool | Always `false` for standup templates |
| `intro` | string | Introduction message |
| `videoUrl` | string | Video URL (extracted from settings) |
| `usage` | array | Usage tags (extracted from settings) |
| `questions` | Question[] | Pre-configured questions (standup Question objects) |
| `time` | string | Default trigger time |
| `is_synced` | bool | Default sync setting |
| `is_anonymous` | bool | Default anonymous setting |
| `is_confidential` | bool | Default confidential setting |
| `schedule` | string[] | Default days of week |
| `outro` | string | Outro message |

When returned from the **list endpoint**, each template also includes a `filters` field:

| Field | Type | Description |
|-------|------|-------------|
| `filters` | array | Array of filter objects associated with this template |

### Template Object (Poll)

Poll templates share the same base fields but have a different structure for `questions` and `settings`:

```json
{
  "id": 50,
  "name": "Team Satisfaction",
  "kind": "satisfaction",
  "is_v2": false,
  "descriptions_json": [...],
  "description": "Gauge team satisfaction",
  "images_json": [...],
  "image_url": "...",
  "category": "engagement",
  "tags": ["hr", "feedback"],
  "order": 50,
  "is_new": "2025-06-01",
  "is_featured": 0,
  "trigger": "schedule",
  "related": [],
  "is_poll": true,
  "intro": "Quick survey time!",
  "videoUrl": null,
  "usage": [],
  "questions": [ /* Poll-specific question config from settings */ ],
  "settings": { /* Poll-specific settings (questions removed) */ }
}
```

> **Note:** For poll templates, `questions` and `settings` are sourced from the template's `settings` JSON field. The standup-specific fields (`time`, `schedule`, `outro`, `is_synced`, `is_anonymous`, `is_confidential`) are **not** included.

---

### GET /standups/templates

Returns all available standup templates for the authenticated user's team.

Templates are filtered by team features (e.g., v2 integrations, confidential standups, calendar triggers) and platform (Slack vs MS Teams). Only templates with `images_json IS NOT NULL` and `order > 0` are included.

**Parameters:** None

**Response (200):** Array of [Standup Template objects](#template-object-standup), each including a `filters` field.

---

### GET /standups/templates/{templateId}

Returns a single standup template.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateId` | number | Yes | Template unique ID |

**Response (200):** Single [Standup Template object](#template-object-standup).

**Errors:**

| Code | Response | Condition |
|------|----------|-----------|
| 404 | `"Template not found"` | Template does not exist. **Note:** returned as a raw JSON string, not wrapped in an error object |

---

### GET /standups/templates/filters

Returns available filter options for browsing standup templates.

**Parameters:** None

**Response (200):**

```json
{
  "templatesCount": 25,
  "filters": {
    "categories": [
      { "id": 1, "name": "Agile", "filter_type": "category", "count": 8 }
    ],
    "roles": [
      { "id": 5, "name": "Engineering", "filter_type": "role", "count": 12 }
    ],
    "workflows": [
      { "id": 10, "name": "Daily Check-in", "filter_type": "workflow", "count": 6 }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `templatesCount` | number | Total number of templates available to the team |
| `filters.categories` | array | Filter options by category |
| `filters.roles` | array | Filter options by role |
| `filters.workflows` | array | Filter options by workflow |

Each filter object:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Filter ID |
| `name` | string | Filter display name |
| `filter_type` | string | Filter type: `"category"`, `"role"`, or `"workflow"` |
| `count` | number | Number of templates matching this filter |

---

### GET /polls/templates

Returns all available poll templates. Same behavior and response structure as `GET /standups/templates` but filtered with `is_poll = true`.

**Response (200):** Array of [Poll Template objects](#template-object-poll).

---

### GET /polls/templates/{templateId}

Returns a single poll template.

**Response (200):** Single [Poll Template object](#template-object-poll).

**Errors:**

| Code | Response | Condition |
|------|----------|-----------|
| 404 | `"Template not found"` | Template does not exist. **Note:** returned as a raw JSON string |

---

### GET /polls/templates/filters

Returns available filter options for browsing poll templates. Same structure as `GET /standups/templates/filters`.

---

## Feature-Gated Availability

Certain templates and capabilities are only available to teams with specific features enabled:

| Feature | Effect |
|---------|--------|
| `v2-standup-integrations` | Required for `is_v2` templates |
| `Team Feedback template` | Required for `kind: "team_feedback"` templates |
| `confidential-standups` | Required for confidential templates; hides `monthly_1-on-1` template when active |
| `calendar-triggers` | Required for `trigger: "calendar"` templates |
| `V2 Standups` | Required for `POST /v1/events` |

Templates that require unavailable features are automatically excluded from list and recommendation responses.
