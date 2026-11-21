import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-color-picker.js';
import type { LyraColorPicker } from '../../lr-color-picker.js';

const swatches = (el: LyraColorPicker): HTMLButtonElement[] =>
  Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="swatch"]'));

describe('color-picker change request', () => {
  it('lets a listener veto or resolve a discrete pick before anything commits', async () => {
    const el = await fixture<LyraColorPicker>(html`<lr-color-picker inline label="Accent" value="#000000"
      swatches="#ff0000;#00ff00;#0000ff"></lr-color-picker>`);
    const log: string[] = [];
    let mode: 'veto' | 'resolve' | 'allow' = 'veto';
    el.addEventListener('lr-change-request', (event) => {
      const { value, previousValue } = event.detail;
      log.push(`request:${value}:${String(previousValue)}:${el.value}:${String(event.cancelable)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') el.value = '#0000ff';
    });
    for (const name of ['input', 'lr-input', 'change', 'lr-change']) el.addEventListener(name, () => log.push(name));

    swatches(el)[0]!.click();
    await el.updateComplete;
    expect(el.value).to.equal('#000000');
    expect(log).to.deep.equal(['request:#ff0000:#000000:#000000:true']);

    log.length = 0;
    const field = el.shadowRoot!.querySelector<HTMLInputElement>('[part~="input"]')!;
    field.value = '#123456';
    field.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.value, 'a vetoed text entry keeps the current value').to.equal('#000000');
    expect(field.value).to.equal('#000000');
    expect(log).to.deep.equal(['request:#123456:#000000:#000000:true']);

    log.length = 0;
    mode = 'resolve';
    swatches(el)[1]!.click();
    await el.updateComplete;
    expect(el.value, 'a listener write wins over the proposal').to.equal('#0000ff');
    expect(log).to.deep.equal(['request:#00ff00:#000000:#000000:true']);

    log.length = 0;
    mode = 'allow';
    swatches(el)[0]!.click();
    await el.updateComplete;
    expect(el.value).to.equal('#ff0000');
    expect(log).to.deep.equal(['request:#ff0000:#0000ff:#0000ff:true', 'input', 'lr-input', 'change', 'lr-change']);

    log.length = 0;
    swatches(el)[0]!.click();
    await el.updateComplete;
    expect(log, 're-picking the current colour proposes nothing').to.deep.equal([]);
  });
});
