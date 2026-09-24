import { expect, Schema, test } from '../../src/fixtures';

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
