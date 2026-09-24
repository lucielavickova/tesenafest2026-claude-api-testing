import type { CreateCommentPayload } from '../clients';
import { uniqueName } from './runId';

export type CommentTarget = { task_id: string } | { project_id: string };

/** A valid comment payload for a task or a project, with unique `autotest-` content. */
export function buildComment(
  target: CommentTarget,
  overrides: { content?: string } = {},
): CreateCommentPayload {
  return { content: uniqueName('comment'), ...overrides, ...target };
}
