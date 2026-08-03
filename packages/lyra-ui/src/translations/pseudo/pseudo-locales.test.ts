import { expect, fixture, html } from '@open-wc/testing';
import {
  getLyraLocaleDirection,
  getRegisteredLyraLocales,
  registerLyraLocale,
} from '../../localization.js';
import '../../components/data/sparkline/sparkline.js';
import '../../components/utility/format/format-number.js';
import './en-XA.js';
import './ar-XB.js';
import type { LyraSparkline } from '../../components/data/sparkline/sparkline.class.js';
import type { LyraFormatNumber } from '../../components/utility/format/format-number.class.js';
import { createPseudoCatalog, pseudoExpand, pseudoMirror } from '../../internal/pseudo-localization.js';

it('generates deterministic synthetic catalogs without changing placeholders or plural shapes', () => {
  const source = {
    greeting: 'Hello {name}',
    count: { one: '{count} item', other: '{count} items' },
  } as const;
  const expanded = createPseudoCatalog(source, pseudoExpand);
  const mirrored = createPseudoCatalog(source, pseudoMirror);

  expect(expanded.greeting).to.include('{name}');
  expect(expanded.greeting).not.to.equal(source.greeting);
  expect(Object.keys(expanded.count)).to.deep.equal(['one', 'other']);
  expect(expanded.count.one.match(/\{\w+\}/g)).to.deep.equal(['{count}']);
  expect(mirrored.greeting.match(/\{\w+\}/g)).to.deep.equal(['{name}']);
  expect(mirrored.count.other.match(/\{\w+\}/g)).to.deep.equal(['{count}']);
});

it('registers explicit LTR and RTL pseudo locales without claiming native translation coverage', () => {
  expect(getRegisteredLyraLocales()).to.include.members(['en-xa', 'ar-xb']);
  expect(getLyraLocaleDirection('en-XA')).to.equal('ltr');
  expect(getLyraLocaleDirection('ar-XB')).to.equal('rtl');
});

it('does not select developer-only pseudo catalogs for their ordinary base locales', async () => {
  const english = (await fixture(html`
    <lr-sparkline locale="en" .values=${[]}></lr-sparkline>
  `)) as LyraSparkline;
  expect(english.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('No data');

  const arabic = (await fixture(html`
    <lr-sparkline locale="ar" .values=${[]}></lr-sparkline>
  `)) as LyraSparkline;
  expect(arabic.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('No data');

  registerLyraLocale('en-XA', { close: 'Application pseudo override' });
  const englishAfterOverride = (await fixture(html`
    <lr-sparkline locale="en" .values=${[]}></lr-sparkline>
  `)) as LyraSparkline;
  expect(englishAfterOverride.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal(
    'No data',
  );
});

it('reaches rendered component text while per-instance strings still win', async () => {
  const expanded = (await fixture(html`
    <lr-sparkline locale="en-XA" .values=${[]}></lr-sparkline>
  `)) as LyraSparkline;
  const generated = expanded.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')!;
  expect(generated).not.to.equal('No data');
  expect(generated).to.match(/^\[!!/);

  expanded.strings = { noData: 'Application override' };
  await expanded.updateComplete;
  expect(expanded.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal(
    'Application override',
  );

  const mirrored = (await fixture(html`
    <lr-sparkline locale="ar-XB" dir="rtl" .values=${[]}></lr-sparkline>
  `)) as LyraSparkline;
  expect(mirrored.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.match(/^\u27e6RTL\u27e7/);
  expect(getComputedStyle(mirrored).direction).to.equal('rtl');
});

it('keeps pseudo locale tags safe for locale-sensitive platform formatting', async () => {
  const number = (await fixture(html`
    <lr-format-number locale="ar-XB" value="1234.5"></lr-format-number>
  `)) as LyraFormatNumber;
  expect(number.shadowRoot!.textContent!.trim()).not.to.equal('');
  expect(() => new Intl.NumberFormat('ar-XB').format(1234.5)).not.to.throw();
  expect(() => new Intl.PluralRules('en-XA').select(2)).not.to.throw();
});
