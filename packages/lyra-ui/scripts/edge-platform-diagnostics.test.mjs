import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { boundedOutput, MAX_DIAGNOSTIC_BYTES } from './edge-platform-diagnostics.mjs';

test('caps bytes across chunks and keeps consuming after the cap', () => {
  const chunks = [];
  const write = boundedOutput(chunk => chunks.push(chunk), 7);
  write(Buffer.from('abc'));
  write(Buffer.from('defghijkl'));
  write(Buffer.alloc(1_000_000, 120));
  assert.equal(Buffer.concat(chunks).toString(), 'abcdefg');
});

test('uses a fixed 128KiB diagnostic budget', () => {
  assert.equal(MAX_DIAGNOSTIC_BYTES, 128 * 1024);
});

for (const status of [0, 7]) {
  test(`preserves child exit${status}, stdout and capped stderr artifact`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'lyra-edge-diagnostics-'));
    const log = join(directory, 'edge.log');
    try {
      const result = spawnSync(process.execPath, [
        new URL('./edge-platform-diagnostics.mjs', import.meta.url).pathname,
        log, process.execPath, '-e',
        `process.stdout.write('unchanged stdout\\n'); process.stderr.write('x'.repeat(200000)); process.exitCode = ${status};`,
      ], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
      assert.equal(result.status, status);
      assert.equal(result.stdout, 'unchanged stdout\n');
      const captured = readFileSync(log);
      assert.equal(captured.length, MAX_DIAGNOSTIC_BYTES);
      assert.equal(result.stderr.length, MAX_DIAGNOSTIC_BYTES);
      assert.match(captured.toString(), /"node":"v/);
      assert.match(captured.toString(), /"concurrencyInput"/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}

test('browser probe failure does not prevent tests or expose unrelated environment', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-edge-diagnostics-'));
  const log = join(directory, 'edge.log');
  try {
    const result = spawnSync(process.execPath, [
      new URL('./edge-platform-diagnostics.mjs', import.meta.url).pathname,
      log, process.execPath, '-e', 'process.stdout.write(process.env.DEBUG); process.exitCode = 3;',
    ], { encoding: 'utf8', env: { ...process.env, PATH: directory, PRIVATE_FIXTURE: 'must-not-be-logged' } });
    assert.equal(result.status, 3);
    assert.equal(result.stdout, 'pw:browser,pw:api');
    assert.match(readFileSync(log, 'utf8'), /"browserVersion":"probe unavailable"/);
    assert.doesNotMatch(result.stderr, /must-not-be-logged/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('preserves signal termination and reports spawn failures as failures', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-edge-diagnostics-'));
  try {
    const helper = new URL('./edge-platform-diagnostics.mjs', import.meta.url).pathname;
    const signal = spawnSync(process.execPath, [helper, join(directory, 'signal.log'), process.execPath, '-e', 'process.kill(process.pid, "SIGTERM");']);
    assert.equal(signal.signal, 'SIGTERM');
    const missing = spawnSync(process.execPath, [helper, join(directory, 'missing.log'), join(directory, 'missing-command')], { encoding: 'utf8' });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Diagnostic child error/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test('a received termination stays a signal even if the child exits zero', { timeout: 8000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-edge-diagnostics-'));
  const child = spawn(process.execPath, [
    new URL('./edge-platform-diagnostics.mjs', import.meta.url).pathname,
    join(directory, 'signal.log'), process.execPath, '-e',
    'process.on("SIGTERM", () => process.exit(0)); process.stdout.write("ready\\n"); setInterval(() => {}, 100);',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const exited = once(child, 'exit');
    await once(child.stdout, 'data');
    child.kill('SIGTERM');
    const [, signal] = await exited;
    assert.equal(signal, 'SIGTERM');
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    rmSync(directory, { recursive: true, force: true });
  }
});
