#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputFile = path.join(repoRoot, '.github', 'release-qualification.json');

function scalar(value) {
  value = value.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith(`'`) && value.endsWith(`'`)) ||
      (value.startsWith('"') && value.endsWith('"')))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function workflowName(source, label) {
  const match = source.match(/^name:\s*(.+?)\s*$/m);
  if (!match)
    throw new Error(`${label}: workflow has no static top-level name`);
  return scalar(match[1]);
}

function markedJobs(source, label) {
  const lines = source.split(/\r?\n/);
  const jobsLine = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsLine < 0) throw new Error(`${label}: workflow has no jobs mapping`);
  const jobs = [];

  for (let index = jobsLine + 1; index < lines.length; index += 1) {
    const marker = lines[index].match(
      /^\s{2}#\s*release-qualification:\s*(required|matrix)\s*$/
    );
    if (!marker) continue;
    const header = lines[index + 1]?.match(/^\s{2}([A-Za-z0-9_-]+):\s*$/);
    if (!header)
      throw new Error(
        `${label}: release-qualification marker is not directly above a job`
      );
    let end = index + 2;
    while (end < lines.length && !/^\s{2}[A-Za-z0-9_-]+:\s*$/.test(lines[end]))
      end += 1;
    jobs.push({
      id: header[1],
      kind: marker[1],
      lines: lines.slice(index + 2, end),
    });
  }

  if (jobs.length === 0)
    throw new Error(`${label}: no release-qualification jobs are marked`);
  return jobs;
}

function jobName(job) {
  const name = job.lines.find((line) => /^\s{4}name:\s*/.test(line));
  return name ? scalar(name.replace(/^\s{4}name:\s*/, '')) : job.id;
}

function parseInlineArray(value, label) {
  const match = value.trim().match(/^\[(.*)\]$/);
  if (!match)
    throw new Error(`${label}: matrix axis must use a finite inline array`);
  if (match[1].trim() === '') return [];
  return match[1].split(',').map((entry) => scalar(entry));
}

function matrixRows(job, label, dynamicAxes = {}) {
  const matrixLine = job.lines.findIndex((line) =>
    /^\s{6}matrix:\s*$/.test(line)
  );
  if (matrixLine < 0)
    throw new Error(
      `${label}/${job.id}: marked matrix job has no strategy matrix`
    );
  const matrix = job.lines.slice(matrixLine + 1);
  const includeLine = matrix.findIndex((line) =>
    /^\s{8}include:\s*$/.test(line)
  );
  if (includeLine >= 0) {
    const rows = [];
    let current;
    for (const line of matrix.slice(includeLine + 1)) {
      if (/^\s{8}\S/.test(line)) break;
      const first = line.match(/^\s{10}-\s+([A-Za-z0-9_-]+):\s*(.+?)\s*$/);
      if (first) {
        current = { [first[1]]: scalar(first[2]) };
        rows.push(current);
        continue;
      }
      const continuation = line.match(/^\s{12}([A-Za-z0-9_-]+):\s*(.+?)\s*$/);
      if (continuation && current)
        current[continuation[1]] = scalar(continuation[2]);
    }
    if (rows.length === 0)
      throw new Error(`${label}/${job.id}: matrix include has no finite rows`);
    return rows;
  }

  const axes = [];
  for (const line of matrix) {
    const axis = line.match(/^\s{8}([A-Za-z0-9_-]+):\s*(\[.*\])\s*$/);
    if (axis) {
      axes.push([axis[1], parseInlineArray(axis[2], `${label}/${job.id}`)]);
      continue;
    }
    const dynamicAxis = line.match(
      /^\s{8}([A-Za-z0-9_-]+):\s*(.+?)\s*$/
    );
    if (dynamicAxis && Object.hasOwn(dynamicAxes, dynamicAxis[1])) {
      const binding = dynamicAxes[dynamicAxis[1]];
      if (dynamicAxis[2] !== binding.expression) {
        throw new Error(
          `${label}/${job.id}: dynamic matrix axis '${dynamicAxis[1]}' is not bound to ${binding.expression}`
        );
      }
      axes.push([dynamicAxis[1], binding.values]);
      continue;
    }
    if (/^\s{8}[A-Za-z0-9_-]+:/.test(line)) break;
  }
  if (axes.length === 0)
    throw new Error(`${label}/${job.id}: matrix has no finite axes`);
  let rows = [{}];
  for (const [key, values] of axes) {
    rows = rows.flatMap((row) =>
      values.map((value) => ({ ...row, [key]: value }))
    );
  }
  return rows;
}

