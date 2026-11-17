import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { formatBytes } from '../../../utilities/format.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import './budget-meter.js';
import type { LyraBudgetMeter } from './budget-meter.class.js';

type Formatter = (value: number, context: Readonly<{ locale: string }>) => string;
type FormattedMeter = LyraBudgetMeter & { valueFormatter?: Formatter };

expectLocaleFallback('fr', [
  'budgetMeterLabel', 'budgetMeterValue', 'budgetMeterPercent',
  'budgetMeterExceeded', 'budgetMeterUnavailable',
]);

function valueText(el: LyraBudgetMeter): string {
  return el.shadowRoot!.querySelector('[part="value"]')!.textContent!;
}

function meter(el: LyraBudgetMeter): Element | null {
  return el.shadowRoot!.querySelector('[part="meter"]');
}

describe('budget meter quantity display formatter', () => {
  it('preserves numeric defaults, units and raw clamping when the formatter is unset', async () => {
    const el = await fixture<FormattedMeter>(html`<lr-budget-meter used="125" limit="100" unit="tokens"></lr-budget-meter>`);
    expect(valueText(el)).to.equal('125 of 100 tokens');
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
    expect([meter(el)!.getAttribute('aria-valuenow'), meter(el)!.getAttribute('aria-valuemax')]).to.deep.equal(['100', '100']);
    expect(el.shadowRoot!.querySelector('[part="exceeded"]') !== null).to.equal(true);
    el.valueFormatter = undefined;
    await el.updateComplete;
    expect(valueText(el)).to.equal('125 of 100 tokens');
    el.limit = 0;
    await el.updateComplete;
    expect(meter(el) === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="unavailable"]') !== null).to.equal(true);
    expect(valueText(el)).to.equal('125 of 0 tokens');
  });

  it('reuses byte formatting independently for visible and spoken quantities while raw ARIA stays in bytes', async () => {
    const locales: string[] = [];
    const formatter: Formatter = (value, { locale }) => {
      locales.push(locale);
      return formatBytes(value, locale, { unitStep: 1024, decimals: 2 })!;
    };
    const el = await fixture<FormattedMeter>(html`<lr-budget-meter lang="en" used="1536" limit="1048576"
      .valueFormatter=${formatter} .strings=${{ budgetMeterValue: '{used} / {limit}' }}></lr-budget-meter>`);
    expect(valueText(el)).to.equal(`${formatBytes(1536, 'en', { unitStep: 1024, decimals: 2 })} / ${formatBytes(1048576, 'en', { unitStep: 1024, decimals: 2 })}`);
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
    expect([meter(el)!.getAttribute('aria-valuenow'), meter(el)!.getAttribute('aria-valuemax')]).to.deep.equal(['1536', '1048576']);
    expect(locales.length).to.be.greaterThan(0);
    expect(locales.every(locale => locale === 'en')).to.equal(true);

    locales.length = 0;
    el.lang = 'fr';
    await el.updateComplete;
    expect(valueText(el)).to.equal(`${formatBytes(1536, 'fr', { unitStep: 1024, decimals: 2 })} / ${formatBytes(1048576, 'fr', { unitStep: 1024, decimals: 2 })}`);
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
    expect(locales.length).to.be.greaterThan(0);
    expect(locales.every(locale => locale === 'fr')).to.equal(true);
  });

  it('uses one coherent formatted pair for visible text and aria-valuetext instead of invoking each path separately', async () => {
    let sequence = 0;
    const el = await fixture<FormattedMeter>(html`<lr-budget-meter used="7" limit="12"
      .valueFormatter=${(value: number) => `${value}[${++sequence}]`}
      .strings=${{ budgetMeterValue: '{used}|{limit}' }}></lr-budget-meter>`);
    expect(valueText(el)).to.match(/^7\[\d+\]\|12\[\d+\]$/);
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
    const before = sequence;
    el.requestUpdate();
    await el.updateComplete;
    expect(sequence - before).to.equal(2);
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
  });

  it('falls back as a pair when the second formatted quantity throws, then recovers after an external replacement', async () => {
    const el = await fixture<FormattedMeter>(html`<lr-budget-meter used="5" limit="10" unit="tokens"
      .valueFormatter=${(value: number) => {
        if (value === 10) throw new Error('formatter private failure');
        return 'five formatted units';
      }}></lr-budget-meter>`);
    expect(valueText(el)).to.equal('5 of 10 tokens');
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
    expect(el.shadowRoot!.textContent).not.to.include('formatter private failure');
    el.valueFormatter = value => `quantity ${value}`;
    await el.updateComplete;
    expect(valueText(el)).to.equal('quantity 5 of quantity 10 tokens');
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
  });

  it('treats malformed formatter results as numeric fallback and renders valid HTML-looking strings as text', async () => {
    const el = await fixture<FormattedMeter>(html`<lr-budget-meter used="5" limit="10"></lr-budget-meter>`);
    for (const result of ['', '   ', null, 42, { html: '<b>unsafe</b>' }, 'x'.repeat(65_537)]) {
      el.valueFormatter = (() => result) as Formatter;
      await el.updateComplete;
      expect(valueText(el)).to.equal('5 of 10');
      expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
    }
    el.valueFormatter = value => `<b>${value}</b>`;
    await el.updateComplete;
    expect(valueText(el)).to.equal('<b>5</b> of <b>10</b>');
    expect(el.shadowRoot!.querySelectorAll('b').length).to.equal(0);
  });

  it('rejects a synchronously superseded custom pair and renders current numeric state coherently', async () => {
    const el = await fixture<FormattedMeter>(html`<lr-budget-meter used="5" limit="10"></lr-budget-meter>`);
    let calls = 0;
    el.valueFormatter = value => {
      calls++;
      if (calls === 1) {
        el.used = 25;
        el.limit = 20;
      }
      return `obsolete ${value}`;
    };
    el.requestUpdate();
    await waitUntil(() => el.used === 25 && valueText(el) === '25 of 20', 'the superseded formatter yields a current numeric projection');
    await el.updateComplete;
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal('25 of 20');
    expect([meter(el)!.getAttribute('aria-valuenow'), meter(el)!.getAttribute('aria-valuemax')]).to.deep.equal(['20', '20']);
    expect((el.shadowRoot!.querySelector('[part="fill"]') as HTMLElement).style.inlineSize).to.equal('100%');
    expect(el.shadowRoot!.querySelector('[part="exceeded"]') !== null).to.equal(true);
    expect(calls, 'the invalidated render chain does not immediately call the formatter again').to.equal(1);
  });

  it('settles a self-invalidating keyless update without an automatic formatter loop and accepts a later pure formatter', async () => {
    const el = await fixture<FormattedMeter>(html`<lr-budget-meter used="5" limit="10"></lr-budget-meter>`);
    let calls = 0;
    el.valueFormatter = () => {
      calls++;
      if (calls > 4) throw new Error('bounded formatter loop guard');
      el.requestUpdate();
      return 'stale custom text';
    };
    el.requestUpdate();
    await waitUntil(() => calls > 0, 'the new formatter was invoked');
    await el.updateComplete;
    await nextFrame();
    expect(valueText(el)).to.equal('5 of 10');
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
    expect(calls).to.equal(1);
    el.valueFormatter = value => `current ${value}`;
    await el.updateComplete;
    expect(valueText(el)).to.equal('current 5 of current 10');
  });

  it('contains long custom quantities in a populated 320px RTL meter', async () => {
    const el = await fixture<FormattedMeter>(html`<lr-budget-meter dir="rtl" used="5" limit="10" style="inline-size: 320px"
      .valueFormatter=${(value: number) => `كمية ${value} ${'وحدة '.repeat(15)}`}></lr-budget-meter>`);
    expect(valueText(el)).to.include('كمية 5');
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
    expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
    await expect(el).to.be.accessible();
  });

  it('retries the same previously self-invalidating callback after an external refresh once its closure becomes pure', async () => {
    const el = await fixture<FormattedMeter>(html`<lr-budget-meter used="5" limit="10"></lr-budget-meter>`);
    let selfInvalidating = true;
    let invalidatingCalls = 0;
    const formatter: Formatter = value => {
      if (selfInvalidating) {
        invalidatingCalls++;
        if (invalidatingCalls > 4) throw new Error('bounded formatter loop guard');
        el.requestUpdate();
      }
      return `formatted ${value}`;
    };
    el.valueFormatter = formatter;
    el.requestUpdate();
    await waitUntil(() => invalidatingCalls > 0, 'the original callback was invoked');
    await el.updateComplete;
    await nextFrame();
    expect(valueText(el)).to.equal('5 of 10');
    expect(invalidatingCalls).to.equal(1);

    selfInvalidating = false;
    el.requestUpdate();
    await el.updateComplete;
    expect(el.valueFormatter === formatter, 'the formatter identity has not changed').to.equal(true);
    expect(valueText(el)).to.equal('formatted 5 of formatted 10');
    expect(meter(el)!.getAttribute('aria-valuetext')).to.equal(valueText(el));
    el.used = 6;
    await el.updateComplete;
    expect(valueText(el)).to.equal('formatted 6 of formatted 10');
    expect(meter(el)!.getAttribute('aria-valuenow')).to.equal('6');
    expect(invalidatingCalls).to.equal(1);
  });
});
