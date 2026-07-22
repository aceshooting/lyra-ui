import { expect } from '@open-wc/testing';
import { readPersistedState, writePersistedState } from './persisted-state.js';

/** Type guard used by the shape-mismatch cases below. */
const isOpenRecord = (v: unknown): v is { open: boolean } =>
  typeof v === 'object' && v !== null && typeof (v as { open?: unknown }).open === 'boolean';

/** Accept-anything guard, for the cases that are about storage failures rather than shape. */
const isAnything = (_v: unknown): _v is unknown => true;

describe('persisted-state', () => {
  afterEach(() => localStorage.clear());

  it('round-trips a value through localStorage', () => {
    writePersistedState('lr-test:key', { open: true, width: 42 });
    const isValid = (v: unknown): v is { open: boolean; width: number } =>
      typeof v === 'object' && v !== null && typeof (v as { open?: unknown }).open === 'boolean';
    expect(readPersistedState('lr-test:key', isValid)).to.deep.equal({ open: true, width: 42 });
  });

  it('returns null for an unset key', () => {
    expect(readPersistedState('lr-test:missing', isAnything)).to.equal(null);
  });

  it('returns null and does not throw for malformed JSON', () => {
    localStorage.setItem('lr-test:bad', '{not json');
    expect(readPersistedState('lr-test:bad', isAnything)).to.equal(null);
  });

  it('returns null for a value that fails the validator', () => {
    localStorage.setItem('lr-test:shape', JSON.stringify({ wrong: true }));
    expect(readPersistedState('lr-test:shape', isOpenRecord)).to.equal(null);
  });

  it('returns null for a JSON null, without calling the validator on it', () => {
    localStorage.setItem('lr-test:null', 'null');
    let called = false;
    const guard = (v: unknown): v is { open: boolean } => {
      called = true;
      return isOpenRecord(v);
    };
    expect(readPersistedState('lr-test:null', guard)).to.equal(null);
    expect(called).to.equal(true);
  });

  // Unset-regression: with no storage key configured (the default for every consumer that has
  // not opted into persistence), neither function may read, write, or throw. This is the
  // component-level guarantee lr-app-rail/lr-split rely on to stay byte-for-byte unchanged.
  it('is a no-op for an undefined key on both read and write', () => {
    const before = localStorage.length;
    expect(readPersistedState(undefined, isAnything)).to.equal(null);
    expect(() => writePersistedState(undefined, { anything: true })).to.not.throw();
    expect(localStorage.length).to.equal(before);
  });

  it('is a no-op for an empty-string key on both read and write', () => {
    const before = localStorage.length;
    expect(readPersistedState('', isAnything)).to.equal(null);
    expect(() => writePersistedState('', { anything: true })).to.not.throw();
    expect(localStorage.length).to.equal(before);
  });

  it('does not read storage at all when the key is undefined', () => {
    const original = Storage.prototype.getItem;
    let reads = 0;
    Storage.prototype.getItem = function (this: Storage, k: string) {
      reads++;
      return original.call(this, k);
    };
    try {
      readPersistedState(undefined, isAnything);
      expect(reads).to.equal(0);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  it('does not throw when localStorage.setItem fails (e.g. quota exceeded)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => writePersistedState('lr-test:quota', { a: 1 })).to.not.throw();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('returns null and does not throw when localStorage.getItem fails (e.g. private browsing)', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('SecurityError');
    };
    try {
      expect(readPersistedState('lr-test:blocked', isAnything)).to.equal(null);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  it('does not throw when the value cannot be serialized (circular reference)', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => writePersistedState('lr-test:circular', circular)).to.not.throw();
    expect(localStorage.getItem('lr-test:circular')).to.equal(null);
  });
});
