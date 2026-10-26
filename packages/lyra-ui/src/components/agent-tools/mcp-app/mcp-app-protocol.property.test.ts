import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { boundedMcpValue } from './mcp-app-protocol.js';

it('accepts small JSON message trees without changing their contents', () => {
  fc.assert(fc.property(fc.jsonValue({ maxDepth: 4 }), value => {
    const before = JSON.stringify(value);
    expect(boundedMcpValue(value)).to.equal(true);
    expect(JSON.stringify(value)).to.equal(before);
  }), propertyRuns());
});

it('rejects cyclic and non-JSON protocol values without invoking getters', () => {
  const cyclic: Record<string, unknown> = {};
  cyclic['self'] = cyclic;
  let calls = 0;
  const accessor = Object.defineProperty({}, 'value', { get: () => { calls++; return 1; } });
  for (const value of [cyclic, accessor, new Date(), undefined, NaN, Infinity, new Map(), () => 1]) {
    expect(boundedMcpValue(value)).to.equal(false);
  }
  expect(calls).to.equal(0);
});

it('rejects messages beyond the depth, value and text budgets', () => {
  let deep: unknown = null;
  for (let depth = 0; depth < 34; depth++) deep = { value: deep };
  expect(boundedMcpValue(deep)).to.equal(false);
  expect(boundedMcpValue(Array(10_001).fill(null))).to.equal(false);
  expect(boundedMcpValue(Array(10_001))).to.equal(false);
  expect(boundedMcpValue('a'.repeat(1_048_577))).to.equal(false);
});


it('accepts optional undefined object members but rejects undefined array values', () => {
  expect(boundedMcpValue({ method: 'resources/list', params: undefined })).to.equal(true);
  expect(boundedMcpValue([undefined])).to.equal(false);
  expect(boundedMcpValue(Array(3))).to.equal(false);
});
