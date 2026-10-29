# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Playwright + TypeScript API test suite for the Todoist REST API v1 (`https://api.todoist.com/api/v1/`), built for the Tesena Fest 2026 workshop. No browser is used, only `APIRequestContext`. Tests run against production on a free Todoist account.

The project requirements live in [brief.md](brief.md) (scope, conventions, pipelines, git workflow, definition of done) and the test cases in [Test Cases for automation.md](<Test Cases for automation.md>). Read both before adding tests. The design is in [docs/test-architecture-plan.md](docs/test-architecture-plan.md).

## Commands

Node.js 24 (`.nvmrc`). `npm ci` also installs the husky hooks. Copy `.env.example` to `.env` and set `TODOIST_API_TOKEN`.

```sh
npm run lint            # ESLint (type-checked typescript-eslint + eslint-plugin-playwright)
npm run format:check    # Prettier (npm run format to fix)
npm run typecheck       # tsc --noEmit, strict
npm test                # all tests (unit and API)
npm run test:unit       # unit tests of the framework: no API, no token needed
npm run test:api        # API tests (the setup project runs first)
npm run test:smoke      # only @smoke

npx playwright test tests/projects/projects.spec.ts   # one file
npx playwright test --grep @TC-001                    # one test case by tag
```

- `TEST_ENV` selects `config/<TEST_ENV>.ts` (default `prod`). New environments are a new file registered in `config/index.ts`, nothing more.
- `node scripts/update-openapi.mts` refreshes the pinned spec in `src/schemas/openapi.json` (review the diff). `scripts/check-no-token.mts` and `scripts/report-flaky.mts` are used by CI.

## Architecture

- **Clients** (`src/clients/`): one class per resource on top of `BaseClient`. The request context already carries the base URL and the Bearer header (`createApiContext`), so paths are relative (`tasks/123`). Typed methods throw `ApiError` on non-2xx; `send(method, path, options)` returns the raw `APIResponse` for status-code assertions. `listAll` follows `next_cursor` pagination.
- **Fixtures** (`src/fixtures/`): spec files import `test`, `expect` and `Schema` only from `src/fixtures`. `mergeTests` combines `apiTest` (`api`, `apiRequest`, `unauthenticatedApi`, `apiWithToken`), `dataTest` (`testData`) and `userTest` (worker-scoped `account`, `accountTimezone`). Contexts are created from `playwright.request` so calls appear in traces.
- **Projects** (`playwright.config.ts`): `unit` (`tests/unit/`, no API, no token), `setup` (`tests/global.setup.ts`, calls `deleteStaleTestData` from `src/data/cleanup.ts`) and `api` (everything else in `tests/`, depends on `setup`). Filters such as `--grep` do not skip `setup`. Do not move the cleanup back to `globalSetup`: it would run for the unit tests too.
- **Test data** (`src/data/`): builders produce names `<TC ID>-autotest-<run id>-w<worker>-<UTC time>` via `uniqueName`, for example `TC-004-autotest-local-w0-20261029T101503123Z`. The run id (`local` or `gh<GITHUB_RUN_ID>`) is fixed once in `playwright.config.ts` (main process) and shared with workers through `AUTOTEST_RUN_ID`. The worker index and the time with milliseconds keep names unique (Todoist rejects a duplicate label name). The `setup` project reads the age from the time and deletes leftovers older than 1 hour (labels have no creation date). `testData.create*` registers items for cleanup in reverse order after the test, ignoring 404. If a create gets no response or a 5xx, it registers a lookup by the `autotest-` name it sent, which runs at cleanup, and rethrows. Anything created another way must be registered with `testData.track(kind, id)`.
- **Schemas** (`src/schemas/`): Ajv 2020 validates against component schemas of the pinned OpenAPI spec. Use `expect(x).toMatchSchema(Schema.task)`; add new names to the `Schema` map in `validator.ts` instead of using generated names in tests.
- **Token safety**: the repo is public. `src/reporters/redact-reporter.ts` must stay the first reporter; it redacts the token from traces, attachments, errors, step titles, annotations and output (in `onTestEnd`, so the live console output of the `list` reporter is not covered). Traces are kept only on failure. CI fails the artifact upload if `check-no-token.mts` finds the token. `tests/unit/token-leak.spec.ts` checks the whole chain: a nested Playwright run (`tests/unit/token-leak/`) with a fake token and a test that fails on purpose, then `check-no-token.mts` on its report and traces. Run it after a Playwright upgrade. ESLint forbids `console`; never print the token or headers (the setup project prints counts only).
- **Dependencies**: there is no Dependabot, updates are done by hand. Every `uses:` in `.github/workflows/` points to a full commit SHA with a `# vX.Y.Z` comment, never to a tag. To update an action, get the SHA with `gh api repos/<owner>/<action>/commits/<tag> --jq .sha` and change the SHA and the comment together. Keep `npm audit` clean (`npm audit fix`, review the `package-lock.json` diff).
- **Dates**: assert due dates in `accountTimezone` with helpers in `src/utils/dates.ts`, not the runner's clock.

