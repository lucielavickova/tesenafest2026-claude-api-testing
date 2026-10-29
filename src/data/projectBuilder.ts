import type { CreateProjectPayload } from '../clients';
import { generateUniqueName } from './runId';

/** A valid project payload with a unique `autotest-` name. Overrides win. */
export function buildProject(
  overrides: Partial<CreateProjectPayload> = {},
  testCaseId?: string,
): CreateProjectPayload {
  return { name: generateUniqueName(testCaseId), ...overrides };
}
