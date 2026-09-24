import dotenv from 'dotenv';

import { prod } from './prod';
import type { EnvConfig } from './types';

export type { EnvConfig } from './types';

// Load .env for local runs. In CI the variables come from the workflow and are not overridden.
dotenv.config({ quiet: true });

// One entry per environment file in this folder. Add a new file and register it here.
const environments: Record<string, EnvConfig> = { prod };

// An empty TEST_ENV (for example "TEST_ENV=" in .env) falls back to prod as well.
const rawEnvName = process.env['TEST_ENV']?.trim();
export const envName = rawEnvName === undefined || rawEnvName === '' ? 'prod' : rawEnvName;

// Object.hasOwn keeps names like "constructor" from resolving to Object.prototype members.
const selected = Object.hasOwn(environments, envName) ? environments[envName] : undefined;
if (!selected) {
  throw new Error(
    `Unknown TEST_ENV "${envName}". Available: ${Object.keys(environments).join(', ')}.`,
  );
}

export const config: EnvConfig = selected;
