import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { cursorField, cursorList, cursorText, cursorToken } from './source-cursor-projection.js';

it('preserves admitted opaque tokens and owns bounded array projections', () => {
  fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 128 }), fc.array(fc.string(), { maxLength: 20 }), (token, values) => {
    expect(cursorToken(token)).to.equal(token);
    const projected = cursorList(values, 20, () => true);
    expect(projected).to.deep.equal(values);
    expect(projected === values).to.equal(false);
    const length = values.length;
    values.length = 0;
    expect(projected.length).to.equal(length);
  }), propertyRuns());
});

it('rejects any own accessor without invoking it and stops after reflection revokes authority', () => {
  fc.assert(fc.property(fc.string(), value => {
    let reads = 0;
    const input = Object.defineProperty({}, 'value', { get: () => { reads++; return value; } });
    expect(() => cursorField(input, 'value', () => true)).to.throw(TypeError);
    expect(reads).to.equal(0);
    let current = true;
    const proxy = new Proxy({ value }, { getOwnPropertyDescriptor: (target, key) => {
      current = false; return Object.getOwnPropertyDescriptor(target, key);
    } });
    expect(() => cursorField(proxy, 'value', () => current)).to.throw('revoked');
    if (value.length > 0) expect(() => cursorText(value, value.length - 1)).to.throw(TypeError);
    else expect(cursorText(value, 0)).to.equal('');
  }), propertyRuns());
});
