import { fixture, expect, html } from '@open-wc/testing';
import {
  registerLyraLocale,
  setLyraLocale,
  getRegisteredLyraLocales,
  subscribeLyraLocaleRegistry,
  subscribeLyraLocale,
  LYRA_DEFAULT_STRINGS,
  resolveLocalizedParts,
  resolveLyraString,
} from './localization.js';
import '../components/data/sparkline/sparkline.js';
import type { LyraSparkline } from '../components/data/sparkline/sparkline.js';

it('resolves registered locale messages and per-instance overrides', async () => {
  registerLyraLocale('x-test', {
    noData: 'Keine Daten',
    trendOf: 'Trend: {count}, zuletzt {value}',
  });
  setLyraLocale('x-test');

  try {
    const el = (await fixture(html`<lr-sparkline .values=${[]}></lr-sparkline>`)) as LyraSparkline;
    expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('Keine Daten');

    el.strings = { noData: 'Aucune donnée' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('Aucune donnée');
  } finally {
    setLyraLocale('en');
  }
});

it('updates connected components when the active locale changes', async () => {
  registerLyraLocale('x-first', { noData: 'First' });
  registerLyraLocale('x-second', { noData: 'Second' });
  const el = (await fixture(html`<lr-sparkline .values=${[]}></lr-sparkline>`)) as LyraSparkline;

  setLyraLocale('x-first');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('First');
  setLyraLocale('x-second');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('Second');
  setLyraLocale('en');
});

it('inherits an ancestor lang and picks up an ancestor lang change on the following render', async () => {
  registerLyraLocale('x-aa', { noData: 'AA leer' });
  registerLyraLocale('x-bb', { noData: 'BB leer' });
  const wrapper = await fixture<HTMLDivElement>(
    html`<div lang="x-aa"><lr-sparkline .values=${[]}></lr-sparkline></div>`,
  );
  const el = wrapper.querySelector('lr-sparkline') as LyraSparkline;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('AA leer');

  wrapper.setAttribute('lang', 'x-bb');
  el.requestUpdate();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('BB leer');
});

it('defines the copy-to-clipboard confirmation label', () => {
  expect(LYRA_DEFAULT_STRINGS.copiedToClipboard).to.equal('Copied to clipboard');
});

it('includes openNavigation and resizeNavigation in the default English strings', () => {
  expect(LYRA_DEFAULT_STRINGS.openNavigation).to.equal('Open navigation');
  expect(LYRA_DEFAULT_STRINGS.resizeNavigation).to.equal('Resize navigation');
});

it('defines a complete localizable lite-chart mark summary', () => {
  expect(LYRA_DEFAULT_STRINGS.liteChartMarkSummary).to.equal(
    '{series}, {label}: {value} ({index} of {total})',
  );
});

it('defines a complete localizable citation status summary', () => {
  expect(LYRA_DEFAULT_STRINGS.citationWithStatus).to.equal('Citation {index}, {status}');
});

it('defines the default heatmap value label', () => {
  expect(LYRA_DEFAULT_STRINGS.heatmapValueLabel).to.equal('value');
});

it('defines utility polling and rotation control labels', () => {
  expect(LYRA_DEFAULT_STRINGS.pollInactive).to.equal('Inactive');
  expect(LYRA_DEFAULT_STRINGS.randomContentPause).to.equal('Pause rotation');
  expect(LYRA_DEFAULT_STRINGS.randomContentResume).to.equal('Resume rotation');
});

it('defines the JSON viewer resource-limit message', () => {
  expect(LYRA_DEFAULT_STRINGS.jsonViewerLimit).to.equal(
    'Only the first {count} JSON nodes and {depth} nesting levels are shown and searched.',
  );
});

it('defines whole retrieval result-count and row-selection messages', () => {
  expect(LYRA_DEFAULT_STRINGS.nodePaletteResultCount).to.deep.equal({
    one: '{count} item',
    other: '{count} items',
  });
  expect(LYRA_DEFAULT_STRINGS.retrievalResultsSelectRow).to.equal('Select {label}');
});

it('defines reorderable whole contact messages and known vCard type labels', () => {
  expect(LYRA_DEFAULT_STRINGS.contactViewerOrganization).to.equal('Organization: {value}');
  expect(LYRA_DEFAULT_STRINGS.contactViewerTypedValue).to.equal('{value} ({types})');
  expect(LYRA_DEFAULT_STRINGS.contactViewerAddressFormat).to.equal(
    '{poBox}\n{extendedAddress}\n{streetAddress}\n{locality} {region} {postalCode}\n{country}',
  );
  expect([
    LYRA_DEFAULT_STRINGS.contactViewerTypeHome,
    LYRA_DEFAULT_STRINGS.contactViewerTypeWork,
    LYRA_DEFAULT_STRINGS.contactViewerTypeCell,
    LYRA_DEFAULT_STRINGS.contactViewerTypeVoice,
    LYRA_DEFAULT_STRINGS.contactViewerTypeFax,
    LYRA_DEFAULT_STRINGS.contactViewerTypeInternet,
    LYRA_DEFAULT_STRINGS.contactViewerTypePreferred,
  ]).to.deep.equal(['Home', 'Work', 'Mobile', 'Voice', 'Fax', 'Internet', 'Preferred']);
});

it('defines a reorderable whole email group-address message', () => {
  expect(LYRA_DEFAULT_STRINGS.emailViewerGroupAddress).to.equal('{name}: {members}');
});

it('splits rich localized placeholders after normal interpolation, including repeats and omission', () => {
  const resolve = (template: string) =>
    resolveLocalizedParts(template, (marker) => template.replaceAll('{tool}', marker));
  expect(resolve('Approve {tool}, then {tool}?')).to.deep.equal(['Approve ', ', then ', '?']);
  expect(resolve('Proceed?')).to.deep.equal(['Proceed?']);
  expect(resolve('Private marker \ue000 before {tool}')).to.deep.equal(['Private marker \ue000 before ', '']);
});

it('defines complete media-card attachment action labels', () => {
  expect(LYRA_DEFAULT_STRINGS.mediaCardOpenImageAttachment).to.equal('Open image attachment');
  expect(LYRA_DEFAULT_STRINGS.mediaCardOpenVideoAttachment).to.equal('Open video attachment');
  expect(LYRA_DEFAULT_STRINGS.mediaCardOpenFileAttachment).to.equal('Open file attachment');
});

it('defines singular and plural file-input result messages', () => {
  expect(LYRA_DEFAULT_STRINGS.fileInputAcceptedOne).to.equal('{count} file added.');
  expect(LYRA_DEFAULT_STRINGS.fileInputAcceptedMany).to.equal('{count} files added.');
  expect(LYRA_DEFAULT_STRINGS.fileInputRejectedOne).to.equal('{count} file rejected.');
  expect(LYRA_DEFAULT_STRINGS.fileInputRejectedMany).to.equal('{count} files rejected.');
});

it('getRegisteredLyraLocales always includes "en" and every registered key, deduped and sorted regardless of casing', () => {
  registerLyraLocale('x-registry-zz', { noData: 'zz' });
  registerLyraLocale('X-REGISTRY-AA', { noData: 'aa upper' });
  registerLyraLocale('x-registry-aa', { noData: 'aa lower' }); // same normalized key as X-REGISTRY-AA -- must not duplicate
  const result = getRegisteredLyraLocales();
  expect(result).to.include('en');
  expect(result).to.include('x-registry-aa');
  expect(result).to.include('x-registry-zz');
  expect(result.filter((l) => l === 'x-registry-aa')).to.have.lengthOf(1);
  expect(result).to.deep.equal([...result].sort());
});

it('subscribeLyraLocaleRegistry fires for a registerLyraLocale call on a locale that is not currently active', () => {
  setLyraLocale('en');
  let calls = 0;
  const unsubscribe = subscribeLyraLocaleRegistry(() => {
    calls += 1;
  });
  try {
    registerLyraLocale('x-registry-not-active', { noData: 'inactive' });
    expect(calls).to.equal(1);
  } finally {
    unsubscribe();
  }
});

it('subscribeLyraLocaleRegistry stops notifying after unsubscribe', () => {
  let calls = 0;
  const unsubscribe = subscribeLyraLocaleRegistry(() => {
    calls += 1;
  });
  unsubscribe();
  registerLyraLocale('x-registry-after-unsub', { noData: 'gone' });
  expect(calls).to.equal(0);
});

it('registerLyraLocale still only notifies subscribeLyraLocale listeners for the active locale (regression guard)', () => {
  setLyraLocale('x-registry-active-guard');
  let activeListenerCalls = 0;
  const unsubscribeActive = subscribeLyraLocale(() => {
    activeListenerCalls += 1;
  });
  try {
    registerLyraLocale('x-registry-inactive-guard', { noData: 'unrelated' });
    expect(activeListenerCalls).to.equal(0);
    registerLyraLocale('x-registry-active-guard', { noData: 'matches' });
    expect(activeListenerCalls).to.equal(1);
  } finally {
    unsubscribeActive();
    setLyraLocale('en');
  }
});

// ---------------------------------------------------------------------------
// Plural rules (Intl.PluralRules categories)
// ---------------------------------------------------------------------------

/** A host carrying an explicit `locale`, which `resolveLyraLocale()` reads ahead of `lang`. */
function localeHost(locale: string): Promise<HTMLElement> {
  return fixture<HTMLElement>(html`<div locale=${locale}></div>`);
}

it('models every pluralized DEFAULT_STRINGS entry as a CLDR category object with a required "other"', () => {
  const pluralized = Object.entries(LYRA_DEFAULT_STRINGS).filter(([, message]) => typeof message === 'object');
  expect(pluralized.length).to.be.greaterThan(0);
  for (const [key, message] of pluralized) {
    expect(Object.keys(message as object), key).to.deep.equal(['one', 'other']);
    expect((message as { other: string }).other, key).to.be.a('string');
  }
});

it('drops the legacy two-key "…Plural" scheme entirely', () => {
  expect(Object.keys(LYRA_DEFAULT_STRINGS).filter((key) => key.endsWith('Plural'))).to.deep.equal([]);
});

it('selects the English one/other categories from values.count', async () => {
  const host = await localeHost('en');
  expect(resolveLyraString(host, 'toolCount', undefined, undefined, { count: 1 })).to.equal('1 tool');
  expect(resolveLyraString(host, 'toolCount', undefined, undefined, { count: 0 })).to.equal('0 tools');
  expect(resolveLyraString(host, 'toolCount', undefined, undefined, { count: 7 })).to.equal('7 tools');
});

it('selects Russian one/few/many through real Intl.PluralRules categories', async () => {
  registerLyraLocale('ru', {
    'x-plural-probe': {
      one: '{count} инструмент',
      few: '{count} инструмента',
      many: '{count} инструментов',
      other: '{count} инструмента',
    },
  });
  const host = await localeHost('ru');
  const at = (count: number) => resolveLyraString(host, 'x-plural-probe', undefined, undefined, { count });
  expect(at(1)).to.equal('1 инструмент');
  expect(at(3)).to.equal('3 инструмента');
  expect(at(5)).to.equal('5 инструментов');
  expect(at(21)).to.equal('21 инструмент');
});

it('selects all six Arabic categories', async () => {
  registerLyraLocale('ar', {
    'x-plural-probe': {
      zero: 'ZERO',
      one: 'ONE',
      two: 'TWO',
      few: 'FEW {count}',
      many: 'MANY {count}',
      other: 'OTHER {count}',
    },
  });
  const host = await localeHost('ar');
  const at = (count: number) => resolveLyraString(host, 'x-plural-probe', undefined, undefined, { count });
  expect(at(0)).to.equal('ZERO');
  expect(at(1)).to.equal('ONE');
  expect(at(2)).to.equal('TWO');
  expect(at(3)).to.equal('FEW 3');
  expect(at(11)).to.equal('MANY 11');
  expect(at(100)).to.equal('OTHER 100');
});

it('widens a missing category through the documented fallback chain', async () => {
  registerLyraLocale('ru', {
    'x-chain-many-only': { many: 'MANY', other: 'OTHER' },
    'x-chain-few-only': { few: 'FEW', other: 'OTHER' },
    'x-chain-other-only': { other: 'OTHER' },
  });
  registerLyraLocale('ar', { 'x-chain-few-only': { few: 'FEW', other: 'OTHER' } });
  const ru = await localeHost('ru');
  const ar = await localeHost('ar');
  // few -> many
  expect(resolveLyraString(ru, 'x-chain-many-only', undefined, undefined, { count: 3 })).to.equal('MANY');
  // many -> few
  expect(resolveLyraString(ru, 'x-chain-few-only', undefined, undefined, { count: 5 })).to.equal('FEW');
  // two -> few
  expect(resolveLyraString(ar, 'x-chain-few-only', undefined, undefined, { count: 2 })).to.equal('FEW');
  // anything -> other
  expect(resolveLyraString(ru, 'x-chain-other-only', undefined, undefined, { count: 1 })).to.equal('OTHER');
  expect(resolveLyraString(ru, 'x-chain-other-only', undefined, undefined, { count: 3 })).to.equal('OTHER');
});

it('falls back to "other" when no numeric count drives the selection', async () => {
  const host = await localeHost('en');
  expect(resolveLyraString(host, 'toolCount', undefined, undefined, {})).to.equal('{count} tools');
  expect(resolveLyraString(host, 'toolCount')).to.equal('{count} tools');
  expect(resolveLyraString(host, 'toolCount', undefined, undefined, { count: Number.NaN })).to.equal('NaN tools');
});

it('accepts a numeric pluralCount alongside a pre-formatted {count}', async () => {
  const host = await localeHost('en');
  expect(resolveLyraString(host, 'toolCount', undefined, undefined, { count: '1', pluralCount: 1 })).to.equal(
    '1 tool',
  );
  expect(
    resolveLyraString(host, 'toolCount', undefined, undefined, { count: '1,024', pluralCount: 1024 }),
  ).to.equal('1,024 tools');
});

it('lets a per-instance override -- plain string or category object -- win over the pluralized default', async () => {
  const host = await localeHost('en');
  expect(resolveLyraString(host, 'toolCount', { toolCount: '{count} outils' }, undefined, { count: 1 })).to.equal(
    '1 outils',
  );
  expect(
    resolveLyraString(
      host,
      'toolCount',
      { toolCount: { one: '{count} outil', other: '{count} outils' } },
      undefined,
      { count: 1 },
    ),
  ).to.equal('1 outil');
});

it('leaves non-plural keys, fallbacks, and interpolation completely unchanged', async () => {
  const host = await localeHost('en');
  expect(resolveLyraString(host, 'close')).to.equal('Close');
  expect(resolveLyraString(host, 'legendTypeShown', undefined, undefined, { label: 'Revenue' })).to.equal(
    'Revenue shown',
  );
  expect(resolveLyraString(host, 'legendTypeShown', undefined, 'Explicit')).to.equal('Explicit');
  expect(resolveLyraString(host, 'notAKeyAtAll')).to.equal('notAKeyAtAll');
});
