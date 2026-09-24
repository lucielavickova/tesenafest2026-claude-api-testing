import type { CreateTaskPayload } from '../clients';
import { uniqueName } from './runId';

/**
 * A valid task payload with a unique `autotest-` content. Overrides win.
 * Without `project_id` the task goes to the Inbox; the global setup cleans stale Inbox tasks.
 */
export function buildTask(overrides: Partial<CreateTaskPayload> = {}): CreateTaskPayload {
  return { content: uniqueName('task'), ...overrides };
}
