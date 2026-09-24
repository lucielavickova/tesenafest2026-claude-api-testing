# Test automation project for Todoist

## Goal

- Quick feedback on every change and support for regression testing of the Todoist API.
- For the business, the key functionality is **working with tasks**. Task tests take priority.

## Scope

- **In scope:** test cases TC-001 to TC-009 and TC-011 to TC-015 from `Test Cases for automation.md`.
- **Out of scope:**
  - Sections. They will change in the next release.
  - TC-010, because it depends on sections.
  - Pull requests from forks. The PR workflow must not use `pull_request_target`.
- **Requirements:** there are no requirements or acceptance criteria. The OpenAPI spec
  (https://developer.todoist.com/openapi.json) is the reference for expected behavior.
  - Validate response bodies against the schema from the spec.
  - If the expected result of a test case is unclear (for example the status code in
    TC-015), call the API first to see how it actually behaves. Then assert that behavior
    and list it as an assumption in the PR description.

## Application and environments

- API base URL: https://api.todoist.com/api/v1/ (docs: https://developer.todoist.com/api/v1/)
- Only production is available now. Todoist has no public test or dev environment.
- Prepare for more environments with config only: one file per environment with the
  base URL, selected by the `TEST_ENV` variable (default `prod`). Don't build more than that.
- Tests run against a **free Todoist account**. Before automating a test case, check
  whether the feature is on the free plan. If it isn't, mark the test `test.fixme()`
  with the reason.

## Tools

- Playwright with TypeScript, using `APIRequestContext` (no browser).
- Node.js 24 LTS, npm. *(default)*
- ESLint with `typescript-eslint` and `eslint-plugin-playwright`.
- Prettier.
- Strict `tsconfig.json`.

## Security

- The API token is never committed.
  - Locally: `.env` file (gitignored), with a committed `.env.example` that lists the variable names.
  - In CI: GitHub Actions secret `TODOIST_API_TOKEN`.
- The repo is public, so the token must not appear in any artifact:
  - Traces are kept only for failed tests (`retain-on-failure`).
  - The `Authorization` header is redacted before traces and reports are saved.
  - Nothing prints the token to logs.

## Project structure

- Object oriented: one API client class per resource (projects, tasks, labels, comments),
  built on a shared base client that handles the base URL, auth and errors.
- Setup and cleanup live in Playwright fixtures, not in the tests.
- Test data is kept separate from tests (builders or factories in their own folder).
- Suggested layout *(default)*:
  ```
  config/          environment configs
  src/clients/     API client classes
  src/fixtures/    Playwright fixtures
  src/data/        test data builders
  src/schemas/     response schemas from the OpenAPI spec
  tests/           test files, grouped by resource or suite
  ```

## Test data

- Every test creates its own data and deletes it afterwards, including when the test fails.
- All created data uses the name prefix `autotest-<run id>-` so that it is easy to spot.
- A global setup deletes leftover `autotest-` data older than 1 hour. This keeps the free
  plan limits (for example the active project limit) from blocking later runs.
- Tests don't share data and don't depend on the order they run in.
- Date assertions use the timezone of the Todoist account (read from the user
  settings), not the runner's clock. This matters for TC-003, TC-009 and TC-013.

## Test case design

- Test name: the test ID and the name. Tags: the test ID and the suite. Example:
  ```ts
  test('TC-001 A new project is created with the entered name', {
    tag: ['@TC-001', '@smoke'],
  }, async ({ ... }) => { ... });
  ```
- Each step of a test case is a `test.step()` with a readable name.
- One behavior per test. Where a test case covers several inputs (TC-014, TC-015),
  use one test per input with the same TC ID and a suffix, for example `TC-015a`.
- Suites and tags:

  | Wave | Tag | Test cases |
  |------|-----|------------|
  | 1 | `@smoke` | TC-001 to TC-005 |
  | 2 | `@regression` | TC-006 to TC-009 |
  | 3 | `@e2e` | TC-011 |
  | 4 | `@regression` | TC-012, TC-013 |
  | 5 | `@negative` | TC-014, TC-015 |

## Pipelines (GitHub Actions)

- **On every PR:** lint, format check, type check, then all tests.
- **Every hour:** `@smoke` tests on `main`.
  - If a scheduled run fails, the workflow opens a GitHub issue labeled `smoke-failure`,
    or comments on the existing open one. *(default)*
- Runs share one Todoist account. Use a workflow `concurrency` group so that runs don't
  overlap, and use at most 2 workers in CI. *(default)*
- Retries: 1 in CI, 0 locally. Tests that pass only on retry are reported as flaky in the
  PR. *(default)*
- Artifacts: the Playwright HTML report (always) and traces (failed tests only), kept
  for 14 days. *(default)*

## Git workflow

- Every change follows: GitHub issue, then branch, then PR.
- Branch name: `<issue id>-<short-description>`, for example `12-tasks-client`. *(default)*
- Commit message: issue ID and a short summary, for example `#12 Add tasks API client`.
  A `commit-msg` hook enforces the format.
- `main` is protected by GitHub branch protection (a human sets it up). A local
  `pre-push` hook also blocks direct pushes to `main`. The hook only helps; it doesn't
  replace branch protection.
- A `pre-commit` hook runs ESLint and Prettier on staged files.
- Claude never merges PRs.
  - Claude runs a code review on its own PR and fixes the findings.
  - A human then reviews and merges.
  - Claude starts the next issue only from the updated `main`.
- When a PR is ready, Claude replies with the PR URL and a short summary of the changes.

## Definition of done (per PR)

- Lint, format check and type check pass.
- The new or changed tests pass in CI.
- Test data is cleaned up (no `autotest-` leftovers after the run).
- Assumptions about unclear behavior are listed in the PR description.
- Claude's code review findings are fixed or explained.
