import { test } from '@playwright/test';

/** A fake API token for unit tests. Never the real one. */
export const FAKE_TOKEN = 'fake-token-for-unit-tests';

/**
 * Saves an environment variable before each test of the current describe block and restores it
 * after, so a test can change it freely. Call it inside `test.describe`.
 */
export function restoreEnvAfterEach(name: string): void {
  let saved: string | undefined;

  test.beforeEach(() => {
    saved = process.env[name];
  });

  test.afterEach(() => {
    if (saved === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = saved;
  });
}
