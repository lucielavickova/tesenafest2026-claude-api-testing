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
npm test                # all tests
npm run test:smoke      # only @smoke

npx playwright test tests/projects/projects.spec.ts   # one file
npx playwright test --grep @TC-001                    # one test case by tag
```

- `TEST_ENV` selects `config/<TEST_ENV>.ts` (default `prod`). New environments are a new file registered in `config/index.ts`, nothing more.
- `node scripts/update-openapi.mts` refreshes the pinned spec in `src/schemas/openapi.json` (review the diff). `scripts/check-no-token.mts` and `scripts/report-flaky.mts` are used by CI.

## Architecture

- **Clients** (`src/clients/`): one class per resource on top of `BaseClient`. The request context already carries the base URL and the Bearer header (`createApiContext`), so paths are relative (`tasks/123`). Typed methods throw `ApiError` on non-2xx; `send(method, path, options)` returns the raw `APIResponse` for status-code assertions. `listAll` follows `next_cursor` pagination.
- **Fixtures** (`src/fixtures/`): spec files import `test`, `expect` and `Schema` only from `src/fixtures`. `mergeTests` combines `apiTest` (`api`, `apiRequest`, `unauthenticatedApi`, `apiWithToken`), `dataTest` (`testData`) and `userTest` (worker-scoped `account`, `accountTimezone`). Contexts are created from `playwright.request` so calls appear in traces.
- **Test data** (`src/data/`): builders produce names `autotest-<run id>-<kind>-<hex>` via `uniqueName`. The run id is fixed once in `playwright.config.ts` (main process) and shared with workers through `AUTOTEST_RUN_ID`; it starts with a UTC timestamp so `global-setup.ts` can delete leftovers older than 1 hour (labels have no creation date). `testData.create*` registers items for cleanup in reverse order after the test, ignoring 404; anything created another way must be registered with `testData.track(kind, id)`.
- **Schemas** (`src/schemas/`): Ajv 2020 validates against component schemas of the pinned OpenAPI spec. Use `expect(x).toMatchSchema(Schema.task)`; add new names to the `Schema` map in `validator.ts` instead of using generated names in tests.
- **Token safety**: the repo is public. `src/reporters/redact-reporter.ts` must stay the first reporter; it redacts the token from traces, attachments, errors and output. Traces are kept only on failure. CI fails the artifact upload if `check-no-token.mts` finds the token. ESLint forbids `console`; never print the token or headers (global setup prints counts only).
- **Dates**: assert due dates in `accountTimezone` with helpers in `src/utils/dates.ts`, not the runner's clock.

## Test conventions

- Name: `TC-xxx <test case name>`, tags `@TC-xxx` plus the suite tag (`@smoke`, `@regression`, `@e2e`, `@negative`, see the wave table in `brief.md`). Every step is a `test.step()` with a readable name. One behavior per test; multi-input cases get suffixes (`TC-015a`).
- Sections and TC-010 are out of scope. Features missing on the free plan are `test.fixme()` with the reason.
- Where the spec does not define the expected result, call the API first, assert the observed behavior and list it as an assumption in the PR description.
- CI uses 1 worker and 1 retry (shared Todoist account); locally 0 retries.

## Git workflow

- Issue, then branch `<issue id>-<short-description>`, then PR to `main`. Commit messages must start with `#<issue id> ` (enforced by the `commit-msg` hook). `pre-push` blocks pushes to `main`; `pre-commit` runs lint-staged.
- Before any work on an issue, create your own git worktree with the issue branch, based on the latest `main`: `git fetch origin`, then `git worktree add --no-track -b <issue id>-<short-description> ../tesenafest-<issue id> origin/main` (run from the main checkout; `--no-track` keeps the branch from tracking `main`, push it with `git push -u origin <branch>`). Work only in that worktree, never in the main checkout or another agent's worktree, so parallel agents do not switch branches under each other. In the new worktree run `npm ci` (dependencies and husky hooks) and copy `.env` from the main checkout. Remove the worktree with `git worktree remove` after the PR is merged.
- Fill in `.github/pull_request_template.md` (test cases, assumptions, checks).
- Claude never merges PRs. Claude reviews its own PR and fixes the findings, then a human reviews and merges. Start the next issue only from the updated `main`. When a PR is ready, reply with the PR URL and a short summary.
