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
    const el = (await fixture(html`<lyra-sparkline .values=${[]}></lyra-sparkline>`)) as LyraSparkline;
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
  const el = (await fixture(html`<lyra-sparkline .values=${[]}></lyra-sparkline>`)) as LyraSparkline;

  setLyraLocale('x-first');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('First');
  setLyraLocale('x-second');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('Second');
  setLyraLocale('en');
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
