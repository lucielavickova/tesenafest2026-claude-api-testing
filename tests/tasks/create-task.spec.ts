import { expect, Schema, test } from '../../src/fixtures';
import { addDays, todayIn } from '../../src/utils/dates';

test(
  'TC-002 A new task is created with the text that was entered',
  { tag: ['@TC-002', '@smoke'] },
  async ({ api, testData }) => {
    const content = testData.generateUniqueName();

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

test(
  'TC-003 A new task is created with the due date that was entered',
  { tag: ['@TC-003', '@smoke'] },
  async ({ api, testData, accountTimezone }) => {
    const dueDate = addDays(todayIn(accountTimezone), 7);

    const created = await test.step('Create a task due in 7 days', () =>
      testData.createTask({ due_date: dueDate }));

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.due?.date).toBe(dueDate);
    });

    await test.step('Load the task by its ID and check the due date', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.due?.date).toBe(dueDate);
    });
  },
);

test(
  'TC-007a A task created with the required content only gets the default values',
  { tag: ['@TC-007', '@regression'] },
  async ({ api, testData, account }) => {
    const content = testData.generateUniqueName();

    const created = await test.step('Create a task with content only', () =>
      testData.createTask({ content }));

    const checkDefaults = (task: typeof created): void => {
      expect(task).toMatchSchema(Schema.task);
      expect(task.content).toBe(content);
      expect(task.project_id).toBe(account.inbox_project_id);
      expect(task.priority).toBe(1);
      expect(task.due).toBeNull();
      expect(task.labels).toEqual([]);
      expect(task.description).toBe('');
    };

    await test.step('Check the defaults in the create response: Inbox, priority 1, no due date, no labels', () => {
      checkDefaults(created);
    });

    await test.step('Load the task by its ID and check the defaults', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded.id).toBe(created.id);
      checkDefaults(loaded);
    });
  },
);

test(
  'TC-007b A task created with all optional fields of the free plan stores each of them exactly as entered',
  { tag: ['@TC-007', '@regression'] },
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
      due_date: addDays(todayIn(accountTimezone), 5),
    };

    const created = await test.step('Create a task with all optional fields set', () =>
      testData.createTask(payload));

    const checkFields = (task: typeof created): void => {
      expect(task).toMatchSchema(Schema.task);
      expect(task.content).toBe(payload.content);
      expect(task.description).toBe(payload.description);
      expect(task.project_id).toBe(payload.project_id);
      expect(task.labels).toEqual(payload.labels);
      expect(task.priority).toBe(payload.priority);
      expect(task.due?.date).toBe(payload.due_date);
    };

    await test.step('Check every optional field in the create response', () => {
      checkFields(created);
    });

    await test.step('Load the task by its ID and check every optional field', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded.id).toBe(created.id);
      checkFields(loaded);
    });
  },
);

test(
  'TC-007c A task created with a duration and a deadline stores both exactly as entered',
  { tag: ['@TC-007', '@regression'] },
  async ({ api, testData, accountTimezone }) => {
    test.fixme(
      true,
      'Premium only: on the free plan the API rejects deadline_date with 403 PREMIUM_ONLY and stores duration as null.',
    );

    const dueDate = addDays(todayIn(accountTimezone), 5);
    const deadlineDate = addDays(dueDate, 2);

    const created = await test.step('Create a task with a 30 minute duration and a deadline', () =>
      testData.createTask({
        due_date: dueDate,
        duration: 30,
        duration_unit: 'minute',
        deadline_date: deadlineDate,
      }));

    const checkFields = (task: typeof created): void => {
      expect(task).toMatchSchema(Schema.task);
      expect(task.duration).toEqual({ amount: 30, unit: 'minute' });
      expect(task.deadline?.date).toBe(deadlineDate);
    };

    await test.step('Check the duration and the deadline in the create response', () => {
      checkFields(created);
    });

    await test.step('Load the task by its ID and check the duration and the deadline', async () => {
      checkFields(await api.tasks.get(created.id));
    });
  },
);
