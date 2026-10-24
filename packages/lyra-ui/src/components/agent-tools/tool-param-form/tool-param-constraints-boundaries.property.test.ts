import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { toolParamChoices, toolParamConstraintFailure, validToolParamConstraints } from './tool-param-constraints.js';
import type { ToolParamFormProperty } from './tool-param-types.js';

describe('tool parameter constraint admission boundaries', () => {
  it('rejects constraints on an incompatible field type independently of their numeric value', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 1000 }), value => {
      const incompatible: ToolParamFormProperty[] = [
        { type: 'boolean', minLength: value },
        { type: 'string', minimum: value },
        { type: 'boolean', maximum: value },
        { type: 'string', minItems: value },
      ];
      for (const field of incompatible) expect(validToolParamConstraints(Object.freeze(field))).to.equal(false);
      expect(validToolParamConstraints(Object.freeze({ type: 'integer', minimum: value, maximum: value }))).to.equal(true);
    }), propertyRuns());
  });

  for (const [name, property] of [
    ['unknown string format', { type: 'string', format: 'hostname' }],
    ['missing array items', { type: 'array' }],
    ['array-valued item schema', { type: 'array', items: [] }],
    ['unsupported item keyword', { type: 'array', items: { type: 'string', enum: ['a'], pattern: 'a' } }],
    ['non-string titled item type', { type: 'array', items: { type: 'number', anyOf: [{ const: 'a', title: 'A' }] } }],
  ] as const) {
    it(`rejects ${name} before accepting any value`, () => {
      expect(Reflect.apply(validToolParamConstraints, undefined, [Object.freeze(property)])).to.equal(false);
    });
  }

  it('preserves raw choice labels when display names are absent and detaches both choice forms', () => {
    for (const property of [
      { type: 'string', enum: ['alpha', 'beta'] },
      { type: 'array', items: { type: 'string', enum: ['alpha', 'beta'] } },
    ] as const) {
      expect(validToolParamConstraints(property)).to.equal(true);
      const choices = toolParamChoices(property)!;
      expect(choices).to.deep.equal([{ value: 'alpha', label: 'alpha' }, { value: 'beta', label: 'beta' }]);
      expect(Object.isFrozen(choices)).to.equal(true);
      expect(choices.every(choice => Object.isFrozen(choice))).to.equal(true);
      expect(choices === toolParamChoices(property)).to.equal(true);
    }
  });

  it('rejects non-array selection payloads even when their primitive values resemble allowed choices', () => {
    const property: ToolParamFormProperty = Object.freeze({ type: 'array', items: { type: 'string' as const, enum: ['yes'] } });
    fc.assert(fc.property(fc.oneof(fc.boolean(), fc.integer(), fc.constant(null), fc.record({ selection: fc.string() })), value => {
      expect(toolParamConstraintFailure(property, value)).to.equal('selection');
    }), propertyRuns());
    expect(toolParamConstraintFailure(property, ['yes'])).to.equal(undefined);
    expect(toolParamConstraintFailure(property, [])).to.equal(undefined);
  });

  for (const [format, invalid, valid] of [
    ['date', '2026/10/24', '2026-10-24'],
    ['email', 'two words@example.org', 'two.words@example.org'],
    ['email', '.name@example.org', 'name@example.org'],
    ['email', 'name.@example.org', 'name@example.org'],
    ['email', 'first..last@example.org', 'first.last@example.org'],
    ['uri', 'https://[', 'https://example.org/resource'],
  ] as const) {
    it(`rejects malformed ${format} value ${JSON.stringify(invalid)} and accepts its valid counterpart`, () => {
      const property = Object.freeze({ type: 'string' as const, format });
      expect(validToolParamConstraints(property)).to.equal(true);
      expect(toolParamConstraintFailure(property, invalid)).to.equal('format');
      expect(toolParamConstraintFailure(property, valid)).to.equal(undefined);
    });
  }
});
