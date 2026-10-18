import { expect } from '@open-wc/testing';
import * as catalog from './selection-catalog.js';

it('retains count-only original admission loss across catalog snapshot rebinding', () => {
  const normalize = (code: string): string => code;
  const source = Array.from({ length: 1025 }, (_, index) => String(index));
  const snapshot = catalog.snapshotSelectionCatalog(source, normalize)!;
  const getter = (catalog as unknown as { selectionCatalogTruncation?: (value: unknown) => unknown }).selectionCatalogTruncation;
  expect(typeof getter).to.equal('function');
  const loss = getter!(snapshot);
  expect(loss).to.deep.equal({ source: 1025, retained: 1024, omitted: 1 });
  expect(Object.isFrozen(loss)).to.equal(true);
  expect(getter!(catalog.snapshotSelectionCatalog(snapshot, normalize))).to.deep.equal(loss);
  expect(getter!(catalog.snapshotSelectionCatalog(snapshot, normalize, () => true))).to.deep.equal(loss);
  expect(getter!(catalog.snapshotSelectionCatalog(['fresh'], normalize))).to.equal(undefined);
  expect(getter!(catalog.snapshotSelectionCatalog(undefined, normalize))).to.equal(undefined);
});

it('reports only uninspected positions as cap omissions without reading their getters', () => {
  let reads = 0;
  const source: unknown[] = Array.from({ length: 1025 }, () => 'duplicate');
  Object.defineProperty(source, 1024, { get() { reads++; return 'tail'; } });
  const snapshot = catalog.snapshotSelectionCatalog(source, (code) => code)!;
  const getter = (catalog as unknown as { selectionCatalogTruncation?: (value: unknown) => unknown }).selectionCatalogTruncation;
  expect(typeof getter).to.equal('function');
  expect(getter!(snapshot)).to.deep.equal({ source: 1025, retained: 1, omitted: 1 });
  expect(reads).to.equal(0);
});
