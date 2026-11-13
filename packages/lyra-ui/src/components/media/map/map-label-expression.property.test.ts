import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { projectMapLabelOptions } from './map-data-layer-model.js';

function expectOwnedSnapshot(actual: unknown, input: unknown): void {
  if (input === null || typeof input !== 'object') {
    expect(actual).to.equal(input);
    return;
  }
  expect(actual !== input).to.equal(true);
  expect(Object.isFrozen(actual)).to.equal(true);
  expect(Array.isArray(actual)).to.equal(Array.isArray(input));
  expect(Object.keys(actual as object)).to.deep.equal(Object.keys(input));
  for (const key of Object.keys(input)) {
    expectOwnedSnapshot(Reflect.get(actual as object, key), Reflect.get(input, key));
  }
}

describe('map label expression ownership and budgets', () => {
  it('preserves bounded plain JSON literals in a recursively frozen independent snapshot', () => {
    const scalar = fc.oneof(fc.constant(null), fc.boolean(), fc.integer(), fc.string({ maxLength: 25 }));
    const value = fc.oneof(scalar, fc.array(scalar, { maxLength: 8 }),
      fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/), scalar, { maxKeys: 8 }));
    fc.assert(fc.property(fc.array(value, { maxLength: 8 }), values => {
      const expression = ['literal', values];
      const before = structuredClone(expression);
      const projected = projectMapLabelOptions({ expression });
      expect(projected !== undefined).to.equal(true);
      expectOwnedSnapshot(projected!.expression, expression);
      expect(expression).to.deep.equal(before);
      values.length = 0;
      expectOwnedSnapshot(projected!.expression, before);
    }), propertyRuns());
  });

  for (const [name, text] of [
    ['ASCII', 'x'.repeat(65_529)],
    ['three-byte code points', '€'.repeat(21_843)],
    ['four-byte code points', '🙂'.repeat(16_382) + 'x'],
  ] as const) {
    it(`counts UTF-8 text bytes across the operator and ${name} payload at the exact limit`, () => {
      expect(new TextEncoder().encode('literal' + text).byteLength).to.equal(65_536);
      const accepted = projectMapLabelOptions({ expression: ['literal', text] });
      expect(accepted?.expression).to.deep.equal(['literal', text]);
      expect(projectMapLabelOptions({ expression: ['literal', text + 'x'] })).to.equal(undefined);
    });
  }

  it('includes record keys in the cumulative UTF-8 text budget', () => {
    const text = '€'.repeat(21_842);
    const input = ['literal', { key: text }];
    expect(new TextEncoder().encode('literalkey' + text).byteLength).to.equal(65_536);
    expectOwnedSnapshot(projectMapLabelOptions({ expression: input })?.expression, input);
    expect(projectMapLabelOptions({ expression: ['literal', { key: text + 'x' }] })).to.equal(undefined);
  });

  it('accepts depth twelve and rejects a further nested value', () => {
    let value: unknown = null;
    for (let depth = 0; depth < 11; depth++) value = [value];
    const expression = ['literal', value];
    expectOwnedSnapshot(projectMapLabelOptions({ expression })?.expression, expression);
    expect(projectMapLabelOptions({ expression: ['literal', [value]] })).to.equal(undefined);
  });

  it('counts the expression and literal array in the 4096-node work budget', () => {
    const values = Array.from({ length: 4093 }, () => false);
    const expression = ['literal', values];
    expectOwnedSnapshot(projectMapLabelOptions({ expression })?.expression, expression);
    values.push(false);
    expect(projectMapLabelOptions({ expression })).to.equal(undefined);
  });

  it('counts both record keys and values toward the work budget', () => {
    const values = Object.fromEntries(Array.from({ length: 2046 }, (_, index) => [`k${index}`, true]));
    const expression = ['literal', values];
    expectOwnedSnapshot(projectMapLabelOptions({ expression })?.expression, expression);
    values['next'] = true;
    expect(projectMapLabelOptions({ expression })).to.equal(undefined);
  });

  it('accepts repeated references without retaining aliases to caller objects', () => {
    const record = { name: 'Shared', score: 2, enabled: true, missing: null };
    const expression = ['literal', [record, record]];
    const projected = projectMapLabelOptions({ expression });
    expectOwnedSnapshot(projected?.expression, expression);
    record.name = 'Changed';
    expect(JSON.stringify(projected?.expression)).to.equal('["literal",[{"name":"Shared","score":2,"enabled":true,"missing":null},{"name":"Shared","score":2,"enabled":true,"missing":null}]]');
  });

  for (const key of ['__proto__', 'prototype', 'constructor', Symbol('key')]) {
    it(`rejects a literal record containing the forbidden key ${String(key)}`, () => {
      const record = Object.create(null) as Record<PropertyKey, unknown>;
      record[key] = 'value';
      expect(projectMapLabelOptions({ expression: ['literal', record] })).to.equal(undefined);
    });
  }

  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined, 1n, Symbol('value')]) {
    it(`rejects the non-JSON literal ${String(invalid)}`, () => {
      expect(projectMapLabelOptions({ expression: ['literal', invalid] })).to.equal(undefined);
    });
  }

  it('rejects nested record accessors without executing them', () => {
    let reads = 0;
    const record = { get value() { reads++; return 'hidden'; } };
    expect(projectMapLabelOptions({ expression: ['literal', record] })).to.equal(undefined);
    expect(reads).to.equal(0);
  });
});
