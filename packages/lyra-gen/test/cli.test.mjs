import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuredLineup, evaluateLineup, evaluateModel, evaluateSemantics } from '../dist/evaluation.js';
import { createReplayRecord, parseGeneratedSource, parseReplayRecord, replayRecord } from '../dist/replay.js';
import { catalogPresetNames, catalogPresets, initialCatalog } from '../dist/catalog.js';
import { buildCatalogPrompt, exportCatalogJsonSchema } from '../dist/prompts.js';

const cli = fileURLToPath(new URL('../bin/lyra-gen.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('../examples/fixtures/contact-form.json', import.meta.url));
const runInput = (input, ...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
const budget = { maxCalls: 1, timeoutMs: 1000, maxInputBytes: 2000, maxOutputBytes: 2000, maxTokens: 500, maxCostUsd: 0.1, maxCostUsdPerCall: 0.1 };
const model = { provider: 'test', id: 'host-exact-id', label: 'Small model' };

test('CLI prompt and schema output are deterministic and validate fails nonzero', () => {
  assert.equal(run('prompt').status, 0);
  assert.equal(run('prompt').stdout, run('prompt').stdout);
  assert.equal(run('schema').status, 0);
  assert.equal(JSON.parse(run('schema').stdout).type, 'object');
  assert.notEqual(run('validate', new URL('./cli.test.mjs', import.meta.url).pathname).status, 0);
  assert.notEqual(run('benchmark', '--iterations', 'NaN').status, 0);
});


test('CLI defaults retain the full prompt and schema while presets use exact reviewed identities', () => {
  assert.equal(run('prompt').stdout, `${buildCatalogPrompt(initialCatalog)}\n`);
  assert.equal(run('schema').stdout, `${JSON.stringify(exportCatalogJsonSchema(initialCatalog), null, 2)}\n`);
  for (const name of catalogPresetNames) {
    const selected = catalogPresets[name];
    const prompt = run('prompt', '--preset', name);
    assert.equal(prompt.status, 0, prompt.stderr || prompt.stdout);
    assert.equal(prompt.stdout, `${buildCatalogPrompt(selected)}\n`);
    const schema = run('schema', '--preset', name);
    assert.equal(schema.status, 0, schema.stderr || schema.stdout);
    assert.deepEqual(JSON.parse(schema.stdout), exportCatalogJsonSchema(selected));
    const markup = run('prompt', '--format', 'markup', '--preset', name);
    assert.equal(markup.status, 0, markup.stderr || markup.stdout);
    assert.equal(JSON.parse(markup.stdout.trim().split('\n').at(-1)).id, selected.id);
  }
});

test('CLI preset validation and recording require the same catalog through replay', () => {
  const catalog = catalogPresets.retrieval;
  const view = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'preset-answer', revision: 3, root: { id: 'answer', type: 'text', text: 'Reviewed answer' } };
  const source = JSON.stringify(view);
  assert.equal(runInput(source, 'validate', '-', '--preset', 'retrieval').status, 0);
  assert.notEqual(runInput(source, 'validate', '-').status, 0);
  const recorded = runInput(source, 'record', '-', '--preset', 'retrieval');
  assert.equal(recorded.status, 0, recorded.stderr || recorded.stdout);
  assert.deepEqual(JSON.parse(recorded.stdout).catalog, view.catalog);
  assert.equal(runInput(recorded.stdout, 'replay', '-', '--preset', 'retrieval').status, 0);
  assert.notEqual(runInput(recorded.stdout, 'replay', '-', '--preset', 'data').status, 0);
  const markup = '<text id="answer">Reviewed answer</text>';
  const fromMarkup = runInput(markup, 'record', '-', '--format', 'markup', '--preset', 'retrieval', '--surface', 'preset-answer', '--revision', '3');
  assert.equal(fromMarkup.status, 0, fromMarkup.stderr || fromMarkup.stdout);
  assert.deepEqual(JSON.parse(fromMarkup.stdout).catalog, view.catalog);
  assert.equal(runInput(fromMarkup.stdout, 'replay', '-', '--preset', 'retrieval').status, 0);
  for (const root of [
    { id: 'field', type: 'input', props: { label: 'Omitted role' } },
    { id: 'action', type: 'button', props: { label: 'Action' }, action: { name: 'undeclared' } },
    { id: 'answer', type: 'text', props: { innerHTML: '<script>run()</script>' } },
  ]) assert.notEqual(runInput(JSON.stringify({ ...view, root }), 'validate', '-', '--preset', 'retrieval').status, 0);
});

test('CLI rejects unknown, missing, repeated and unsupported preset options', () => {
  for (const args of [
    ['prompt', '--preset', 'unknown'], ['schema', '--preset', 'unknown'],
    ['prompt', '--preset'], ['schema', '--preset', 'data', '--preset', 'forms'],
    ['benchmark', '--preset', 'data'],
  ]) assert.notEqual(run(...args).status, 0, args.join(' '));
});

test('offline fixtures validate and benchmark reports measured timings', () => {
  assert.equal(run('validate', fixture).status, 0);
  const report = run('benchmark', '--iterations', '2');
  assert.equal(report.status, 0, report.stderr || report.stdout);
  const value = JSON.parse(report.stdout);
  assert.equal(value.kind, 'offline');
  assert.equal(value.results.length >= 3, true);
  assert.equal(value.results.every(item => item.semanticPass && item.parseMs.samples === 2), true);
  assert.equal(value.providerLatencyMs, null);
});

test('replay preserves explicit provenance and rejects a changed catalog', async () => {
  const scenario = JSON.parse(await readFile(fixture, 'utf8'));
  const record = createReplayRecord({ source: { kind: 'fixture', id: 'contact-form' }, model: null, package: { name: '@aceshooting/lyra-gen', version: '0.1.0' }, catalog: initialCatalog, format: 'json', text: JSON.stringify(scenario.view), surfaceId: scenario.view.surfaceId, revision: 0 });
  assert.equal(record.timings.renderMs, null);
  assert.equal(record.timings.firstChunkMs, null);
  assert.equal(parseReplayRecord(record).ok, true);
  assert.equal(replayRecord(record, initialCatalog).ok, true);
  assert.equal(replayRecord(record, { ...initialCatalog, version: 'other' }).ok, false);
  assert.equal(parseReplayRecord({ ...record, token: 'secret' }).ok, false);
});

test('evaluation refuses unreserved costs before invoking a provider', async () => {
  let calls = 0;
  const report = await evaluateModel({ model, prompt: 'Hello', budget: { ...budget, maxCostUsd: 0 }, provider: async function* () { calls++; yield { text: 'Hi' }; } });
  assert.equal(calls, 0);
  assert.equal(report.status, 'budget-exceeded');
  assert.equal(report.usage.costUsd, null);
});

test('evaluation bounds output, cancels timeout, and sanitizes provider errors', async () => {
  const tooMuch = await evaluateModel({ model, prompt: 'Hello', budget, provider: async function* () { yield { text: 'a'.repeat(3000) }; } });
  assert.equal(tooMuch.status, 'budget-exceeded');
  assert.equal(tooMuch.output, '');
  const timeout = await evaluateModel({ model, prompt: 'Hello', budget: { ...budget, timeoutMs: 10 }, provider: async function* ({ signal }) { await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); yield { text: 'late' }; } });
  assert.equal(timeout.status, 'aborted');
  const failed = await evaluateModel({ model, prompt: 'Hello', budget, provider: () => ({
    [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('Bearer credential-do-not-record')) }),
  }) });
  assert.equal(failed.status, 'provider-error');
  assert.equal(JSON.stringify(failed).includes('credential'), false);
});

