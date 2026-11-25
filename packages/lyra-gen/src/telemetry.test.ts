import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGenTelemetry, observeGenView, type LyraGenMetric, type LyraGenSpan, type LyraGenUsage } from './telemetry.js';

const harness = () => {
  let clock = 1000;
  const spans: LyraGenSpan[] = [];
  const metrics: LyraGenMetric[] = [];
  const usage: LyraGenUsage[] = [];
  const telemetry = createGenTelemetry({ onSpan: span => spans.push(span), onMetric: metric => metrics.push(metric), onUsage: item => usage.push(item), now: () => clock });
  return { telemetry, spans, metrics, usage, tick: (ms: number) => { clock += ms; } };
};

test('time wraps sync and async phases in OpenTelemetry-shaped spans and rethrows failures', async () => {
  const { telemetry, spans, tick } = harness();
  assert.equal(telemetry.time('parse', () => { tick(5); return 42; }, { bytes: 10 }), 42);
  assert.deepEqual(spans[0], { name: 'lyra.gen.parse', startTime: 1000, endTime: 1005, durationMs: 5, status: 'ok', attributes: { bytes: 10 } });
  assert.throws(() => telemetry.time('validate', () => { throw new Error('boom'); }), /boom/);
  assert.equal(spans[1]!.status, 'error');
  assert.equal(await telemetry.time('render', async () => { tick(3); return 'x'; }), 'x');
  assert.equal(spans[2]!.name, 'lyra.gen.render');
  await assert.rejects(telemetry.time('repair', () => Promise.reject(new Error('no'))));
  assert.equal(spans[3]!.status, 'error');
  const open = telemetry.startSpan('lyra.gen.preview');
  open.end({ nodes: 3 });
  open.end({ nodes: 9 });
  assert.equal(spans.length, 5);
  assert.equal(spans[4]!.attributes['nodes'], 3);
});

test('attributes keep only numbers, booleans and identifier-like strings', () => {
  const { telemetry, spans } = harness();
  telemetry.startSpan('s', { prompt: 'Show me the revenue for Jane Doe', ok: true, size: 4, bad: Number.NaN, code: 'schema.range', nested: { a: 1 }, text: 'x'.repeat(200) }).end();
  assert.deepEqual(spans[0]!.attributes, { ok: true, size: 4, code: 'schema.range' });
});

test('recordUsage passes provider-reported tokens through and reports metrics', () => {
  const { telemetry, usage, metrics } = harness();
  telemetry.recordUsage({ inputTokens: 120, outputTokens: 30.9, model: 'model-1' });
  telemetry.recordUsage({ inputTokens: -4, outputTokens: Number.NaN, model: 'a secret prompt' });
  assert.deepEqual(usage, [{ inputTokens: 120, outputTokens: 30, model: 'model-1' }, { inputTokens: 0, outputTokens: 0 }]);
  assert.deepEqual(metrics[0], { name: 'lyra.gen.tokens.input', value: 120, attributes: { model: 'model-1' } });
});

test('a throwing host callback never breaks the pipeline', () => {
  const telemetry = createGenTelemetry({ onSpan: () => { throw new Error('host'); } });
  assert.equal(telemetry.time('parse', () => 1), 1);
});

test('observeGenView reports revisions, errors, state changes and actions without values', () => {
  const { telemetry, spans, metrics, tick } = harness();
  const target = new EventTarget();
  const observation = observeGenView(target, telemetry);
  const fire = (type: string, detail: unknown): void => { target.dispatchEvent(new CustomEvent(type, { detail })); };
  tick(40);
  fire('lr-gen-ready', { surfaceId: 'dash', revision: 2, changes: { added: ['a', 'b'], changed: ['c'], removed: [] } });
  assert.deepEqual(spans[0], { name: 'lyra.gen.revision', startTime: 1000, endTime: 1040, durationMs: 40, status: 'ok', attributes: { surfaceId: 'dash', revision: 2, added: 2, changed: 1, removed: 0 } });
  observation.markRequest();
  tick(7);
  fire('lr-gen-error', { diagnostics: [{ code: 'schema.range', severity: 'error', message: 'secret user text', path: '/x' }, { code: 'props.unknown', severity: 'warning', message: 'm', path: '' }] });
  assert.equal(spans[1]!.durationMs, 7);
  assert.equal(spans[1]!.status, 'error');
  assert.deepEqual(spans[1]!.attributes, { diagnosticCount: 2, codes: 'schema.range,props.unknown', errorCount: 1 });
  fire('lr-gen-state-change', { surfaceId: 'dash', revision: 2, nodeId: 'field', values: { name: 'Jane Doe' }, dirty: ['/name'] });
  fire('lr-gen-action', { surfaceId: 'dash', nodeId: 'go', revision: 2, name: 'submit', payload: { email: 'jane@example.com' } });
  assert.deepEqual(metrics.map(metric => metric.name), ['lyra.gen.state_change', 'lyra.gen.action']);
  assert.deepEqual(metrics[0]!.attributes, { surfaceId: 'dash', nodeId: 'field', revision: 2, dirtyCount: 1 });
  assert.equal(metrics[1]!.attributes['action'], 'submit');
  assert.equal(typeof metrics[1]!.attributes['payloadBytes'], 'number');
  const everything = JSON.stringify([spans, metrics]);
  assert.ok(!everything.includes('Jane') && !everything.includes('jane@') && !everything.includes('secret'));
  observation.dispose();
  fire('lr-gen-ready', { surfaceId: 'dash', revision: 3 });
  assert.equal(spans.length, 2);
});
