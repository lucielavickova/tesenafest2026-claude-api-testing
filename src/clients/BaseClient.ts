import type { APIRequestContext, APIResponse } from '@playwright/test';

import { ApiError, RequestFailedError } from './ApiError';

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
}

/** Shape of every paginated list endpoint in API v1. */
export interface Page<T> {
  results: T[];
  next_cursor: string | null;
}

const PAGE_SIZE = 200;

/**
 * Shared base for the resource clients.
 *
 * The request context passed in already carries the base URL and the Authorization header
 * (see createApiContext), so paths are relative to the API root, for example `tasks/123`.
 * Typed methods throw ApiError on non-2xx responses. `send` returns the raw response for
 * tests that assert on error statuses.
 */
export abstract class BaseClient {
  protected readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  /** Sends a request and returns the raw response, whatever the status. */
  async send(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<APIResponse> {
    try {
      return await this.request.fetch(path, {
        method,
        ...(options.query && { params: withoutUndefined(options.query) }),
        ...(options.body !== undefined && { data: options.body }),
      });
    } catch (error) {
      throw new RequestFailedError(method, path, error);
    }
  }

  protected async getJson<T>(path: string, query?: QueryParams): Promise<T> {
    return this.json<T>('GET', path, query ? { query } : {});
  }

  protected async postJson<T>(path: string, body?: unknown): Promise<T> {
    return this.json<T>('POST', path, body === undefined ? {} : { body });
  }

  /** POST for endpoints that answer without a JSON body worth reading (close, reopen). */
  protected async postEmpty(path: string, body?: unknown): Promise<void> {
    await this.expectOk('POST', path, body === undefined ? {} : { body });
  }

  protected async deleteResource(path: string): Promise<void> {
    await this.expectOk('DELETE', path);
  }

  /** Follows `next_cursor` until the last page and returns all results. */
  protected async listAll<T>(path: string, query: QueryParams = {}): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null = null;
    do {
      const page: Page<T> = await this.getJson<Page<T>>(path, {
        ...query,
        limit: PAGE_SIZE,
        ...(cursor !== null && { cursor }),
      });
      items.push(...page.results);
      cursor = page.next_cursor;
    } while (cursor !== null);
    return items;
  }

  private async json<T>(method: HttpMethod, path: string, options: RequestOptions): Promise<T> {
    const response = await this.expectOk(method, path, options);
    return (await response.json()) as T;
  }

  private async expectOk(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<APIResponse> {
    const response = await this.send(method, path, options);
    if (!response.ok()) {
      throw new ApiError(response.status(), method, path, await response.text());
    }
    return response;
  }
}

function withoutUndefined(query: QueryParams): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}
