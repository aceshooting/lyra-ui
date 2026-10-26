import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '@aceshooting/lyra-translations/fr/conversation.js';
import '@aceshooting/lyra-translations/ar.js';
import { getRegisteredLyraLocaleKeys, registerLyraLocale } from '@aceshooting/lyra-ui/localization.js';
import { expectLocaleFallback } from '../../../lyra-ui/test/expected-locale-fallbacks.js';
import { createCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import { LYRA_GEN_STRINGS } from '../../src/localization.js';
import type { LyraGenCatalog, LyraGenView } from '../../src/types.js';

expectLocaleFallback('qaa-QL', ['genViewEmpty']);

const text = (host: LyraGenViewElement, part: string): string | null | undefined => host.shadowRoot?.querySelector(`[part="${part}"]`)?.textContent;
const view = (catalog: LyraGenCatalog): LyraGenView => ({ version: '1', surfaceId: 'translated-view', revision: 0, catalog: { id: catalog.id, version: catalog.version }, root: { id: 'item', type: 'item', text: 'Caller-owned text' } });

it('keeps English fallbacks without registering an English locale and honors per-instance overrides', async () => {
  expect(getRegisteredLyraLocaleKeys('en').length).to.equal(0);
  const host = await fixture<LyraGenViewElement>(html`<lr-gen-view lang="en"></lr-gen-view>`);
  await host.updateComplete;
  expect(text(host, 'empty')).to.equal(LYRA_GEN_STRINGS.genViewEmpty);
  host.strings = { genViewEmpty: 'Application-owned empty message' };
  await host.updateComplete;
  expect(text(host, 'empty')).to.equal('Application-owned empty message');
});

it('loads generated-view messages from the real French conversation slice and Arabic full catalog', async () => {
  for (const locale of ['fr', 'ar']) for (const key of Object.keys(LYRA_GEN_STRINGS)) expect(getRegisteredLyraLocaleKeys(locale).includes(key), `${locale} includes ${key}`).to.equal(true);
  const parent = await fixture<HTMLElement>(html`<section lang="fr"><lr-gen-view></lr-gen-view></section>`);
  const host = parent.querySelector<LyraGenViewElement>('lr-gen-view')!;
  await host.updateComplete;
  expect(text(host, 'empty')).to.equal('Aucune vue générée à afficher.');
  parent.lang = 'ar';
  parent.dir = 'rtl';
  await waitUntil(() => text(host, 'empty') === 'لا توجد واجهة مُنشأة لعرضها.');
  expect(getComputedStyle(host).direction).to.equal('rtl');
  expect(host.hasAttribute('dir')).to.equal(false);
  host.strings = { genViewEmpty: 'Application override' };
  await host.updateComplete;
  expect(text(host, 'empty')).to.equal('Application override');
  host.strings = {};
  await host.updateComplete;
  expect(text(host, 'empty')).to.equal('لا توجد واجهة مُنشأة لعرضها.');
});

it('updates real catalog loading and failure messages without exposing loader exception text', async () => {
  let reject!: (reason: Error) => void;
  const catalog = createCatalog({ id: 'localized-loading', version: '1', components: { item: { tag: 'p', properties: {}, text: true, load: () => new Promise((_resolve, fail) => { reject = fail; }) } } });
  const parent = await fixture<HTMLElement>(html`<section lang="fr"><lr-gen-view .catalog=${catalog} .document=${view(catalog)}></lr-gen-view></section>`);
  const host = parent.querySelector<LyraGenViewElement>('lr-gen-view')!;
  await waitUntil(() => host.status === 'loading' && text(host, 'loading') !== undefined);
  expect(text(host, 'loading')).to.equal('Chargement du composant…');
  parent.lang = 'ar'; parent.dir = 'rtl';
  await waitUntil(() => text(host, 'loading') === 'جارٍ تحميل المكوّن…');
  reject(new Error('Technical exception must stay private'));
  await waitUntil(() => text(host, 'error') === 'تعذّر تحميل هذا المكوّن.');
  expect(host.shadowRoot?.textContent?.includes('Technical exception')).to.equal(false);
});

it('resolves late catalog registration without defeating a literal key override', async () => {
  const host = await fixture<LyraGenViewElement>(html`<lr-gen-view lang="qaa-QL"></lr-gen-view>`);
  await host.updateComplete;
  expect(text(host, 'empty')).to.equal(LYRA_GEN_STRINGS.genViewEmpty);
  registerLyraLocale('qaa-QL', { genViewEmpty: 'genViewEmpty' });
  await waitUntil(() => text(host, 'empty') === 'genViewEmpty');
});
