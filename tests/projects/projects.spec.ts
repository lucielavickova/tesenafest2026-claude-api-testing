import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-001 A new project is created and comes back under the name that was entered',
  { tag: ['@TC-001', '@smoke'] },
  async ({ api, testData }) => {
    const name = testData.uniqueName('project');

    const created = await test.step('Create a project with a unique name', () =>
      testData.createProject({ name }));

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.project);
      expect(created.name).toBe(name);
      expect(created.id, 'id of the created project').toBeTruthy();
    });

    await test.step('Load the project by its id and check its name', async () => {
      const project = await api.projects.get(created.id);
      expect(project).toMatchSchema(Schema.project);
      expect(project.id).toBe(created.id);
      expect(project.name).toBe(name);
    });
  },
);
