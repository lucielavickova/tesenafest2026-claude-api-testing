/**
 * Fails when the Todoist API token appears anywhere in the test artifacts, including inside
 * trace zips. CI runs it before uploading the report and traces, because the repo is public.
 *
 * Usage: node scripts/check-no-token.mts [dir ...]   (default: playwright-report test-results)
 *
 * The script is self-contained (no imports from src/) so Node can run it directly.
 */
import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import { unzipSync } from 'fflate';

dotenv.config({ quiet: true });

const token = process.env['TODOIST_API_TOKEN']?.trim() ?? '';
const dirs =
  process.argv.length > 2 ? process.argv.slice(2) : ['playwright-report', 'test-results'];

if (token === '') {
  console.log('check-no-token: TODOIST_API_TOKEN is not set, nothing to check.');
  process.exit(0);
}

const needle = Buffer.from(token);
const leaks: string[] = [];
let scanned = 0;

// The HTML report embeds its data in index.html as a base64 zip data URL.
const EMBEDDED_ZIP = /data:application\/zip;base64,([A-Za-z0-9+/=]+)/g;

function scanBytes(data: Uint8Array, location: string): void {
  scanned++;
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (buffer.includes(needle)) {
    leaks.push(location);
  }
  if (isZip(data)) {
    for (const [name, content] of Object.entries(unzipSync(data))) {
      scanBytes(content, `${location} > ${name}`);
    }
  } else if (buffer.includes('data:application/zip;base64,')) {
    let index = 0;
    for (const match of buffer.toString('latin1').matchAll(EMBEDDED_ZIP)) {
      scanBytes(
        Buffer.from(match[1] ?? '', 'base64'),
        `${location} > embedded zip ${String(index++)}`,
      );
    }
  }
}

function isZip(data: Uint8Array): boolean {
  return data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
}

function scanDir(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) scanDir(fullPath);
    else if (entry.isFile()) scanBytes(fs.readFileSync(fullPath), fullPath);
  }
}

for (const dir of dirs) {
  if (fs.existsSync(dir)) scanDir(dir);
}

if (leaks.length > 0) {
  // Only locations are printed, never the value.
  console.error(`check-no-token: the API token was found in ${String(leaks.length)} place(s):`);
  for (const leak of leaks) console.error(`  ${leak}`);
  process.exit(1);
}

console.log(`check-no-token: OK, ${String(scanned)} files scanned in ${dirs.join(', ')}.`);
