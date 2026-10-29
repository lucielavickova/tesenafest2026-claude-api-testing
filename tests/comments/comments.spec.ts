import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-005 A comment is added to a task with the text that was entered',
  { tag: ['@TC-005', '@smoke'] },
  async ({ api, testData }) => {
    const content = testData.uniqueName('comment');

    const task = await test.step('Create a task', () => testData.createTask());

    const created = await test.step('Add a comment with unique text to the task', () =>
      testData.createComment({ task_id: task.id }, { content }));

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.comment);
      expect(created.id, 'id of the created comment').toBeTruthy();
      expect(created.content).toBe(content);
      expect(created.item_id).toBe(task.id);
    });

    await test.step('Load the comment by its ID and check it', async () => {
      const loaded = await api.comments.get(created.id);
      expect(loaded).toMatchSchema(Schema.comment);
      expect(loaded.id).toBe(created.id);
      expect(loaded.content).toBe(content);
      expect(loaded.item_id).toBe(task.id);
    });

    await test.step("List the task's comments and find the comment", async () => {
      const comments = await api.comments.list({ task_id: task.id });
      for (const comment of comments) {
        expect(comment).toMatchSchema(Schema.comment);
      }
      expect(comments.map((comment) => comment.id)).toEqual([created.id]);
    });
  },
);
