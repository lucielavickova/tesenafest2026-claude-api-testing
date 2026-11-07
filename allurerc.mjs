import { defineConfig } from 'allure';

/**
 * Config of the Allure 3 report (`npm run allure:generate`). The results come from
 * src/reporters/redact-allure-reporter.ts in `allure-results`.
 *
 * `allure generate` adds one entry per run to the history file and keeps the last
 * `historyLimit` entries. CI keeps the file between runs in the Actions cache, see nightly.yml
 * and smoke.yml. Allure 3 limits the history only by the number of runs, not by age.
 */
export default defineConfig({
  name: 'Todoist API tests',
  output: './allure-report',
  historyPath: './allure-history/history.jsonl',
  historyLimit: 30,
  plugins: {
    awesome: {
      options: { reportLanguage: 'en', singleFile: false },
    },
    dashboard: {
      options: { reportLanguage: 'en', singleFile: false },
    },
  },
});
