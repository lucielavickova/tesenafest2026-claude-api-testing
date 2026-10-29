import { expect, test } from '@playwright/test';

import { ApiError, RequestFailedError, type TodoistApi } from '../../src/clients';
import { createTestData } from '../../src/fixtures/data.fixture';

// Unit tests of the testData fixture logic. They use an in-memory fake of the API, not Todoist.

type Kind = 'projects' | 'tasks' | 'labels' | 'comments';

interface StoredItem {
  id: string;
  name?: string;
  content?: string;
  task_id?: string;
  project_id?: string;
}

/** When the server stores an item whose create fails: never, before the error, or later. */
type Stored = 'never' | 'before' | 'later';

/**
 * Stores what `create` gets. `failNext` makes the next create of a kind throw the given error.
 * Items stored `later` appear only after `storeLate()`, like a commit after the client timed out.
 */
function fakeApi() {
  const items: Record<Kind, StoredItem[]> = { projects: [], tasks: [], labels: [], comments: [] };
  const failures: Partial<Record<Kind, { error: Error; stored: Stored } | undefined>> = {};
  const late: [Kind, StoredItem][] = [];
  const listCalls: Record<Kind, Partial<StoredItem>[]> = {
    projects: [],
    tasks: [],
    labels: [],
    comments: [],
  };
  let nextId = 1;

  const client = (kind: Kind) => ({
    create: (payload: Omit<StoredItem, 'id'>) => {
      // The API puts a task without a project or parent into the Inbox.
      const inInbox = kind === 'tasks' && !payload.project_id && !payload.task_id;
      const item = { id: String(nextId++), ...payload, ...(inInbox && { project_id: 'inbox' }) };
      const failure = failures[kind];
      failures[kind] = undefined;
      if (failure?.stored === 'later') late.push([kind, item]);
      else if (failure?.stored !== 'never') items[kind].push(item);
      return failure ? Promise.reject(failure.error) : Promise.resolve(item);
    },
    list: (query: Partial<StoredItem> = {}) => {
      listCalls[kind].push(query);
      const filters = Object.entries(query) as [keyof StoredItem, string][];
      return Promise.resolve(
        items[kind].filter((item) => filters.every(([key, value]) => item[key] === value)),
      );
    },
    delete: (id: string) => {
      const index = items[kind].findIndex((item) => item.id === id);
      if (index === -1) return Promise.reject(new ApiError(404, 'DELETE', `${kind}/${id}`, ''));
      items[kind].splice(index, 1);
      return Promise.resolve();
    },
  });

  const api = {
    projects: client('projects'),
    tasks: client('tasks'),
    labels: client('labels'),
    comments: client('comments'),
    user: { get: () => Promise.resolve({ inbox_project_id: 'inbox' }) },
  } as unknown as TodoistApi;

  return {
    api,
    items,
    listCalls,
    failNext(kind: Kind, error: Error, stored: Stored = 'before') {
      failures[kind] = { error, stored };
    },
    storeLate() {
      for (const [kind, item] of late.splice(0)) items[kind].push(item);
    },
  };
}

const noResponse = (path: string) =>
  new RequestFailedError('POST', path, new Error('Timeout 30000ms exceeded.'));

