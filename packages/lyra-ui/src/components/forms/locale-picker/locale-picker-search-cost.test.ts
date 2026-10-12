import { expect, fixture, html } from '@open-wc/testing';
import { LyraElement } from '../../../internal/lyra-element.js';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';
import '../../../translations/fr/forms.js';
import '../../../translations/fr/shared.js';
import '../../../translations/fr/media.js';
import '../../../translations/tr/forms.js';
import '../../../translations/tr/shared.js';
import '../../../translations/tr/media.js';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.class.js';

beforeEach(() => setFlagUrlResolver(async () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E'));
afterEach(() => setFlagUrlResolver(null));

it('resolves locale once per cold search while keeping aliases, accent folding and cache invalidation', async () => {
  const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker searchable locale="fr"
    .locales=${[
      { tag: 'de' }, { tag: 'es', label: 'Café central' }, { tag: 'tr', label: 'İzmir' },
    ]}></lr-locale-picker>`);
  const search = el as unknown as {
    searchQuery: string;
    readonly visibleEntries: readonly { tag: string }[];
  };
  const localeGetter = Object.getOwnPropertyDescriptor(LyraElement.prototype, 'effectiveLocale')!.get!;
  let localeReads = 0;
  Object.defineProperty(el, 'effectiveLocale', {
    configurable: true,
    get() {
      localeReads++;
      return localeGetter.call(this);
    },
  });
  try {
    search.searchQuery = 'cafe';
    const first = search.visibleEntries;
    expect(first.map((row) => row.tag)).to.deep.equal(['es']);
    expect(localeReads).to.equal(1);
    expect(search.visibleEntries === first).to.equal(true);

    search.searchQuery = 'allemand';
    expect(search.visibleEntries.map((row) => row.tag)).to.deep.equal(['de']);
    search.searchQuery = 'GERMAN';
    expect(search.visibleEntries.map((row) => row.tag)).to.deep.equal(['de']);
    el.locale = 'tr';
    search.searchQuery = 'iz';
    expect(search.visibleEntries.map((row) => row.tag)).to.deep.equal(['tr']);
  } finally {
    Reflect.deleteProperty(el, 'effectiveLocale');
  }
});
