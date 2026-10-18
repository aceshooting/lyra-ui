import { expect } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../test/scale-budgets.js';
import { snapshotSelectionCatalog } from './selection-catalog.js';
it('reuses only catalog snapshots admitted under identical rules', () => {
  let normalized = 0;
  const normalize = (code: string) => { normalized++; return code.toUpperCase(); };
  const snapshot = snapshotSelectionCatalog(Array.from({ length: 1100 }, (_, i) => `code-${i}`), normalize)!;
  expect(snapshot.length).equal(1024); normalized = 0;
  const reused = snapshotSelectionCatalog(snapshot, normalize);
  expect(reused === snapshot).equal(true); expect(normalized).equal(0);
  recordScaleMeasurement('lr-country-picker', 'n=1024 admitted snapshot reuse', { normalized });
  const lower = snapshotSelectionCatalog(snapshot, code => code.toLowerCase())!;
  expect(lower[0]!.code).equal('code-0');
  const filtered = snapshotSelectionCatalog(snapshot, normalize, code => code === 'CODE-1')!;
  expect(filtered.map(row => row.code)).deep.equal(['CODE-1']);
  expect(normalized).equal(1024);
});
