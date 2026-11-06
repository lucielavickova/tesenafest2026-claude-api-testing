import type { TestStep } from '@playwright/test/reporter';
import { unzipSync, zipSync, type Zippable } from 'fflate';

import { findApiToken } from '../env';

export const REDACTED = '[REDACTED]';

// Shorter values could match unrelated text and are not real tokens.
const MIN_SECRET_LENGTH = 8;

/** Secret values that must never appear in logs, reports or traces. */
export function secretValues(): string[] {
  const token = findApiToken();
  return token !== undefined && token.length >= MIN_SECRET_LENGTH ? [token] : [];
}

/** Replaces every secret value in the text with {@link REDACTED}. */
export function redact(text: string, secrets: readonly string[] = secretValues()): string {
  return secrets.reduce((result, secret) => result.replaceAll(secret, REDACTED), text);
}

/** Replaces every secret value in binary data. Returns undefined when nothing was found. */
export function redactBytes(
  data: Uint8Array,
  secrets: readonly string[] = secretValues(),
): Buffer | undefined {
  let buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  let changed = false;
  const replacement = Buffer.from(REDACTED);
  for (const secret of secrets) {
    const needle = Buffer.from(secret);
    let index = buffer.indexOf(needle);
    while (index !== -1) {
      buffer = Buffer.concat([
        buffer.subarray(0, index),
        replacement,
        buffer.subarray(index + needle.length),
      ]);
      changed = true;
      index = buffer.indexOf(needle, index + replacement.length);
    }
  }
  return changed ? buffer : undefined;
}

/** True when the data starts with the signature of a zip archive, for example a trace. */
export function isZip(data: Uint8Array): boolean {
  return data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
}

/**
 * Replaces every secret value in every entry of a zip archive. Returns undefined when nothing was
 * found, so the caller can keep the original file.
 */
export function redactZip(
  data: Uint8Array,
  secrets: readonly string[] = secretValues(),
): Uint8Array | undefined {
  const entries = unzipSync(data);
  let changed = false;
  const output: Zippable = {};
  for (const [name, content] of Object.entries(entries)) {
    const redacted = redactBytes(content, secrets);
    if (redacted) changed = true;
    output[name] = redacted ?? content;
  }
  return changed ? zipSync(output) : undefined;
}

/**
 * Returns a copy of a JSON value (objects, arrays, strings, numbers) with every secret value
 * replaced in all strings, keys included.
 */
export function redactJson<T>(value: T, secrets: readonly string[] = secretValues()): T {
  return redactJsonValue(value, secrets) as T;
}

function redactJsonValue(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === 'string') return redact(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactJsonValue(item, secrets));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        redact(key, secrets),
        redactJsonValue(item, secrets),
      ]),
    );
  }
  return value;
}

/** Redacts a chunk of test output, as reporters get it in `onStdOut` and `onStdErr`. */
export function redactChunk(
  chunk: string | Buffer,
  secrets: readonly string[] = secretValues(),
): string | Buffer {
  return typeof chunk === 'string'
    ? redact(chunk, secrets)
    : (redactBytes(chunk, secrets) ?? chunk);
}

/**
 * Redacts the title of a step in place. The title is read-only in the reporter API, but other
 * reporters read it later, for example the HTML reporter in `onEnd`.
 */
export function redactStepTitle(step: TestStep, secrets: readonly string[] = secretValues()): void {
  (step as { title: string }).title = redact(step.title, secrets);
}
