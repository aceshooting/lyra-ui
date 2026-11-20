import { expect, fixture, html } from '@open-wc/testing';
import type { LyraToolCallBlock } from './tool-call-block.class.js';
import '../../lr-tool-call-block.js';

const headerOf = (el: LyraToolCallBlock): HTMLButtonElement => el.shadowRoot!.querySelector('[part="header"]')!;

describe('tool call block toggle request', () => {
  it('lets a listener veto or resolve a header toggle before it commits', async () => {
    const el = await fixture<LyraToolCallBlock>(html`<lr-tool-call-block name="t" call-id="c1"></lr-tool-call-block>`);
    const log: string[] = [];
    const flags: boolean[] = [];
    let mode: 'veto' | 'resolve' | 'allow' = 'veto';
    el.addEventListener('lr-toggle-request', (event) => {
      flags.push(event.cancelable, event.bubbles, event.composed);
      log.push(`request:${JSON.stringify(event.detail)}:${String(el.expanded)}`);
      if (mode === 'veto') event.preventDefault();
      if (mode === 'resolve') el.expanded = false;
    });
    el.addEventListener('lr-toggle', (event) => log.push(`toggle:${String(event.detail.expanded)}`));

    headerOf(el).click();
    await el.updateComplete;
    expect(el.expanded).to.equal(false);
    expect(el.hasAttribute('expanded')).to.equal(false);
    expect(flags).to.deep.equal([true, true, true]);
    expect(log).to.deep.equal(['request:{"expanded":true,"callId":"c1","invocationId":"c1"}:false']);

    log.length = 0;
    mode = 'resolve';
    headerOf(el).click();
    await el.updateComplete;
    expect(el.expanded, 'a listener write of the current value wins over the proposal').to.equal(false);
    expect(log).to.deep.equal(['request:{"expanded":true,"callId":"c1","invocationId":"c1"}:false']);

    log.length = 0;
    mode = 'allow';
    headerOf(el).click();
    await el.updateComplete;
    expect(el.expanded).to.equal(true);
    expect(headerOf(el).getAttribute('aria-expanded')).to.equal('true');
    expect(log).to.deep.equal(['request:{"expanded":true,"callId":"c1","invocationId":"c1"}:false', 'toggle:true']);
  });
});
