import fs from 'node:fs';

import type { Suite } from '@playwright/test/reporter';
import type { Writer } from 'allure-js-commons/sdk/reporter';
import AllureReporter from 'allure-playwright';

import { isZip, redactBytes, redactJson, redactZip, secretValues } from '../utils/redact';

/**
 * The `allure-playwright` reporter, which writes nothing to `allure-results` before the token is
 * removed. Use it instead of `allure-playwright` in playwright.config.ts.
 *
 * allure-playwright writes while the test runs: an attachment made inside a `test.step()` and a
 * step with its error when the step ends. That is before redact-reporter.ts gets the result in
 * `onTestEnd`, so that reporter cannot remove the token from these files. Every write goes through
 * one `Writer` object, so this class wraps it with {@link RedactingWriter}.
 *
 * The writer is in a private field of `AllureReporter`, and the `writer` option cannot replace it
 * (`onBegin` always creates a new one). After an upgrade of allure-playwright, run
 * tests/unit/token-leak.spec.ts: it checks the Allure results, the report and the history.
 *
 * It also deletes the old `allure-results` folder before the run. allure-playwright does not,
 * and the report would then mix the results of several runs.
 */
export default class RedactAllureReporter extends AllureReporter {
  private readonly secrets = secretValues();

  constructor(options: ConstructorParameters<typeof AllureReporter>[0]) {
    super(options);
    // `playwright test --list` runs no test, but allure-playwright would write a skipped result
    // for every listed test in place of the results of the last run. Do nothing instead.
    if ((options as Record<string, unknown>)['_mode'] === 'list') {
      return { printsToStdio: () => false } as unknown as RedactAllureReporter;
    }
  }

  override onBegin(suite: Suite): void {
    // Reporters run only in the main process, so the workers never delete it.
    fs.rmSync(this.options.resultsDir ?? './allure-results', { recursive: true, force: true });
    super.onBegin(suite);
    if (this.secrets.length === 0) return;

    const runtime = (this as unknown as { allureRuntime?: { writer?: Writer } }).allureRuntime;
    if (runtime?.writer === undefined) {
      // Fail loudly: without the wrapper the token gets into allure-results.
      throw new Error(
        'redact-allure-reporter: allure-playwright has no allureRuntime.writer any more. ' +
          'Update the reporter for the new allure-playwright version.',
      );
    }
    runtime.writer = new RedactingWriter(runtime.writer, this.secrets);
  }
}

/** An Allure `Writer` that removes the secrets from everything before the inner writer saves it. */
export class RedactingWriter implements Writer {
  constructor(
    private readonly inner: Writer,
    private readonly secrets: readonly string[],
  ) {}

  writeResult(result: Parameters<Writer['writeResult']>[0]): void {
    this.inner.writeResult(redactJson(result, this.secrets));
  }

  writeGroup(group: Parameters<Writer['writeGroup']>[0]): void {
    this.inner.writeGroup(redactJson(group, this.secrets));
  }

  writeAttachment(distFileName: string, content: Buffer): void {
    this.inner.writeAttachment(distFileName, this.redactContent(content) ?? content);
  }

  /** Playwright attachments with a path, for example the trace. The source file is not changed. */
  writeAttachmentFromPath(distFileName: string, from: string): void {
    const redacted = this.redactContent(fs.readFileSync(from));
    if (redacted) this.inner.writeAttachment(distFileName, redacted);
    else this.inner.writeAttachmentFromPath(distFileName, from);
  }

  writeEnvironmentInfo(info: Parameters<Writer['writeEnvironmentInfo']>[0]): void {
    this.inner.writeEnvironmentInfo(redactJson(info, this.secrets));
  }

  writeCategoriesDefinitions(
    categories: Parameters<Writer['writeCategoriesDefinitions']>[0],
  ): void {
    this.inner.writeCategoriesDefinitions(redactJson(categories, this.secrets));
  }

  /** Errors and attachments outside of tests, for example from a failed `beforeAll`. */
  writeGlobals(distFileName: string, globals: Parameters<Writer['writeGlobals']>[1]): void {
    this.inner.writeGlobals(distFileName, redactJson(globals, this.secrets));
  }

  writePerformanceResults(
    distFileName: string,
    results: Parameters<NonNullable<Writer['writePerformanceResults']>>[1],
  ): void {
    this.inner.writePerformanceResults?.(distFileName, redactJson(results, this.secrets));
  }

  /** Returns the redacted content, or undefined when it has no secret. */
  private redactContent(content: Uint8Array): Buffer | undefined {
    if (!isZip(content)) return redactBytes(content, this.secrets);
    const redacted = redactZip(content, this.secrets);
    return redacted ? Buffer.from(redacted) : undefined;
  }
}
