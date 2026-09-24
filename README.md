# Tesena Fest 2026 Workshop: AI-assisted API Testing with Claude Code and Superpowers
 This repo is going to be used for workshop "AI-assisted API Testing with Claude Code and Superpowers" at Tesena Fest 2026

## Application under test

- **Todoist**, a task manager: [www.todoist.com](https://www.todoist.com)
- Create **a free account** and use it for testing
- API docs: [https://developer.todoist.com/openapi.json](https://developer.todoist.com/openapi.json)

# Split into teams
https://docs.google.com/spreadsheets/d/1sojXo_kTQdlSs79mieYC4lg28hxKNJhT-8dk8EhaDk4/edit?gid=1451532433#gid=1451532433

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
| `npm test` | All Playwright API tests |
| `npm run test:smoke` | Only tests tagged `@smoke` |

- The environment is picked by `TEST_ENV` (default `prod`) from `config/<TEST_ENV>.ts`.
- Git hooks: `pre-commit` lints and formats staged files, `commit-msg` requires `#<issue id> <summary>`, `pre-push` blocks direct pushes to `main`. `npm ci` also sets `core.commentChar` to `;` so Git does not strip `#` subject lines written in the editor.
- The architecture is described in [docs/test-architecture-plan.md](docs/test-architecture-plan.md).

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
  global-setup.ts       deletes `autotest-` data older than 1 hour
scripts/                check-no-token, report-flaky, update-openapi
tests/                  spec files, grouped by resource or suite
.github/workflows/      pr.yml (every PR), smoke.yml (hourly @smoke on main)
```

## Writing a test

```ts
import { expect, Schema, test } from '../../src/fixtures';

test('TC-002 A new task is created with the text that was entered', {
  tag: ['@TC-002', '@smoke'],
}, async ({ api, testData }) => {
  const created = await test.step('Create a task', () => testData.createTask({ content: 'autotest-...' }));

  await test.step('Load the task and check its text', async () => {
    const task = await api.tasks.get(created.id);
    expect(task).toMatchSchema(Schema.task);
    expect(task.content).toBe(created.content);
  });
});
```

- There is no login. The API token is sent as a Bearer header on every request.
- `testData.create*` builds a unique `autotest-<run id>-` name and deletes the item after the test, also when it fails. Use `testData.track(kind, id)` for things created another way.
- `api.<resource>.send(method, path, options)` returns the raw response, for status code checks.
- `unauthenticatedApi` and `apiWithToken(token)` are for the negative auth tests.
- `accountTimezone` (with `src/utils/dates.ts`) is the timezone for date assertions, not the runner's clock.

## Security

- The token lives only in `.env` (gitignored) and in the `TODOIST_API_TOKEN` GitHub secret.
- Traces are kept only for failed tests. The first reporter (`src/reporters/redact-reporter.ts`) replaces the token with `[REDACTED]` in traces, attachments, error messages and captured output before the HTML report is built.
- CI runs `node scripts/check-no-token.mts`, which searches `playwright-report/` and `test-results/` (including inside zips) and blocks the artifact upload if the token is found.
- ESLint forbids `console` in the framework and tests. Live terminal output of a test that prints the token itself cannot be redacted.
- Refresh the pinned spec by hand with `node scripts/update-openapi.mts` and review the diff.
