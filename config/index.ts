import dotenv from 'dotenv';

import { prod } from './prod';
import type { EnvConfig } from './types';

export type { EnvConfig } from './types';

// Load .env for local runs. In CI the variables come from the workflow and are not overridden.
dotenv.config({ quiet: true });

// One entry per environment file in this folder. Add a new file and register it here.
const environments: Record<string, EnvConfig> = { prod };

export const envName = process.env['TEST_ENV'] ?? 'prod';

const selected = environments[envName];
if (!selected) {
  throw new Error(
    `Unknown TEST_ENV "${envName}". Available: ${Object.keys(environments).join(', ')}.`,
  );
}

export const config: EnvConfig = selected;
