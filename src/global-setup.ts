import { createApiContext, createTodoistApi } from './clients';
import { deleteStaleTestData } from './data/cleanup';
import { redact } from './utils/redact';

/** Runs once before all tests: removes `autotest-` data left behind by earlier runs. */
export default async function globalSetup(): Promise<void> {
  try {
    const request = await createApiContext();
    try {
      const summary = await deleteStaleTestData(createTodoistApi(request));
      // Counts only, never names or headers.
      process.stdout.write(
        `global-setup: deleted stale test data (projects: ${String(summary.projects)}, ` +
          `labels: ${String(summary.labels)}, inbox tasks: ${String(summary.tasks)})\n`,
      );
    } finally {
      await request.dispose();
    }
  } catch (error) {
    // Playwright prints global setup errors itself, before any reporter can redact them.
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line preserve-caught-error -- the cause would carry the unredacted text
    throw new Error(`Global setup failed: ${redact(message)}`);
  }
}
