/**
 * Prints what a Playwright trace says about a failed API test: the steps (failed ones marked) and
 * every API call with method, URL, status and the request and response bodies. Request headers
 * are never printed, because they hold the API token. Used by the ci-failure-triage subagent
 * instead of reading the trace files itself.
 *
 * Usage: node scripts/trace-summary.mts <trace.zip> [trace.zip ...]
 *
 * The reading is in scripts/lib/trace-summary.mts. No imports from src/, so Node can run it directly.
 */
import fs from 'node:fs';

import { summarize } from './lib/trace-summary.mts';

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: node scripts/trace-summary.mts <trace.zip> [trace.zip ...]');
  process.exit(1);
}
for (const path of paths) {
  console.log(`== ${path}`);
  console.log(summarize(fs.readFileSync(path)));
}
