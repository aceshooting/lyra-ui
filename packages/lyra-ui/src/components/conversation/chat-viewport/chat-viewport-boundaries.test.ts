import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './chat-viewport.js';
import type { LyraChatViewport } from './chat-viewport.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';

describe('chat viewport composed and directional boundaries', () => {
  it('places a named-slot unread boundary beside forwarded messages while retaining direct transcript content', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <div id="forwarded-first" slot="messages">First forwarded message</div>
      <div id="forwarded-second" slot="messages">Second forwarded message</div>
    </div>`);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<lr-chat-viewport unread-start-index="1" style="height:120px">' +
      '<div>Transcript header</div><slot name="messages"></slot></lr-chat-viewport>';
    const viewport = root.querySelector<LyraChatViewport>('lr-chat-viewport')!;
    await viewport.updateComplete;
    await aTimeout(0);
    const boundary = host.querySelector<HTMLElement>('[data-lr-chat-viewport-unread-boundary]');
    expect(boundary?.getAttribute('slot')).to.equal('messages');
    expect(boundary?.getAttribute('role')).to.equal('separator');
    expect(boundary?.nextElementSibling?.id).to.equal('forwarded-first');
    expect(viewport.scrollToUnread({ behavior: 'auto' })).to.equal(true);
    viewport.unreadStartIndex = 2;
    await viewport.updateComplete;
    expect(boundary?.nextElementSibling?.id).to.equal('forwarded-second');
  });

  it('forces unread navigation to use immediate scrolling with reduced motion', async () => {
    await setReducedMotion('reduce');
    try {
      const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport unread-start-index="1" style="height:100px">
        <div style="height:100px">Read message</div><div style="height:100px">Unread message</div>
      </lr-chat-viewport>`);
      const scroll = viewport.shadowRoot!.querySelector<HTMLElement>('[part="scroll"]')!;
      const originalScrollTo = scroll.scrollTo;
      const behaviors: Array<ScrollBehavior | undefined> = [];
      scroll.scrollTo = ((options: ScrollToOptions) => { behaviors.push(options.behavior); }) as typeof scroll.scrollTo;
      try {
        expect(viewport.scrollToUnread({ behavior: 'smooth' })).to.equal(true);
        expect(behaviors.at(-1)).to.equal('auto');
      } finally {
        scroll.scrollTo = originalScrollTo;
      }
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  it('attributes RTL left-gutter scrollbar gestures to user scrolling and releases follow', async () => {
    const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport dir="rtl" style="height:100px">
      ${Array.from({ length: 8 }, (_, index) => html`<div style="height:80px">Message ${index}</div>`)}
    </lr-chat-viewport>`);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const scroll = viewport.shadowRoot!.querySelector<HTMLElement>('[part="scroll"]')!;
    const rect = scroll.getBoundingClientRect();
    const width = Math.max(100, rect.width);
    Object.defineProperty(scroll, 'offsetWidth', { configurable: true, value: width });
    Object.defineProperty(scroll, 'clientWidth', { configurable: true, value: width - 16 });
    try {
      scroll.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, composed: true, button: 0, clientX: rect.left + 1,
      }));
      scroll.scrollTop = 0;
      scroll.dispatchEvent(new Event('scroll'));
      expect(viewport.follow).to.equal(false);
      window.dispatchEvent(new PointerEvent('pointercancel'));
      await viewport.updateComplete;
      expect(viewport.shadowRoot!.querySelectorAll('[part="jump-pill"]').length).to.equal(1);
    } finally {
      window.dispatchEvent(new PointerEvent('pointercancel'));
      Reflect.deleteProperty(scroll, 'offsetWidth');
      Reflect.deleteProperty(scroll, 'clientWidth');
    }
  });
});
