import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { admitSnapshotArray, projectSnapshotArray, snapshotStructuredData } from './structured-snapshot.js';

for (const profile of ['form', 'schema', 'chart', 'chartData'] as const) {
  it(`freezes independent snapshots and preserves repeated references in the ${profile} profile`, () => {
    fc.assert(fc.property(fc.array(fc.record({ id: fc.string(), value: fc.integer() }), { maxLength: 30 }), rows => {
      const sourceRows = rows.map(row => ({ ...row }));
      const input = { first: sourceRows, second: sourceRows };
      const result = snapshotStructuredData(input, { profile });
      const output = result.value as { readonly first: readonly { readonly id: string; readonly value: number }[]; readonly second: readonly unknown[] };
      expect(result.invalid).to.equal(false); expect(result.truncated).to.equal(false);
      expect(output.first === output.second).to.equal(true);
      expect(output.first === sourceRows).to.equal(false);
      expect(Object.isFrozen(output) && Object.isFrozen(output.first) && output.first.every(Object.isFrozen)).to.equal(true);
      if (sourceRows[0]) sourceRows[0].id = 'changed';
      sourceRows.length = 0;
      expect(output.first).to.deep.equal(rows);
    }), propertyRuns());
  });
}

for (const compact of [false, true]) {
  it(`keeps accepted values in order during a ${compact ? 'compact' : 'positional'} array projection`, () => {
    fc.assert(fc.property(fc.array(fc.oneof(fc.integer(), fc.constant(null)), { maxLength: 100 }), source => {
      const accept = (value: unknown): number | undefined => typeof value === 'number' && value >= 0 ? value : undefined;
      const output = projectSnapshotArray(admitSnapshotArray(source), accept, compact ? { compact: true } : { missing: -1 });
      const expected = compact ? source.filter((value): value is number => typeof value === 'number' && value >= 0) : source.map(value => accept(value) ?? -1);
      expect(output).to.deep.equal(expected); expect(Object.isFrozen(output)).to.equal(true);
    }), propertyRuns());
  });
}
