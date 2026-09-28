#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { analyzeLocaleInventory, artifactProblems, renderLocaleArtifacts } from './locale-manifest.mjs';

const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) {
  throw new Error('usage: node scripts/generate-locale-manifest.mjs [--check]');
}

const analysis = await analyzeLocaleInventory();
const artifacts = renderLocaleArtifacts(analysis);
if (check) {
  const problems = await artifactProblems(artifacts);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  }
} else {
  for (const [file, content] of artifacts) await writeFile(file, content);
}
