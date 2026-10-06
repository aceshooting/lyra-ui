import { spawn as spawnChild } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';
import { LINT_SHARD_TOTAL } from './lint-ci-shard.mjs';

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

/** Reuses the complete CI partition; no separate local inventory can omit a check. */
export async function runParallelLint({
  jobs = process.env.CI_JOBS ?? LINT_SHARD_TOTAL,
  spawn = spawnChild,
  cwd = packageDirectory,
  environment = process.env,
  prefixOutput = Boolean(environment.CI),
  write = (text) => process.stdout.write(text),
} = {}) {
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
  if (process.argv.length !== 2) throw new Error('Usage: lint-parallel.mjs (CI_JOBS limits workers).');
  process.exitCode = await runParallelLint();
}
