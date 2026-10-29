import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-004 A new label is created under the name that was entered',
  { tag: ['@TC-004', '@smoke'] },
  async ({ api, testData }) => {
    const name = testData.uniqueName();

    const created = await test.step('Create a label with a unique name', () =>
      testData.createLabel({ name }));

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.label);
      expect(created.name).toBe(name);
      expect(created.id, 'id of the created label').toBeTruthy();
    });

    await test.step('Load the label by its id and check its name', async () => {
      const label = await api.labels.get(created.id);
      expect(label).toMatchSchema(Schema.label);
      expect(label.id).toBe(created.id);
      expect(label.name).toBe(name);
    });
  },
);
