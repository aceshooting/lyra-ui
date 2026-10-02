import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { availableParallelism, cpus } from 'node:os';
import { dirname } from 'node:path';
import { isMainModule } from './is-main-module.mjs';

export const MAX_DIAGNOSTIC_BYTES = 128 * 1024;

// Keep draining after the budget is exhausted: closing stderr would send SIGPIPE to the runner.
export function boundedOutput(write, limit = MAX_DIAGNOSTIC_BYTES) {
  let remaining = limit;
  return chunk => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const accepted = bytes.subarray(0, Math.max(0, Math.min(remaining, bytes.length)));
    remaining -= accepted.length;
    if (accepted.length) write(accepted);
  };
}

async function main() {
  const [outputPath, command, ...args] = process.argv.slice(2);
  if (!outputPath || !command) throw new Error('Usage: edge-platform-diagnostics.mjs <output-path> <command> [args...]');
  mkdirSync(dirname(outputPath), { recursive: true });
  const file = openSync(outputPath, 'w');
  const record = boundedOutput(bytes => {
    writeSync(file, bytes);
    process.stderr.write(bytes);
  });
  // Channel browsers are supplied by the OS; the Playwright cache is not their executable.
  // Probe failure is diagnostic only and must not prevent the test command from running.
  const probe = spawnSync('microsoft-edge', ['--version'], { encoding: 'utf8', timeout: 5000, maxBuffer: 1024 });
  record(JSON.stringify({
    node: process.version,
    browserVersion: !probe.error && probe.status === 0 ? probe.stdout.trim() : 'probe unavailable',
    reportedCpus: cpus().length,
    allocatedCpus: availableParallelism(),
    concurrencyInput: process.env.WTR_CONCURRENCY ?? 'automatic',
    estimatedDefaultConcurrency: Math.max(1, cpus().length / 2),
    diagnosticByteLimit: MAX_DIAGNOSTIC_BYTES,
  }) + '\n');
  const child = spawn(command, args, {
    stdio: ['inherit', 'inherit', 'pipe'],
    env: { ...process.env, DEBUG: 'pw:browser,pw:api', DEBUG_COLORS: '0' },
  });
  child.stderr.on('data', record);
  let receivedSignal;
  const forward = signal => {
    receivedSignal ??= signal;
    child.kill(signal);
  };
  const onInterrupt = () => forward('SIGINT');
  const onTerminate = () => forward('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  const result = await new Promise(resolve => {
    child.on('error', error => { record(`Diagnostic child error: ${error.message}\n`); });
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  process.removeListener('SIGINT', onInterrupt);
  process.removeListener('SIGTERM', onTerminate);
  closeSync(file);
  // Preserve signal termination, rather than turning a killed run into a successful exit.
  const signal = receivedSignal ?? result.signal;
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = result.code ?? 1;
}

if (isMainModule(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`Edge diagnostics failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
