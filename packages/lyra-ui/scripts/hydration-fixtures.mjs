import { isMainModule } from './is-main-module.mjs';

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the server-rendered, hydrated fixture group (test/hydration/) once per engine, all engines
// concurrently, so three engines cost roughly one engine's wall time. Each engine's output is
// printed whole when it finishes rather than interleaved.
const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const HYDRATION_FIXTURE_ENGINES = Object.freeze(['chromium', 'firefox', 'webkit']);

/** `HYDRATION_FIXTURE_BROWSERS=chromium,webkit` narrows the engines; unknown names are rejected. */
export function parseEngines(value) {
  if (value === undefined || value.trim() === '') return [...HYDRATION_FIXTURE_ENGINES];
  const engines = [...new Set(value.split(',').map((engine) => engine.trim()).filter(Boolean))];
  const unknown = engines.filter((engine) => !HYDRATION_FIXTURE_ENGINES.includes(engine));
  if (unknown.length || !engines.length) {
    throw new Error(`HYDRATION_FIXTURE_BROWSERS accepts ${HYDRATION_FIXTURE_ENGINES.join(', ')}; received ${JSON.stringify(value)}.`);
  }
  return engines;
}

/** An OS-assigned free port, so concurrent engines never race WTR's own port probe. */
function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function runEngine(engine, port) {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const child = spawn('pnpm', ['exec', 'wtr', '--group', 'hydration'], {
      cwd: packageDirectory,
      env: { ...process.env, WTR_BROWSER: engine, WTR_PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code, signal) => {
      resolveRun({ engine, code: code ?? 1, signal, output, seconds: (Date.now() - started) / 1000 });
    });
  });
}

async function main() {
  const engines = parseEngines(process.env.HYDRATION_FIXTURE_BROWSERS);
  const ports = [];
  for (const _engine of engines) ports.push(await freePort());
  const results = await Promise.all(engines.map((engine, index) => runEngine(engine, ports[index])));
  for (const result of results) {
    console.log(`\n=== hydrated fixtures: ${result.engine} (${result.seconds.toFixed(1)}s, exit ${result.signal ?? result.code})`);
    console.log(result.output.trimEnd());
  }
  const failed = results.filter((result) => result.code !== 0);
  if (failed.length) {
    console.error(`\nHydrated fixtures failed on: ${failed.map((result) => result.engine).join(', ')}`);
    process.exitCode = 1;
  }
}

if (isMainModule(import.meta.url)) await main();
