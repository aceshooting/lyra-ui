import { aTimeout, expect, fixture, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraAppRail } from './app-rail.class.js';
import '../../lr-app-rail.js';
import '../../lr-app-rail-item.js';

let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  // Desktop at every breakpoint: any icon-only presentation below comes from auto-hide alone.
  window.matchMedia = ((query: string) => query.includes('max-width')
    ? {
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList
    : originalMatchMedia.call(window, query)) as typeof window.matchMedia;
});
afterEach(async () => {
  window.matchMedia = originalMatchMedia;
  await resetMouse();
});

const base = (el: LyraAppRail): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('[part="base"], [part="panel"]')!;
const itemFocus = (el: LyraAppRail): HTMLElement =>
  el.querySelector('lr-app-rail-item')!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
const pin = (el: LyraAppRail): HTMLButtonElement | null =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="pin-button"]');

function pointer(el: LyraAppRail, type: string, init: PointerEventInit = {}): void {
  const bubbles = type === 'pointermove';
  base(el).dispatchEvent(new PointerEvent(type, {
    pointerType: 'mouse', isPrimary: true, bubbles, composed: bubbles, clientX: 10, clientY: 10, ...init,
  }));
}

async function autoHideRail(): Promise<{ el: LyraAppRail; main: HTMLElement }> {
  const wrapper = await fixture<HTMLElement>(`
    <div style="display:flex;inline-size:700px;block-size:360px">
      <lr-app-rail label="Main" auto-hide peek-open-delay="40" peek-close-delay="60">
        <lr-app-rail-item href="#a" aria-label="Alpha"><svg slot="start" aria-hidden="true" width="16" height="16"></svg>Alpha</lr-app-rail-item>
        <lr-app-rail-item href="#b" aria-label="Beta"><svg slot="start" aria-hidden="true" width="16" height="16"></svg>Beta</lr-app-rail-item>
      </lr-app-rail>
      <main style="flex:1 1 auto"><button type="button">Content</button></main>
    </div>`);
  const el = wrapper.querySelector<LyraAppRail>('lr-app-rail')!;
  await el.updateComplete;
  return { el, main: wrapper.querySelector<HTMLElement>('main')! };
}

describe('lr-app-rail peek ownership between pointer and keyboard', () => {
  it('keeps a keyboard-opened peek while the pointer is still inside after focus leaves', async () => {
    const { el, main } = await autoHideRail();
    await focusByKeyboard(itemFocus(el));
    await waitUntil(() => el.peeking, 'keyboard focus peeks', { timeout: 2000 });
    pointer(el, 'pointerenter');
    await focusByKeyboard(main.querySelector<HTMLElement>('button')!);
    // wait-reason: negative assertion, the peek must outlast its 60ms close delay while hovered
    await aTimeout(200);
    expect(el.peeking, 'focus leaving closed a peek the pointer still holds').to.equal(true);
    pointer(el, 'pointerleave');
    await waitUntil(() => !el.peeking, 'leaving with the pointer too closes the peek', { timeout: 2000 });
  });

  it('stays open under keyboard focus when a keyboard-pinned rail is unpinned', async () => {
    const { el } = await autoHideRail();
    await focusByKeyboard(itemFocus(el));
    await waitUntil(() => el.peeking && pin(el) !== null, 'peek with pin', { timeout: 2000 });
    await focusByKeyboard(pin(el)!);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.mode).to.equal('full');
    await waitUntil(() => pin(el) !== null, 'the docked rail kept its pin control');
    await focusByKeyboard(pin(el)!);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.mode).to.equal('icon-only');
    await waitUntil(() => el.peeking, 'unpinning under keyboard focus did not keep the rail open', { timeout: 2000 });
  });
});
