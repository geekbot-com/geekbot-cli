---
name: Run UAT commands yourself
description: User wants Claude to run CLI test commands directly instead of asking the user to run them manually
type: feedback
---

During UAT, run the test commands yourself (via Bash or sub-agents) instead of asking the user to manually run them and report back.

**Why:** The user pointed out that Claude can execute CLI commands directly, making manual testing unnecessary for observable CLI output.

**How to apply:** During /gsd:verify-work sessions, execute each test command via Bash and show the output inline. Only ask the user for confirmation on things that genuinely require human judgment (visual UI, subjective experience).
