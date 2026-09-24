# Plan: Test automation architecture for the Todoist API

## Context

The repo currently contains only `README.md`, `brief.md` and `Test Cases for automation.md`. The brief asks for a Playwright + TypeScript API test framework (no browser) against the Todoist API v1 on production, using a free account. It must give quick feedback on PRs and hourly smoke checks, with task tests as the business priority. In scope: TC-001 to TC-009 and TC-011 to TC-015 (sections and TC-010 are out of scope).

The plan below defines the architecture and splits the work into GitHub issues, each delivered as its own branch and PR (per the brief's git workflow). Claude never merges; it reviews its own PR, fixes findings, and waits for a human merge before starting the next issue from the updated `main`.

## Architecture

### Layout

```
config/
  prod.ts                    { baseURL: 'https://api.todoist.com/api/v1/' }
  index.ts                   loads config/<TEST_ENV>.ts (default 'prod'), fails on unknown env
src/
  env.ts                     reads TODOIST_API_TOKEN (dotenv locally), throws a clear error if missing (never prints the value)
  clients/
    BaseClient.ts            wraps APIRequestContext: base URL, Bearer auth, JSON, error handling
    ApiError.ts              typed error (status, method, path, body) - no headers in message
    ProjectsClient.ts
    TasksClient.ts
    LabelsClient.ts
    CommentsClient.ts
    UserClient.ts            GET /user -> account timezone (tz_info) for date assertions (not a login)
  fixtures/
    index.ts                 merged `test` / `expect` exported to all tests
    api.fixture.ts           api clients (worker scope request context) + unauthenticated/bad-token contexts for TC-014
    data.fixture.ts          tracked-resource fixtures that create and always delete (teardown runs on failure)
    user.fixture.ts          account timezone, worker scoped
  data/
    runId.ts                 RUN_ID (GITHUB_RUN_ID or local timestamp) and prefix `autotest-<runId>-`
    projectBuilder.ts, taskBuilder.ts, labelBuilder.ts, commentBuilder.ts
  schemas/
    openapi.json             pinned snapshot of https://developer.todoist.com/openapi.json
    validator.ts             Ajv 2020 + ajv-formats, `expectSchema(body, 'TaskDto')` style helper
  utils/
    dates.ts                 "today/tomorrow in account tz" via Intl (no extra date lib unless needed)
    redact.ts                header redaction helper
  global-setup.ts            deletes `autotest-` projects/labels (and tasks in Inbox) older than 1 hour
scripts/
  update-openapi.ts          refreshes the pinned spec snapshot (manual, not in CI)
tests/
  projects/  tasks/  labels/  comments/  e2e/  negative/
.github/workflows/
  pr.yml  smoke.yml
.husky/  (or simple-git-hooks)  pre-commit, commit-msg, pre-push
```

### Key design decisions

- **Authentication: API token only.** There is no login step, no OAuth flow and no session handling. The personal API token (from Todoist settings) is read from `TODOIST_API_TOKEN` (`.env` locally, GitHub secret in CI) and sent as `Authorization: Bearer <token>` on every request. `GET /user` is used only to read the account timezone, not to authenticate.
- **Base client.** `BaseClient` holds a `APIRequestContext` created with `baseURL` from config and `extraHTTPHeaders: { Authorization: 'Bearer ...' }`. Methods `get/post/delete` return parsed JSON typed as `T`; non-2xx throws `ApiError` unless the caller uses a `raw*` variant that returns the `APIResponse` (needed for negative tests TC-014/015). Resource clients are thin: one method per endpoint (`create`, `get`, `update`, `delete`, `list`, plus `close`/`reopen` on tasks). List endpoints in v1 are paginated (`{ results, next_cursor }`), so `BaseClient` gets a `listAll` helper.
- **Schema validation.** Pin the OpenAPI spec in the repo (reproducible, reviewable diffs) and validate every successful response body against the matching component schema via Ajv. A custom `expect` matcher `toMatchSchema('<ComponentName>')` keeps tests readable. Exact component names are confirmed when the spec is pulled in (issue 3).
- **Fixtures own setup and cleanup.** Data fixtures expose factory functions such as `createProject(overrides?)` that call the client, register the created id, and delete all registered ids in reverse order in teardown (fixture teardown runs on failure too). Deleting a project cascades its tasks and comments. Cleanup ignores 404 so tests that delete data themselves do not fail teardown.
- **Test data.** Builders produce payloads with the `autotest-<runId>-` prefix plus a short random suffix, so parallel workers never collide. No shared data, no order dependency (`fullyParallel: true`).
- **Global setup.** Lists projects and labels (and Inbox tasks), deletes those with the `autotest-` prefix whose run id timestamp or `created_at` is older than 1 hour. Protects the free plan project limit.
- **Timezone-aware dates.** `user.fixture` reads the account timezone once per worker; `dates.ts` computes the expected calendar date in that zone (TC-003, TC-009, TC-013).
- **Free plan check.** Before each wave, confirm features against the free plan (comments, labels, recurring due dates, reminders, etc.). Anything not available is `test.fixme(true, '<reason>')`.
- **Security.**
  - `.env` gitignored, `.env.example` committed with `TODOIST_API_TOKEN=`.
  - `playwright.config.ts`: `trace: 'retain-on-failure'`, HTML reporter.
  - Redaction: traces record request headers, so the token is not passed via `extraHTTPHeaders` on the traced context alone. Implement redaction in a custom reporter/fixture step that rewrites the trace and report attachments, or (simpler and verified first in issue 2) send the token through a context whose trace capture excludes it. Issue 2 includes a spike that inspects a real trace zip and HTML report for the token string and adds an automated check (`scripts/check-no-token.ts`) that greps `playwright-report/` and `test-results/` for the token before artifacts are uploaded in CI. The CI step fails if found.
  - No `console.log` of config or headers; ApiError messages exclude headers.
- **Config.** `playwright.config.ts`: `workers: CI ? 2 : undefined`, `retries: CI ? 1 : 0`, `globalSetup`, `use.baseURL` from `config/index.ts`. Strict `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`). ESLint flat config with `typescript-eslint` (type-checked) and `eslint-plugin-playwright`. Prettier. npm scripts: `lint`, `format:check`, `typecheck`, `test`, `test:smoke`.

