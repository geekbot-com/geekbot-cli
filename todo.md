- [ ] I want to create an agent skill that can help users perform any Geekbot (geekbot.com) related operation.


- [ ] I want to create a CLI that will be mostly used by agents to perform most operations that someone can do with Geekbot (geekbot.com)
The use cases are:
1. Setup Standups, polls and surveys (this includes reading templates)
2. Read reports and poll results in order to analyse them
3. Post a report in a standup (or even cast votes in polls)
A few requirements:
- It should be written with Bun and Typescript
- As it is intented to be used by AI agents it should incorporate all good practices for that matter (eg. always give recommendations in errors, verify ids, etc.)
- The code should have 99% test coverage, and there should be integration tests in place (that could use an API key from the environment, eg. GEEKBOT_INTEGRATION_TEST_API_KEY)
- There should be a setup option that the user (not the agent) should use in order to setup their Geekbot API key that should be stored securely (eg. in Mac's keychain)
- The CLI should work in Windows, Linux and Mac operating systems
- It should provide the whole functionality from @API_DOCUMENTATION.md

- [ ] Integration testing key: api_69b803c2ebab74.92123929

- [ ] I want you to use sub agents to check how popular agent skill projects (check github stars) do distribution, installation and updates. Our project is a skill that uses a bun CLI. Requirements:
- We are interested in agent skills that use CLIs, not mcp servers
- The CLI already works in Mac, Linux and Windows so the installation should keep that in mind.
- People might need to install the skill in Claude Desktop, Claude Code, Codex, Cursor, etc.
- An automatic updates feature would be great as this is an active project
- The project will use Github to share the code, so that can be the entry point for CI, etc.
As a deliverable we want a document explaining the best strategies out there with their pros/cons and code snippets as examples of how each strategy is implemented

- [ ] For each of the above issues found in a recent review I want you to spawn an opus sub agent to:
1. write a test or update a test to verify the issue (if applicable)
2. fix the issue
3. run all tests to make sure that nothing is broken

After all fixes run an opus sub agent to review all changes and run all tests.
Then commit everything. 
Do not use git worktrees