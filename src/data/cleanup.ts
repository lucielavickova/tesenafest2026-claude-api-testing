import { ApiError, type TodoistApi } from '../clients';
import { TEST_DATA_PREFIX, parseRunTimestamp } from './runId';

/** Leftovers older than this are removed. Younger ones may belong to a run still in progress. */
export const STALE_AFTER_MS = 60 * 60 * 1000;

export interface CleanupSummary {
  projects: number;
  labels: number;
  tasks: number;
}

/**
 * True for `autotest-` names older than {@link STALE_AFTER_MS}.
 * An `autotest-` name without a readable run id is treated as stale.
 */
export function isStale(name: string, now: Date = new Date()): boolean {
  if (!name.startsWith(TEST_DATA_PREFIX)) return false;
  const createdAt = parseRunTimestamp(name);
  return createdAt === undefined || now.getTime() - createdAt.getTime() > STALE_AFTER_MS;
}

/**
 * Deletes stale `autotest-` projects (with their tasks and comments), labels and Inbox tasks.
 * Keeps the free plan limits, for example the number of active projects, from blocking runs.
 */
export async function deleteStaleTestData(
  api: TodoistApi,
  now: Date = new Date(),
): Promise<CleanupSummary> {
  const projects = (await api.projects.list()).filter((project) => isStale(project.name, now));
  for (const project of projects) await ignoreNotFound(api.projects.delete(project.id));

  const labels = (await api.labels.list()).filter((label) => isStale(label.name, now));
  for (const label of labels) await ignoreNotFound(api.labels.delete(label.id));

  const { inbox_project_id: inboxId } = await api.user.get();
  const tasks =
    inboxId === null
      ? []
      : (await api.tasks.list({ project_id: inboxId })).filter((task) =>
          isStale(task.content, now),
        );
  for (const task of tasks) await ignoreNotFound(api.tasks.delete(task.id));

  return { projects: projects.length, labels: labels.length, tasks: tasks.length };
}

async function ignoreNotFound(request: Promise<void>): Promise<void> {
  try {
    await request;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}
