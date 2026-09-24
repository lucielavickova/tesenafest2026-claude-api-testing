import { mergeTests } from '@playwright/test';

import { dataTest } from './data.fixture';
import { userTest } from './user.fixture';

/**
 * The `test` for all spec files: `import { test, expect } from '../../src/fixtures';`
 *
 * Fixtures: `api`, `apiRequest`, `unauthenticatedApi`, `apiWithToken`, `testData`,
 * and per worker `account`, `accountTimezone`.
 */
export const test = mergeTests(dataTest, userTest);

/** Playwright's expect plus `toMatchSchema`. */
export { expect } from '../schemas/matchers';
export { Schema } from '../schemas/validator';

export type { ApiFixtures } from './api.fixture';
export type { DataFixtures, ResourceKind, TestData } from './data.fixture';
export type { UserWorkerFixtures } from './user.fixture';
