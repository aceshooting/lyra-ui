import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import '../../lr-stack-trace.js';
import type { LyraStackTrace } from '../../lr-stack-trace.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

describe('lr-stack-trace removed trace', () => {
  it('clears parsed frames and recovers without changing null readback', async () => {
    const el = await fixture<LyraStackTrace>(html`<lr-stack-trace trace="Error: before&#10;    at run (/app/main.js:3:4)"></lr-stack-trace>`);
    expect(el.shadowRoot!.textContent!.includes('/app/main.js')).to.equal(true);
    el.removeAttribute('trace');
    await el.updateComplete;
    expect(el.trace).to.equal(null);
    expect(el.shadowRoot!.textContent!.includes('/app/main.js')).to.equal(false);
    el.setAttribute('trace', '');
    await el.updateComplete;
    expect(el.trace).to.equal('');
    el.setAttribute('trace', 'Error: restored\n    at next (/app/next.js:5:6)');
    await el.updateComplete;
    expect(el.shadowRoot!.textContent!.includes('/app/next.js')).to.equal(true);
  });
});

const insetFocusRing = (el: HTMLElement): boolean => {
  const style = getComputedStyle(el);
  return parseFloat(style.outlineOffset) <= -parseFloat(style.outlineWidth);
};

describe('lr-stack-trace focus rings', () => {
  it('draws frame and internal-toggle focus rings inside the scrolling base', async () => {
    const trace = ['Error: x', '    at a (/app/a.js:1:1)', '    at b (node:internal/b.js:2:1)', '    at c (node:internal/c.js:3:1)'].join('\n');
    const el = await fixture<LyraStackTrace>(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`);
    for (const selector of ['button[part="frame"]', '[part="internal-toggle"]']) {
      const control = el.shadowRoot!.querySelector(selector) as HTMLElement;
      await focusByKeyboard(control);
      expect(insetFocusRing(control), selector).to.equal(true);
    }
  });
});

describe('lr-stack-trace copy announcement', () => {
  it('announces copy success through the shared sink', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
    try {
      const el = await fixture<LyraStackTrace>(html`<lr-stack-trace trace="Error: x&#10;    at a (/app/a.js:1:1)"></lr-stack-trace>`);
      el.shadowRoot!.querySelector<HTMLElement>('[part="copy-button"]')!.click();
      await waitUntil(() => (document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)?.textContent ?? '').includes('Copied'));
      el.removeAttribute('trace');
      await el.updateComplete;
      const copied = oneEvent(el, 'lr-copy');
      el.shadowRoot!.querySelector<HTMLElement>('[part="copy-button"]')!.click();
      expect((await copied as CustomEvent).detail).to.deep.equal({ ok: true, text: '' });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
