/**
 * Refreshes the pinned OpenAPI snapshot in src/schemas/openapi.json.
 * Run it by hand (not in CI) and review the diff like any other change:
 *
 *   node scripts/update-openapi.mts
 */
import fs from 'node:fs';

const SPEC_URL = 'https://developer.todoist.com/openapi.json';
const TARGET = 'src/schemas/openapi.json';

const response = await fetch(SPEC_URL);
if (!response.ok) {
  console.error(`update-openapi: ${SPEC_URL} answered ${String(response.status)}`);
  process.exit(1);
}

const spec = (await response.json()) as { openapi?: string; info?: { version?: string } };
fs.writeFileSync(TARGET, `${JSON.stringify(spec, null, 2)}\n`);
console.log(
  `update-openapi: wrote ${TARGET} (OpenAPI ${spec.openapi ?? '?'}, API version ${spec.info?.version ?? '?'})`,
);