### Test design conventions

- Name `TC-00X <name from test case file>`, tags `['@TC-00X', '@<suite>']`.
- Every step in `test.step('...')`.
- One behavior per test; multi-input cases split with suffixes: TC-014a (no token), TC-014b (malformed token); TC-015a (empty content), TC-015b (missing required field), TC-015c (unreadable due string).
- Unclear expected results (e.g. TC-015 status codes, TC-014 "nothing is created") are probed against the real API first, asserted as observed, and listed as assumptions in the PR description.

| File | Tests | Tag |
|------|-------|-----|
| `tests/projects/projects.spec.ts` | TC-001, TC-006 | @smoke, @regression |
| `tests/tasks/create-task.spec.ts` | TC-002, TC-003, TC-007 | @smoke, @regression |
| `tests/tasks/task-list.spec.ts` | TC-008 | @regression |
| `tests/tasks/due-dates.spec.ts` | TC-009, TC-013 | @regression |
| `tests/tasks/reopen-task.spec.ts` | TC-012 | @regression |
| `tests/labels/labels.spec.ts` | TC-004 | @smoke |
| `tests/comments/comments.spec.ts` | TC-005 | @smoke |
| `tests/e2e/project-lifecycle.spec.ts` | TC-011 | @e2e |
| `tests/negative/auth.spec.ts` | TC-014a/b | @negative |
| `tests/negative/task-validation.spec.ts` | TC-015a/b/c | @negative |

### Pipelines

- `pr.yml` (`on: pull_request`, never `pull_request_target`): checkout, setup-node 24 with npm cache, `npm ci`, `lint`, `format:check`, `typecheck`, `npx playwright test`, token leak check, upload `playwright-report` (always) and `test-results` traces (on failure), `retention-days: 14`. Flaky tests (passed on retry) surfaced in the PR via a job summary / sticky comment built from the JSON reporter output. `permissions` minimal (`contents: read`, `pull-requests: write` for the comment).
- `smoke.yml`: `schedule: cron '0 * * * *'` + `workflow_dispatch`, runs `--grep @smoke` on `main`. On failure, `gh` opens an issue labeled `smoke-failure` or comments on the open one (`issues: write`).
- Both workflows use the same `concurrency: { group: todoist-account, cancel-in-progress: false }` so runs never overlap on the shared account.

### Git hooks

- `husky` + `lint-staged`: `pre-commit` runs ESLint and Prettier on staged files.
- `commit-msg`: regex `^#\d+ .+` (allow merge/revert messages).
- `pre-push`: blocks pushes to `refs/heads/main`.

## Delivery plan (one issue = one branch = one PR)

Order puts the foundation first, then tasks (business priority) before the other resources inside each wave.

1. **Project scaffolding** - package.json, Node 24 (`.nvmrc`, `engines`), strict tsconfig, ESLint, Prettier, husky hooks (pre-commit, commit-msg, pre-push), `.gitignore`, `.env.example`, `config/`, `playwright.config.ts`. No tests yet.
2. **Base client, API token auth, security** - `BaseClient` (Bearer token header, no login), `ApiError`, `env.ts`, redaction and token leak check script, trace/report settings. Includes a spike verifying that the token does not appear in a failing test's trace and report.
3. **Schema validation** - pinned `openapi.json`, `validator.ts`, `toMatchSchema` matcher, `update-openapi.ts`.
4. **Clients, builders, fixtures, global setup** - Projects, Tasks, Labels, Comments, User clients; builders; data and user fixtures; global cleanup of `autotest-` data older than 1 hour. Free plan feature check documented in the PR.
5. **CI pipelines** - `pr.yml`, `smoke.yml`, concurrency, artifacts, flaky report, smoke-failure issue. (Needs the `TODOIST_API_TOKEN` secret set by a human.)
6. **Wave 1 smoke** - TC-002, TC-003 (tasks first), TC-001, TC-004, TC-005.
7. **Wave 2 regression** - TC-007, TC-008, TC-009, TC-006.
8. **Wave 3 e2e** - TC-011.
9. **Wave 4 regression** - TC-012, TC-013.
10. **Wave 5 negative** - TC-014a/b, TC-015a/b/c, with probed behavior listed as assumptions.

Issues 1 to 5 can be merged before any real tests exist; the PR workflow in issue 5 is exercised by a trivial health check (e.g. GET /user schema check), which later stays as part of the suite only if useful.

## Verification

- Locally per PR: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npx playwright test` (and `--grep @smoke` for wave 1).
- Cleanup: after a run, list projects and labels via API and confirm there are no `autotest-<runId>-` leftovers; force a failing test once to confirm fixture teardown still deletes data.
- Security: force a failure, open the trace zip and HTML report, confirm the token string is absent; the automated leak check must pass in CI.
- CI: PR workflow green; trigger `smoke.yml` via `workflow_dispatch`, then simulate a failure to confirm the `smoke-failure` issue is opened, and a second failure comments on it.
- Hooks: bad commit message is rejected, direct push to `main` is blocked.
