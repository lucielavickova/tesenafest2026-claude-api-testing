import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import spec from './openapi.json';

/** Name of any component schema in the pinned spec. */
export type SchemaName = keyof typeof spec.components.schemas;

/**
 * Component schema names from the pinned spec for the resources under test.
 * Use these instead of spelling the generated names in tests.
 */
export const Schema = {
  project: 'AnyProjectSyncViewResponse',
  task: 'ItemSyncView',
  label: 'LabelRestView',
  comment: 'NoteSyncView',
  user: 'UserJSON',
  projectPage: 'PaginatedList_AnyProjectSyncViewResponse_',
  taskPage: 'PaginatedList_ItemSyncView_',
  labelPage: 'PaginatedList_LabelRestView_',
  commentPage: 'PaginatedList_NoteSyncView_',
} as const satisfies Record<string, SchemaName>;

const SCHEMA_ID = 'todoist-openapi';

// OpenAPI 3.1 schemas are JSON Schema 2020-12, but they live under `components`, which is not a
// JSON Schema keyword. They are registered under `$defs` and the refs are rewritten to match.
const definitions: unknown = JSON.parse(
  JSON.stringify(spec.components.schemas).replaceAll('#/components/schemas/', '#/$defs/'),
);

// strictTypes is off because the spec puts `format` inside `anyOf` branches, which is valid but
// trips that check. `x-*` vendor keywords are registered as annotations.
const ajv = new Ajv2020({ strict: true, strictTypes: false, allErrors: true });
addFormats(ajv);
ajv.addKeyword('x-enumDescriptions');
ajv.addSchema({ $id: SCHEMA_ID, $defs: definitions });

export interface SchemaResult {
  valid: boolean;
  /** Readable list of validation errors, empty when valid. */
  errors: string[];
}

/** Validates data against a component schema of the pinned OpenAPI spec. */
export function validateSchema(data: unknown, name: SchemaName): SchemaResult {
  const validate = getValidator(name);
  const valid = validate(data);
  return { valid, errors: valid ? [] : (validate.errors ?? []).map(formatError) };
}

function getValidator(name: SchemaName): ValidateFunction {
  if (!Object.hasOwn(spec.components.schemas, name)) {
    throw new Error(`Schema "${name}" is not in src/schemas/openapi.json.`);
  }
  const validate = ajv.getSchema(`${SCHEMA_ID}#/$defs/${name}`);
  if (!validate) throw new Error(`Schema "${name}" could not be compiled.`);
  return validate;
}

function formatError(error: ErrorObject): string {
  const where = error.instancePath === '' ? '(root)' : error.instancePath;
  return `${where} ${error.message ?? 'is invalid'} ${JSON.stringify(error.params)}`;
}
