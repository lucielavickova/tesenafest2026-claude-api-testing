import type { CreateProjectPayload } from '../clients';
import { uniqueName } from './runId';

/** A valid project payload with a unique `autotest-` name. Overrides win. */
export function buildProject(overrides: Partial<CreateProjectPayload> = {}): CreateProjectPayload {
  return { name: uniqueName('project'), ...overrides };
}
