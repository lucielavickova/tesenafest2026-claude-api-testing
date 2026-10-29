# Contributing

This repo is a showcase: an API test framework for Todoist, built in one day with Claude Code at Tesena Fest 2026. A small team maintains it. The history of the [original repository](https://github.com/lucielavickova/tesenafest2026-claude-api-testing) (issues, pull requests and commits) is the record of how it was built. A copy made from the template starts with one commit and has none of that history.

## Try it in your own copy

To experiment with the framework or let Claude Code add tests, create your own repository with **Use this template** (or fork it) and follow [Try it yourself](README.md#try-it-yourself) in the README. Your copy needs its own free Todoist account and its own `TODOIST_API_TOKEN` secret. With that secret, CI runs in your copy as it does here.

## Report a bug or an idea

Open an issue and pick a form: **Bug report**, **Task** or **Test case automation**. Blank issues are turned off, so that every issue has the fields the workflow needs, for example the priority.

Do not open a public issue for a leaked token or another vulnerability. Report it privately through [a security advisory](../../security/advisories/new).

## Pull requests from forks

Pull requests from a fork to this repository cannot pass CI. The tests run against a real Todoist account, and GitHub does not give the `TODOIST_API_TOKEN` secret to `pull_request` workflows started from a fork. The PR workflow deliberately does not use `pull_request_target`: it runs with the secret, so checking out the fork's code in it would expose the token to that code. If you have a change in mind, open an issue instead.

## Team workflow

The rules for the team are in [CLAUDE.md](CLAUDE.md), and people and coding agents follow the same file. [AGENTS.md](AGENTS.md) points other coding agents to it. The rules are not repeated here, so that the two files cannot drift apart.
