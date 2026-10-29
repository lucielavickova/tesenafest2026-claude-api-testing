---
name: writing-todoist-api-tests
description: Use when adding or changing a spec file in this repo (automating a TC-xxx test case from "Test Cases for automation.md", a negative test, an e2e flow, or a flow recorded as a HAR from the Todoist web app).
---

# Writing Todoist API tests

## Overview

Conventions (naming, tags, fixtures, dates, git) are in `CLAUDE.md` and `brief.md`. This skill is
the workflow around them: where the test goes, how to find the expected behavior, how to prove
nothing leaks, and what to run before calling it done.

## Workflow

1. **Find the target file** in the table under "Test design conventions" in
   `docs/test-architecture-plan.md` (for example TC-003 joins TC-002 in
   `tests/tasks/create-task.spec.ts`, TC-015 goes to `tests/negative/task-validation.spec.ts`).
   Create the folder if it does not exist yet. Take the suite tag from the wave table in `brief.md`.
2. **Check the free plan** for the feature. A probe shows it: `403` with `PREMIUM_ONLY`, or a
   field that is accepted but stored as `null`. Missing: `test.fixme(true, '<reason>')` as the
   first line, and keep the full test body with real assertions, so it runs once the `fixme` line
   is removed on a premium account (TC-007c).
3. **Probe unclear behavior before writing asserts.** The test case file has titles only, so status
   codes, error bodies and edge cases (is a nonsense `due_string` rejected or ignored?) are unknown.
   Never guess a status code. Probe once, then assert what the API returned and list it under
   "Assumptions" in the PR. See "Probing" below.
4. **Write the test** starting from the closest existing spec in `tests/`:

   | Test needs                                 | Start from                            |
   | ------------------------------------------ | ------------------------------------- |
   | Create and load back, optional fields      | `tests/tasks/create-task.spec.ts`     |
   | A list scoped to a project                 | `tests/tasks/task-list.spec.ts`       |
   | Relative due dates, recurring tasks        | `tests/tasks/due-dates.spec.ts`       |
   | Close, reopen, "same task, not a new one"  | `tests/tasks/reopen-task.spec.ts`     |
   | A multi-step flow                          | `tests/e2e/project-lifecycle.spec.ts` |
   | Raw status codes, helpers shared in a spec | `tests/negative/auth.spec.ts`         |

   If nothing fits, build it from the patterns below.

5. **Verify** (all must pass, show the output):
   ```sh
   npm run lint && npm run format:check && npm run typecheck
   npx playwright test --grep @TC-xxx --repeat-each 2
   ```
   If the change also touches `src/` (a client method, a builder, a fixture), run
   `npm run test:unit` as well.

## Patterns

- **Three levels on every response:** 1) status code, 2) schema, 3) business values.
  - Status: a typed method (`api.tasks.create`) throws on non-2xx, so a success is covered. When
    the exact code matters (`204` on delete, `401`, `404`), use `send()` and
    `expect(res.status()).toBe(204)`.
  - Schema: see below. Skipped only for error bodies and empty `204` bodies.
  - Business values: assert the values the test sent or expects (`toBe(name)`,
    `toBe(project.id)`, `due?.date`), not `toBeTruthy()` alone. A test with a schema check only
    is not done.
- **Read back, not only the response.** After create/update/close, load the item again
  (`api.tasks.get(id)`) and assert the same fields. The response alone does not prove it was stored.
- **One check helper for the response and the reloaded item,** so the two steps cannot drift
  apart: `const checkFields = (task: typeof created): void => { ... }` (TC-007). To prove that
  nothing changed, compare a picked set of fields: `expect(stableFields(after)).toEqual(stableFields(before))`
  (TC-012).
- **Schema on every successful body:** `expect(x).toMatchSchema(Schema.task)`. The list methods
  (`api.tasks.list`) follow the pages and return a plain array, so check each item:
  `for (const task of listed) expect(task).toMatchSchema(Schema.task)`. `Schema.taskPage` and the
  other `*Page` schemas are only for a raw page body from `send('GET', 'tasks')`.
- **`test.step` can return a value:** `const task = await test.step('...', () => testData.createTask(...))`.
- **Exact list assertions** on ids: `expect(tasks.map((t) => t.id)).toEqual([task.id])`. With
  more than one item the order is not guaranteed, so sort both sides:
  `expect(listed.map((t) => t.id).sort()).toEqual(created.map((t) => t.id).sort())`.
