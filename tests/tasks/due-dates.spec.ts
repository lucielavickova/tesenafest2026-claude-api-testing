import { expect, Schema, test } from '../../src/fixtures';
import { tomorrowIn } from '../../src/utils/dates';

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
