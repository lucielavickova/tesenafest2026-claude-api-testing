import fs from 'node:fs';

import type {
  Reporter,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';
import { unzipSync, zipSync, type Zippable } from 'fflate';

import { redact, redactBytes, secretValues } from '../utils/redact';

/**
 * Removes the API token from everything a test result carries, before any other reporter or
 * artifact upload sees it.
 *
 * Playwright records request headers in traces (network log, call log, call parameters) and in
 * error messages, and it has no option to hide them. This reporter must be listed first in
 * playwright.config.ts: reporters get `onTestEnd` one after another in that order, and the HTML
 * reporter copies attachments only in `onEnd`. Everything here is synchronous on purpose, because
 * Playwright does not wait for a promise returned from `onTestEnd`.
 */
export default class RedactReporter implements Reporter {
  private readonly secrets = secretValues();

  printsToStdio(): boolean {
    return false;
  }

  /** Errors outside of tests, for example from the global setup. */
  onError(error: TestError): void {
    if (this.secrets.length > 0) this.redactError(error);
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    if (this.secrets.length === 0) return;

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

    result.stdout = result.stdout.map((chunk) => this.redactChunk(chunk));
    result.stderr = result.stderr.map((chunk) => this.redactChunk(chunk));
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
    if (step.error) this.redactError(step.error);
    step.steps.forEach((child) => {
      this.redactStep(child);
    });
  }

  private redactChunk(chunk: string | Buffer): string | Buffer {
    return typeof chunk === 'string'
      ? redact(chunk, this.secrets)
      : (redactBytes(chunk, this.secrets) ?? chunk);
  }
}
