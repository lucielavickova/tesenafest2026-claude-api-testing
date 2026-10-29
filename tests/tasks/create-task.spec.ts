import { expect, Schema, test } from '../../src/fixtures';
import { addDays, todayIn } from '../../src/utils/dates';

test(
  'TC-002 A new task is created with the text that was entered',
  { tag: ['@TC-002', '@smoke'] },
  async ({ api, testData }) => {
    const content = testData.uniqueName('task');

    const created = await test.step('Create a task with unique content', () =>
      testData.createTask({ content }));

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.id, 'id of the created task').toBeTruthy();
      expect(created.content).toBe(content);
    });

    await test.step('Load the task by its ID and check it', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(created.id);
      expect(loaded.content).toBe(content);
    });
  },
);

test(
  'TC-003 A new task is created with the due date that was entered',
  { tag: ['@TC-003', '@smoke'] },
  async ({ api, testData, accountTimezone }) => {
    const dueDate = addDays(todayIn(accountTimezone), 7);

    const created = await test.step('Create a task due in 7 days', () =>
      testData.createTask({ due_date: dueDate }));

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.due?.date).toBe(dueDate);
    });

    await test.step('Load the task by its ID and check the due date', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.due?.date).toBe(dueDate);
    });
  },
);
