/**
 * PreToolUse hook of the ci-failure-triage subagent (.claude/agents/ci-failure-triage.md). It
 * allows only the Bash commands the agent needs to read a failed CI run and blocks everything
 * else, so the agent cannot change the repository, GitHub or files outside the temp directory.
 *
 * Claude Code passes the tool call as JSON on stdin. Exit code 2 blocks the call and sends stderr
 * back to the agent. Anything the hook cannot parse is blocked.
 *
 * Usage: node scripts/triage-bash-allowlist.mts < tool-call.json
 *
 * The rules are in scripts/lib/bash-allowlist.mts. No imports from src/, so Node can run it directly.
 */
import fs from 'node:fs';

import { checkCommand } from './lib/bash-allowlist.mts';

function main(): void {
  let command: unknown;
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8')) as {
      tool_name?: unknown;
      tool_input?: { command?: unknown };
    };
    if (input.tool_name !== 'Bash') return;
    command = input.tool_input?.command;
  } catch {
    command = undefined;
  }

  const reason =
    typeof command === 'string' ? checkCommand(command) : 'the hook could not read the command';
  if (reason !== undefined) {
    console.error(
      `Blocked by the ci-failure-triage allowlist: ${reason}. This agent is read-only, see ` +
        '.claude/agents/ci-failure-triage.md and scripts/triage-bash-allowlist.mts.',
    );
    process.exitCode = 2;
  }
}

main();
