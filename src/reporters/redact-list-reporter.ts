import type { TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { ListModeReporter, ListReporter } from 'playwright/lib/runner';

import { redactChunk, redactStepTitle, secretValues } from '../utils/redact';

/**
 * The built-in `list` reporter, which gets the test output and the step titles only after the
 * token is removed. Use it instead of `list` in playwright.config.ts.
 *
 * The `list` reporter prints the output of a test as it comes (`onStdOut`, `onStdErr`), before
 * the redaction reporter can change it in `onTestEnd`, and it keeps the same chunks for the
 * failure summary at the end. A reporter cannot change the chunk that the next reporter gets,
 * because strings cannot be changed in place, so this class redacts the chunk before the `list`
 * code sees it.
 *
 * `ListReporter` and `ListModeReporter` are not a public Playwright API. After a Playwright upgrade, run
 * tests/unit/token-leak.spec.ts: it checks the console output of this reporter.
 */
export default class RedactListReporter extends ListReporter {
  private readonly secrets = secretValues();

  constructor(options: Record<string, unknown> = {}) {
    super(options);
    // `playwright test --list` replaces the built-in `list` with a reporter that only lists the
    // tests, but not a custom reporter. Do the same: nothing runs, so there is nothing to redact.
    if (options['_mode'] === 'list') {
      return new ListModeReporter(options) as unknown as RedactListReporter;
    }
  }

  override onStdOut(
    chunk: string | Buffer,
    test: TestCase | undefined,
    result: TestResult | undefined,
  ): void {
    super.onStdOut?.(redactChunk(chunk, this.secrets), test, result);
  }

  override onStdErr(
    chunk: string | Buffer,
    test: TestCase | undefined,
    result: TestResult | undefined,
  ): void {
    super.onStdErr?.(redactChunk(chunk, this.secrets), test, result);
  }

  /** `list` prints the step title here, with or without `printSteps`. */
  override onStepBegin(test: TestCase, result: TestResult, step: TestStep): void {
    if (this.secrets.length > 0) redactStepTitle(step, this.secrets);
    super.onStepBegin?.(test, result, step);
  }
}
