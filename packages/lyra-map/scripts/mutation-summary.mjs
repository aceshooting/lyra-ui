#!/usr/bin/env node
// Turns Stryker's JSON report into a Markdown summary for the job page of the "Quality tools" workflow.
// A score never fails it: surviving mutants are a worklist. It fails only when the report cannot be
// trusted, which is a tool or infrastructure problem: it is missing, holds no mutants, or holds no
// mutant that could be tested.
//
//   node scripts/mutation-summary.mjs [reports/mutation/mutation.json] [--max-survivors 15]
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KILLED = new Set(['Killed', 'Timeout']);
const UNDETECTED = new Set(['Survived', 'NoCoverage']);

/** Stryker's score: detected mutants over all mutants the tests could have detected (errors are excluded). */
export function scoreOf(counts) {
  const detected = counts.killed;
  const total = counts.killed + counts.survived;
  return total === 0 ? 100 : (detected / total) * 100;
}

export function summarizeReport(report) {
  const files = Object.entries(report.files ?? {}).map(([name, file]) => {
    const counts = { killed: 0, survived: 0, errors: 0 };
    const survivors = [];
    for (const mutant of file.mutants) {
      if (KILLED.has(mutant.status)) counts.killed += 1;
      else if (UNDETECTED.has(mutant.status)) {
        counts.survived += 1;
        survivors.push({
          line: mutant.location.start.line, column: mutant.location.start.column,
          mutator: mutant.mutatorName, replacement: mutant.replacement ?? '',
          original: (file.source ?? '').split('\n')[mutant.location.start.line - 1]?.trim() ?? '',
        });
      } else if (mutant.status === 'RuntimeError' || mutant.status === 'CompileError') counts.errors += 1;
    }
    survivors.sort((left, right) => left.line - right.line || left.column - right.column);
    return { name, counts, score: scoreOf(counts), survivors };
  }).sort((left, right) => (left.name < right.name ? -1 : 1));
  const total = files.reduce((sum, file) => ({
    killed: sum.killed + file.counts.killed, survived: sum.survived + file.counts.survived, errors: sum.errors + file.counts.errors,
  }), { killed: 0, survived: 0, errors: 0 });
  return { files, total: { counts: total, score: scoreOf(total) } };
}

/** Throws when the report proves the tool did not do its job (as opposed to the tests being weak). */
export function assertUsableReport(summary) {
  const { killed, survived, errors } = summary.total.counts;
  if (summary.files.length === 0 || killed + survived + errors === 0) {
    throw new Error('The Stryker report holds no mutants: the tool did not run against the configured modules.');
  }
  if (killed + survived === 0) {
    throw new Error('The Stryker report holds mutants, but no mutant could be tested (all errored): the test runner or its sandbox is broken.');
  }
}

const cell = (value) => String(value).replaceAll('|', '\\|').replaceAll('`', "'").replaceAll('\n', ' ');

export function renderMarkdown(summary, { maxSurvivors = 15 } = {}) {
  const out = ['## Mutation testing (Stryker, `@aceshooting/lyra-map` logic modules)', '', 'The score gates nothing; the job fails only if Stryker or its report is broken. A surviving mutant is a code change no test notices; read the list as a worklist for missing tests.', ''];
  out.push('| File | Score | Killed | Survived | Errors |', '|---|---|---|---|---|');
  for (const file of summary.files) out.push(`| \`${file.name}\` | ${file.score.toFixed(1)}% | ${file.counts.killed} | ${file.counts.survived} | ${file.counts.errors} |`);
  const { counts, score } = summary.total;
  out.push(`| **Total** | **${score.toFixed(1)}%** | ${counts.killed} | ${counts.survived} | ${counts.errors} |`, '');
  for (const file of summary.files.filter((entry) => entry.survivors.length > 0)) {
    out.push(`<details><summary><code>${file.name}</code>: ${file.survivors.length} surviving mutant(s)</summary>`, '', '| Line:column | Mutator | Replacement | Source line |', '|---|---|---|---|');
    for (const survivor of file.survivors.slice(0, maxSurvivors)) {
      out.push(`| ${survivor.line}:${survivor.column} | ${survivor.mutator} | \`${cell(survivor.replacement).slice(0, 60)}\` | \`${cell(survivor.original).slice(0, 90)}\` |`);
    }
    if (file.survivors.length > maxSurvivors) out.push('', `…and ${file.survivors.length - maxSurvivors} more in the HTML report.`);
    out.push('', '</details>', '');
  }
  return `${out.join('\n')}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const limit = args.indexOf('--max-survivors');
  const maxSurvivors = limit >= 0 ? Number(args[limit + 1]) : 15;
  // The first argument that is neither a flag nor the value of --max-survivors.
  const path = args.find((argument, index) => !argument.startsWith('--') && (limit < 0 || index !== limit + 1)) ?? 'reports/mutation/mutation.json';
  const summary = summarizeReport(JSON.parse(readFileSync(path, 'utf8')));
  const markdown = renderMarkdown(summary, { maxSurvivors });
  process.stdout.write(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  assertUsableReport(summary);
}
