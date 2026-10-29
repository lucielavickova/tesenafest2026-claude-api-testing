import { expect, Schema, test } from '../../src/fixtures';
import { addDays, todayIn } from '../../src/utils/dates';

test(
  'TC-012 A task ticked off by mistake can be put back among the open ones, and it is the same task, not a new one',
  { tag: ['@TC-012', '@regression'] },
  async ({ api, testData, accountTimezone }) => {
    const { project, label } =
      await test.step('Create a project and a label for the task', async () => ({
        project: await testData.createProject(),
        label: await testData.createLabel(),
      }));

    const payload = {
      content: testData.generateUniqueName(),
      description: `Description of ${testData.generateUniqueName()}`,
      project_id: project.id,
      labels: [label.name],
      priority: 3 as const,
      due_date: addDays(todayIn(accountTimezone), 3),
    };

    const created = await test.step('Create a task with several fields set', () =>
      testData.createTask(payload));

    /** Fields that describe the task itself and must survive a close and a reopen unchanged. */
    const stableFields = (task: typeof created) => ({
      id: task.id,
      content: task.content,
      description: task.description,
      project_id: task.project_id,
      section_id: task.section_id,
      parent_id: task.parent_id,
      labels: task.labels,
      priority: task.priority,
      due: task.due,
      added_at: task.added_at,
    });

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.id, 'id of the created task').toBeTruthy();
      expect(created.checked).toBe(false);
      expect(created.content).toBe(payload.content);
      expect(created.description).toBe(payload.description);
      expect(created.project_id).toBe(payload.project_id);
      expect(created.labels).toEqual(payload.labels);
      expect(created.priority).toBe(payload.priority);
      expect(created.due?.date).toBe(payload.due_date);
    });

    const before = await test.step('Load the task by its ID before closing it', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.checked).toBe(false);
      expect(stableFields(loaded)).toEqual(stableFields(created));
      return loaded;
    });

    await test.step('Close the task: 204 with no body', async () => {
      const res = await api.tasks.send('POST', `tasks/${created.id}/close`);
      expect(res.status()).toBe(204);
      expect(await res.text()).toBe('');
    });

    await test.step('Load the closed task by its ID: it is marked as completed', async () => {
      const closed = await api.tasks.get(created.id);
      expect(closed).toMatchSchema(Schema.task);
      expect(closed.id).toBe(created.id);
      expect(closed.checked).toBe(true);
      expect(closed.completed_at, 'completed_at of the closed task').toBeTruthy();
    });

    await test.step('Check that the project has no active tasks', async () => {
      expect(await api.tasks.list({ project_id: project.id })).toEqual([]);
    });

    await test.step('Reopen the task: 204 with no body', async () => {
      const res = await api.tasks.send('POST', `tasks/${created.id}/reopen`);
      expect(res.status()).toBe(204);
      expect(await res.text()).toBe('');
    });

    await test.step('Load the reopened task by its ID: it is active and has the same fields as before closing', async () => {
      const reopened = await api.tasks.get(created.id);
      expect(reopened).toMatchSchema(Schema.task);
      expect(reopened.checked).toBe(false);
      expect(reopened.completed_at).toBeNull();
      expect(stableFields(reopened)).toEqual(stableFields(before));
    });

    await test.step('List the active tasks of the project: exactly the same task, no new one', async () => {
      const listed = await api.tasks.list({ project_id: project.id });
      for (const task of listed) expect(task).toMatchSchema(Schema.task);
      expect(listed.map((task) => task.id)).toEqual([created.id]);
      expect(listed.map(stableFields)).toEqual([stableFields(before)]);
    });
  },
);
