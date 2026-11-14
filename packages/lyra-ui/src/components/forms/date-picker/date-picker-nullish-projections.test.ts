import { expect, fixture, html } from '@open-wc/testing';
import './date-picker.js';
import './date-input.js';
import { parseDisabledWeekdays, type LyraDatePicker } from './date-picker.class.js';
import type { LyraDateInput } from './date-input.class.js';

describe('lr-date-picker UTC projection', () => {
  it('reports no UTC date while empty and the UTC midnight of a chosen day', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker></lr-date-picker>`);
    expect(el.valueAsUTCDate).to.equal(null);
    el.value = '2024-03-09';
    expect(el.valueAsUTCDate?.toISOString()).to.equal('2024-03-09T00:00:00.000Z');
  });
});

describe('parseDisabledWeekdays', () => {
  it('drops unknown weekday tokens while keeping names and digits', () => {
    expect([...parseDisabledWeekdays('Sunday, funday 6 7')].sort()).to.deep.equal([0, 6]);
  });
});

describe('lr-date-input lowercase native aliases', () => {
  it('restores the browser default when inputmode or enterkeyhint is cleared with null', async () => {
    const el = await fixture<LyraDateInput>(html`<lr-date-input inputmode="numeric" enterkeyhint="next"></lr-date-input>`);
    const native = el.shadowRoot!.querySelector('input')!;
    expect(native.getAttribute('inputmode')).to.equal('numeric');

    el.inputmode = null as unknown as string;
    el.enterkeyhint = null as unknown as string;
    await el.updateComplete;

    expect(el.inputMode).to.equal('');
    expect(el.enterKeyHint).to.equal('');
    expect(native.hasAttribute('inputmode')).to.equal(false);
    expect(native.hasAttribute('enterkeyhint')).to.equal(false);
  });
});

describe('lr-date-picker preset bounds', () => {
  it('skips presets whose start or end is not a date string', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker mode="range"></lr-date-picker>`);
    el.presets = [
      { label: 'Numeric start', start: 20260813 },
      { label: 'Object end', end: { year: 2026 } },
      { label: 'Last week', start: '2026-08-13', end: '2026-08-19' },
    ] as never;
    await el.updateComplete;
    const labels = [...el.shadowRoot!.querySelectorAll('[part~="preset-button"]')].map((button) => button.textContent!.trim());
    expect(labels).to.deep.equal(['Last week']);
  });

  it('clears a pending-range preview on pointer leave, and ignores a leave with none', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker mode="range" value="2026-08-13" focused-date="2026-08-13"></lr-date-picker>`);
    const day = (iso: string) => el.shadowRoot!.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;
    const previewed = () => el.shadowRoot!.querySelectorAll('[part~="day-range-preview"]').length;

    day('2026-08-20').dispatchEvent(new PointerEvent('pointerleave'));
    await el.updateComplete;
    expect(previewed(), 'nothing previews before a hover').to.equal(0);

    day('2026-08-16').dispatchEvent(new PointerEvent('pointerenter'));
    await el.updateComplete;
    expect(previewed()).to.be.greaterThan(0);
    day('2026-08-16').dispatchEvent(new PointerEvent('pointerleave'));
    await el.updateComplete;
    expect(previewed()).to.equal(0);
  });
});
