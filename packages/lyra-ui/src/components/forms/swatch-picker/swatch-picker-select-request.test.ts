import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-swatch-picker.js';
import type { LyraSwatchPicker } from '../../lr-swatch-picker.js';

const items = [
  { value: 'blue', color: '#0969da', label: 'Blue' },
  { value: 'green', color: '#1a7f37', label: 'Green' },
  { value: 'red', color: '#cf222e', label: 'Red' },
];
const swatch = (el: LyraSwatchPicker, index: number): HTMLButtonElement =>
  el.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="swatch"][data-index="${index}"]`)!;

describe('lr-swatch-picker select request', () => {
  it('lets a listener veto or resolve a selection before anything commits', async () => {
    const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Accent" value="blue"
      .items=${items}></lr-swatch-picker>`);
    const log: string[] = [];
    let mode: 'veto' | 'resolve' | 'same' | 'allow' = 'veto';
    el.addEventListener('lr-change-request', (event) => {
      const { value, previousValue } = event.detail;
      log.push(`request:${value}:${String(previousValue)}:${String(el.value)}:${String(event.cancelable)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') el.value = 'red';
      if (mode === 'same') el.value = 'blue';
    });
    for (const name of ['lr-change', 'lr-activate']) el.addEventListener(name, () => log.push(name));

    swatch(el, 1).click();
    await el.updateComplete;
    expect(el.value).to.equal('blue');
    expect(swatch(el, 0).getAttribute('aria-checked')).to.equal('true');
    expect(log).to.deep.equal(['request:green:blue:blue:true']);

    log.length = 0;
    mode = 'veto';
    await focusByKeyboard(swatch(el, 0));
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === swatch(el, 0), 'a refused arrow key leaves focus in place').to.equal(true);
    expect(el.value).to.equal('blue');
    expect(log).to.deep.equal(['request:green:blue:blue:true']);

    log.length = 0;
    mode = 'resolve';
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect(el.value, 'a listener write wins over the proposal').to.equal('red');
    expect(log).to.deep.equal(['request:green:blue:blue:true']);

    log.length = 0;
    mode = 'same';
    el.value = 'blue';
    await el.updateComplete;
    swatch(el, 2).click();
    await el.updateComplete;
    expect(el.value, 'writing back the held value still suppresses the commit').to.equal('blue');
    expect(log).to.deep.equal(['request:red:blue:blue:true']);

    log.length = 0;
    mode = 'allow';
    swatch(el, 1).click();
    await el.updateComplete;
    expect(el.value).to.equal('green');
    expect(swatch(el, 1).getAttribute('aria-checked')).to.equal('true');
    expect(log).to.deep.equal(['request:green:blue:blue:true', 'lr-change', 'lr-activate']);

    log.length = 0;
    swatch(el, 1).click();
    expect(log, 're-picking the current value requests nothing').to.deep.equal(['lr-activate']);
  });
});
