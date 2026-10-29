import { expect, Schema, test } from '../../src/fixtures';

test(
  "TC-008 A project's task list contains only the tasks of that project, nothing from elsewhere",
  { tag: ['@TC-008', '@regression'] },
  async ({ api, testData }) => {
    const { projectA, projectB } = await test.step('Create projects A and B', async () => ({
      projectA: await testData.createProject(),
      projectB: await testData.createProject(),
    }));

    const tasksA = await test.step('Create two tasks in project A', async () => [
      await testData.createTask({ project_id: projectA.id }),
      await testData.createTask({ project_id: projectA.id }),
    ]);

    const otherTasks =
      await test.step('Create one task in project B and one in the Inbox', async () => [
        await testData.createTask({ project_id: projectB.id }),
        await testData.createTask(),
      ]);

    const listed = await test.step('List the tasks of project A across all pages', () =>
      api.tasks.list({ project_id: projectA.id }));

    await test.step('Check that every listed task matches the schema and belongs to project A', () => {
      for (const task of listed) {
        expect(task).toMatchSchema(Schema.task);
        expect(task.project_id).toBe(projectA.id);
      }
    });

    await test.step('Check that the list contains exactly the two tasks of project A', () => {
      expect(listed.map((task) => task.id).sort()).toEqual(tasksA.map((task) => task.id).sort());
      expect(listed.map((task) => task.content).sort()).toEqual(
        tasksA.map((task) => task.content).sort(),
      );
    });

    await test.step('Check that the tasks from project B and the Inbox are not in the list', () => {
      const listedIds = listed.map((task) => task.id);
      for (const task of otherTasks) expect(listedIds).not.toContain(task.id);
    });
  },
);
