import { fixture, expect, html } from '@open-wc/testing';
import {
  registerLyraLocale,
  setLyraLocale,
  getRegisteredLyraLocales,
  subscribeLyraLocaleRegistry,
  subscribeLyraLocale,
  LYRA_DEFAULT_STRINGS,
  resolveLocalizedParts,
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
  expect(LYRA_DEFAULT_STRINGS.nodePaletteResultCount).to.equal('{count} item');
  expect(LYRA_DEFAULT_STRINGS.nodePaletteResultCountPlural).to.equal('{count} items');
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
