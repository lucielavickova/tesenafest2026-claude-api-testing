## Summary

<!-- What this PR changes and why. -->

Closes #

## Type of change

- [ ] New or changed tests
- [ ] Bug fix
- [ ] Framework, CI or tooling
- [ ] Documentation

## Test cases

<!-- Test case IDs this PR automates or changes, e.g. TC-002, TC-003. Delete if not applicable. -->

## Assumptions

<!-- Behavior the OpenAPI spec does not define and that the tests assert as observed,
     e.g. "TC-015: the API returns 404 for a deleted task". Write "None" if there are none. -->

## How it was tested

- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm test` (or the affected specs) passes locally

## Checklist

- [ ] Every commit message starts with `#<issue id>`.
- [ ] New tests have a `@TC-xxx` tag, and `@smoke` where they belong in the smoke suite.
- [ ] Test data uses the builders, so it has the `autotest-` prefix and is cleaned up.
- [ ] Features missing from the free plan are marked `test.fixme()` with the reason.
- [ ] No API token or other secret in code, logs, screenshots or this description.