function interpolateMatrix(template, row, label) {
  const result = template.replace(
    /\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}/g,
    (expression, key) => (Object.hasOwn(row, key) ? row[key] : expression)
  );
  if (/\$\{\{\s*matrix\./.test(result)) {
    throw new Error(
      `${label}: unresolved matrix expression in ${JSON.stringify(result)}`
    );
  }
  return result;
}

function requiredJobNames(source, label, dynamicAxes) {
  const names = [];
  for (const job of markedJobs(source, label)) {
    const name = jobName(job);
    if (job.kind === 'required') names.push(name);
    else {
      for (const row of matrixRows(job, label, dynamicAxes))
        names.push(interpolateMatrix(name, row, `${label}/${job.id}`));
    }
  }
  if (new Set(names).size !== names.length)
    throw new Error(`${label}: qualification job names are not unique`);
  return names.sort((a, b) => a.localeCompare(b));
}

function workflowDispatchCsvDefault(source, inputName, label) {
  const lines = source.split(/\r?\n/);
  const dispatchLine = lines.findIndex((line) =>
    /^\s{2}workflow_dispatch:\s*$/.test(line)
  );
  if (dispatchLine < 0) {
    throw new Error(`${label}: workflow has no workflow_dispatch mapping`);
  }
  let dispatchEnd = dispatchLine + 1;
  while (
    dispatchEnd < lines.length &&
    !/^(?:\S|\s{2}\S)/.test(lines[dispatchEnd])
  ) {
    dispatchEnd += 1;
  }
  const inputsLine = lines.findIndex(
    (line, index) =>
      index > dispatchLine &&
      index < dispatchEnd &&
      /^\s{4}inputs:\s*$/.test(line)
  );
  if (inputsLine < 0) {
    throw new Error(`${label}: workflow_dispatch has no inputs mapping`);
  }
  const inputLine = lines.findIndex(
    (line, index) =>
      index > inputsLine &&
      index < dispatchEnd &&
      line === `      ${inputName}:`
  );
  if (inputLine < 0) {
    throw new Error(`${label}: workflow_dispatch has no ${inputName} input`);
  }
  let end = inputLine + 1;
  while (end < lines.length && !/^\s{0,6}\S/.test(lines[end])) end += 1;
  const defaultLine = lines
    .slice(inputLine + 1, end)
    .find((line) => /^\s{8}default:\s*/.test(line));
  if (!defaultLine) {
    throw new Error(`${label}: ${inputName} input has no finite default`);
  }
  const value = scalar(defaultLine.replace(/^\s{8}default:\s*/, ''));
  const values = value.split(',').map((entry) => entry.trim());
  if (
    values.length === 0 ||
    values.some((entry) => !/^[A-Za-z0-9_-]+$/.test(entry)) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(
      `${label}: ${inputName} input default is not a unique finite list`
    );
  }
  return values;
}

export function deriveReleaseQualification({
  ciSource,
  fullEngineSource,
  testAllBrowsersSource,
}) {
  const testBrowsers = workflowDispatchCsvDefault(
    testAllBrowsersSource,
    'browsers',
    'test-all-browsers'
  );
  return {
    schemaVersion: 1,
    workflows: {
      ci: {
        name: workflowName(ciSource, 'CI'),
        path: '.github/workflows/ci.yml',
        event: 'push',
        headBranch: 'main',
        requiredJobs: requiredJobNames(ciSource, 'CI'),
      },
      fullEngine: {
        name: workflowName(fullEngineSource, 'full-engine'),
        path: '.github/workflows/full-engine.yml',
        event: 'workflow_dispatch',
        headBranch: 'main',
        requiredJobs: requiredJobNames(fullEngineSource, 'full-engine'),
      },
      testAllBrowsers: {
        name: workflowName(testAllBrowsersSource, 'test-all-browsers'),
        path: '.github/workflows/test-all-browsers.yml',
        event: 'workflow_dispatch',
        headBranch: 'main',
        requiredJobs: requiredJobNames(
          testAllBrowsersSource,
          'test-all-browsers',
          {
            browser: {
              expression: '${{ fromJSON(needs.plan.outputs.browsers) }}',
              values: testBrowsers,
            },
          }
        ),
      },
    },
  };
}

export function generateReleaseQualification() {
  return deriveReleaseQualification({
    ciSource: readFileSync(
      path.join(repoRoot, '.github', 'workflows', 'ci.yml'),
      'utf8'
    ),
    fullEngineSource: readFileSync(
      path.join(repoRoot, '.github', 'workflows', 'full-engine.yml'),
      'utf8'
    ),
    testAllBrowsersSource: readFileSync(
      path.join(repoRoot, '.github', 'workflows', 'test-all-browsers.yml'),
      'utf8'
    ),
  });
}

function serialized(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mode = process.argv[2] ?? '--check';
  const expected = serialized(generateReleaseQualification());
  if (mode === '--write') {
    writeFileSync(outputFile, expected);
    console.log(`Wrote ${path.relative(repoRoot, outputFile)}.`);
  } else if (mode === '--check') {
    const actual = readFileSync(outputFile, 'utf8');
    if (actual !== expected) {
      throw new Error(
        '.github/release-qualification.json is stale; run node scripts/generate-release-qualification.mjs --write'
      );
    }
    console.log('Release qualification manifest is fresh.');
  } else {
    throw new Error(
      'Usage: generate-release-qualification.mjs [--check|--write]'
    );
  }
}
