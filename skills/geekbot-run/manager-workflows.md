# Manager Workflows

Detailed multi-step guides for manager operations. The SKILL.md provides
the overview; this document covers the full orchestration with edge cases.

## Table of Contents

1. [Standup Creation Wizard](#standup-creation-wizard)
2. [Poll Creation Flow](#poll-creation-flow)
3. [Analytics Playbook](#analytics-playbook)

---

## Standup Creation Wizard

The most complex manager operation. This wizard adapts to how much the user
already knows about what they want.

### Step 1: Assess intent specificity

**Vague request** ("set up a standup") → offer templates
**Moderate** ("create a daily standup for engineering") → use Daily Standup
template, confirm with user
**Specific** ("create a standup in #backend, Mon/Wed/Fri at 9am Athens
time, with these 3 questions...") → build directly from their spec

### Step 2: Template selection (when applicable)

Load `standup-templates.json`. Present 3-4 relevant options based
on the user's language:

| User says | Suggest |
|-----------|---------|
| "daily standup", "daily check-in" | Daily Standup, Quick Check-in |
| "retro", "retrospective", "sprint review" | Retrospective |
| "sales", "pipeline", "deals" | Sales Report |
| "check-in", "how's everyone doing" | Quick Check-in, Well-being Check-in |
| "1-on-1", "confidential", "private" | Confidential Check-in |
| "meeting notes", "meeting recap" | Meeting Notes |
| "ideas", "brainstorm" | I Have an Idea |
| "changelog", "releases" | Product Changelog |
| "incidents", "outages" | Incident Log |

Present each template with its name, questions, and default schedule.
Let the user pick one or say "I want something custom."

Example presentation format:
```
Here are some templates that might fit:

1. **Daily Standup** — Mon–Fri at 10:00
   Questions: What did you do? What will you do? Any blockers? How do you feel?

2. **Quick Check-in** — Mon–Fri at 09:00
   Questions: Main focus today? How are you feeling? Any blockers?

Which one works, or would you prefer something custom?
```

### Step 3: Gather required fields

For template-based creation, many fields have defaults. Only ask about
what's missing:

| Field | Template provides? | Action if missing |
|-------|-------------------|-------------------|
| Name | Yes (suggestive) | Let user customise or accept |
| Channel | No | Must ask — "Which Slack/Teams channel?" |
| Questions | Yes | Show them, let user add/remove/edit |
| Time | Yes (default) | Offer to change: "The default is 10:00 — does that work?" |
| Timezone | No | Infer from `geekbot me show` → `data.timezone`. Confirm. |
| Days | Yes (default) | Show the default, let user adjust |
| Users | No | Ask if they want to add members now or later |

For custom standups, gather all fields conversationally. Don't ask all
at once — lead with name + channel, then questions, then schedule.

### Step 4: Confirm and execute

Present the full configuration in a clear summary:

```
Standup: Sprint Retro
Channel: #engineering
Schedule: Fridays at 15:00 (Europe/Athens)
Questions:
  1. What went well?
  2. What could improve?
  3. What should we try next?

Ready to create?
```

On confirmation, build and execute the CLI command:

```bash
geekbot standup create \
  --name "Sprint Retro" \
  --channel "#engineering" \
  --time "15:00" \
  --timezone "Europe/Athens" \
  --days "Fri" \
  --questions '[{"text":"What went well?"},{"text":"What could improve?"},{"text":"What should we try next?"}]'
```

### Step 5: Post-creation

After success:
1. Confirm with the created standup's ID and details
2. If users weren't specified: "Want to add members now?"
   - If yes: run `geekbot team list` to show teams with members and their IDs.
     Let the user pick who to include, then:
     `geekbot standup update <id> --users "U123,U456"`
   - To find a specific person's ID: names appear alongside IDs in team list output
3. Mention: "You can trigger it immediately with `geekbot standup start <id>`"

### Edge cases

- **User doesn't know channel name**: Suggest they check Slack/Teams, or
  just type the channel name without # (the CLI handles both)
- **User wants to edit questions after creation**: Use `standup update`
  or `standup replace` depending on scope of changes
- **Questions with special characters**: Ensure JSON is properly escaped.
  Single quotes inside questions need escaping in the shell command.

---

## Poll Creation Flow

Simpler than standups because polls have fewer moving parts.

### Pre-check: Slack only

Polls require Slack. If you're unsure of the team's platform, try the
command — the CLI will return a descriptive platform error. Inform the
user and suggest using a standup with multiple-choice questions as an
alternative for Teams users.

### Gather fields

All four fields are required:

1. **Name** — what to call the poll
2. **Channel** — where to post it
3. **Question** — the poll question (single string)
4. **Choices** — JSON array of answer options

### Confirm and execute

```bash
geekbot poll create \
  --name "Team Lunch" \
  --channel "#general" \
  --question "Where should we eat?" \
  --choices '["Pizza", "Sushi", "Tacos"]'
```

### Viewing results

```bash
geekbot poll votes <id>
geekbot poll votes <id> --after "2026-03-01"    # filter by date range
```

Present results as a summary: total votes, per-choice breakdown, winner
(or tie). For polls with many responses over time, a bar chart helps.

---

## Analytics Playbook

Analytics in this skill are computed from report data fetched via the CLI.
The skill does the computation; the CLI provides raw data.

### Data Fetching Strategy

Always scope data fetches to be useful but not excessive:

- **Last week**: `--after <monday> --before <today>` — good for "this week"
- **Last month**: `--after <30 days ago>` with `--limit 200`
- **Trend analysis**: multiple fetches, bucketed by week or month
- **Always use `--standup-id`** to scope results. Without it, you get
  reports across all standups, which is rarely what the user wants.

### Common Analysis Patterns

#### 1. Response Rate

**Question the user asks:** "How engaged is my team?" / "What's our response rate?"

**Method:**
1. Fetch standup details: `geekbot standup get <id>` → get member count
2. Fetch reports for the period: `geekbot report list --standup-id <id> --after <start>`
3. Count the active days in the period — days that match the standup's `days`
   field. For a Mon–Fri standup over 30 calendar days, that's ~22 working
   days. Don't count weekends or days outside the schedule.
4. Count actual reports submitted
5. Response rate = reports submitted ÷ (members × active days)

**Resolving user IDs to names:** Report data uses user IDs (like `U08LXSA31BJ`).
To show human-readable names in analytics output, cross-reference with
`geekbot team list` which returns member names alongside IDs.

**Presentation:** Single percentage for the period, plus per-member breakdown
if the user wants details.

#### 2. Participation Gaps

**Question:** "Who hasn't posted?" / "Who's missing from standups?"

**Method:**
1. Fetch member list from `geekbot standup get <id>`
2. Fetch reports: `geekbot report list --standup-id <id> --after <start>`
3. Extract unique `user_id` from reports
4. Diff: members not in report submitters = gaps

**Presentation:** List the missing members by name. If some members are
partially missing (posted 2 of 5 days), note the frequency.

#### 3. Blocker Frequency

**Question:** "What are the common blockers?" / "Who's blocked most often?"

**Method:**
1. Fetch reports: `geekbot report list --standup-id <id> --after <start> --limit 100`
2. For each report, scan answers for blocker-related questions
   (identify by question text containing "block", "stuck", "help", "impediment")
3. Categorise: no blockers vs has blockers
4. Track per-user blocker frequency
5. Extract common themes from blocker text (group similar phrases)

**Presentation:** Narrative summary of most common blockers, who reports
them most, and whether they persist across reports.

#### 4. Trend Analysis

**Question:** "How has engagement changed?" / "Show me the trend"

**Method:**
1. Fetch reports over a longer period (2-3 months)
2. Bucket by week or month
3. Compute response rate per bucket
4. Show the trajectory: improving, stable, or declining

**Presentation:** Use a visualisation — a line chart or bar chart showing
response rate over time. Always include a narrative interpretation:
"Response rate improved from 62% to 85% over the last 6 weeks."

#### 5. Answer Quality / Length Trends

**Question:** "Are reports getting shorter?" / "Is engagement declining?"

**Method:**
1. Fetch reports over time
2. Track average answer length per report (character or word count)
3. Track per week/month

**Presentation:** This is a leading indicator — declining answer length
often predicts disengagement before response rates drop.

#### 6. Cross-Referencing with Connected MCP Servers

**Question:** "Is the team actually delivering?" / "How does standup reporting
correlate with actual output?"

This pattern is only available when MCP servers for source code or project
management tools are connected. It goes beyond "who posted" to "what was
actually shipped."

**Entities to combine:**

| From Geekbot (CLI) | From source code MCP (GitHub/GitLab) | From project mgmt MCP (Jira/Linear/Asana) |
|---------------------|--------------------------------------|-------------------------------------------|
| Standup reports per member | Merged PRs per member | Completed tickets per member |
| Reported accomplishments (text) | Commit count, lines changed | Ticket status transitions |
| Reported blockers | Stale PRs, review-requested PRs | Blocked/on-hold tickets |

**What to look for:**
- Do reported accomplishments match actual deliverables? ("Shipped feature X"
  should correlate with merged PRs or completed tickets)
- Are there team members who are delivering (merged PRs, closed tickets)
  but not posting standups? They may need a nudge on reporting.
- Are there stale tickets or PRs that keep appearing as "working on it"
  in reports? This signals genuine blockers worth escalating.
- Is some work not being tracked? If reports mention work that doesn't
  appear in any tool, the team may have a tracking gap.

**Matching members across tools:** Geekbot uses Slack-style user IDs while
GitHub/Jira use their own identifiers. Match by email address when available
(from `geekbot team list` and the external MCP server's user data). If the
mapping is ambiguous, show the manager what you found and ask them to confirm.
Cache the mapping for the conversation.

**Presentation:** Be careful with framing — this is not a surveillance tool.
Frame as "finding gaps between reported work and tracked work so the team
can improve communication," not "catching people who aren't working." Focus
on systemic patterns (e.g., "the team reports more work than shows up in
Jira — maybe some work isn't being tracked") rather than calling out
individuals.

### Tips for Analytics Conversations

- **Start with the question, not the data.** Ask what the user wants to
  understand, then fetch only the data needed.
- **Scope appropriately.** "Last 2 weeks" is more actionable than "all time."
- **Always offer to drill deeper.** After a summary, ask if they want
  per-member breakdowns or a longer time range.
- **Don't overstate precision.** If you're counting reports and dividing by
  expected count, say "approximately 78%" not "78.26%".
- **Check for connected MCP servers.** If GitHub, Jira, or other MCP servers
  are connected, mention that cross-referencing is available: "I can also
  pull delivery data from GitHub to give a fuller picture — want me to?"

---

## Team Member Summary

The most common manager question: "What has X been up to?" / "Prep me
for my 1-1 with X." This workflow resolves a person, fetches their recent
reports, and synthesizes a narrative summary.

### When to use

Trigger on: "what has X been up to", "X's reports", "1-1 prep for X",
"summarize X's work", "what did X report", "Jenny's recent standups",
"catch me up on X".

### Step 1: Resolve the person

```bash
geekbot team search <name>
```

This returns matching team members with their IDs. If multiple matches,
show them and ask which one. If exactly one, proceed.

### Step 2: Determine the time range

Map the user's language to a concrete date range:

| User says | Translate to |
|-----------|-------------|
| "lately", "recently" | Last 3 weeks |
| "this week" | Since Monday |
| "this month" | Since 1st of current month |
| "last 2 weeks" | 14 days ago |
| Explicit date | Use as-is |
| No time qualifier | Default to last 3 weeks |

### Step 2.5: Find their standups (optional but recommended)

```bash
geekbot standup list --member <id> --brief
```

This shows which standups the person participates in. Use this to pick
the right standup for report fetching (typically the "Daily" or "status"
standup). This avoids fetching reports across all standups which can
fail on certain API response shapes.

### Step 3: Fetch reports

```bash
geekbot report list --standup-id <sid> --user-id <id> --after <date> --limit 20
```

Use the standup ID from Step 2.5 (prefer the daily/status standup for
the most complete work picture).

If the result set is large (15+ reports), prioritize the most recent
and scan older ones for patterns rather than listing every detail.

### Step 4: Synthesize

Group the report answers into themes:

1. **Identify major work streams** — recurring project names, tasks, or
   initiatives that span multiple reports
2. **Track progress arcs** — things that started, progressed, and completed
3. **Note blockers and sentiment** — persistent blockers, mood patterns,
   health mentions (handle sensitively)
4. **Spot context switches** — if the person bounced between many unrelated
   tasks, note that as a possible discussion point

### Step 5: Present

Structure the output as:

1. **High-level summary** (2-3 sentences) — what they've been focused on
   and any notable accomplishments
2. **Work streams** — bullet points organized by theme, not chronologically.
   Each stream should show what happened and current status.
3. **Blockers / waiting on** — anything unresolved from recent reports
4. **Suggested 1-1 talking points** (if the user mentioned 1-1 prep):
   - Acknowledge completed milestones
   - Ask about persistent blockers or waiting items
   - Discuss workload balance if context-switching is high
   - Check in on wellbeing if sentiment patterns warrant it

### Presentation tips

- **Lead with themes, not dates.** "Jenny drove the software certification
  to completion" is more useful than a chronological list of daily reports.
- **Be sensitive with health/sentiment data.** If reports mention illness
  or pain, note it factually as context but don't frame it as a performance
  issue.
- **Keep it scannable.** The manager wants to walk into the 1-1 prepared,
  not read an essay. Aim for a summary that takes 30 seconds to read.
