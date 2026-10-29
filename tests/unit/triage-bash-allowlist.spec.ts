import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { checkCommand } from '../../scripts/lib/bash-allowlist.mts';

// Unit tests of the Bash allowlist hook of the ci-failure-triage subagent. Fixed temp roots, so
// the result does not depend on the machine.

const TEMP_ROOTS = ['/tmp', 'C:\\Users\\me\\AppData\\Local\\Temp'];
const SCRIPT = path.resolve(__dirname, '../../scripts/triage-bash-allowlist.mts');

/** Commands the agent needs for a triage (see .claude/agents/ci-failure-triage.md). */
const ALLOWED = [
  'gh run view 123 --log-failed',
  'gh run view 123 --json workflowName,jobs,url',
  'gh run list --branch 79-x --limit 5 --json databaseId,conclusion',
  'gh run download 123 -D /tmp/tmp.abc',
  'gh run download 123 --dir=/c/Users/me/AppData/Local/Temp/run',
  'gh pr view 82 --json headRefName,state,url',
  'gh issue list --state open --label bug --search "TC-002"',
  'mktemp -d',
  'unzip -o -q /tmp/t/trace.zip -d /tmp/t/x',
  'unzip -l /tmp/t/trace.zip',
  'node scripts/trace-summary.mts /tmp/t/a/trace.zip',
  'node scripts/check-no-token.mts /tmp/t/playwright-report /tmp/t/test-results',
  'curl -s https://developer.todoist.com/openapi.json -o /tmp/t/openapi.json',
  'curl -sSL https://developer.todoist.com/openapi.json > /tmp/t/openapi.json',
  "grep -rlE 'Bearer [0-9a-f]{40}' /tmp/t",
  'gh run view 1 --log-failed 2>&1 | grep -E "failed|passed" | head -20',
  'find /tmp/t -name trace.zip',
  'jq ".suites[0].specs" /tmp/t/test-results/results.json',
  'git diff origin/main -- src/schemas/openapi.json',
  'git log --oneline -5',
  'ls /tmp/t 2>/dev/null; cat /tmp/t/error-context.md',
  'rm -rf /tmp/tmp.abc',
  "rm -rf 'C:\\Users\\me\\AppData\\Local\\Temp\\run'",
];

/** Commands that change something, and shell tricks that would hide such a command. */
const BLOCKED = [
  'gh issue create --title x --body y',
  'gh pr comment 82 --body x',
  'gh run rerun 123',
  'gh api repos/o/r/issues -f title=x',
  'git push origin HEAD',
  'git commit -m x',
  'git -c core.pager=sh log',
  'git diff --output=CLAUDE.md',
  'git diff --ext-diff',
  'gh run download 123',
  'gh run download 123 -D artifacts',
  'echo x > CLAUDE.md',
  'cat a >> /tmp/../repo/file',
  'gh run view 1 | tee CLAUDE.md',
  'rm -rf /tmp',
  'rm -rf src',
  'rm -rf /tmp/*',
  'unzip /tmp/t/trace.zip -l',
  // Bash drops unquoted backslashes, so this is the relative path C:UsersmeAppData...
  'rm -rf C:\\Users\\me\\AppData\\Local\\Temp\\run',
  'rm -rf /tmp/t ../repo',
  "node -e \"require('fs').writeFileSync('x', '')\"",
  'node scripts/update-openapi.mts',
  'curl -s https://example.com',
  'curl -s -X POST https://developer.todoist.com/openapi.json',
  'curl -s https://developer.todoist.com/openapi.json -o openapi.json',
  'unzip -o /tmp/t/trace.zip',
  'find . -delete',
  'find /tmp/t -name x -exec rm {} ;',
  'sort -o CLAUDE.md /tmp/t/a',
  'gh run view 1 && gh issue create -t x',
  'gh run view 1; git push',
  'gh run view 1 || git push',
  'gh run view 1 | sh',
  'gh run view 1 | xargs rm',
  'bash -c "gh issue create"',
  'eval gh issue create',
  'gh run view $(gh issue create)',
  'gh run view `id`',
  'echo "$HOME"',
  'GH_TOKEN=x gh issue list',
  '(gh issue create)',
  'gh run view 1 &',
  'cat <<EOF > x',
  'diff <(ls) x',
  '/usr/bin/gh issue create',
  "echo 'unterminated",
  '',
];

test.describe('triage Bash allowlist', { tag: '@unit' }, () => {
  for (const command of ALLOWED) {
    test(`allows: ${command}`, () => {
      expect(checkCommand(command, TEMP_ROOTS)).toBeUndefined();
    });
  }

  for (const command of BLOCKED) {
    test(`blocks: ${command || '(empty)'}`, () => {
      expect(checkCommand(command, TEMP_ROOTS)).toEqual(expect.any(String));
    });
  }
});

test.describe('triage Bash allowlist hook', { tag: '@unit' }, () => {
  // The interface Claude Code uses: the tool call as JSON on stdin, exit code 2 blocks it.
  function runHook(input: string) {
    return spawnSync(process.execPath, [SCRIPT], { input, encoding: 'utf8' });
  }
  const bash = (command: string) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

  test('exits with 0 for an allowed command', () => {
    const result = runHook(bash('gh run view 123 --log-failed'));

    expect(result.status, result.stderr).toBe(0);
  });

  test('exits with 2 and gives the reason for a blocked command', () => {
    const result = runHook(bash('gh issue create --title x'));

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Blocked by the ci-failure-triage allowlist');
    expect(result.stderr).toContain('gh issue create');
  });

  test('blocks input it cannot read', () => {
    expect(runHook('not json').status).toBe(2);
  });

  test('ignores other tools', () => {
    const input = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'x' } });

    expect(runHook(input).status).toBe(0);
  });
});