test('semantic oracle detects a missing required action rather than only valid syntax', () => {
  const view = { version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 'x', revision: 0, root: { id: 'submit', type: 'button', text: 'Send' } };
  assert.equal(evaluateSemantics(view, { nodes: [{ id: 'submit', type: 'button', action: 'send' }] }).ok, false);
});


test('configured comparison labels require explicit identifiers and share the spending reservation', async () => {
  assert.deepEqual(configuredLineup({}), []);
  const models = configuredLineup({ Luna: { ...model, id: 'exact-luna' }, Astra: { ...model, id: 'exact-astra' } });
  assert.deepEqual(models.map(item => item.label), ['Astra', 'Luna']);
  assert.deepEqual(models.map(item => item.id), ['exact-astra', 'exact-luna']);
  let calls = 0;
  const results = await evaluateLineup({ models, prompt: 'Hello', budget: { ...budget, maxCalls: 2 }, providers: { test: async function* () { calls++; yield { text: 'done' }; } } });
  assert.equal(calls, 1);
  assert.equal(results[1].status, 'budget-exceeded');
  assert.equal(results[0].usage.costUsd, null);
});

test('evaluation terminates streams of empty chunks and refuses undeclared provider metadata', async () => {
  const empty = await evaluateModel({ model, prompt: '', budget: { ...budget, maxOutputBytes: 2 }, provider: async function* () { while (true) yield { text: '' }; } });
  assert.equal(empty.status, 'budget-exceeded');
  const extra = await evaluateModel({ model, prompt: '', budget, provider: async function* () { yield { text: '', usage: { credential: 123456 } }; } });
  assert.equal(extra.status, 'provider-error');
  assert.equal(JSON.stringify(extra).includes('123456'), false);
});

