import { fixture, expect, html } from '@open-wc/testing';
import {
  getLyraLocale,
  registerLyraLocale,
  setLyraLocale,
  getLyraLocaleDirection,
  getRegisteredLyraLocales,
  subscribeLyraLocaleRegistry,
  subscribeLyraLocale,
  LYRA_DEFAULT_STRINGS,
  resolveLocalizedParts,
  resolveLyraDirection,
  resolveLyraLocale,
  resolveLyraString,
} from './localization.js';
import '../components/data/sparkline/sparkline.js';
import '../translations/ar.js';
import '../translations/de.js';
import '../translations/fa.js';
import '../translations/he.js';
import '../translations/pt-BR.js';
import '../translations/zh-CN.js';
import type { LyraSparkline } from '../components/data/sparkline/sparkline.js';
import type { LyraMessage, LyraMessageKey } from './localization-types.js';

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

it('snapshots per-instance strings and drops hostile accessor entries without rendering them', async () => {
  const el = (await fixture(html`<lr-sparkline .values=${[]}></lr-sparkline>`)) as LyraSparkline;
  const source = { noData: 'Snapshot override' };
  el.strings = source;
  await el.updateComplete;
  source.noData = 'Mutated after assignment';
  el.requestUpdate();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('Snapshot override');

  let getterCalls = 0;
  const hostile = Object.defineProperty({}, 'noData', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('per-instance override getter must not execute');
    },
  });
  el.strings = hostile;
  await el.updateComplete;
  expect(getterCalls).to.equal(0);
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('No data');
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

