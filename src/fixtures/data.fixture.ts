import {
  ApiError,
  type Comment,
  type CreateCommentPayload,
  type CreateLabelPayload,
  type CreateProjectPayload,
  type CreateTaskPayload,
  type Label,
  type Project,
  type Task,
  type TodoistApi,
} from '../clients';
import { buildComment, buildLabel, buildProject, buildTask, type CommentTarget } from '../data';
import { apiTest } from './api.fixture';

export type ResourceKind = 'project' | 'task' | 'label' | 'comment';

/**
 * Creates test data and deletes it after the test, also when the test fails.
 * Everything is created through the real API with `autotest-<run id>-` names.
 */
export interface TestData {
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

interface Tracked {
  kind: ResourceKind;
  id: string;
}

export const dataTest = apiTest.extend<DataFixtures>({
  testData: async ({ api }, use) => {
    const tracked: Tracked[] = [];
    const track = (kind: ResourceKind, id: string): void => {
      tracked.push({ kind, id });
    };

    await use({
      track,
      async createProject(overrides = {}) {
        const project = await api.projects.create(buildProject(overrides));
        track('project', project.id);
        return project;
      },
      async createTask(overrides = {}) {
        const task = await api.tasks.create(buildTask(overrides));
        track('task', task.id);
        return task;
      },
      async createLabel(overrides = {}) {
        const label = await api.labels.create(buildLabel(overrides));
        track('label', label.id);
        return label;
      },
      async createComment(target, overrides = {}) {
        const payload: CreateCommentPayload = buildComment(target, overrides);
        const comment = await api.comments.create(payload);
        track('comment', comment.id);
        return comment;
      },
    });

    await cleanUp(api, tracked);
  },
});

/**
 * Deletes in reverse order of creation (comments before tasks before projects).
 * 404 is fine: the test may have deleted the item, or a deleted project took its tasks along.
 * Other errors are collected, so one failure does not leave the rest behind.
 */
async function cleanUp(api: TodoistApi, tracked: readonly Tracked[]): Promise<void> {
  const failures: string[] = [];
  for (const { kind, id } of [...tracked].reverse()) {
    try {
      await deleteResource(api, kind, id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) continue;
      failures.push(`${kind} ${id}: ${error instanceof Error ? error.message : String(error)}`);
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