test.describe('testData cleanup after a failed create', { tag: '@unit' }, () => {
  test('a project stored without a response is deleted at cleanup', async () => {
    const fake = fakeApi();
    const { testData, cleanUp } = createTestData(fake.api, 'TC-001');
    fake.failNext('projects', noResponse('projects'));

    await test.step('The create throws the original error', async () => {
      await expect(testData.createProject()).rejects.toThrow(RequestFailedError);
    });

    expect(fake.items.projects).toHaveLength(1);

    await test.step('Cleanup finds the project by name and deletes it', async () => {
      await cleanUp();
      expect(fake.items.projects).toHaveLength(0);
    });
  });

  test('a label stored before a 5xx is deleted at cleanup', async () => {
    const fake = fakeApi();
    const { testData, cleanUp } = createTestData(fake.api, 'TC-001');
    fake.failNext('labels', new ApiError(503, 'POST', 'labels', 'Service Unavailable'));

    await expect(testData.createLabel()).rejects.toThrow(ApiError);
    await cleanUp();

    expect(fake.items.labels).toHaveLength(0);
  });

  test('a task the server stores after the client gave up is found at cleanup', async () => {
    const fake = fakeApi();
    const { testData, cleanUp } = createTestData(fake.api, 'TC-002');
    const project = await testData.createProject();
    await testData.createTask({ project_id: project.id, content: testData.uniqueName('other') });
    fake.failNext('tasks', noResponse('tasks'), 'later');

    await expect(testData.createTask({ project_id: project.id })).rejects.toThrow(
      RequestFailedError,
    );
    expect(fake.items.tasks).toHaveLength(1);
    fake.storeLate();
    await cleanUp();

    expect(fake.items.tasks).toHaveLength(0);
    expect(fake.items.projects).toHaveLength(0);
  });

  test('a comment stored without a response is deleted at cleanup', async () => {
    const fake = fakeApi();
    const { testData, cleanUp } = createTestData(fake.api, 'TC-003');
    const task = await testData.createTask();
    fake.failNext('comments', noResponse('comments'));

    await expect(testData.createComment({ task_id: task.id })).rejects.toThrow(RequestFailedError);
    await cleanUp();

    expect(fake.items.comments).toHaveLength(0);
    expect(fake.items.tasks).toHaveLength(0);
  });

  test('an Inbox task stored without a response is looked up in the Inbox only', async () => {
    const fake = fakeApi();
    const { testData, cleanUp } = createTestData(fake.api, 'TC-002');
    fake.failNext('tasks', noResponse('tasks'));

    await expect(testData.createTask()).rejects.toThrow(RequestFailedError);
    await cleanUp();

    expect(fake.listCalls.tasks).toEqual([{ project_id: 'inbox' }]);
    expect(fake.items.tasks).toHaveLength(0);
  });

  test('a lookup that gets 404 is not a cleanup failure', async () => {
    const fake = fakeApi();
    const { testData, cleanUp } = createTestData(fake.api, 'TC-003');
    fake.failNext('comments', noResponse('comments'), 'never');
    await expect(testData.createComment({ task_id: 'gone' })).rejects.toThrow(RequestFailedError);
    fake.api.comments.list = () => Promise.reject(new ApiError(404, 'GET', 'comments', ''));

    await expect(cleanUp()).resolves.toBeUndefined();
  });

  test('a 4xx is not followed by a lookup', async () => {
    const fake = fakeApi();
    const { testData, cleanUp } = createTestData(fake.api, 'TC-001');
    fake.failNext('projects', new ApiError(400, 'POST', 'projects', 'Bad Request'), 'never');

    await expect(testData.createProject()).rejects.toThrow(ApiError);
    await cleanUp();

    expect(fake.listCalls.projects).toHaveLength(0);
  });

  test('a name without the autotest- prefix is not looked up', async () => {
    const fake = fakeApi();
    const { testData, cleanUp } = createTestData(fake.api, 'TC-001');
    fake.failNext('projects', noResponse('projects'));

    await expect(testData.createProject({ name: 'Inbox copy' })).rejects.toThrow(
      RequestFailedError,
    );
    await cleanUp();

    expect(fake.listCalls.projects).toHaveLength(0);
    expect(fake.items.projects).toHaveLength(1);
  });

  test('a failed lookup is reported and the other items are still deleted', async () => {
    const fake = fakeApi();
    const { testData, cleanUp } = createTestData(fake.api, 'TC-001');
    await testData.createLabel();
    fake.failNext('projects', noResponse('projects'));
    await expect(testData.createProject()).rejects.toThrow(RequestFailedError);
    fake.api.projects.list = () => Promise.reject(noResponse('projects'));

    await expect(cleanUp()).rejects.toThrow(/project lookup: POST projects got no response/);
    expect(fake.items.labels).toHaveLength(0);
  });
});