it('defines and resolves the shared resize-value and mention-result messages', async () => {
  const sharedKeys = [
    'resizeValuePixels',
    'resizeValuePercent',
    'mentionResultCount',
    'mentionResultPosition',
  ] as const satisfies readonly LyraMessageKey[];
  type SharedMessageKey = (typeof sharedKeys)[number];

  const catalog = {
    resizeValuePixels: '{value} Bildpunkte',
    resizeValuePercent: '{value} Prozentpunkte',
    mentionResultCount: { one: '{count} Treffer', other: '{count} Treffer' },
    mentionResultPosition: 'Treffer {current} von {total}',
  } satisfies Record<SharedMessageKey, LyraMessage>;

  expect(LYRA_DEFAULT_STRINGS.resizeValuePixels).to.equal('{value} pixels');
  expect(LYRA_DEFAULT_STRINGS.resizeValuePercent).to.equal('{value} percent');
  expect(LYRA_DEFAULT_STRINGS.mentionResultCount).to.deep.equal({
    one: '{count} suggestion',
    other: '{count} suggestions',
  });
  expect(LYRA_DEFAULT_STRINGS.mentionResultPosition).to.equal('Suggestion {current} of {total}');

  registerLyraLocale('x-shared-messages', catalog);
  const host = await localeHost('x-shared-messages');
  expect(resolveLyraString(host, 'resizeValuePixels', undefined, undefined, { value: '640' })).to.equal(
    '640 Bildpunkte',
  );
  expect(resolveLyraString(host, 'resizeValuePercent', undefined, undefined, { value: '35' })).to.equal(
    '35 Prozentpunkte',
  );
  expect(
    resolveLyraString(host, 'mentionResultCount', undefined, undefined, {
      count: '2',
      pluralCount: 2,
    }),
  ).to.equal('2 Treffer');
  expect(
    resolveLyraString(host, 'mentionResultPosition', undefined, undefined, {
      current: '2',
      total: '4',
    }),
  ).to.equal('Treffer 2 von 4');
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
  expect(LYRA_DEFAULT_STRINGS.heatmapProjectionLimit).to.equal('Only the first {count} heatmap cells are shown.');
  expect(LYRA_DEFAULT_STRINGS.heatmapDecorationLimit).to.contain('legend stops');
  expect(LYRA_DEFAULT_STRINGS.mapStyleRequired).to.equal('Provide a map style to render the map.');
  expect(LYRA_DEFAULT_STRINGS.mapWebglUnavailable).to.contain('graphics support');
  expect(LYRA_DEFAULT_STRINGS.mapInitializationFailed).to.equal('The map could not be initialized.');
  expect(LYRA_DEFAULT_STRINGS.mapLegend).to.equal('Map legend');
  expect(LYRA_DEFAULT_STRINGS.dataGridColumnMenu).to.equal('Options for {label}');
  expect(LYRA_DEFAULT_STRINGS.dataGridPinStart).to.equal('Pin {label} to start');
  expect(LYRA_DEFAULT_STRINGS.dataGridPinEnd).to.equal('Pin {label} to end');
  expect(LYRA_DEFAULT_STRINGS.dataGridUnpin).to.equal('Unpin {label}');
  expect(LYRA_DEFAULT_STRINGS.dataGridRowsPerPage).to.equal('Rows per page');
  expect(LYRA_DEFAULT_STRINGS.dataGridTreeLimitReached).to.contain('tree limit');
  expect(LYRA_DEFAULT_STRINGS.flowCanvasLayoutLimit).to.contain('work limit');
  expect(LYRA_DEFAULT_STRINGS.flowRunStatusLabel).to.equal('Run status');
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

it('defines the complete reorder request lifecycle messages', () => {
  expect(LYRA_DEFAULT_STRINGS.reorderMovePending).to.equal('Reorder pending.');
  expect(LYRA_DEFAULT_STRINGS.reorderMoveCancelled).to.equal('Reorder cancelled.');
  expect(LYRA_DEFAULT_STRINGS.reorderItemMoved).to.equal('Moved to position {index} of {total}');
});

it('splits rich localized placeholders after normal interpolation, including repeats and omission', () => {
  const resolve = (template: string) =>
    resolveLocalizedParts(template, (marker) => template.replaceAll('{tool}', marker));
  expect(resolve('Approve {tool}, then {tool}?')).to.deep.equal(['Approve ', ', then ', '?']);
  expect(resolve('Proceed?')).to.deep.equal(['Proceed?']);
  expect(resolve('Private marker \ue000 before {tool}')).to.deep.equal(['Private marker \ue000 before ', '']);
});

it('chooses a bounded rich marker in linear work even when every old marker prefix is present', () => {
  const prefixes: string[] = [];
  let prefix = '\ue000';
  for (let index = 0; index < 512; index += 1) {
    prefixes.push(prefix);
    prefix += '\ue001';
  }
  const template = `${prefixes.join('|')}:{tool}:{tool}`;
  let marker = '';
  const parts = resolveLocalizedParts(template, (candidate) => {
    marker = candidate;
    return template.replaceAll('{tool}', candidate);
  });

  expect(marker.length, 'the sentinel must stay bounded instead of growing with hostile input').to.be.at.most(2);
  expect(parts.join('<tool>')).to.equal(template.replaceAll('{tool}', '<tool>'));
});

it('uses a two-code-unit rich marker when the template contains every UTF-16 code unit', () => {
  const everyCodeUnit = Array.from({ length: 65_536 }, (_, code) => String.fromCharCode(code)).join('');
  const template = `${everyCodeUnit}{tool}`;
  let marker = '';
  const parts = resolveLocalizedParts(template, (candidate) => {
    marker = candidate;
    return `${everyCodeUnit}${candidate}`;
  });

  expect(marker.length).to.equal(2);
  expect(template.includes(marker)).to.equal(false);
  expect(parts).to.deep.equal([everyCodeUnit, '']);
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
  expect(Object.isFrozen(result)).to.be.true;
});

it('uses one canonical BCP-47 tag for registration, active state, lookup, and enumeration', async () => {
  const previous = getLyraLocale();
  try {
    registerLyraLocale('PT_BR', { 'x-canonical-probe': 'canônico' });
    setLyraLocale('  PT_BR  ');

    expect(getLyraLocale()).to.equal('pt-BR');
    expect(getRegisteredLyraLocales()).to.include('pt-BR');
    expect(getRegisteredLyraLocales()).not.to.include('pt-br');
    expect(resolveLyraString(await localeHost('pt_br'), 'x-canonical-probe')).to.equal('canônico');
  } finally {
    setLyraLocale(previous);
  }
});

it('retains a normalized lowercase policy for private-use and legacy custom locale tags', async () => {
  registerLyraLocale('X-CUSTOM_PROBE', { 'x-custom-tag-probe': 'custom' });
  expect(getRegisteredLyraLocales()).to.include('x-custom-probe');
  expect(resolveLyraString(await localeHost('X_CUSTOM_PROBE'), 'x-custom-tag-probe')).to.equal('custom');
});

it('canonicalizes deprecated BCP-47 aliases through the same lookup identity', () => {
  expect(getLyraLocaleDirection('IW_il')).to.equal('rtl');
});

it('merges deprecated and current BCP-47 aliases under one public registry tag', async () => {
  registerLyraLocale('IW_il', { 'x-deprecated-alias-first': 'first' });
  registerLyraLocale('he-IL', { 'x-deprecated-alias-second': 'second' });
  const registered = getRegisteredLyraLocales();
  expect(registered.filter((locale) => locale === 'he-IL')).to.have.lengthOf(1);
  expect(registered).not.to.include('iw-IL');

  const host = await localeHost('iw_IL');
  expect(resolveLyraString(host, 'x-deprecated-alias-first')).to.equal('first');
  expect(resolveLyraString(host, 'x-deprecated-alias-second')).to.equal('second');
});

it('treats equivalent canonical active-locale spellings as a notification no-op', () => {
  const previous = getLyraLocale();
  let calls = 0;
  try {
    setLyraLocale('pt-BR');
    const stop = subscribeLyraLocale(() => {
      calls += 1;
    });
    try {
      setLyraLocale('PT_br');
      expect(getLyraLocale()).to.equal('pt-BR');
      expect(calls).to.equal(0);
    } finally {
      stop();
    }
  } finally {
    setLyraLocale(previous);
  }
});

it('rejects invalid over-complex storage tags while retaining bounded custom tags', () => {
  const invalid = `not a locale ${'x'.repeat(512)}`;
  expect(() => setLyraLocale(invalid)).to.throw(TypeError);
  expect(() => registerLyraLocale(invalid, { noData: 'unreachable' })).to.throw(TypeError);
  expect(() => registerLyraLocale('X_BOUNDED_CUSTOM', { noData: 'accepted' })).not.to.throw();
});

it('registers the complete Persian and Hebrew catalogs as discoverable locales', () => {
  const result = getRegisteredLyraLocales();
  expect(result).to.include('fa');
  expect(result).to.include('he');
});

it('falls back from fa-IR and he-IL regional tags to the registered base catalogs', async () => {
  const persian = await localeHost('fa-IR');
  const hebrew = await localeHost('he-IL');
  expect(resolveLyraString(persian, 'close')).to.equal('بستن');
  expect(resolveLyraString(hebrew, 'close')).to.equal('סגור');
});

it('selects Persian one/other and Hebrew one/two/other catalog forms through regional tags', async () => {
  const persian = await localeHost('fa-IR');
  const hebrew = await localeHost('he-IL');
  const matches = (host: HTMLElement, count: number) =>
    resolveLyraString(host, 'viewerSearchMatchCount', undefined, undefined, { count });

  expect(matches(persian, 1)).to.equal('1 تطابق');
  expect(matches(persian, 2)).to.equal('2 تطابق');
  expect(matches(hebrew, 1)).to.equal('1 התאמה');
  expect(matches(hebrew, 2)).to.equal('2 התאמות');
  expect(matches(hebrew, 3)).to.equal('3 התאמות');
});

it('reaches a regional-only catalog from its bare base language and from a script-bearing tag', async () => {
  // zh-CN and pt-BR are the only Chinese/Portuguese catalogs that ship; every one of these tags
  // has to land on them rather than silently rendering English.
  for (const tag of ['zh', 'zh-Hans', 'zh-Hans-CN', 'zh-CN']) {
    expect(resolveLyraString(await localeHost(tag), 'close'), tag).to.equal('关闭');
  }
  for (const tag of ['pt', 'pt-PT', 'pt-BR']) {
    expect(resolveLyraString(await localeHost(tag), 'close'), tag).to.equal('Fechar');
  }
});

it('breaks a base-language fallback tie by shared subtags, then alphabetically -- never by registration order', async () => {
  registerLyraLocale('qaa-TW', { 'x-tie-probe': 'TW' });
  registerLyraLocale('qaa-CN', { 'x-tie-probe': 'CN' });
  // No subtag in common beyond the language -> alphabetical.
  expect(resolveLyraString(await localeHost('qaa'), 'x-tie-probe')).to.equal('CN');
  // A shared region subtag outranks the alphabetical winner.
  expect(resolveLyraString(await localeHost('qaa-Hant-TW'), 'x-tie-probe')).to.equal('TW');
});

it('keeps an exact truncation-chain hit ahead of any regional sibling', async () => {
  registerLyraLocale('qab', { 'x-exact-probe': 'BASE' });
  registerLyraLocale('qab-CN', { 'x-exact-probe': 'REGION' });
  expect(resolveLyraString(await localeHost('qab-Hans-CN'), 'x-exact-probe')).to.equal('BASE');
});

it('selects plural categories through the same widened chain the messages use', async () => {
  registerLyraLocale('zh-CN', { 'x-plural-chain': { other: '{count} 个' } });
  const host = await localeHost('zh-Hans-CN');
  expect(resolveLyraString(host, 'x-plural-chain', undefined, undefined, { count: 3 })).to.equal('3 个');
});

it('reports a registered catalog writing direction, honouring regional and base tags', () => {
  expect(getLyraLocaleDirection('ar')).to.equal('rtl');
  expect(getLyraLocaleDirection('ar-EG')).to.equal('rtl');
  expect(getLyraLocaleDirection('fa-IR')).to.equal('rtl');
  expect(getLyraLocaleDirection('he')).to.equal('rtl');
  expect(getLyraLocaleDirection('de')).to.equal('ltr');
  expect(getLyraLocaleDirection('zh-Hans-CN')).to.equal('ltr');
  expect(getLyraLocaleDirection('')).to.equal('ltr');
  expect(getLyraLocaleDirection('not a tag')).to.equal('ltr');
});

it('accepts explicit locale metadata without disturbing the two-argument call', () => {
  registerLyraLocale('x-meta-probe', { noData: 'first' });
  expect(getLyraLocaleDirection('x-meta-probe')).to.equal('ltr');
  registerLyraLocale('x-meta-probe', { close: 'second' }, { dir: 'rtl', name: 'Probe' });
  expect(getLyraLocaleDirection('x-meta-probe')).to.equal('rtl');
  // The metadata call must merge, never replace, the strings registered before it.
  expect(getRegisteredLyraLocales()).to.include('x-meta-probe');
  registerLyraLocale('x-meta-probe', { noData: 'third' });
  expect(getLyraLocaleDirection('x-meta-probe')).to.equal('rtl');
});

it('derives direction from Intl for an unregistered RTL locale when the engine exposes text info', () => {
  const supported = typeof (Intl.Locale.prototype as { getTextInfo?: unknown }).getTextInfo === 'function';
  // `ur` ships no catalog; the answer can only come from Intl, and only where Intl provides it.
  expect(getLyraLocaleDirection('ur')).to.equal(supported ? 'rtl' : 'ltr');
});

it('inherits explicit RTL direction for Persian and Hebrew without forcing direction from locale', async () => {
  for (const locale of ['fa-IR', 'he-IL']) {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div lang=${locale} dir="rtl"><span></span></div>`,
    );
    expect(resolveLyraDirection(wrapper.querySelector('span')!)).to.equal('rtl');
  }

  const localeOnly = await fixture<HTMLElement>(html`<span lang="he-IL"></span>`);
  expect(resolveLyraDirection(localeOnly)).to.equal('ltr');
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

it('does not notify active-locale subscribers for an unrelated catalog registration', () => {
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

it('isolates active-locale subscriber failures until every snapshot listener receives the change', () => {
  const previous = getLyraLocale();
  const failure = new Error('locale subscriber failure');
  const secondFailure = new Error('second locale subscriber failure');
  const delivered: string[] = [];
  const stopThrowing = subscribeLyraLocale(() => {
    delivered.push('throwing');
    throw failure;
  });
  const stopSecondThrowing = subscribeLyraLocale(() => {
    delivered.push('second throwing');
    throw secondFailure;
  });
  const stopLater = subscribeLyraLocale(() => delivered.push('later'));
  let thrown: unknown;
  try {
    try {
      setLyraLocale('x-isolated-active-delivery');
    } catch (error) {
      thrown = error;
    }
    expect(delivered).to.deep.equal(['throwing', 'second throwing', 'later']);
    expect(thrown).to.be.instanceOf(AggregateError);
    expect((thrown as AggregateError).errors).to.deep.equal([failure, secondFailure]);
  } finally {
    stopThrowing();
    stopSecondThrowing();
    stopLater();
    setLyraLocale(previous);
  }
});

it('delivers registry subscribers after a relevant active subscriber throws during registration', () => {
  const locale = 'x-isolated-registry-delivery';
  const previous = getLyraLocale();
  setLyraLocale(locale);
  const failure = new Error('active subscriber failure');
  const delivered: string[] = [];
  const stopThrowing = subscribeLyraLocale(() => {
    delivered.push('active');
    throw failure;
  });
  const stopRegistry = subscribeLyraLocaleRegistry(() => delivered.push('registry'));
  let thrown: unknown;
  try {
    try {
      registerLyraLocale(locale, { noData: 'registered' });
    } catch (error) {
      thrown = error;
    }
    expect(delivered).to.deep.equal(['active', 'registry']);
    expect(thrown).to.be.instanceOf(AggregateError);
    expect((thrown as AggregateError).errors).to.deep.equal([failure]);
    expect(resolveLyraString(document.body, 'noData')).to.equal('registered');
  } finally {
    stopThrowing();
    stopRegistry();
    setLyraLocale(previous);
  }
});

it('notifies registry subscribers only when registry membership changes', () => {
  const locale = 'x-registry-membership-only';
  let calls = 0;
  const stop = subscribeLyraLocaleRegistry(() => {
    calls += 1;
  });
  try {
    registerLyraLocale(locale, { noData: 'first' });
    registerLyraLocale(locale, { close: 'second' });
    expect(calls).to.equal(1);
  } finally {
    stop();
  }
});

it('delivers the starting listener snapshot even when an earlier callback unsubscribes a later one', () => {
  const previous = getLyraLocale();
  const delivered: string[] = [];
  let stopLater = () => {};
  const stopFirst = subscribeLyraLocale(() => {
    delivered.push('first');
    stopLater();
  });
  stopLater = subscribeLyraLocale(() => delivered.push('later'));
  try {
    setLyraLocale('x-starting-snapshot');
    expect(delivered).to.deep.equal(['first', 'later']);
  } finally {
    stopFirst();
    stopLater();
    setLyraLocale(previous);
  }
});

// ---------------------------------------------------------------------------
// Plural rules (Intl.PluralRules categories)
// ---------------------------------------------------------------------------

/** A host carrying an explicit `locale`, which `resolveLyraLocale()` reads ahead of `lang`. */
function localeHost(locale: string): Promise<HTMLElement> {
  return fixture<HTMLElement>(html`<div locale=${locale}></div>`);
}

it('bounds hostile locale-prefix construction and avoids rebuilding the chain per lookup', async () => {
  const hostileLocale = Array.from({ length: 2_048 }, () => 'a').join('-');
  const host = await localeHost(hostileLocale);
  expect(resolveLyraLocale(host)).to.equal('en');
  const originalJoin = Array.prototype.join;
  let oversizedPrefixJoins = 0;
  Array.prototype.join = function (...args: Parameters<typeof originalJoin>): string {
    if (args[0] === '-' && this.length > 32) oversizedPrefixJoins += 1;
    return originalJoin.apply(this, args);
  };
  try {
    for (let index = 0; index < 8; index += 1) {
      expect(resolveLyraString(host, 'x-hostile-locale-miss')).to.equal('x-hostile-locale-miss');
    }
  } finally {
    Array.prototype.join = originalJoin;
  }
  expect(oversizedPrefixJoins).to.equal(0);
});

it('memoizes canonical identity and candidate work across repeated bounded lookups', async () => {
  const locale = `qaa-Latn-LU-x-${Math.random().toString(36).slice(2, 8)}`;
  const host = await localeHost(locale);
  const originalCanonicalizer = Intl.getCanonicalLocales;
  let canonicalizerCalls = 0;
  Intl.getCanonicalLocales = ((locales?: string | readonly string[]) => {
    canonicalizerCalls += 1;
    return originalCanonicalizer(locales);
  }) as typeof Intl.getCanonicalLocales;
  try {
    for (let index = 0; index < 8; index += 1) {
      expect(resolveLyraString(host, 'x-cached-locale-miss')).to.equal('x-cached-locale-miss');
    }
  } finally {
    Intl.getCanonicalLocales = originalCanonicalizer;
  }
  expect(canonicalizerCalls).to.equal(1);
});

it('retains exact and base lookup for a structurally valid tag beyond the malformed-input ceiling', async () => {
  const base = 'qzz';
  const longValidTag = `${base}-x-${Array.from({ length: 100 }, (_, index) =>
    (index % 36).toString(36)).join('-')}`;
  registerLyraLocale(base, { 'x-long-valid-probe': 'base fallback' });

  expect(resolveLyraString(await localeHost(longValidTag), 'x-long-valid-probe')).to.equal('base fallback');
});

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

it('snapshots registered plural messages so later caller mutation cannot change the catalog', async () => {
  const plural = { one: 'before one', other: 'before other' };
  registerLyraLocale('x-snapshot-catalog', { 'x-snapshot-message': plural });
  plural.one = 'after one';
  plural.other = 'after other';
  const host = await localeHost('x-snapshot-catalog');

  expect(resolveLyraString(host, 'x-snapshot-message', undefined, undefined, { count: 1 })).to.equal(
    'before one',
  );
  expect(resolveLyraString(host, 'x-snapshot-message', undefined, undefined, { count: 2 })).to.equal(
    'before other',
  );
});

it('snapshots locale metadata so caller mutation cannot change direction', () => {
  const meta: { dir: 'ltr' | 'rtl'; name: string } = { dir: 'rtl', name: 'Before' };
  registerLyraLocale('x-snapshot-meta', { noData: 'message' }, meta);
  meta.dir = 'ltr';
  meta.name = 'After';
  expect(getLyraLocaleDirection('x-snapshot-meta')).to.equal('rtl');
});

it('skips a malformed registered key while preserving its last valid value and valid siblings', async () => {
  const locale = 'x-invalid-catalog-preserves';
  registerLyraLocale(locale, { noData: 'last valid' });
  expect(() =>
    registerLyraLocale(
      locale,
      { noData: {}, close: 'valid sibling' } as unknown as Parameters<typeof registerLyraLocale>[1],
    ),
  ).not.to.throw();

  expect(resolveLyraString(await localeHost(locale), 'noData')).to.equal('last valid');
  expect(resolveLyraString(await localeHost(locale), 'close')).to.equal('valid sibling');
});

it('skips throwing catalog accessors without invoking them or disturbing valid state', async () => {
  const locale = 'x-hostile-catalog-getter';
  registerLyraLocale(locale, { noData: 'last valid' });
  let getterCalls = 0;
  const hostile = Object.defineProperty({}, 'noData', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('catalog getter must not execute');
    },
  });
  expect(() => registerLyraLocale(locale, hostile as Parameters<typeof registerLyraLocale>[1])).not.to.throw();
  expect(getterCalls).to.equal(0);
  expect(resolveLyraString(await localeHost(locale), 'noData')).to.equal('last valid');
});

it('skips a throwing plural-category accessor without invoking it', async () => {
  const locale = 'x-hostile-plural-getter';
  registerLyraLocale(locale, { noData: 'last valid' });
  let getterCalls = 0;
  const plural = Object.defineProperty({}, 'other', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('plural getter must not execute');
    },
  });
  registerLyraLocale(
    locale,
    { noData: plural } as unknown as Parameters<typeof registerLyraLocale>[1],
  );

  expect(getterCalls).to.equal(0);
  expect(resolveLyraString(await localeHost(locale), 'noData')).to.equal('last valid');
});

it('bounds registered catalog records before committing them', async () => {
  const locale = 'x-bounded-catalog';
  registerLyraLocale(locale, { noData: 'last valid' });
  const oversized = Object.fromEntries(
    Array.from({ length: 4_097 }, (_, index) => [`x-message-${index}`, `message ${index}`]),
  );
  expect(() => registerLyraLocale(locale, oversized)).not.to.throw();
  expect(resolveLyraString(await localeHost(locale), 'noData')).to.equal('last valid');
  expect(resolveLyraString(await localeHost(locale), 'x-message-4095')).to.equal('message 4095');
  expect(resolveLyraString(await localeHost(locale), 'x-message-4096')).to.equal('x-message-4096');
});

it('fails closed per malformed override key and always returns an interpolatable string', async () => {
  const host = await localeHost('en');
  let getterCalls = 0;
  const throwingOverride = Object.defineProperty({}, 'noData', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('override getter must not execute');
    },
  });
  expect(resolveLyraString(host, 'noData', throwingOverride, undefined, { count: 1 })).to.equal('No data');
  expect(getterCalls).to.equal(0);
  expect(
    resolveLyraString(
      host,
      'noData',
      { noData: [] } as unknown as Parameters<typeof resolveLyraString>[2],
      undefined,
      { count: 1 },
    ),
  ).to.equal('No data');
  const inherited = Object.create({ noData: 'inherited override' }) as Parameters<typeof resolveLyraString>[2];
  expect(resolveLyraString(host, 'noData', inherited)).to.equal('No data');
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
