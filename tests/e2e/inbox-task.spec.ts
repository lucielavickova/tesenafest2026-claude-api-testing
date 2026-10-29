import { expect, Schema, test } from '../../src/fixtures';
import { tomorrowIn } from '../../src/utils/dates';

test(
  'TC-017 A task added to the Inbox with a due date of tomorrow gets a label and the highest priority afterwards',
  { tag: ['@TC-017', '@e2e'] },
  async ({ api, testData, account, accountTimezone }) => {
    const inboxId = account.inbox_project_id ?? '';
    expect(inboxId, 'inbox_project_id of the account').toBeTruthy();

    const label = await test.step('Create a label', async () => {
      const created = await testData.createLabel();
      expect(created).toMatchSchema(Schema.label);
      return created;
    });

    const content = testData.generateUniqueName();
    const dueDate = tomorrowIn(accountTimezone);

    const task = await test.step('Add a task with a due date of tomorrow to the Inbox', () =>
      testData.createTask({ content, due_date: dueDate }));

    await test.step('Load the task by its ID: it is open in the Inbox, with no label and the default priority', async () => {
      expect(task).toMatchSchema(Schema.task);
      const loaded = await api.tasks.get(task.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(task.id);
      expect(loaded.content).toBe(content);
      expect(loaded.project_id).toBe(inboxId);
      expect(loaded.due?.date).toBe(dueDate);
      expect(loaded.labels).toEqual([]);
      expect(loaded.priority).toBe(1);
      expect(loaded.checked).toBe(false);
    });

    // P1 in the web app is priority 4 in the API.
    const update = { labels: [label.name], priority: 4 as const };

    await test.step('Add the label to the task and set the priority to P1', async () => {
      const updated = await api.tasks.update(task.id, update);
      expect(updated).toMatchSchema(Schema.task);
      expect(updated.labels).toEqual(update.labels);
      expect(updated.priority).toBe(update.priority);
    });

    await test.step('Load the task by its ID: it has the label and P1, and keeps its text, Inbox and due date', async () => {
      const loaded = await api.tasks.get(task.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(task.id);
      expect(loaded.labels).toEqual(update.labels);
      expect(loaded.priority).toBe(update.priority);
      expect(loaded.content).toBe(content);
      expect(loaded.project_id).toBe(inboxId);
      expect(loaded.due?.date).toBe(dueDate);
      expect(loaded.checked).toBe(false);
    });

    await test.step('List the open tasks of the Inbox: the task is there with the label and P1', async () => {
      // The Inbox is shared with other runs, so check only this task.
      const listed = (await api.tasks.list({ project_id: inboxId })).filter(
        (listedTask) => listedTask.id === task.id,
      );
      for (const listedTask of listed) expect(listedTask).toMatchSchema(Schema.task);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.labels).toEqual(update.labels);
      expect(listed[0]?.priority).toBe(update.priority);
      expect(listed[0]?.due?.date).toBe(dueDate);
    });
  },
);
