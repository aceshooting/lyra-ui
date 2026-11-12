import { expect } from '@open-wc/testing';
import {
  admitSnapshotArray, projectSnapshotArray, snapshotArrayStillAdmitted, snapshotStructuredData,
} from './structured-snapshot.js';

describe('structured snapshot boundary contracts', () => {
  for (const profile of ['form', 'schema', 'chart', 'chartData'] as const) {
    it(`bounds oversized arrays in the ${profile} profile and reports truncation once`, () => {
      const limit = profile === 'schema' ? 50000 : 10000;
      const source = new Array<unknown>(limit + 1); source[0] = 'first'; source[limit] = 'outside';
      let truncated = 0;
      const result = snapshotStructuredData(source, { profile, onArrayTruncate: () => truncated++ });
      const output = result.value as readonly unknown[];
      expect(result.invalid).to.equal(false); expect(result.truncated).to.equal(true);
      expect(truncated).to.equal(1); expect(output.length).to.be.at.most(limit);
      expect(output[0]).to.equal('first'); expect(output.includes('outside')).to.equal(false);
      expect(Object.isFrozen(output)).to.equal(true); expect(source.length).to.equal(limit + 1);
    });
  }

  for (const profile of ['chart', 'chartData'] as const) {
    it(`rejects an array revoked during its length inspection in the ${profile} profile`, () => {
      const source = Proxy.revocable([1], { getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key === 'length') source.revoke();
        return descriptor;
      } });
      const result = snapshotStructuredData(source.proxy, { profile });
      expect(result.value === undefined).to.equal(true); expect(result.invalid).to.equal(true);
      expect(result.truncated).to.equal(false);
    });
  }

  it('omits an over-deep schema branch while preserving its independent sibling', () => {
    const result = snapshotStructuredData({ nested: { value: true }, label: 'retained' }, {
      profile: 'schema', structure: { depth: 100, child: key => ({ depth: key === 'nested' ? 101 : 100 }) },
    });
    expect(result.value).to.deep.equal({ label: 'retained' });
    expect(result.invalid).to.equal(false); expect(result.truncated).to.equal(true);
    expect(Object.isFrozen(result.value)).to.equal(true);
  });

  it('bounds repeated sparse arrays without treating exhausted work as invalid data', () => {
    const source = [...Array.from({ length: 9 }, () => new Array<unknown>(9998)), new Array<unknown>(9996), []];
    const result = snapshotStructuredData(source, { profile: 'form' });
    const output = result.value as readonly unknown[][];
    expect(result.invalid).to.equal(false); expect(result.truncated).to.equal(true);
    expect(output.length).to.be.lessThan(source.length);
    expect(output.reduce((total, row) => total + row.length, 0)).to.be.lessThan(100000);
    expect(output.every(Object.isFrozen)).to.equal(true); expect(Object.isFrozen(output)).to.equal(true);
  });

  it('bounds oversized form arrays without a truncation callback', () => {
    const result = snapshotStructuredData(new Array<unknown>(10001), { profile: 'form' });
    expect((result.value as readonly unknown[]).length).to.equal(10000);
    expect(result.invalid).to.equal(false); expect(result.truncated).to.equal(true);
  });

  it('preserves safe form-array positions when descriptor reflection fails for one entry', () => {
    const source = new Proxy([1, 2, 3], { getOwnPropertyDescriptor(target, key) {
      if (key === '1') throw new Error('Unreadable row');
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    const result = snapshotStructuredData(source, { profile: 'form' });
    const output = result.value as readonly unknown[];
    expect(output.length).to.equal(3); expect(output[0]).to.equal(1); expect(output[2]).to.equal(3);
    expect(Object.hasOwn(output, '1')).to.equal(false);
    expect(result.invalid).to.equal(true); expect(result.truncated).to.equal(false);
    expect(Object.isFrozen(output)).to.equal(true);
  });

  for (const profile of ['form', 'chart'] as const) {
    it(`handles a record descriptor disappearing during the ${profile} snapshot`, () => {
      let reads = 0;
      const source = new Proxy({ bad: 1, safe: 2 }, { getOwnPropertyDescriptor(target, key) {
        if (key === 'bad' && ++reads === 2) throw new Error('Record changed after enumeration');
        return Reflect.getOwnPropertyDescriptor(target, key);
      } });
      const result = snapshotStructuredData(source, { profile });
      expect(result.invalid).to.equal(true); expect(result.truncated).to.equal(false);
      if (profile === 'form') expect(result.value === undefined).to.equal(true);
      else expect(result.value).to.deep.equal({ safe: 2 });
    });
  }

  it('rejects invalid array lengths without invoking array values', () => {
    let reads = 0;
    const source = new Proxy([1], {
      get() { reads++; throw new Error('Value access is forbidden'); },
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === 'length' ? { ...descriptor, value: -1 } : descriptor;
      },
    });
    expect(admitSnapshotArray(source) === undefined).to.equal(true);
    expect(reads).to.equal(0);
  });

  for (const compact of [false, true]) {
    it(`keeps safe rows when array descriptor reflection throws in a ${compact ? 'compact' : 'positional'} projection`, () => {
      const source = new Proxy([1, 2, 3], { getOwnPropertyDescriptor(target, key) {
        if (key === '1') throw new Error('Unreadable row');
        return Reflect.getOwnPropertyDescriptor(target, key);
      } });
      const admission = admitSnapshotArray(source); expect(admission !== undefined).to.equal(true);
      const visited: unknown[] = [];
      const output = projectSnapshotArray(admission, value => { visited.push(value); return value; }, compact ? { compact: true } : { missing: null });
      expect(output).to.deep.equal(compact ? [1, 3] : [1, null, 3]);
      expect(visited).to.deep.equal([1, 3]); expect(Object.isFrozen(output)).to.equal(true);
    });
  }

  it('rejects a shrunk array admission before projecting any stale rows', () => {
    const source = [1, 2, 3]; const admission = admitSnapshotArray(source)!;
    source.length = 1; let calls = 0;
    expect(snapshotArrayStillAdmitted(admission)).to.equal(false);
    const output = projectSnapshotArray(admission, value => { calls++; return value; }, { compact: true });
    expect(output === undefined).to.equal(true); expect(calls).to.equal(0);
  });
});
