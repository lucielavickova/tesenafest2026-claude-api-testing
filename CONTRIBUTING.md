# Contributing

This repo is a showcase: an API test framework for Todoist, built in one day with Claude Code at Tesena Fest 2026. A small team maintains it. Its history (issues, pull requests and commits) is the record of how it was built.

## Try it in your own copy

To experiment with the framework or let Claude Code add tests, create your own repository with **Use this template** and follow [Try it yourself](README.md#try-it-yourself) in the README. Your copy needs its own free Todoist account and its own `TODOIST_API_TOKEN` secret.

## Report a bug or an idea

Open an issue and pick a form: **Bug report**, **Task** or **Test case**. Blank issues are turned off, so that every issue has the fields the workflow needs, for example the priority.

Do not open a public issue for a leaked token or another vulnerability. Report it privately through [a security advisory](https://github.com/lucielavickova/tesenafest2026-claude-api-testing/security/advisories/new).

## Pull requests from forks

Pull requests from forks cannot pass CI. The tests run against a real Todoist account, and GitHub does not give the `TODOIST_API_TOKEN` secret to workflows started from a fork. The PR workflow deliberately does not use `pull_request_target`, which would run code from the fork with that secret. If you have a change in mind, open an issue instead.

## Team workflow

The rules for the team are in [CLAUDE.md](CLAUDE.md). People and coding agents follow the same file: issue, then branch, then pull request, one git worktree per issue, commit messages that start with the issue ID, and a human review before every merge. [AGENTS.md](AGENTS.md) points other coding agents to the same file. The rules are not repeated here, so that the two files cannot drift apart.
