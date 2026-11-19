import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { resolveMultipleSelectedWrites, resolveOccurrences } from './option-catalog-host.js';

const value = fc.constantFrom('a', 'b', 'c');

it('resolveOccurrences hands each value the next unused row carrying it, in source order', () => {
  fc.assert(fc.property(fc.array(value, { maxLength: 12 }), fc.array(value, { maxLength: 12 }), (values, rowValues) => {
    const rows = rowValues.map((v, id) => ({ v, id }));
    const result = resolveOccurrences(values, rows, row => row.v);
    expect(result).to.have.length(values.length);
    const expected = new Map<string, number[]>();
    for (const row of rows) expected.set(row.v, [...(expected.get(row.v) ?? []), row.id]);
    const seen = new Map<string, number>();
    values.forEach((v, index) => {
      const nth = seen.get(v) ?? 0;
      seen.set(v, nth + 1);
      expect(result[index]?.id, `occurrence ${nth} of ${v}`).to.equal(expected.get(v)?.[nth]);
    });
  }), propertyRuns());
});

it('resolveMultipleSelectedWrites matches a splice-based reference', () => {
  const option = fc.integer({ min: 0, max: 5 });
  const write = fc.record({ selected: fc.boolean(), value });
  fc.assert(fc.property(
    fc.uniqueArray(option, { maxLength: 5 }),
    fc.array(fc.tuple(option, write), { maxLength: 8 }),
    fc.integer({ min: 0, max: 5 }),
    (selected, writes, stray) => {
      const values = selected.map(index => `v${index}`);
      const occurrences: (number | undefined)[] = selected.map((index, at) => (at === 0 ? undefined : index));
      const isMember = (candidate: number) => candidate !== stray;
      const reference = values.map((v, at) => ({ v, o: occurrences[at] }));
      for (const [candidate, change] of writes) {
        if (!isMember(candidate)) continue;
        let at = -1;
        for (let index = reference.length - 1; index >= 0; index -= 1) if (reference[index]!.o === candidate) { at = index; break; }
        if (!change.selected) { if (at >= 0) reference.splice(at, 1); }
        else if (at >= 0) reference[at]!.v = change.value;
        else reference.push({ v: change.value, o: candidate });
      }
      const result = resolveMultipleSelectedWrites(values, occurrences, writes, isMember);
      expect(result).to.deep.equal({ values: reference.map(entry => entry.v), occurrences: reference.map(entry => entry.o) });
    },
  ), propertyRuns());
});
