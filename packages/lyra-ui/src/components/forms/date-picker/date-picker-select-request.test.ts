import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-date-picker.js';
import '../../lr-date-input.js';
import type { LyraDatePicker } from '../../lr-date-picker.js';
import type { LyraDateInput } from '../../lr-date-input.js';

const day = (el: LyraDatePicker, iso: string): HTMLButtonElement =>
  el.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="day"][data-date="${iso}"]`)!;

describe('lr-date-picker select request', () => {
  it('lets a listener veto or resolve a day pick before anything commits', async () => {
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker value="2026-05-14"></lr-date-picker>`);
    const log: string[] = [];
    let mode: 'veto' | 'resolve' | 'same' | 'allow' = 'veto';
    el.addEventListener('lr-date-picker-select-request', (event) => {
      const { value, previousValue } = event.detail;
      log.push(`request:${value}:${previousValue}:${el.value}:${String(event.cancelable)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') el.value = '2026-05-20';
      if (mode === 'same') el.value = '2026-05-14';
    });
    for (const name of ['input', 'lr-input', 'change', 'lr-change']) el.addEventListener(name, () => log.push(name));

    day(el, '2026-05-15').click();
    await el.updateComplete;
    expect(el.value).to.equal('2026-05-14');
    expect(day(el, '2026-05-14').getAttribute('aria-selected')).to.equal('true');
    expect(day(el, '2026-05-15').getAttribute('aria-selected')).to.equal('false');
    expect(log).to.deep.equal(['request:2026-05-15:2026-05-14:2026-05-14:true']);

    log.length = 0;
    mode = 'resolve';
    day(el, '2026-05-15').click();
    await el.updateComplete;
    expect(el.value, 'a listener write wins over the proposal').to.equal('2026-05-20');
    expect(log).to.deep.equal(['request:2026-05-15:2026-05-14:2026-05-14:true']);

    log.length = 0;
    mode = 'same';
    el.value = '2026-05-14';
    await el.updateComplete;
    day(el, '2026-05-16').click();
    await el.updateComplete;
    expect(el.value, 'writing back the held value still suppresses the commit').to.equal('2026-05-14');

    log.length = 0;
    mode = 'allow';
    day(el, '2026-05-15').click();
    await el.updateComplete;
    expect(el.value).to.equal('2026-05-15');
    expect(log).to.deep.equal([
      'request:2026-05-15:2026-05-14:2026-05-14:true', 'input', 'lr-input', 'change', 'lr-change',
    ]);
  });

  it('gates a range preset, keeping appliedPreset untouched on veto', async () => {
    const preset = { label: 'Week', start: '2026-05-04', end: '2026-05-10' };
    const el = await fixture<LyraDatePicker>(html`<lr-date-picker mode="range" today="2026-05-14"
      value="2026-05-01/2026-05-02" .presets=${[preset]}></lr-date-picker>`);
    const log: string[] = [];
    let veto = true;
    el.addEventListener('lr-date-picker-select-request', (event) => {
      log.push(`request:${event.detail.value}:${event.detail.previousValue}`);
      if (veto) event.preventDefault();
    });
    el.addEventListener('lr-change', () => log.push('lr-change'));
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="preset-button"]')!;
    button.click();
    await el.updateComplete;
    expect(el.value).to.equal('2026-05-01/2026-05-02');
    expect(el.appliedPreset).to.equal(undefined);
    expect(log).to.deep.equal(['request:2026-05-04/2026-05-10:2026-05-01/2026-05-02']);

    log.length = 0;
    veto = false;
    button.click();
    await el.updateComplete;
    expect(el.value).to.equal('2026-05-04/2026-05-10');
    expect(el.appliedPreset === preset).to.equal(true);
    expect(log).to.deep.equal(['request:2026-05-04/2026-05-10:2026-05-01/2026-05-02', 'lr-change']);
  });

  it('keeps the nested picker request inside lr-date-input', async () => {
    const el = await fixture<LyraDateInput>(html`<lr-date-input label="Date" value="2026-05-14"></lr-date-input>`);
    let leaked = 0;
    el.addEventListener('lr-date-picker-select-request', () => leaked++);
    await el.show();
    const picker = el.shadowRoot!.querySelector<LyraDatePicker>('[part="date-picker"]')!;
    await picker.updateComplete;
    day(picker, '2026-05-15').click();
    await el.updateComplete;
    expect(leaked).to.equal(0);
    expect(el.value).to.equal('2026-05-15');
  });
});
