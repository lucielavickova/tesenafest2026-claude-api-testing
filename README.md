# Tesena Fest 2026 Workshop: AI-assisted API Testing with Claude Code and Superpowers
 This repo is going to be used for workshop "AI-assisted API Testing with Claude Code and Superpowers" at Tesena Fest 2026

## Application under test

- **Todoist**, a task manager: [www.todoist.com](https://www.todoist.com)
- Create **a free account** and use it for testing
- API docs: [https://developer.todoist.com/openapi.json](https://developer.todoist.com/openapi.json)

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
