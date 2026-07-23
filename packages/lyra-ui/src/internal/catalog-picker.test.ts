import { expect } from '@open-wc/testing';
import {
  filterCatalogEntries,
  normalizeCatalog,
  withSyntheticCatalogValue,
} from './catalog-picker.js';

it('normalizes string shorthand without changing complete records', () => {
  const full = { id: 'b', label: 'Beta', description: 'Second' };
  expect(normalizeCatalog(['a', full])).to.deep.equal([{ id: 'a', label: 'a' }, full]);
});

it('adds one synthetic stale value without mutating the source catalog', () => {
  const source = [{ id: 'a', label: 'Alpha' }];
  expect(withSyntheticCatalogValue(source, 'stale')).to.deep.equal([
    { id: 'a', label: 'Alpha', synthetic: false },
    { id: 'stale', label: 'stale', synthetic: true },
  ]);
  expect(source).to.deep.equal([{ id: 'a', label: 'Alpha' }]);
});

it('filters locale-aware across caller-selected searchable fields', () => {
  const entries = [
    { id: 'en', label: 'English', language: 'English' },
    { id: 'tr', label: 'Türkçe', language: 'Türkçe' },
  ];
  expect(filterCatalogEntries(entries, 'TÜRK', 'tr', (entry) => [entry.id, entry.label, entry.language])).to.deep.equal([
    entries[1],
  ]);
});

