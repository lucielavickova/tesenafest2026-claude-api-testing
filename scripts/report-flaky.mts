/**
 * Lists tests that passed only on retry (flaky), from the Playwright JSON report.
 * Writes a Markdown report and appends it to the GitHub job summary when there is one.
 *
 * Usage: node scripts/report-flaky.mts [results.json] [output.md]
 * Defaults: test-results/results.json, flaky-report.md
 * Prints the number of flaky tests on stdout, so a workflow step can read it.
 */
import fs from 'node:fs';

interface JsonTest {
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
}
interface JsonSpec {
  title: string;
  file: string;
  line: number;
  tests: JsonTest[];
}
interface JsonSuite {
  suites?: JsonSuite[];
  specs?: JsonSpec[];
}
interface JsonReport {
  suites: JsonSuite[];
}

const [resultsPath = 'test-results/results.json', outputPath = 'flaky-report.md'] =
  process.argv.slice(2);

// Marks the PR comment, so the workflow updates it instead of adding a new one each run.
const MARKER = '<!-- flaky-tests-report -->';

function collectFlaky(suites: readonly JsonSuite[]): JsonSpec[] {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).filter((spec) => spec.tests.some((test) => test.status === 'flaky')),
    ...collectFlaky(suite.suites ?? []),
  ]);
}

let flaky: JsonSpec[] = [];
if (fs.existsSync(resultsPath)) {
  const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as JsonReport;
  flaky = collectFlaky(report.suites);
}

const lines =
  flaky.length === 0
    ? [MARKER, '### Flaky tests', '', 'No flaky tests in this run.']
    : [
        MARKER,
        '### Flaky tests',
        '',
        `${String(flaky.length)} test(s) failed first and passed on retry:`,
        '',
        ...flaky.map((spec) => `- \`${spec.file}:${String(spec.line)}\` ${spec.title}`),
      ];
const markdown = `${lines.join('\n')}\n`;

fs.writeFileSync(outputPath, markdown);
const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
if (summaryPath) fs.appendFileSync(summaryPath, markdown);

console.log(String(flaky.length));
