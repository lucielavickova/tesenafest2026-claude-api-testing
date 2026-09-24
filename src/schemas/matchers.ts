import { expect as baseExpect } from '@playwright/test';

import { validateSchema, type SchemaName } from './validator';

/**
 * `expect(body).toMatchSchema(Schema.task)` checks a response body against a component schema of
 * the pinned OpenAPI spec (src/schemas/openapi.json).
 */
export const expect = baseExpect.extend({
  toMatchSchema(received: unknown, schemaName: SchemaName) {
    const assertionName = 'toMatchSchema';
    const result = validateSchema(received, schemaName);
    const pass = result.valid;

    const message = pass
      ? () =>
          `${this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot })}\n\n` +
          `Expected the body not to match schema "${schemaName}", but it does.`
      : () =>
          `${this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot })}\n\n` +
          `Expected the body to match schema "${schemaName}":\n` +
          result.errors.map((error) => `  - ${error}`).join('\n');

    return { pass, message, name: assertionName };
  },
});
