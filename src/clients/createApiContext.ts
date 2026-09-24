import { request, type APIRequestContext } from '@playwright/test';

import { config } from '../../config';
import { getApiToken } from '../env';

type RequestFactory = Pick<typeof request, 'newContext'>;

/**
 * Creates a request context for the Todoist API, authenticated with the personal API token.
 * There is no login: the token is sent as a Bearer header on every request.
 *
 * Pass the `playwright.request` fixture as the factory inside tests, so the calls show up in the
 * test trace (the reporter in src/reporters redacts the token there). The caller disposes the
 * context.
 */
export async function createApiContext(
  factory: RequestFactory = request,
  token: string = getApiToken(),
): Promise<APIRequestContext> {
  return factory.newContext({
    baseURL: config.baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/** Creates a request context with no Authorization header at all (negative auth tests). */
export async function createUnauthenticatedContext(
  factory: RequestFactory = request,
): Promise<APIRequestContext> {
  return factory.newContext({ baseURL: config.baseURL });
}
