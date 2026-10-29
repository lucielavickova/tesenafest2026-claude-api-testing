import { expect, Schema, test } from '../../src/fixtures';
import { tomorrowIn } from '../../src/utils/dates';

test(
  'TC-016 A user creates a project, adds a task with a due date to it, and ticks it off',
  { tag: ['@TC-016', '@e2e'] },
  async ({ api, testData, accountTimezone }) => {
    const project = await test.step('Create a new project', () => testData.createProject());

    await test.step('Check the project and load it by its ID', async () => {
      expect(project).toMatchSchema(Schema.project);
      const loaded = await api.projects.get(project.id);
      expect(loaded).toMatchSchema(Schema.project);
      expect(loaded.id).toBe(project.id);
      expect(loaded.name).toBe(project.name);
    });

    const dueDate = tomorrowIn(accountTimezone);
    const content = testData.generateUniqueName();

    const task = await test.step('Add a task with a due date of tomorrow to the project', () =>
      testData.createTask({ content, project_id: project.id, due_date: dueDate }));

    await test.step('Check that the task belongs to the project, has the due date and is open', () => {
      expect(task).toMatchSchema(Schema.task);
      expect(task.id, 'id of the created task').toBeTruthy();
      expect(task.content).toBe(content);
      expect(task.project_id).toBe(project.id);
      expect(task.due?.date).toBe(dueDate);
      expect(task.checked).toBe(false);
      expect(task.completed_at).toBeNull();
    });

    await test.step('List the open tasks of the project: the task is the only one', async () => {
      const listed = await api.tasks.list({ project_id: project.id });
      for (const listedTask of listed) expect(listedTask).toMatchSchema(Schema.task);
      expect(listed.map((listedTask) => listedTask.id)).toEqual([task.id]);
      expect(listed[0]?.content).toBe(content);
      expect(listed[0]?.due?.date).toBe(dueDate);
    });

    await test.step('Tick the task off', () => api.tasks.close(task.id));

    await test.step('Load the task by its ID: it is completed and keeps its due date', async () => {
      const loaded = await api.tasks.get(task.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(task.id);
      expect(loaded.content).toBe(content);
      expect(loaded.project_id).toBe(project.id);
      expect(loaded.due?.date).toBe(dueDate);
      expect(loaded.checked).toBe(true);
      expect(loaded.completed_at, 'completed_at of the ticked off task').toBeTruthy();
    });

    await test.step('List the open tasks of the project: there are none', async () => {
      expect(await api.tasks.list({ project_id: project.id })).toEqual([]);
    });
  },
);
