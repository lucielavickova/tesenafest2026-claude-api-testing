import type { CreateLabelPayload } from '../clients';
import { generateUniqueName } from './runId';

/** A valid personal label payload with a unique `autotest-` name. Overrides win. */
export function buildLabel(
  overrides: Partial<CreateLabelPayload> = {},
  testCaseId?: string,
): CreateLabelPayload {
  return { name: generateUniqueName(testCaseId), ...overrides };
}
