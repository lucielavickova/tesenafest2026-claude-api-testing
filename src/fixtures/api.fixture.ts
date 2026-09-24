import { test as base, type APIRequestContext } from '@playwright/test';

import {
  createApiContext,
  createTodoistApi,
  createUnauthenticatedContext,
  type TodoistApi,
} from '../clients';

export interface ApiFixtures {
  /** Request context authenticated with the account's API token. */
  apiRequest: APIRequestContext;
  /** Resource clients on top of `apiRequest`. */
  api: TodoistApi;
  /** Resource clients that send no Authorization header (TC-014). Use `send` for raw responses. */
  unauthenticatedApi: TodoistApi;
  /** Resource clients that send the given token instead of the real one (TC-014). */
  apiWithToken: (token: string) => Promise<TodoistApi>;
}

export const apiTest = base.extend<ApiFixtures>({
  // Contexts come from the `playwright.request` fixture, so their calls are in the test trace.
  apiRequest: async ({ playwright }, use) => {
    const request = await createApiContext(playwright.request);
    await use(request);
    await request.dispose();
  },

  api: async ({ apiRequest }, use) => {
    await use(createTodoistApi(apiRequest));
  },

  unauthenticatedApi: async ({ playwright }, use) => {
    const request = await createUnauthenticatedContext(playwright.request);
    await use(createTodoistApi(request));
    await request.dispose();
  },

  apiWithToken: async ({ playwright }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async (token) => {
      const request = await createApiContext(playwright.request, token);
      contexts.push(request);
      return createTodoistApi(request);
    });
    await Promise.all(contexts.map((request) => request.dispose()));
  },
});
