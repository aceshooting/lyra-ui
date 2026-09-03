#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const exactVersion = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)';
const canonicalNvmrc = new RegExp(`^(${exactVersion})\\r?\\n$`, 'u');
const canonicalRuntimeVersion = new RegExp(`^${exactVersion}$`, 'u');

export function parseNvmrcVersion(source) {
  const match = canonicalNvmrc.exec(source);
  if (!match) {
    throw new Error(
      '.nvmrc must contain exactly one canonical Node patch (for example, 22.23.2) followed by one LF or CRLF terminator',
    );
  }
  return match[1];
}

export function assertExactNodeVersion({ expected, actual }) {
  if (!canonicalRuntimeVersion.test(String(expected ?? ''))) {
    throw new Error(`expected Node version is not a canonical exact patch: ${JSON.stringify(expected)}`);
  }
  if (!canonicalRuntimeVersion.test(String(actual ?? ''))) {
    throw new Error(`active Node version is not a canonical exact patch: ${JSON.stringify(actual)}`);
  }
  if (actual !== expected) {
    throw new Error(`repository requires exact Node ${expected}; active Node is ${actual}`);
  }
  return actual;
}

export async function checkNodeVersionAtRoot(root, actual = process.versions.node) {
  const nvmrcPath = path.join(root, '.nvmrc');
  let source;
  try {
    source = await readFile(nvmrcPath, 'utf8');
  } catch (error) {
    throw new Error(
      `cannot read exact Node authority ${nvmrcPath}: ${error instanceof Error ? error.message : error}`,
    );
  }
  const expected = parseNvmrcVersion(source);
  return assertExactNodeVersion({ expected, actual });
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error('usage: node scripts/check-node-version.mjs');
  }
  const version = await checkNodeVersionAtRoot(repoRoot);
  console.log(`Exact Node authority satisfied: ${version}.`);
}

if (isMainModule(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(`Exact Node check failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
