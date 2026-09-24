import type { CreateLabelPayload } from '../clients';
import { uniqueName } from './runId';

/** A valid personal label payload with a unique `autotest-` name. Overrides win. */
export function buildLabel(overrides: Partial<CreateLabelPayload> = {}): CreateLabelPayload {
  return { name: uniqueName('label'), ...overrides };
}
