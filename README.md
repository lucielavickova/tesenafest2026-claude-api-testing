# API test automation framework built in one day with Claude Code

[![PR checks](https://github.com/lucielavickova/tesenafest2026-claude-api-testing/actions/workflows/pr.yml/badge.svg)](https://github.com/lucielavickova/tesenafest2026-claude-api-testing/actions/workflows/pr.yml)
[![Daily smoke](https://github.com/lucielavickova/tesenafest2026-claude-api-testing/actions/workflows/smoke.yml/badge.svg)](https://github.com/lucielavickova/tesenafest2026-claude-api-testing/actions/workflows/smoke.yml)

Building a test automation framework usually takes three to six months. This one was built in a single day, on 24 September 2026, at the workshop "AI-assisted API Testing with Claude Code" at [Tesena Fest 2026](https://www.tesena.com): from an empty repository to API tests running in a GitHub Actions pipeline.

Claude Code wrote the code. People wrote the brief, approved the plan, set the rules, reviewed every pull request and merged it. Every step is in the history of this repo: the issues, the pull requests and the commits are the record of how it was done.

The walk-through of this repo (in Czech) is the webinar [Test automation framework za jeden den: API testy s Claude Code](https://www.tesena.com/cz-test-automation-framework-za-jeden-den-api-testy-s-claude-code/a-1109/).

## What it tests

- **Todoist**, a task manager: [www.todoist.com](https://www.todoist.com), REST API v1, tested on a free account.
- API docs: [developer.todoist.com/api/v1](https://developer.todoist.com/api/v1/), OpenAPI spec: [openapi.json](https://developer.todoist.com/openapi.json).
- Test cases: [Test Cases for automation.md](<Test Cases for automation.md>). Each one has its own issue labeled `test`.

## How it was built

| Step | What people did | What Claude Code did | Where to see it |
|------|-----------------|----------------------|-----------------|
| 1. Brief | Wrote the requirements: scope, priorities, tools, security, pipelines, git workflow, definition of done | Nothing yet | [brief.md](brief.md) |
| 2. Plan | Reviewed and approved the plan before any code existed | Proposed the architecture and split the work into issues | Issue #1, PR #2, [docs/test-architecture-plan.md](docs/test-architecture-plan.md) |
| 3. Framework | Reviewed and merged | Scaffolding, base client with token auth and redaction, schema validation, API clients, fixtures, test data builders, CI pipelines | Issues #3 to #7, PR #8 |
| 4. Rules and guardrails | Decided the rules | Wrote them down in templates, `CLAUDE.md` and git hooks | PRs #10, #26, #30, #32 |
| 5. Tests | Picked the test cases, reviewed each test | Implemented one test case per issue and PR | PRs #27 and #28 |
| 6. Skill | Asked Claude to turn what worked into a reusable workflow | Wrote the skill for adding new tests | PR #34, [.claude/skills/writing-todoist-api-tests](.claude/skills/writing-todoist-api-tests/SKILL.md) |
| 7. Subagent | Asked for a read-only helper that explains why a CI run failed | Wrote the agent that reads the log, the report and the traces and drafts a Bug report | PR #76, [.claude/agents/ci-failure-triage](.claude/agents/ci-failure-triage.md) |

### The rules the agent works by

- **Every change starts as an issue.** Templates for test cases, tasks and bugs are in [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE).
- **One issue, one branch, one pull request.** Branch names and commit messages carry the issue ID, a `commit-msg` hook enforces it.
- **The agent never pushes to `main` and never merges.** The "Protect main" ruleset on GitHub requires a pull request with a green `Lint, type check and tests` check and blocks force pushes and deletion of `main`; a `pre-push` hook rejects such pushes locally. Claude reviews its own PR and fixes the findings, then a person reviews and merges.
- **One git worktree per agent**, so several agents can work on different issues in parallel without switching branches under each other.
- **Expected behavior is probed, not guessed.** Where the spec does not say what the API returns, the test asserts the observed behavior and the PR lists it as an assumption.
- All of this is in [CLAUDE.md](CLAUDE.md). [AGENTS.md](AGENTS.md) points other coding agents to the same file.

### Skills and subagents

Both are instructions for Claude Code in `.claude/`. The difference is who decides during the work and what you see.

- **A skill works with you.** It loads into the current conversation. You see every step and can step in: "not this assert, check the status code". Use it when the result is a change in the code and you want to stay in control. Example: [writing-todoist-api-tests](.claude/skills/writing-todoist-api-tests/SKILL.md), the workflow for adding a test.
- **A subagent works on its own and reports back.** It gets the task, runs in its own context with its own tools, and returns only the result. The long logs and traces stay out of your conversation. Use it when the way to the result is long and noisy and you only need the conclusion. Example: [ci-failure-triage](.claude/agents/ci-failure-triage.md). It has no Edit or Write tool, and a hook limits its Bash to read commands, see below.

The two work together. When CI fails, ask Claude why: the `ci-failure-triage` agent reads the failed run and returns a category, the evidence and a draft Bug report, for example "test bug: TC-007 compares the date in UTC instead of the account timezone". Then you decide what to do, and fix the test in the main conversation with the `writing-todoist-api-tests` skill, step by step.

When the same know-how is needed in both places, for example how to read our traces without printing the token, it can move into a skill that the agent loads with the `skills:` field.

**"Must not" or "cannot".** Instructions say what the agent must not do, but an agent with the Bash tool could still run `gh issue create` or `git push`. The `ci-failure-triage` agent has a `PreToolUse` hook in its frontmatter: before each Bash command, [scripts/triage-bash-allowlist.mts](scripts/triage-bash-allowlist.mts) checks it against an allowlist of read commands and blocks everything else, also when it is hidden in `&&`, a pipe, `sh -c` or `$(...)`. The hook applies only to this agent, not to your own conversation. To read traces without the headers, the agent calls [scripts/trace-summary.mts](scripts/trace-summary.mts) instead of `node -e`, which the hook blocks. Claude Code runs project hooks only after you trust the folder, and not in `claude -p`.

## Try it yourself

What you need:

- A paid Claude plan with Claude Code (Pro, Max or Team).
- VS Code with the Claude Code extension.
- The Superpowers plugin from the `anthropics/claude-plugins-official` marketplace. Restart VS Code after installing it, otherwise it does not load.
- Git. On a company laptop set `git config user.name` and `git config user.email` in the repo, without `--global`, so the company identity stays untouched.
- Node.js 24 LTS and npm. `npx playwright install` is not needed, the tests use no browser.
- GitHub CLI, logged in with `gh auth login -s project`. Claude uses it to create issues and pull requests, read failed pipeline runs and set secrets.
- A GitHub account and a free Todoist account.

Then:

1. Create your own copy with **Use this template** (or fork it).
2. Create a free [Todoist](https://www.todoist.com) account and copy its API token from Settings > Integrations > Developer.
3. Add the token as the `TODOIST_API_TOKEN` secret in your repository (Settings > Secrets and variables > Actions) and to your local `.env` (see Getting started).
4. Turn on private vulnerability reporting in your repository (Settings > Advanced Security > Private vulnerability reporting). A copy does not inherit this setting. Then change the owner and repository name in the "Report a security issue" link in `.github/ISSUE_TEMPLATE/config.yml` to your own, otherwise a leaked token gets reported to the original repository.
5. Open the repository in [Claude Code](https://claude.com/claude-code) and pick an open `test` issue, for example: `Work on issue #13. Follow CLAUDE.md and the writing-todoist-api-tests skill.`

## Getting started

Requirements: Node.js 24 (see `.nvmrc`) and npm.

```sh
npm ci                      # installs dependencies and the git hooks
cp .env.example .env        # then fill in TODOIST_API_TOKEN
```

| Script | What it does |
|--------|--------------|
| `npm run lint` | ESLint (typescript-eslint type-checked rules, eslint-plugin-playwright) |
| `npm run format:check` | Prettier check (`npm run format` to fix) |
| `npm run typecheck` | TypeScript strict type check |
| `npm test` | All tests: unit tests of the framework and API tests |
| `npm run test:unit` | Unit tests of the framework (`tests/unit/`). They do not call the API and do not need `TODOIST_API_TOKEN` |
| `npm run test:api` | API tests only. The `setup` project deletes old test data first |
| `npm run test:smoke` | Only tests tagged `@smoke` |

- The environment is picked by `TEST_ENV` (default `prod`) from `config/<TEST_ENV>.ts`.
- Git hooks: `pre-commit` lints and formats staged files, `commit-msg` requires `#<issue id> <summary>`, `pre-push` blocks direct pushes to `main` (GitHub enforces the same with the "Protect main" ruleset). `npm ci` also sets `core.commentChar` to `;` so Git does not strip `#` subject lines written in the editor.

## Project structure

```
config/                 environment configs (base URL), picked by TEST_ENV
src/
  env.ts                reads TODOIST_API_TOKEN (never prints it)
  clients/              BaseClient + one client per resource (projects, tasks, labels, comments, user)
  fixtures/             Playwright fixtures: `test` and `expect` for all spec files
  data/                 builders with the `autotest-<run id>-` prefix, stale data cleanup
  schemas/              pinned OpenAPI spec, Ajv validator, `toMatchSchema` matcher
  reporters/            reporter that redacts the token from traces and reports
  utils/                dates in the account timezone, redaction helpers
scripts/                check-no-token, report-flaky, update-openapi, trace-summary and the
                        Bash allowlist hook of the triage agent (rules in scripts/lib/)
tests/                  spec files, grouped by resource or suite
  global.setup.ts       setup project: deletes `autotest-` data older than 1 hour before the API tests
  unit/                 unit tests of the framework, incl. an end-to-end check of token redaction
.claude/skills/         skills for Claude Code
.claude/agents/         subagents for Claude Code: ci-failure-triage (why a CI run failed)
.github/workflows/      pr.yml (every PR), smoke.yml (daily @smoke on main)
```

## Writing a test

```ts
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-002 A new task is created with the text that was entered',
  { tag: ['@TC-002', '@smoke'] },
  async ({ api, testData }) => {
    const content = testData.generateUniqueName();

    const created = await test.step('Create a task with unique content', () =>
      testData.createTask({ content }));

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.id, 'id of the created task').toBeTruthy();
      expect(created.content).toBe(content);
    });

    await test.step('Load the task by its ID and check it', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(created.id);
      expect(loaded.content).toBe(content);
    });
  },
);
```

This is [tests/tasks/create-task.spec.ts](tests/tasks/create-task.spec.ts). The test checks the create response and then loads the task again, because the response alone does not prove that the task was stored.

- There is no login. The API token is sent as a Bearer header on every request.
- `testData.create*` builds a unique name such as `TC-002-autotest-local-w0-20260924T101503123Z` (the test case ID from the `@TC-...` tag, the run id, the worker and the UTC time the name was created) and deletes the item after the test, also when it fails. Use `testData.generateUniqueName()` for values the test builds itself and `testData.track(kind, id)` for things created another way.
- `api.<resource>.send(method, path, options)` returns the raw response, for status code checks.
- `unauthenticatedApi` and `apiWithToken(token)` are for the negative auth tests.
- `accountTimezone` (with `src/utils/dates.ts`) is the timezone for date assertions, not the runner's clock.

## Security

- The token lives only in `.env` (gitignored) and in the `TODOIST_API_TOKEN` GitHub secret.
- Traces are kept only for failed tests. The first reporter (`src/reporters/redact-reporter.ts`) replaces the token with `[REDACTED]` in traces, attachments, error messages and captured output before the HTML report is built.
- CI runs `node scripts/check-no-token.mts`, which searches `playwright-report/` and `test-results/` (including inside zips) and blocks the artifact upload if the token is found.
- ESLint forbids `console` in the framework and tests. Live terminal output of a test that prints the token itself cannot be redacted.
- Refresh the pinned spec by hand with `node scripts/update-openapi.mts` and review the diff.

## License

[MIT](LICENSE)
