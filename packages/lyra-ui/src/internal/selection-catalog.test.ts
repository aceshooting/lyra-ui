import { expect } from '@open-wc/testing';
import { normalizeSelectionValue, snapshotSelectionCatalog } from './selection-catalog.js';

describe('selection catalog snapshots', () => {
  it('preserves ordered first occurrences and clone-owns display configuration', () => {
    const source = [{ code: ' gb ', label: 'Britain', group: 'Common' }, { code: 'FR', disabled: true }, { code: 'GB' }];
    const rows = snapshotSelectionCatalog(source, (code) => code.trim().toUpperCase());
    source[0]!.label = 'Changed';
    expect(rows?.map((row) => row.code)).to.deep.equal(['GB', 'FR']);
    expect(rows?.[0]?.label).to.equal('Britain');
    expect(rows?.[0]?.group).to.equal('Common');
    expect(rows?.[1]?.disabled).to.equal(true);
    expect(Object.isFrozen(rows)).to.equal(true);
    expect(Object.isFrozen(rows?.[0])).to.equal(true);
  });

  it('does not invoke array or row accessors and bounds hostile catalogs', () => {
    let reads = 0;
    const source: unknown[] = [{ code: 'US', get label() { reads++; return 'Unsafe'; } }, 'FR'];
    Object.defineProperty(source, 2, { get() { reads++; return 'GB'; } });
    const rows = snapshotSelectionCatalog(source, (code) => code);
    expect(reads).to.equal(0);
    expect(rows?.map((row) => row.code)).to.deep.equal(['FR']);
    expect(snapshotSelectionCatalog(Array.from({ length: 1100 }, (_, i) => String(i)), (code) => code)?.length).to.equal(1024);
  });

  it('distinguishes omitted defaults from an explicitly empty or malformed catalog', () => {
    expect(snapshotSelectionCatalog(undefined, (code) => code)).to.equal(undefined);
    expect(snapshotSelectionCatalog(null, (code) => code)).to.equal(undefined);
    expect(snapshotSelectionCatalog([], (code) => code)).to.deep.equal([]);
    expect(snapshotSelectionCatalog({}, (code) => code)).to.deep.equal([]);
    expect(snapshotSelectionCatalog(['', ' '], (code) => code.trim())).to.deep.equal([]);
  });
});

describe('selection catalog snapshots of mixed and hostile inputs', () => {
  const identity = (code: string): string => code;

  it('skips rows that are not strings or objects, and objects whose code is not a string', () => {
    const rows = snapshotSelectionCatalog(['US', null, 5, undefined, { code: 7 }, { label: 'no code' }, { code: 'FR' }], identity);
    expect(rows?.map((row) => row.code)).to.deep.equal(['US', 'FR']);
  });

  it('treats an array whose length cannot be read safely as an empty catalog', () => {
    const hostile = new Proxy(['US'], { getOwnPropertyDescriptor() { throw new Error('descriptor reflection failed'); } });
    expect(snapshotSelectionCatalog(hostile, identity)).to.deep.equal([]);
    expect(snapshotSelectionCatalog(['US'], identity)?.map((row) => row.code)).to.deep.equal(['US']);
  });

  it('treats a revoked proxy as an empty catalog instead of throwing', () => {
    const { proxy, revoke } = Proxy.revocable([] as string[], {});
    revoke();
    expect(() => snapshotSelectionCatalog(proxy, identity)).not.to.throw();
    expect(snapshotSelectionCatalog(proxy, identity)).to.deep.equal([]);
  });

  it('normalizes a selection value by trimming strings and emptying everything else', () => {
    expect(normalizeSelectionValue('  gb ')).to.equal('gb');
    expect(normalizeSelectionValue(42)).to.equal('');
    expect(normalizeSelectionValue(null)).to.equal('');
    expect(normalizeSelectionValue({ code: 'GB' })).to.equal('');
  });
});
