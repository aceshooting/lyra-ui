import { expect } from '@open-wc/testing';
import { toolParamChoices, validToolParamConstraints } from './tool-param-constraints.js';
import type { ToolParamFormProperty } from './tool-param-types.js';

describe('tool param schema memoization', () => {
  const property = { type: 'string', enum: ['a', 'b'], enumNames: ['A', 'B'] } as unknown as ToolParamFormProperty;

  it('derives a field\'s choices once and hands out the same frozen list', () => {
    const first = toolParamChoices(property);
    expect(first === toolParamChoices(property)).to.equal(true);
    expect(Object.isFrozen(first)).to.equal(true);
    expect(first!.map((choice) => choice.label)).to.deep.equal(['A', 'B']);
  });

  it('returns the same validity verdict for a field on every call', () => {
    const bad = { type: 'string', minLength: 5, maxLength: 2 } as unknown as ToolParamFormProperty;
    expect(validToolParamConstraints(property)).to.equal(true);
    expect(validToolParamConstraints(property)).to.equal(true);
    expect(validToolParamConstraints(bad)).to.equal(false);
    expect(validToolParamConstraints(bad)).to.equal(false);
  });

  it('keeps no choices for a field without any', () => {
    const plain = { type: 'string' } as unknown as ToolParamFormProperty;
    expect(toolParamChoices(plain)).to.equal(undefined);
    expect(toolParamChoices(plain)).to.equal(undefined);
  });
});
