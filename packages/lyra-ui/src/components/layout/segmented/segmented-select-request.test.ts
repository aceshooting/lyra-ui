import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-segmented.js';
import type { LyraSegmented, LyraSegmentedSelectRequestDetail } from '../../lr-segmented.js';

const items = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
];
const segment = (el: LyraSegmented, index: number): HTMLElement =>
  el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="segment"]')[index]!;

describe('segmented select request', () => {
  it('lets a listener veto or resolve a user selection before anything commits', async () => {
    const el = await fixture<LyraSegmented>(html`<lr-segmented label="Plan" value="a" .items=${items}></lr-segmented>`);
    const log: string[] = [];
    const requests: LyraSegmentedSelectRequestDetail[] = [];
    let mode: 'veto' | 'resolve' | 'allow' = 'veto';
    el.addEventListener('lr-segmented-select-request', (event) => {
      requests.push({ ...event.detail });
      log.push(`request:${el.value}:${String(event.cancelable)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') el.value = 'c';
    });
    for (const name of ['lr-change', 'lr-activate']) el.addEventListener(name, () => log.push(name));

    segment(el, 1).click();
    await el.updateComplete;
    expect(el.value).to.equal('a');
    expect(segment(el, 0).getAttribute('aria-checked')).to.equal('true');
    expect(log).to.deep.equal(['request:a:true']);
    expect(requests).to.deep.equal([{ value: 'b', previousValue: 'a' }]);

    log.length = 0;
    mode = 'resolve';
    await focusByKeyboard(segment(el, 0));
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect(el.value, 'a listener write wins over the proposal').to.equal('c');
    expect(log).to.deep.equal(['request:a:true']);

    log.length = 0;
    mode = 'allow';
    segment(el, 1).click();
    await el.updateComplete;
    expect(el.value).to.equal('b');
    expect(log).to.deep.equal(['request:c:true', 'lr-change', 'lr-activate']);

    log.length = 0;
    segment(el, 1).click();
    expect(log, 're-picking the current value never asks').to.deep.equal(['lr-activate']);
  });
});
