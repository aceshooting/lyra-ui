import { fixture, expect, html } from '@open-wc/testing';
import { registerLyraLocale, setLyraLocale, LYRA_DEFAULT_STRINGS } from './localization.js';
import '../components/sparkline/sparkline.js';
import type { LyraSparkline } from '../components/sparkline/sparkline.js';

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
