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
