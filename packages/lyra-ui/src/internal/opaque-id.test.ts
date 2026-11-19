import { expect } from '@open-wc/testing';
import { opaqueId } from './opaque-id.js';

describe('opaque-id', () => {
  it('prefixes and is unique', () => {
    const ids = new Set(Array.from({ length: 500 }, () => opaqueId('x-')));
    expect(ids.size).to.equal(500);
    for (const id of ids) expect(id.startsWith('x-')).to.equal(true);
  });
  it('works with randomUUID removed (insecure origin)', () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const ids = new Set(Array.from({ length: 200 }, () => opaqueId('p')));
      expect(ids.size).to.equal(200);
      for (const id of ids) expect(id).to.match(/^p[0-9a-f]{32}$/);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
  it('falls back to a counter when crypto is unusable', () => {
    const original = crypto.randomUUID;
    const getRandom = crypto.getRandomValues;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    Object.defineProperty(crypto, 'getRandomValues', { value: () => { throw new Error('no'); }, configurable: true });
    try {
      const a = opaqueId('q');
      const b = opaqueId('q');
      expect(a).to.not.equal(b);
      expect(a.startsWith('q')).to.equal(true);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
      Object.defineProperty(crypto, 'getRandomValues', { value: getRandom, configurable: true });
    }
  });
});
