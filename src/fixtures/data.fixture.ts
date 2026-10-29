import {
  ApiError,
  RequestFailedError,
  type Comment,
  type CreateCommentPayload,
  type CreateLabelPayload,
  type CreateProjectPayload,
  type CreateTaskPayload,
  type Label,
  type Project,
  type Task,
  type TaskListQuery,
  type TodoistApi,
} from '../clients';
import {
  buildComment,
  buildLabel,
  buildProject,
  buildTask,
  isTestDataName,
  testCaseIdOf,
  generateUniqueName,
  type CommentTarget,
} from '../data';
import { apiTest } from './api.fixture';

export type ResourceKind = 'project' | 'task' | 'label' | 'comment';

/**
 * Creates test data and deletes it after the test, also when the test fails.
 * Everything is created through the real API with `<TC ID>-autotest-<run id>-` names,
 * so a leftover can be traced back to the test case that created it.
 */
export interface TestData {
  /** Test case ID from the test's `@TC-...` tag or title, for example `TC-002`. */
  testCaseId: string | undefined;
  /** `<TC ID>-autotest-<run id>-w<worker>-<UTC time>`, for values the test builds itself. */
  generateUniqueName(): string;
  createProject(overrides?: Partial<CreateProjectPayload>): Promise<Project>;
  createTask(overrides?: Partial<CreateTaskPayload>): Promise<Task>;
  createLabel(overrides?: Partial<CreateLabelPayload>): Promise<Label>;
  createComment(target: CommentTarget, overrides?: { content?: string }): Promise<Comment>;
  /** Registers something the test created itself (for example through `send`) for cleanup. */
  track(kind: ResourceKind, id: string): void;
}

export interface DataFixtures {
  testData: TestData;
}

/** An item to delete: by id, or by a lookup that runs at cleanup (see `createAndTrack`). */
type Tracked =
  { kind: ResourceKind; id: string } | { kind: ResourceKind; find: () => Promise<string[]> };

export const dataTest = apiTest.extend<DataFixtures>({
  testData: async ({ api }, use, testInfo) => {
    const { testData, cleanUp } = createTestData(api, testCaseIdOf(testInfo));
    await use(testData);
    await cleanUp();
  },
});

/**
 * The `testData` fixture without Playwright, so its logic can be tested with a mocked `api`.
 * `cleanUp` deletes everything the test data created or tracked.
 */
export function createTestData(
  api: TodoistApi,
  testCaseId: string | undefined,
): { testData: TestData; cleanUp: () => Promise<void> } {
  const tracked: Tracked[] = [];
  const track = (kind: ResourceKind, id: string): void => {
    tracked.push({ kind, id });
  };

  /**
   * Creates an item and registers it for cleanup. If the request gets no response or a 5xx,
   * the server may still have stored the item. Then a lookup by the name that was sent is
   * registered instead, and the error is rethrown. The lookup runs at cleanup, so it also finds
   * an item that the server stores later, as long as that happens before the test ends.
   */
  async function createAndTrack<T extends { id: string }>(
    kind: ResourceKind,
    name: string,
    create: () => Promise<T>,
    list: () => Promise<readonly { id: string; name: string }[]>,
  ): Promise<T> {
    try {
      const item = await create();
      track(kind, item.id);
      return item;
    } catch (error) {
      // A 4xx means the server rejected the item. Only `autotest-` names are looked up, so a
      // lookup can never delete data that the tests did not create.
      if (mayHaveBeenStored(error) && isTestDataName(name)) {
        tracked.push({
          kind,
          find: async () =>
            (await list()).filter((item) => item.name === name).map((item) => item.id),
        });
      }
      throw error;
    }
  }

  const testData: TestData = {
    testCaseId,
    generateUniqueName: () => generateUniqueName(testCaseId),
    track,
    async createProject(overrides = {}) {
      const payload = buildProject(overrides, testCaseId);
      return createAndTrack(
        'project',
        payload.name,
        () => api.projects.create(payload),
        () => api.projects.list(),
      );
    },
    async createTask(overrides = {}) {
      const payload = buildTask(overrides, testCaseId);
      // Without `parent_id` and `project_id` the task goes to the Inbox.
      const inboxQuery = async (): Promise<TaskListQuery> => {
        const { inbox_project_id: inboxId } = await api.user.get();
        return inboxId === null ? {} : { project_id: inboxId };
      };
      return createAndTrack(
        'task',
        payload.content,
        () => api.tasks.create(payload),
        async () => {
          const query = payload.parent_id
            ? { parent_id: payload.parent_id }
            : payload.project_id
              ? { project_id: payload.project_id }
              : await inboxQuery();
          return (await api.tasks.list(query)).map((task) => ({ id: task.id, name: task.content }));
        },
      );
    },
    async createLabel(overrides = {}) {
      const payload = buildLabel(overrides, testCaseId);
      return createAndTrack(
        'label',
        payload.name,
        () => api.labels.create(payload),
        () => api.labels.list(),
      );
    },
    async createComment(target, overrides = {}) {
      const payload: CreateCommentPayload = buildComment(target, overrides, testCaseId);
      return createAndTrack(
        'comment',
        payload.content,
        () => api.comments.create(payload),
        async () =>
          (await api.comments.list(target)).map((comment) => ({
            id: comment.id,
            name: comment.content,
          })),
      );
    },
  };

  return { testData, cleanUp: () => cleanUp(api, tracked) };
}

/** No response, or a 5xx that the server may have sent after it stored the item. */
function mayHaveBeenStored(error: unknown): boolean {
  return error instanceof RequestFailedError || (error instanceof ApiError && error.status >= 500);
}

/**
 * Deletes in reverse order of creation (comments before tasks before projects).
 * 404 is fine, for deletes and lookups: the test may have deleted the item, or a deleted project
 * took its tasks along.
 * Other errors are collected, so one failure does not leave the rest behind.
 */
async function cleanUp(api: TodoistApi, tracked: readonly Tracked[]): Promise<void> {
  const failures: string[] = [];
  for (const entry of [...tracked].reverse()) {
    let ids: string[];
    try {
      ids = 'id' in entry ? [entry.id] : await entry.find();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) continue;
      failures.push(`${entry.kind} lookup: ${messageOf(error)}`);
      continue;
    }
    for (const id of ids) {
      try {
        await deleteResource(api, entry.kind, id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) continue;
        failures.push(`${entry.kind} ${id}: ${messageOf(error)}`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`Test data cleanup failed:\n${failures.join('\n')}`);
  }
}

async function deleteResource(api: TodoistApi, kind: ResourceKind, id: string): Promise<void> {
  switch (kind) {
    case 'project':
      return api.projects.delete(id);
    case 'task':
      return api.tasks.delete(id);
    case 'label':
      return api.labels.delete(id);
    case 'comment':
      return api.comments.delete(id);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
