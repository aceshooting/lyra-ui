import { fixture, expect, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './date-input.js';
import type { LyraDateInput } from './date-input.js';

/** Every shipped catalog plus locales with spaced, suffixed or year-first numeric dates. */
const LOCALES = [
  'am', 'ar', 'bho', 'bn', 'cs', 'da', 'de', 'de-CH', 'el', 'en', 'en-GB', 'en-US', 'es', 'fa',
  'fa-AF', 'fi', 'fr', 'gu', 'ha', 'he', 'hi', 'hr', 'hu', 'id', 'ig', 'it', 'ja', 'jv', 'kk',
  'kn', 'ko', 'ln', 'ml', 'mr', 'ms', 'my', 'nb', 'ne', 'nl', 'nn', 'om', 'or', 'pa', 'pcm', 'pl',
  'pnb', 'ps', 'pt-BR', 'pt-PT', 'ro', 'ru', 'sd', 'sl', 'su', 'sv', 'sw', 'ta', 'te', 'th', 'tl',
  'tr', 'uk', 'ur', 'uz', 'vi', 'yo', 'zh-CN', 'zh-TW', 'zu',
  'bg', 'bs', 'ky', 'lv', 'mk', 'sk', 'sr', 'sr-Latn',
];

// English chrome is the intended fallback (`tl` and `pnb` canonicalize to `fil` and `lah`).
for (const locale of [...LOCALES, 'fil', 'lah']) {
  expectLocaleFallback(locale, ['chooseDate', 'date', 'dateInputInvalid', 'nextMonth', 'openCalendar', 'previousMonth']);
}

interface Outcome {
  typed: string;
  committed: string;
  badInput: boolean;
}

/** Mounts at `from`, types the field's own rendering of `to`, and commits it via `change`. */
async function commitOwnText(
  locale: string,
  from: string,
  to: string,
  mode: 'single' | 'range' = 'single'
): Promise<Outcome> {
  const el = (await fixture(
    html`<lr-date-input locale=${locale} mode=${mode} value=${to}></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const typed = input.value;
  el.value = from;
  await el.updateComplete;
  input.value = typed;
  input.dispatchEvent(new Event('change'));
  await el.updateComplete;
  return { typed, committed: el.value, badInput: el.validity.badInput };
}

async function commitText(locale: string, from: string, text: string, mode: 'single' | 'range' = 'single') {
  const el = (await fixture(
    html`<lr-date-input locale=${locale} mode=${mode} value=${from}></lr-date-input>`
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('change'));
  await el.updateComplete;
  return { committed: el.value, badInput: el.validity.badInput };
}

describe('lr-date-input parses its own locale display text', () => {
  it('round-trips a single date in every supported locale, for a day that could be a month and one that cannot', async () => {
    const failures: string[] = [];
    for (const locale of LOCALES) {
      for (const to of ['2026-10-07', '2026-10-17', '2026-01-09']) {
        const outcome = await commitOwnText(locale, '2026-10-06', to);
        if (outcome.committed !== to || outcome.badInput) {
          failures.push(`${locale} ${JSON.stringify(outcome.typed)} -> ${outcome.committed} badInput=${outcome.badInput}`);
        }
      }
    }
    expect(failures).to.deep.equal([]);
  });

  it('round-trips a range in every supported locale, including the shared-field collapsed forms', async () => {
    const failures: string[] = [];
    const cases: [string, string][] = [
      ['2026-10-06/2026-10-09', '2026-10-07/2026-10-09'], // same month
      ['2026-09-06/2026-10-09', '2026-09-07/2026-10-09'], // same year
      ['2025-12-06/2026-01-09', '2025-12-07/2026-01-09'], // different years
      ['2026-10-06/2026-10-06', '2026-10-07/2026-10-07'], // one day, rendered as a single date
    ];
    for (const locale of LOCALES) {
      for (const [from, to] of cases) {
        const outcome = await commitOwnText(locale, from, to, 'range');
        if (outcome.committed !== to || outcome.badInput) {
          failures.push(`${locale} ${JSON.stringify(outcome.typed)} -> ${outcome.committed} badInput=${outcome.badInput}`);
        }
      }
    }
    expect(failures).to.deep.equal([]);
  });

  it('commits the typed Czech date from real keyboard input under an inherited lang', async () => {
    const wrapper = await fixture(html`<div lang="cs"><lr-date-input value="2026-10-06"></lr-date-input></div>`);
    const el = wrapper.querySelector('lr-date-input') as LyraDateInput;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    expect(input.value).to.equal('6. 10. 2026');
    await focusByKeyboard(input);
    input.select();
    await sendKeys({ type: '7. 10. 2026' });
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.value).to.equal('2026-10-07');
    expect(input.value).to.equal('7. 10. 2026');
    expect(el.validity.badInput).to.equal(false);
  });

  it('accepts hand-typed spellings of the locale order: other separators, no spaces, no suffix', async () => {
    const results = [
      ['cs', '7.10.2026'],
      ['cs', '7/10/2026'],
      ['bg', '7.10.2026'],
      ['bg', '7.10.2026г.'],
      ['hr', '7. 10. 2026'],
      ['hu', '2026.10.7'],
      ['de', '7-10-2026'],
    ].map(async ([locale, text]) => `${locale} ${text}: ${(await commitText(locale!, '2026-10-06', text!)).committed}`);
    expect(await Promise.all(results)).to.deep.equal([
      'cs 7.10.2026: 2026-10-07',
      'cs 7/10/2026: 2026-10-07',
      'bg 7.10.2026: 2026-10-07',
      'bg 7.10.2026г.: 2026-10-07',
      'hr 7. 10. 2026: 2026-10-07',
      'hu 2026.10.7: 2026-10-07',
      'de 7-10-2026: 2026-10-07',
    ]);
  });

  it('rejects incomplete numeric text instead of letting the engine guess a date', async () => {
    const results: string[] = [];
    for (const [locale, text, mode] of [
      ['de', '07.', 'single'],
      ['cs', '7. 10.', 'single'],
      ['de', '07.–09.10.', 'range'],
      ['de', '07. – 09.10.2026', 'range'],
    ] as const) {
      const from = mode === 'range' ? '2026-10-06/2026-10-09' : '2026-10-06';
      const outcome = await commitText(locale, from, text, mode);
      results.push(`${locale} ${text}: ${outcome.committed} badInput=${outcome.badInput}`);
    }
    expect(results).to.deep.equal([
      'de 07.: 2026-10-06 badInput=true',
      'cs 7. 10.: 2026-10-06 badInput=true',
      'de 07.–09.10.: 2026-10-06/2026-10-09 badInput=true',
      'de 07. – 09.10.2026: 2026-10-07/2026-10-09 badInput=false',
    ]);
  });
});
