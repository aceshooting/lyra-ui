import { spawn as spawnChild } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';
import { appendFileSync } from 'node:fs';
import {
  LINT_SHARD_TOTAL, buildLintInventory, commandInvocation, lintCommandWeight, readPackageScripts,
} from './lint-ci-shard.mjs';
import { localWorkerCount } from './local-parallelism.mjs';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runner = fileURLToPath(new URL('./lint-ci-shard.mjs', import.meta.url));

/** Streams a lane's output line by line with a `[lint N/3]` prefix. */
function prefixLines(stream, prefix, write) {
  let pending = '';
  stream.setEncoding?.('utf8');
  stream.on('data', (chunk) => {
    const lines = (pending + chunk).split('\n');
    pending = lines.pop();
    for (const line of lines) write(`${prefix} ${line}\n`);
  });
  stream.on('end', () => {
    if (pending) write(`${prefix} ${pending}\n`);
    pending = '';
  });
}

// A type-check command peaks near this resident size; the memory cap keeps small hosts out of swap.
const LINT_WORKER_MEMORY_MB = 2048;

/**
 * Runs every inventory command (the CI partition's source, so nothing can be omitted) as its own
 * job, longest measured first, on as many workers as the host affords. Each job's output is held
 * and printed whole when it finishes; every job runs so one pass reports all failures.
 */
export async function runLintQueue({
  jobs,
  spawn = spawnChild,
  cwd = packageDirectory,
  environment = process.env,
  scripts = readPackageScripts(cwd),
  write = (text) => process.stdout.write(text),
} = {}) {
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error('Parallel lint jobs must be a positive integer.');
  const inventory = buildLintInventory(scripts)
    .sort((left, right) => lintCommandWeight(right.command) - lintCommandWeight(left.command)
      || left.ordinal - right.ordinal);
  const concurrency = Math.min(jobs, inventory.length);
  console.log(`Parallel lint: ${inventory.length} commands, ${concurrency} concurrent workers.`);
  const timingReport = environment.LINT_TIMING_REPORT || undefined;
  const failures = [];
  let next = 0;
  async function worker() {
    while (next < inventory.length) {
      const item = inventory[next++];
      const label = `[${item.ordinal}/${inventory.length}] ${item.command}`;
      const started = performance.now();
      const { executable, args } = commandInvocation(item.command);
      const { status, output } = await new Promise((resolveStatus) => {
        let output = '';
        const child = spawn(executable, args, { cwd, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
        for (const stream of [child.stdout, child.stderr]) {
          stream?.setEncoding?.('utf8');
          stream?.on('data', (chunk) => { output += chunk; });
        }
        child.once('error', (error) => resolveStatus({ status: 1, output: `${output}${error.message}\n` }));
        child.once('close', (code, signal) => resolveStatus({ status: signal ? 1 : code ?? 1, output }));
      });
      const seconds = Math.round((performance.now() - started) / 100) / 10;
      if (timingReport) {
        appendFileSync(resolve(cwd, timingReport), `${JSON.stringify({ command: item.command, seconds, status })}\n`);
      }
      if (status !== 0) failures.push({ label, status });
      write(`${status === 0 ? 'ok  ' : 'FAIL'} ${label} (${seconds} s)\n`);
      if (status !== 0 && output) write(output.endsWith('\n') ? output : `${output}\n`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  for (const { label, status } of failures) write(`Lint failed (${status}): ${label}\n`);
  return failures[0]?.status ?? 0;
}

/**
 * Without CI_JOBS, sizes a per-command queue to the host (CPU - 2, memory-capped). With
 * CI_JOBS, reuses the fixed three-lane CI partition so CI scheduling stays reproducible.
 */
export async function runParallelLint({
  environment = process.env,
  jobs = environment.CI_JOBS,
  spawn = spawnChild,
  cwd = packageDirectory,
  prefixOutput = Boolean(environment.CI),
  write = (text) => process.stdout.write(text),
  scripts,
} = {}) {
  if (jobs === undefined) {
    return runLintQueue({
      jobs: localWorkerCount({ memoryPerWorkerMb: LINT_WORKER_MEMORY_MB }),
      spawn, cwd, environment, scripts, write,
    });
  }
  const requested = Number(jobs);
  if (!Number.isSafeInteger(requested) || requested < 1)
    throw new Error('Parallel lint jobs must be a positive integer.');
  const concurrency = Math.min(requested, LINT_SHARD_TOTAL);
  console.log(`Parallel lint: ${LINT_SHARD_TOTAL} CI shards, ${concurrency} concurrent workers.`);
  let next = 1;
  const statuses = new Array(LINT_SHARD_TOTAL).fill(0);
  async function worker() {
    while (next <= LINT_SHARD_TOTAL) {
      const shard = next++;
      statuses[shard - 1] = await new Promise((resolveStatus) => {
        const child = spawn(process.execPath, [runner, '--shard', `${shard}/${LINT_SHARD_TOTAL}`], {
          cwd, env: environment, stdio: prefixOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        });
        if (prefixOutput) {
          for (const stream of [child.stdout, child.stderr]) {
            if (stream) prefixLines(stream, `[lint ${shard}/${LINT_SHARD_TOTAL}]`, write);
          }
        }
        child.once('error', (error) => {
          console.error(`Lint shard ${shard}/${LINT_SHARD_TOTAL}: ${error.message}`);
          resolveStatus(1);
        });
        child.once('exit', (code, signal) => resolveStatus(signal ? 1 : code ?? 1));
      });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  for (const [index, status] of statuses.entries()) {
    console.log(`Lint shard ${index + 1}/${LINT_SHARD_TOTAL}: ${status === 0 ? 'passed' : `failed (${status})`}.`);
  }
  return statuses.find((status) => status !== 0) ?? 0;
}

if (isMainModule(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Usage: lint-parallel.mjs (CI_JOBS selects the fixed CI lanes).');
  process.exitCode = await runParallelLint();
}
