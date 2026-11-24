import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORMATS } from './encoders.mjs';
import { REPORT_FORMAT, renderMarkdown, runBenchmark } from './run.mjs';
import { scenarios } from './scenarios.mjs';
import { approximateTokens, bytesBaselineTokens } from './tokens.mjs';

test('corpus has at least twelve scenarios with unique ids', () => {
  assert.ok(scenarios.length >= 12);
  assert.equal(new Set(scenarios.map(scenario => scenario.id)).size, scenarios.length);
});

test('approximate tokens are positive, deterministic', () => {
  assert.equal(approximateTokens(''), 0);
  assert.equal(approximateTokens('{"a":1}'), approximateTokens('{"a":1}'));
  assert.ok(approximateTokens('hello world') >= 2);
  assert.equal(bytesBaselineTokens('abcdefgh'), 2);
});

test('the harness reports every format for two scenarios and renders markdown', () => {
  const report = runBenchmark({ samples: 1, chunk: 16, scenarios: ['kpi-overview', 'refinement-patch'] });
  assert.equal(report.format, REPORT_FORMAT);
  assert.equal(report.boundary, 'offline, synthetic, no model in the loop');
  assert.ok(report.limits.length >= 5);
  assert.equal(report.scenarios.length, 2);
  assert.equal(report.settings.tokenizer.name, 'heuristic-v1');
  for (const scenario of report.scenarios) {
    for (const format of FORMATS) {
      const entry = scenario.formats[format];
      assert.ok(entry.utf8Bytes > 0 && entry.approxTokens > 0, `${scenario.id}/${format} size`);
      assert.equal(entry.stream.valid, true, `${scenario.id}/${format} validates`);
      assert.equal(entry.stream.roundTripEqual, true, `${scenario.id}/${format} round-trips`);
      assert.equal(entry.stream.finalStatus, 'complete');
      assert.ok(Number.isFinite(entry.timing.parseMs) && Number.isFinite(entry.timing.validateMs));
      assert.ok(Number.isFinite(entry.timing.firstValidRenderMs), `${scenario.id}/${format} first valid render`);
      assert.ok(entry.timing.firstValidByteFraction > 0 && entry.timing.firstValidByteFraction <= 1);
    }
    assert.equal(scenario.formats.json.stream.partialRenderSupported, false);
    assert.equal(scenario.formats.statements.stream.partialRenderSupported, true);
    assert.ok(scenario.formats.statements.timing.firstValidByteFraction < 1, 'statement streams admit a partial tree early');
    assert.equal(scenario.viewCorruptions.length, 6);
    assert.ok(scenario.viewCorruptions.some(c => c.applicable && c.repair.outcome === 'repaired'), 'at least one corruption is repaired by the session');
    assert.ok(scenario.viewCorruptions.filter(c => c.applicable).every(c => c.strict.accepted === false), 'every corruption is rejected strictly');
    assert.equal(scenario.streamCorruptions.length, 2);
    for (const damage of scenario.streamCorruptions) assert.deepEqual(Object.keys(damage.formats), [...FORMATS]);
  }
  const refinement = report.scenarios.find(scenario => scenario.id === 'refinement-patch').refinement;
  for (const format of FORMATS) {
    assert.equal(refinement.delta[format].reproducesRefinedView, true, `${format} delta reproduces the refined view`);
    assert.ok(refinement.delta[format].utf8Bytes < refinement.fullRegeneration[format].utf8Bytes);
  }
  assert.ok(Object.keys(report.repairOutcomeCounts).length > 0);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
  assert.ok(!JSON.stringify(report).includes('/home/'), 'no local paths');
  const markdown = renderMarkdown(report);
  assert.match(markdown, /offline, synthetic, no model in the loop/u);
  assert.match(markdown, /\| Format \| UTF-8 bytes \|/u);
});

test('every authored scenario validates, round-trips and is repair-classified', () => {
  const report = runBenchmark({ samples: 1, chunk: 64 });
  assert.equal(report.scenarios.length, scenarios.length);
  for (const format of FORMATS) assert.equal(report.totals[format].allRoundTripsEqual && report.totals[format].allStreamsValid, true, format);
});
