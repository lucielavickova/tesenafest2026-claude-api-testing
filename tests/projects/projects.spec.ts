import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-001 A new project is created and comes back under the name that was entered',
  { tag: ['@TC-001', '@smoke'] },
  async ({ api, testData }) => {
    const name = testData.uniqueName();

    const created = await test.step('Create a project with a unique name', () =>
      testData.createProject({ name }));

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.project);
      expect(created.name).toBe(name);
      expect(created.id, 'id of the created project').toBeTruthy();
    });

    await test.step('Load the project by its id and check its name and that it is active', async () => {
      const project = await api.projects.get(created.id);
      expect(project).toMatchSchema(Schema.project);
      expect(project.id).toBe(created.id);
      expect(project.name).toBe(name);
      expect(project.is_deleted).toBe(false);
      expect(project.is_archived).toBe(false);
    });
  },
);

test(
  'TC-006 A renamed project loads under the new name the next time it is opened, not only in the response to the update',
  { tag: ['@TC-006', '@regression'] },
  async ({ api, testData }) => {
    const created = await test.step('Create a project', () => testData.createProject());

    const newName = testData.uniqueName();
    expect(newName, 'the new name differs from the old one').not.toBe(created.name);

    await test.step('Rename the project and check the update response', async () => {
      const updated = await api.projects.update(created.id, { name: newName });
      expect(updated).toMatchSchema(Schema.project);
      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe(newName);
    });

    await test.step('Load the project by its id and check that it has the new name', async () => {
      const project = await api.projects.get(created.id);
      expect(project).toMatchSchema(Schema.project);
      expect(project.id).toBe(created.id);
      expect(project.name).toBe(newName);
    });
  },
);
