import { expect } from '@open-wc/testing';
import {
  filterCatalogEntries,
  normalizeCatalog,
  withSyntheticCatalogValue,
} from './catalog-picker.js';

it('normalizes string shorthand without changing complete records', () => {
  const full = { id: 'b', label: 'Beta', description: 'Second' };
  expect(normalizeCatalog(['a'])).to.deep.equal([{ id: 'a', label: 'a' }]);
  expect(normalizeCatalog([full])).to.deep.equal([full]);
});

it('keeps the first unique nonempty catalog id before any picker uses the collection', () => {
  const first = { id: 'same', label: 'First', previewUrl: 'first.mp3' };
  const later = { id: 'same', label: 'Later', previewUrl: 'later.mp3' };

  expect(normalizeCatalog(['', 'alpha', 'alpha', '   ', 'beta'])).to.deep.equal([
    { id: 'alpha', label: 'alpha' },
    { id: 'beta', label: 'beta' },
  ]);
  expect(normalizeCatalog([first, later])).to.deep.equal([first]);
});

it('adds one synthetic stale value without mutating the source catalog', () => {
  const source = [{ id: 'a', label: 'Alpha' }];
  expect(withSyntheticCatalogValue(source, 'stale')).to.deep.equal([
    { id: 'a', label: 'Alpha', synthetic: false },
    { id: 'stale', label: 'stale', synthetic: true },
  ]);
  expect(withSyntheticCatalogValue(source, '   ')).to.deep.equal([
    { id: 'a', label: 'Alpha', synthetic: false },
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
