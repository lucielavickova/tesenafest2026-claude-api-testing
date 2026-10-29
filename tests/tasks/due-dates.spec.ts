import { expect, Schema, test } from '../../src/fixtures';
import { addDays, todayIn, tomorrowIn } from '../../src/utils/dates';

test(
  'TC-009 A due date entered in words lands on the same day as the same date entered explicitly',
  { tag: ['@TC-009', '@regression'] },
  async ({ api, testData, accountTimezone }) => {
    // Computed right before the create calls. Close to midnight in the account timezone the day
    // can change between the calls, so the test is skipped when "tomorrow" moved during the test.
    const tomorrow = tomorrowIn(accountTimezone);

    const { inWords, explicit } =
      await test.step('Create a task due "tomorrow" in words and one due tomorrow as an explicit date', async () => ({
        inWords: await testData.createTask({ due_string: 'tomorrow', due_lang: 'en' }),
        explicit: await testData.createTask({ due_date: tomorrow }),
      }));

    // eslint-disable-next-line playwright/no-skipped-test -- runtime guard for the midnight case
    test.skip(
      tomorrowIn(accountTimezone) !== tomorrow,
      'The day changed in the account timezone during the test, so "tomorrow" is ambiguous.',
    );

    await test.step('Check that both create responses are due tomorrow in the account timezone', () => {
      expect(inWords).toMatchSchema(Schema.task);
      expect(explicit).toMatchSchema(Schema.task);
      expect(inWords.due?.date).toBe(tomorrow);
      expect(explicit.due?.date).toBe(tomorrow);
    });

    await test.step('Load both tasks by their IDs and check that they have the same due date, tomorrow', async () => {
      const loadedInWords = await api.tasks.get(inWords.id);
      const loadedExplicit = await api.tasks.get(explicit.id);
      expect(loadedInWords).toMatchSchema(Schema.task);
      expect(loadedExplicit).toMatchSchema(Schema.task);
      expect(loadedInWords.due?.date).toBe(tomorrow);
      expect(loadedExplicit.due?.date).toBe(tomorrow);
      expect(loadedInWords.due?.date).toBe(loadedExplicit.due?.date);
    });
  },
);

test(
  'TC-013 A recurring task does not disappear when ticked off and moves on to its next due date',
  { tag: ['@TC-013', '@regression'] },
  async ({ api, testData, accountTimezone }) => {
    // "every day" starts today in the account timezone and closing it moves it to tomorrow.
    // Close to midnight the day can change between the calls, so the test is skipped when
    // "today" moved during the test (same guard as TC-009). The create response is asserted
    // after that guard, not right after the create.
    const today = todayIn(accountTimezone);
    const tomorrow = addDays(today, 1);

    const project = await test.step('Create a project for the task', () =>
      testData.createProject());

    const created = await test.step('Create a task due "every day" in the project', () =>
      testData.createTask({ project_id: project.id, due_string: 'every day', due_lang: 'en' }));

    await test.step('Close the recurring task and check that the API answers 204', async () => {
      const res = await api.tasks.send('POST', `tasks/${created.id}/close`);
      expect(res.status()).toBe(204);
    });

    // eslint-disable-next-line playwright/no-skipped-test -- runtime guard for the midnight case
    test.skip(
      todayIn(accountTimezone) !== today,
      'The day changed in the account timezone during the test, so the next due date is ambiguous.',
    );

    await test.step('Check that the created task is recurring and due today in the account timezone', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.project_id).toBe(project.id);
      expect(created.due?.date).toBe(today);
      expect(created.due?.string).toBe('every day');
      expect(created.due?.is_recurring).toBe(true);
    });

    await test.step('Load the task by its ID and check that it is still open, recurring and due tomorrow', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(created.id);
      expect(loaded.checked).toBe(false);
      expect(loaded.completed_at).toBeNull();
      expect(loaded.due?.date).toBe(tomorrow);
      expect(loaded.due?.string).toBe('every day');
      expect(loaded.due?.is_recurring).toBe(true);
    });

    await test.step('List the active tasks of the project and check that the same task is there, due tomorrow', async () => {
      const active = await api.tasks.list({ project_id: project.id });
      for (const task of active) expect(task).toMatchSchema(Schema.task);
      expect(active.map((task) => task.id)).toEqual([created.id]);
      expect(active[0]?.due?.date).toBe(tomorrow);
    });
  },
);
