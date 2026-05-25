# Reporter Workflows

Detailed guide for the AI-assisted reporting experience. The SKILL.md
covers the 5-step pipeline at a high level; this document covers the
full flow including tone calibration, blocker carry-over, and edge cases.

## Table of Contents

1. [Report Drafting Pipeline (detailed)](#report-drafting-pipeline)
2. [Tone Calibration](#tone-calibration)
3. [Blocker Carry-Over Logic](#blocker-carry-over-logic)
4. [Edge Cases](#edge-cases)

---

## Report Drafting Pipeline

### Step 1: Identify the standup

Run `geekbot standup list` to get the user's standups.

- **Single standup**: Use it automatically. Mention which one: "I see you're
  in the 'Daily Standup' — let's draft your report for that."
- **Multiple standups**: Present a short list (ID, name, channel) and ask
  which one. If the user's request hints at one ("my daily"), match on name.
- **No standups**: The user might not be a participant in any standup.
  Suggest they check with their manager.

### Step 2: Fetch questions

```bash
geekbot standup get <standup_id>
```

Extract from the response:
- `questions[].id` — you need these for the report submission
- `questions[].text` — show these to the user and use as draft structure

Store the question ID ↔ text mapping for use in step 5.

### Step 3: Gather context

Context comes from three sources. Check them in this order — each one makes
the draft richer.

#### Source A: Connected MCP servers (opportunistic enrichment)

Check what MCP servers are available in the current session. Use whatever
is connected to pull the user's recent activity. This is what transforms
"help me write my standup" from a Q&A session into a one-click draft.

The key concept: map MCP entities to standup questions — what they *did*,
what they *will do*, and what's *blocking* them.

| Source | Entity | Maps to |
|--------|--------|---------|
| GitHub/GitLab | Merged PRs, closed issues, review comments | "What did you do?" |
| GitHub/GitLab | Open/draft PRs (authored) | "What will you do?" |
| GitHub/GitLab | PRs with changes requested | "Blockers?" |
| Jira/Linear/Asana | Tickets moved to Done | "What did you do?" |
| Jira/Linear/Asana | In Progress tickets | "What will you do?" |
| Jira/Linear/Asana | Blocked/On Hold tickets | "Blockers?" |
| Calendar | Meetings attended since last report | "What did you do?" |
| Calendar | Upcoming meetings today | "What will you do?" |
| Slack | Threads participated in, announcements | Any question |

Filter calendar noise: skip the standup itself, recurring 1:1s, and
all-day events unless meaningful (offsites, deadlines).

**Deduplication:** Group related entities across tools — "Merged PR #342,
closes PROJ-89" is better than listing each separately.

**Identity matching:** MCP servers use different identifiers (Slack IDs,
GitHub usernames, emails). If they don't match, ask the user once and
reuse for the conversation.

**Enrichment flow:**
1. Silently check which MCP servers are connected
2. Pull recent activity from each (since last report date)
3. Deduplicate across tools, group by standup question
4. Present: "I pulled your recent activity — here's what I found"

If no MCP servers are connected, skip silently. Don't mention missing
access unprompted — explain only if the user asks why the draft isn't
auto-populated.

#### Source B: Previous Geekbot reports (always available)

```bash
geekbot report list --standup-id <id> --user-id <uid> --limit 5
```

Where `<uid>` comes from `geekbot me show` → `data.id`. Extract: typical
answer length, writing style (bullets vs prose), recurring themes, and
any unresolved blockers for carry-over.

#### Source C: The user's direct input

**With MCP context:** Show what you found, ask "Anything to add, correct,
or remove?" — the user validates instead of recalling from scratch.

**Without MCP:** This is the primary source. Let the user dump context
freely ("What have you been working on?") — you structure it into answers.

#### Combining sources

Merge priority: user corrections > MCP specifics (PR numbers, ticket IDs) >
previous reports (style/tone) > user narrative input (the "why").

### Step 4: Draft answers

For each question in the standup, draft an answer that:

1. **Addresses the question directly** — don't go off-topic
2. **Matches the user's historical style** (see Tone Calibration below)
3. **Leads with specifics from MCP data** — PR numbers, ticket IDs,
   meeting names add credibility and save the user from remembering details
4. **Incorporates their direct input** — the user's words provide narrative
   and context that tools can't capture
5. **Includes blocker carry-over** — surface unresolved blockers from
   previous reports (see Blocker Carry-Over below)

**Example with enrichment:**
```
Q: What have you done since yesterday?
A: Merged PR #342 (auth module refactor), closed PROJ-89 (payment webhook
   bug). Had a sync with the API team about token rotation strategy.

Q: What will you do today?
A: Starting on the new billing API (PROJ-102). PR #345 is waiting for
   review from @alice.

Q: Any blockers?
A: Still waiting on the staging deploy from DevOps (carrying over from
   Tuesday). Also blocked on PROJ-98 — needs design sign-off.
```

vs. **without enrichment (user input only):**
```
Q: What have you done since yesterday?
A: Fixed the payment webhook bug and worked on the auth refactor.
```

The enriched version is more useful for the team reading the report.

If the user didn't provide enough context for a specific question, ask
about that question specifically rather than inventing content.

### Step 5: Review and post

Present the complete draft clearly:

```
Here's your draft for "Daily Standup":

Q: What did you work on yesterday?
A: Finished the auth module refactor and opened PR #342 for review.

Q: What are you working on today?
A: Starting integration tests for the new auth flow. Meeting with
   the API team at 14:00 to discuss token rotation.

Q: Any blockers?
A: Still waiting on the staging environment deploy from DevOps
   (carried over from Tuesday).

Ready to submit?
```

On explicit approval, build and execute:

```bash
geekbot report create \
  --standup-id 123 \
  --answers '{"101":"Finished the auth module refactor and opened PR #342 for review.","102":"Starting integration tests for the new auth flow. Meeting with the API team at 14:00 to discuss token rotation.","103":"Still waiting on the staging environment deploy from DevOps (carried over from Tuesday)."}'
```

Confirm success with the report ID and a brief summary.

---

## Tone Calibration

Match the user's existing reporting style. This matters — people notice
when their standup answers suddenly sound different.

### What to analyse from historical reports

| Signal | How to detect | How to match |
|--------|--------------|--------------|
| **Length** | Average character count per answer | Keep within ±20% of their norm |
| **Structure** | Bullets vs prose vs numbered lists | Mirror the format |
| **Formality** | "Completed authentication module" vs "wrapped up auth stuff" | Match register |
| **Detail level** | PR numbers, ticket refs vs high-level summaries | Include same specificity |
| **Emoji / voice** | Present or absent; "I did X" vs "Did X" vs "Completed X" | Mirror exactly |

**If terse bullet points historically** → draft terse bullets, don't expand.
**If narrative with context** → draft with similar detail and flow.
**First-time reporter** → default to concise prose, 1–3 sentences per question.

---

## Blocker Carry-Over Logic

One of the most valuable parts of AI-assisted reporting: automatically
surfacing unresolved blockers so they don't silently disappear.

### Detection

Scan last 3–5 reports for blocker-related questions (keywords: "block",
"stuck", "impediment", "waiting", "depend"). Classify answers as **no
blocker** ("None", "All clear", "N/A", short negatives) or **has blocker**
(anything else).

### Resolution detection

- Later report's blocker answer is "None" or similar → resolved
- Later report mentions same topic in progress answer → resolved
- Same blocker in most recent report → still active

### Carry-over presentation

Surface active blockers during step 4: *"In your last report (Tuesday),
you mentioned waiting on the staging deploy. Is that still blocking you?"*

- **Still blocked** → include, note it's a carry-over
- **Resolved** → omit (optionally mention resolution in progress answer)
- **Changed** → update the description

### Don't over-carry

Only carry over from last 3–5 reports. If a blocker persists 2+ weeks,
still surface but don't belabour it. If the user says "no blockers" after
you surface a carry-over, respect that.

---

## Edge Cases

### User in multiple standups with overlapping questions

If multiple standups have similar questions (common with "blockers" across
a daily standup and a weekly sync), draft each report independently. A
blocker reported in one standup should be surfaced for the other if it's
the same blocker — but the framing may differ (daily: tactical, weekly:
strategic).

### Standup with many questions (>5)

Some standups (e.g., Sales Report, Well-being Check-in) have 5+ questions.
Don't try to gather context for all at once. Process in batches:
1. Draft the first 3 answers based on initial context
2. Ask about the remaining questions specifically
3. Complete the draft

### User provides minimal input

If the user says something like "nothing much today" or "same as yesterday":
- For progress questions: pull from the last report and frame as continuation
  ("Still working on the auth refactor from yesterday?")
- For blocker questions: check carry-over, default to "No blockers" if clear
- Don't pad — if they want a short report, draft a short report

### Report already submitted

If the user tries to submit a report and the CLI returns a conflict (exit
code 8), they may have already reported today. Inform them and ask if they
want to view their existing report instead.

### Standup is inactive or paused

If `geekbot standup get` shows the standup isn't currently active, let the
user know. They can still submit a report manually, but the standup won't
trigger automatically until reactivated.
