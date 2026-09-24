import { test as base } from '@playwright/test';

import { createApiContext, createTodoistApi, type User } from '../clients';

export interface UserWorkerFixtures {
  /** The account behind the API token, read once per worker. */
  account: User;
  /** IANA timezone of the account (tz_info.timezone). Use it for every date assertion. */
  accountTimezone: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- no test-scoped fixtures here
export const userTest = base.extend<{}, UserWorkerFixtures>({
  account: [
    async ({ playwright }, use) => {
      const request = await createApiContext(playwright.request);
      try {
        await use(await createTodoistApi(request).user.get());
      } finally {
        await request.dispose();
      }
    },
    { scope: 'worker' },
  ],

  accountTimezone: [
    async ({ account }, use) => {
      await use(account.tz_info.timezone);
    },
    { scope: 'worker' },
  ],
});