test('evaluation fails closed when required numeric ceilings are missing', async () => {
  const { maxOutputBytes: _omitted, ...incomplete } = budget;
  let called = false;
  const report = await evaluateModel({ model, prompt: '', budget: incomplete, provider: async function* () { called = true; yield { text: 'no' }; } });
  assert.equal(called, false);
  assert.equal(report.status, 'budget-exceeded');
});

test('replay envelope admission does not invoke accessors', () => {
  let invoked = false;
  const value = Object.defineProperty({}, 'version', { enumerable: true, get() { invoked = true; return '1'; } });
  assert.equal(parseReplayRecord(value).ok, false);
  assert.equal(invoked, false);
});


test('generated JSON rejects duplicate decoded keys and oversized source before validation', () => {
  for (const text of ['{"same":1,"same":2}', '{"same":1,"sa\\u006de":2}']) {
    const result = parseGeneratedSource(text, 'json', initialCatalog);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, 'json.duplicate-key');
  }
  const oversized = parseGeneratedSource(' '.repeat(262145) + '{}', 'json', initialCatalog);
  assert.equal(oversized.ok, false);
  assert.equal(oversized.diagnostics[0].code, 'source.bytes');
});

test('CLI validates complete untrusted JSON before view or scenario extraction', async () => {
  const scenario = JSON.parse(await readFile(fixture, 'utf8'));
  const valid = JSON.stringify(scenario.view);
  const duplicateView = valid.replace('"revision":0', '"revision":1,"revision":0');
  const duplicateScenario = `{"id":"fixture","view":null,"view":${valid},"oracle":{}}`;
  for (const command of ['validate', 'record']) {
    for (const input of [duplicateView, duplicateScenario]) {
      const result = runInput(input, command, '-');
      assert.notEqual(result.status, 0);
      assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'json.duplicate-key');
    }
    assert.notEqual(runInput(' '.repeat(262145) + valid, command, '-').status, 0);
    assert.notEqual(runInput(' '.repeat(1048577) + valid, command, '-').status, 0);
  }
});

test('CLI replay rejects duplicate envelope keys and duplicate embedded view keys', async () => {
  const scenario = JSON.parse(await readFile(fixture, 'utf8'));
  const record = createReplayRecord({ source: { kind: 'fixture', id: scenario.id }, model: null, package: { name: '@aceshooting/lyra-gen', version: '0.1.0' }, catalog: initialCatalog, format: 'json', text: JSON.stringify(scenario.view), surfaceId: scenario.view.surfaceId, revision: 0 });
  const duplicateEnvelope = JSON.stringify(record).replace('"revision":0', '"revision":1,"revision":0');
  const duplicateView = JSON.stringify({ ...record, text: record.text.replace('"revision":0', '"revision":1,"revision":0') });
  for (const input of [duplicateEnvelope, duplicateView]) {
    const result = runInput(input, 'replay', '-');
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'json.duplicate-key');
  }
  assert.notEqual(runInput(' '.repeat(1048577) + JSON.stringify(record), 'replay', '-').status, 0);
});

test('CLI benchmark applies strict JSON admission to supplied fixture directories', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-gen-cli-json-'));
  try {
    const text = await readFile(fixture, 'utf8');
    await writeFile(join(directory, 'scenario.json'), text.replace('"revision": 0', '"revision": 1, "revision": 0'));
    const result = run('benchmark', '--fixtures', directory, '--iterations', '1');
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'json.duplicate-key');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
