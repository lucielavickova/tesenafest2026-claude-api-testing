import fs from 'node:fs';

import type {
  Reporter,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';
import { unzipSync, zipSync, type Zippable } from 'fflate';

import { redact, redactBytes, redactChunk, redactStepTitle, secretValues } from '../utils/redact';

/**
 * Removes the API token from everything a test result carries, before any other reporter or
 * artifact upload sees it.
 *
 * Playwright records request headers in traces (network log, call log, call parameters) and in
 * error messages, and it has no option to hide them. This reporter must be listed first in
 * playwright.config.ts: reporters get `onTestEnd` one after another in that order, and the HTML
 * reporter copies attachments only in `onEnd`. Everything here is synchronous on purpose, because
 * Playwright does not wait for a promise returned from `onTestEnd`.
 *
 * The live console output of the `list` reporter comes before `onTestEnd`, so this reporter
 * cannot redact it. redact-list-reporter.ts does that.
 */
export default class RedactReporter implements Reporter {
  private readonly secrets = secretValues();

  printsToStdio(): boolean {
    return false;
  }

  /** Errors outside of tests, for example when a spec file cannot be loaded. */
  onError(error: TestError): void {
    if (this.secrets.length > 0) this.redactError(error);
  }

  /** Before reporters that print steps as they start, such as `list` with `printSteps`. */
  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (this.secrets.length > 0) redactStepTitle(step, this.secrets);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (this.secrets.length === 0) return;

    // The HTML and JSON reporters show both, for example a skip reason.
    this.redactAnnotations(test.annotations);
    this.redactAnnotations(result.annotations);

    for (const attachment of result.attachments) {
      if (attachment.body) {
        attachment.body = redactBytes(attachment.body, this.secrets) ?? attachment.body;
      }
      if (attachment.path && fs.existsSync(attachment.path)) {
        this.redactFile(attachment.path, attachment.contentType);
      }
    }

    result.errors.forEach((error) => {
      this.redactError(error);
    });
    if (result.error) this.redactError(result.error);
    result.steps.forEach((step) => {
      this.redactStep(step);
    });

    result.stdout = result.stdout.map((chunk) => redactChunk(chunk, this.secrets));
    result.stderr = result.stderr.map((chunk) => redactChunk(chunk, this.secrets));
  }

  private redactFile(filePath: string, contentType: string): void {
    const data = fs.readFileSync(filePath);
    const redacted =
      contentType === 'application/zip' || filePath.endsWith('.zip')
        ? this.redactZip(data)
        : redactBytes(data, this.secrets);
    if (redacted) fs.writeFileSync(filePath, redacted);
  }

  private redactZip(data: Buffer): Uint8Array | undefined {
    const entries = unzipSync(data);
    let changed = false;
    const output: Zippable = {};
    for (const [name, content] of Object.entries(entries)) {
      const redacted = redactBytes(content, this.secrets);
      if (redacted) changed = true;
      output[name] = redacted ?? content;
    }
    return changed ? zipSync(output) : undefined;
  }

  private redactError(error: TestError): void {
    if (error.message !== undefined) error.message = redact(error.message, this.secrets);
    if (error.stack !== undefined) error.stack = redact(error.stack, this.secrets);
    if (error.value !== undefined) error.value = redact(error.value, this.secrets);
    if (error.snippet !== undefined) error.snippet = redact(error.snippet, this.secrets);
    if (error.cause) this.redactError(error.cause);
  }

  private redactStep(step: TestStep): void {
    redactStepTitle(step, this.secrets);
    this.redactAnnotations(step.annotations);
    if (step.error) this.redactError(step.error);
    step.steps.forEach((child) => {
      this.redactStep(child);
    });
  }

  private redactAnnotations(annotations: TestCase['annotations']): void {
    for (const annotation of annotations) {
      if (annotation.description !== undefined) {
        annotation.description = redact(annotation.description, this.secrets);
      }
    }
  }
}