- **Closed tasks:** `api.tasks.list` returns open tasks only. A closed task is still loaded by id:
  `api.tasks.get(id)` has `checked: true` and `completed_at` set; after a reopen `checked: false`
  and `completed_at: null`. Close and reopen answer `204` with an empty body, so use
  `api.tasks.send('POST', 'tasks/<id>/close')` when the status is part of the test.
- **Dates relative to today** (`tomorrow`, `every day`): compute them with `todayIn` /
  `tomorrowIn(accountTimezone)` right before the calls, compute again after them, and skip when the
  day changed in between. Assert after that guard (TC-009, TC-013):
  ```ts
  // eslint-disable-next-line playwright/no-skipped-test -- runtime guard for the midnight case
  test.skip(
    todayIn(accountTimezone) !== today,
    'The day changed in the account timezone during the test.',
  );
  ```
- **Optional fields under strict TS:** `created.due?.date`, and add a message to bare truthiness
  checks: `expect(created.id, 'id of the created task').toBeTruthy()`.

## Negative tests

- Use `api.tasks.send('POST', 'tasks', { body })` for the raw `APIResponse`.
- Wrong or missing token: `unauthenticatedApi` (no Authorization header) and
  `await apiWithToken('<fake token>')`. Use a fake token with the wrong shape, never a variant of
  the real one. Create the project with the valid `testData` and check the result with the valid
  `api`; only the request under test goes through the other client (TC-014).
- If the API unexpectedly accepts the request, `testData.track('task', id)` **before** any
  assertion, so cleanup still runs when the test fails.
- **Prove "nothing was created" in a scope the test owns.** Create a project with
  `testData.createProject()`, send the bad request with its `project_id`, then assert
  `api.tasks.list({ project_id })` is `[]`. Listing the whole account is slow and races with
  other runs on the shared account.
- Several inputs for one TC: one top-level test each, `TC-015a`, `TC-015b`, all tagged `@TC-015`.
  A helper shared by those tests stays in the spec file; type its parameters with
  `ApiFixtures['api']` and `TestData` from `src/fixtures`.
- "Required field missing": take the field from `required` of the request body in
  `src/schemas/openapi.json`, not from memory.
- Error bodies have no schema in the spec. Assert the status, and a body field only if the
  probe showed it. Do not invent an error shape. Level 3 (business values) of a negative test is
  the proof that nothing was created or changed.
- If the probe shows the API **accepts** the input (for example a nonsense `due_string`), the test
  asserts what happens instead, its title says so, and the PR lists it as an assumption and a
  possible bug. Do not keep a "rejected" test that is known to fail.

## Probing

A throwaway script in the scratchpad or `temp/` (gitignored), never in `tests/` or `scripts/`:

```ts
// probe.mts, run with: node probe.mts (from the repo root)
process.loadEnvFile('.env');
const res = await fetch('https://api.todoist.com/api/v1/tasks', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env['TODOIST_API_TOKEN']}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ content: '', project_id: '<id of an autotest- project>' }),
});
console.log(res.status, await res.text()); // status and body only, never headers
```

Send the probe into an `autotest-` project so anything accepted by mistake lands there, and
delete that project (`DELETE projects/<id>`) when done. Name the project like the tests do,
`TC-xxx-autotest-probe-w0-<UTC time>` (for example `TC-015-autotest-probe-w0-20261029T101503123Z`),
so the setup project deletes it after 1 hour if the delete is forgotten.

## Recorded web app flows (HAR)

The web app uses `POST /api/v1/sync` with batched commands, not the REST endpoints the clients
cover. Read the HAR for the **user's intent** (which steps, in which order, which data) and map
each step to a REST client call. Do not replay sync commands. Leave the HAR in `temp/`, since it
contains session cookies and must never be committed.

## Common mistakes

| Mistake                                                          | Fix                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Guessing `400` for an invalid request                            | Probe, assert what the API returned, write it down as an assumption |
| Only the create response is asserted                             | Add a step that loads the item by id                                |
| `api.tasks.list()` without a filter to prove nothing was created | Scope to a project the test owns                                    |
| Created via `send` and not tracked                               | `testData.track(kind, id)` right after a 2xx                        |
| Dates from `new Date()`                                          | `todayIn` / `tomorrowIn(accountTimezone)`                           |
| Several ids compared with `toEqual` in API order                 | `.sort()` both sides                                                |
| `Schema.taskPage` on the array from `api.tasks.list`             | `Schema.task` on each item                                          |
| Premium-only test deleted or left with an empty body             | `test.fixme(true, reason)` above the full test body                 |
| "Done" without running lint/typecheck/tests                      | Run the Verify block and quote the result                           |