## Test conventions

- Unit tests of the framework itself go to `tests/unit/` with the `@unit` tag and no TC ID. They import `test` from `@playwright/test` (not `src/fixtures`), never call the API, use a fake `TodoistApi` and fixed dates, and need `test.step()` only where it makes the report clearer, see `tests/unit/test-data-cleanup.spec.ts`. A test that needs a token sets a fake one and restores the old value. CI runs them before the API tests, without the token.
- Name: `TC-xxx <test case name>`, tags `@TC-xxx` plus the suite tag (`@smoke`, `@regression`, `@e2e`, `@negative`, see the wave table in `brief.md`). Every step is a `test.step()` with a readable name. One behavior per test; multi-input cases get suffixes (`TC-015a`).
- Every API test verifies the response on three levels: 1) **status code**, 2) **schema**, 3) **business values**. A typed client method covers level 1 for a success (it throws `ApiError` on non-2xx); when the exact code matters (`204`, `401`, `404`), use `send()` and assert `res.status()`. Level 2 is `expect(x).toMatchSchema(Schema.x)` on every successful body; error bodies have no schema in the spec, so negative tests skip it. Level 3 asserts the fields the test sent or expects (name, due date, project id, state), not only that they exist, and after a write also on the item loaded again by id.
- Sections and TC-010 are out of scope. Features missing on the free plan are `test.fixme()` with the reason.
- Where the spec does not define the expected result, call the API first, assert the observed behavior and list it as an assumption in the PR description.
- CI uses 1 worker and 1 retry (shared Todoist account); locally 0 retries. Each PR has its own concurrency group, so runs of different PRs may overlap; keep tests isolated by run id and do not raise the CI worker count without checking the free plan project limit.

## Git workflow

- Issue, then branch `<issue id>-<short-description>`, then PR to `main`. Branch names and PR titles must contain the issue id: branch `12-tc-002-create-task`, PR title `#12 <short description>`. Commit messages must start with `#<issue id> ` (enforced by the `commit-msg` hook). `pre-push` blocks pushes to `main`; `pre-commit` runs lint-staged. On GitHub the "Protect main" ruleset requires a PR with a green `Lint, type check and tests` check and blocks force pushes and deletion of `main`.
- Before any work on an issue, create your own git worktree with the issue branch, based on the latest `main`: `git fetch origin`, then `git worktree add --no-track -b <issue id>-<short-description> ../tesenafest-<issue id> origin/main` (run from the main checkout; `--no-track` keeps the branch from tracking `main`, push it with `git push -u origin <branch>`). Work only in that worktree, never in the main checkout or another agent's worktree, so parallel agents do not switch branches under each other. In the new worktree run `npm ci` (dependencies and husky hooks) and copy `.env` from the main checkout. Remove the worktree with `git worktree remove` after the PR is merged.
- Fill in `.github/pull_request_template.md` (test cases, assumptions, checks).
- Three people work on this repo in parallel, each with their own agents, and anyone can merge a PR at any time. Before every push to a branch that has a PR, check that the PR is still open: `gh pr view <branch> --json state --jq .state` must print `OPEN`. If the PR is merged or closed, do not push to its branch, because those commits never reach `main`. Open a new issue and start a new branch from the updated `main`.
- Claude never merges PRs. Claude reviews its own PR and fixes the findings, then a human reviews and merges. Start the next issue only from the updated `main`. When a PR is ready, reply with the PR URL and a short summary.
