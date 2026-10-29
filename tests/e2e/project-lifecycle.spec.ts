import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-011 A project from empty to done: three tasks, two ticked off, one still open at the end',
  { tag: ['@TC-011', '@e2e'] },
  async ({ api, testData }) => {
    const project = await test.step('Create a new project', () => testData.createProject());

    await test.step('Load the project by its ID and check that it matches what was created', async () => {
      expect(project).toMatchSchema(Schema.project);
      const loaded = await api.projects.get(project.id);
      expect(loaded).toMatchSchema(Schema.project);
      expect(loaded.id).toBe(project.id);
      expect(loaded.name).toBe(project.name);
    });

    await test.step('Check that the new project has no tasks', async () => {
      expect(await api.tasks.list({ project_id: project.id })).toEqual([]);
    });

    const tasks = await test.step('Add three tasks to the project', async () =>
      [
        await testData.createTask({ project_id: project.id }),
        await testData.createTask({ project_id: project.id }),
        await testData.createTask({ project_id: project.id }),
      ] as const);

    await test.step('Check that the three created tasks are open and belong to the project', () => {
      for (const task of tasks) {
        expect(task).toMatchSchema(Schema.task);
        expect(task.project_id).toBe(project.id);
        expect(task.checked).toBe(false);
      }
    });

    await test.step('List the tasks of the project and check that it lists exactly the three tasks', async () => {
      const listed = await api.tasks.list({ project_id: project.id });
      for (const task of listed) expect(task).toMatchSchema(Schema.task);
      expect(listed.map((task) => task.id).sort()).toEqual(tasks.map((task) => task.id).sort());
      expect(listed.map((task) => task.content).sort()).toEqual(
        tasks.map((task) => task.content).sort(),
      );
    });

    const [first, second, third] = tasks;
    const closed = [first, second];

    await test.step('Close the first two tasks', async () => {
      for (const task of closed) await api.tasks.close(task.id);
    });

    await test.step('List the active tasks of the project and check that only the third task is listed', async () => {
      const listed = await api.tasks.list({ project_id: project.id });
      for (const task of listed) expect(task).toMatchSchema(Schema.task);
      expect(listed.map((task) => task.id)).toEqual([third.id]);
      expect(listed[0]?.content).toBe(third.content);
      expect(listed[0]?.checked).toBe(false);
    });

    await test.step('Load the two closed tasks by their IDs and check that they are completed', async () => {
      for (const task of closed) {
        const loaded = await api.tasks.get(task.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded.id).toBe(task.id);
        expect(loaded.content).toBe(task.content);
        expect(loaded.project_id).toBe(project.id);
        expect(loaded.checked).toBe(true);
        expect(loaded.completed_at, `completed_at of task ${task.id}`).not.toBeNull();
      }
    });

    await test.step('Load the third task by its ID and check that it is still open', async () => {
      const loaded = await api.tasks.get(third.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(third.id);
      expect(loaded.content).toBe(third.content);
      expect(loaded.project_id).toBe(project.id);
      expect(loaded.checked).toBe(false);
      expect(loaded.completed_at).toBeNull();
    });
  },
);
