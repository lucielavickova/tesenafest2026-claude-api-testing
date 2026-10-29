// Types for the part of Playwright's internal runner module that redact-list-reporter.ts uses.
declare module 'playwright/lib/runner' {
  import type { Reporter } from '@playwright/test/reporter';

  /** The built-in `list` reporter. It takes the options of `['list', options]`. */
  export const ListReporter: new (options?: Record<string, unknown>) => Reporter;

  /** What `list` becomes with `playwright test --list`. */
  export const ListModeReporter: new (options?: Record<string, unknown>) => Reporter;
}
