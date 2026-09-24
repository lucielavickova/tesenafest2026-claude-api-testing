import { createApiContext, createTodoistApi } from './clients';
import { deleteStaleTestData } from './data/cleanup';

/** Runs once before all tests: removes `autotest-` data left behind by earlier runs. */
export default async function globalSetup(): Promise<void> {
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
}
