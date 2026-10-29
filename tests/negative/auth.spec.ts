import { expect, test, type ApiFixtures, type TestData } from '../../src/fixtures';

/**
 * Not a real token: it has the wrong shape (a Todoist API token is 40 hex characters),
 * so it can never be the account's token, and it is safe to show in the report.
 */
const MALFORMED_TOKEN = 'malformed-token-tc-014';

type Client = ApiFixtures['api'];
type APIResponse = Awaited<ReturnType<Client['tasks']['send']>>;

/**
 * Sends `POST /tasks` with unique content with `client` into a new project the test owns.
 * If the API unexpectedly accepts it, the task is registered for cleanup before any assertion.
 */
async function sendCreateTaskInOwnProject(
  client: Client,
  testData: TestData,
): Promise<{ res: APIResponse; projectId: string }> {
  const project = await test.step('Create a project for the test', () => testData.createProject());

  const content = testData.generateUniqueName();

  const res = await test.step('Send POST /tasks with unique content into the project', () =>
    client.tasks.send('POST', 'tasks', { body: { content, project_id: project.id } }));

  if (res.ok()) {
    const created = (await res.json()) as { id: string };
    testData.track('task', created.id);
  }

  return { res, projectId: project.id };
}

/** Error bodies have no schema in the spec. The probe showed this tag, nothing more is asserted. */
async function errorTagOf(res: APIResponse): Promise<string | undefined> {
  return ((await res.json()) as { error_tag?: string }).error_tag;
}

/** Contents of the open tasks in the project, loaded with the valid token. */
async function taskContentsIn(api: Client, projectId: string): Promise<string[]> {
  return (await api.tasks.list({ project_id: projectId })).map((task) => task.content);
}

test(
  'TC-014a Creating a task without an access token fails with 401 and nothing is created',
  { tag: ['@TC-014', '@negative'] },
  async ({ api, unauthenticatedApi, testData }) => {
    const { res, projectId } = await sendCreateTaskInOwnProject(unauthenticatedApi, testData);

    await test.step('Check the response is 401 Unauthorized', async () => {
      expect(res.status()).toBe(401);
      expect(await errorTagOf(res)).toBe('UNAUTHORIZED');
    });

    await test.step('List the tasks of the project with the valid token: there are none', async () => {
      expect(await taskContentsIn(api, projectId)).toEqual([]);
    });
  },
);

test(
  'TC-014b Creating a task with a malformed access token fails with 401 and nothing is created',
  { tag: ['@TC-014', '@negative'] },
  async ({ api, apiWithToken, testData }) => {
    const client = await test.step('Create a client with a malformed token', () =>
      apiWithToken(MALFORMED_TOKEN));

    const { res, projectId } = await sendCreateTaskInOwnProject(client, testData);

    await test.step('Check the response is 401 Unauthorized', async () => {
      expect(res.status()).toBe(401);
      expect(await errorTagOf(res)).toBe('UNAUTHORIZED');
    });

    await test.step('List the tasks of the project with the valid token: there are none', async () => {
      expect(await taskContentsIn(api, projectId)).toEqual([]);
    });
  },
);
