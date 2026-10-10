import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { focusAfterPointer, focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import type { LyraAppRail } from './app-rail.class.js';
import './app-rail.js';
import './app-rail-item.js';

type Pointer = 'mouse' | 'touch' | 'pen';

const STORAGE_KEY = 'lr-app-rail:auto-hide-test';

let originalMatchMedia: typeof window.matchMedia;
let mobileViewport = false;

beforeEach(() => {
  mobileViewport = false;
  originalMatchMedia = window.matchMedia;
  // Desktop at every breakpoint unless a test flips `mobileViewport`: the breakpoint-derived mode
  // is `'full'`, so any icon-only presentation below comes from `auto-hide` alone.
  window.matchMedia = ((query: string) => query.includes('max-width')
    ? {
      matches: mobileViewport,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList
    : originalMatchMedia.call(window, query)) as typeof window.matchMedia;
  localStorage.removeItem(STORAGE_KEY);
});
afterEach(async () => {
  window.matchMedia = originalMatchMedia;
  localStorage.removeItem(STORAGE_KEY);
  await setReducedMotion('no-preference');
  await resetMouse();
});

const base = (el: LyraAppRail): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('[part="base"], [part="panel"]')!;
/** The focusable surface inside an item: the item host itself is not a focus target. */
const itemFocus = (el: LyraAppRail, index = 0): HTMLElement =>
  el.querySelectorAll('lr-app-rail-item')[index]!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
const pin = (el: LyraAppRail): HTMLButtonElement | null =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="pin-button"]');
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Dispatches one pointer event on the rail's own surface, the element its listeners live on. */
function pointer(el: LyraAppRail, type: string, init: PointerEventInit = {}): void {
  const bubbles = type === 'pointermove';
  base(el).dispatchEvent(new PointerEvent(type, {
    pointerType: 'mouse', isPrimary: true, bubbles, composed: bubbles, clientX: 10, clientY: 10, ...init,
  }));
}
/** A pointer entering the rail and then genuinely moving inside it. */
function hover(el: LyraAppRail, init: PointerEventInit = {}): void {
  pointer(el, 'pointerenter', init);
  pointer(el, 'pointermove', { clientX: 14, clientY: 12, movementX: 4, movementY: 2, ...init });
}

interface Layout { wrapper: HTMLElement; el: LyraAppRail; main: HTMLElement }

async function layout(dir: 'ltr' | 'rtl' = 'ltr', attrs = ''): Promise<Layout> {
  const open = attrs.includes('peek-open-delay') ? '' : 'peek-open-delay="40"';
  const close = attrs.includes('peek-close-delay') ? '' : 'peek-close-delay="60"';
  const wrapper = await fixture<HTMLElement>(`
    <div dir="${dir}" style="display:flex;inline-size:700px;block-size:360px">
      <lr-app-rail label="Main" ${open} ${close} ${attrs}>
        <lr-app-rail-item href="#a" aria-label="Alpha"><svg slot="icon" aria-hidden="true" width="16" height="16"></svg>Alpha</lr-app-rail-item>
        <lr-app-rail-item href="#b" aria-label="Beta"><svg slot="icon" aria-hidden="true" width="16" height="16"></svg>Beta</lr-app-rail-item>
      </lr-app-rail>
      <main style="flex:1 1 auto"><button type="button">Content</button></main>
    </div>`);
  const el = wrapper.querySelector<LyraAppRail>('lr-app-rail')!;
  await el.updateComplete;
  return { wrapper, el, main: wrapper.querySelector<HTMLElement>('main')! };
}
async function autoHideRail(dir: 'ltr' | 'rtl' = 'ltr', attrs = ''): Promise<Layout> {
  return layout(dir, `auto-hide ${attrs}`);
}
const peekEvents = (el: LyraAppRail): boolean[] => {
  const seen: boolean[] = [];
  el.addEventListener('lr-peek-change', (event) => seen.push((event as CustomEvent<{ peeking: boolean }>).detail.peeking));
  return seen;
};

describe('lr-app-rail auto-hide: unset behavior', () => {
  it('keeps today\'s behavior without auto-hide: no peek, no pin control, same mode', async () => {
    const { el } = await layout('ltr', 'collapsible');
    expect(el.autoHide).to.equal(false);
    expect(el.hasAttribute('auto-hide')).to.equal(false);
    expect(el.mode).to.equal('full');
    const seen = peekEvents(el);
    hover(el);
    await sleep(160);
    expect(el.peeking).to.equal(false);
    expect(el.hasAttribute('peeking')).to.equal(false);
    expect(pin(el) === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="collapse-toggle"]') !== null).to.equal(true);
    expect(seen).to.deep.equal([]);
    expect(el.mode).to.equal('full');
  });

  it('does not peek an icon-only rail that lacks auto-hide', async () => {
    const { el } = await layout('ltr', 'force-mode="icon-only"');
    hover(el);
    await sleep(160);
    expect(el.mode).to.equal('icon-only');
    expect(el.peeking).to.equal(false);
    expect(pin(el) === null).to.equal(true);
  });

  it('defaults the delays to finite values and normalizes bad input', async () => {
    const { el } = await layout();
    el.removeAttribute('peek-open-delay');
    el.removeAttribute('peek-close-delay');
    await el.updateComplete;
    expect(el.peekOpenDelay).to.be.a('number');
    expect(el.peekCloseDelay).to.be.a('number');
    expect(el.peekOpenDelay).to.be.greaterThan(0);
    expect(el.peekCloseDelay).to.be.greaterThan(0);
  });
});

describe('lr-app-rail auto-hide: resting strip', () => {
  it('rests as the icon-only strip with no pin control and reflects auto-hide', async () => {
    const { el } = await autoHideRail();
    expect(el.hasAttribute('auto-hide')).to.equal(true);
    expect(el.mode).to.equal('icon-only');
    expect(el.peeking).to.equal(false);
    expect(el.hasAttribute('peeking')).to.equal(false);
    expect(pin(el) === null).to.equal(true);
    const items = [...el.querySelectorAll('lr-app-rail-item')];
    expect(items.every((item) => item.hasAttribute('icon-only'))).to.equal(true);
  });

  it('applies auto-hide set as an attribute before the first render', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail auto-hide><lr-app-rail-item href="#a" aria-label="A">A</lr-app-rail-item></lr-app-rail>`);
    expect(el.autoHide).to.equal(true);
    expect(el.mode).to.equal('icon-only');
  });

  it('releases the strip when auto-hide is removed', async () => {
    const { el } = await autoHideRail();
    el.autoHide = false;
    await el.updateComplete;
    expect(el.mode).to.equal('full');
    expect(el.hasAttribute('auto-hide')).to.equal(false);
  });
});

describe('lr-app-rail auto-hide: pointer peek', () => {
  it('opens after the open delay, shows labels, and closes after the close delay', async () => {
    const { el } = await autoHideRail();
    const seen = peekEvents(el);
    hover(el);
    expect(el.peeking, 'not before the open delay').to.equal(false);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    await el.updateComplete;
    expect(el.hasAttribute('peeking')).to.equal(true);
    expect(el.mode, 'peeking is a presentation, not a mode change').to.equal('icon-only');
    expect([...el.querySelectorAll('lr-app-rail-item')].every((item) => !item.hasAttribute('icon-only'))).to.equal(true);
    expect(seen).to.deep.equal([true]);
    pointer(el, 'pointerleave');
    expect(el.peeking, 'still open inside the close delay').to.equal(true);
    await waitUntil(() => !el.peeking, 'peek closes', { timeout: 2000 });
    await el.updateComplete;
    expect(el.hasAttribute('peeking')).to.equal(false);
    expect([...el.querySelectorAll('lr-app-rail-item')].every((item) => item.hasAttribute('icon-only'))).to.equal(true);
    expect(seen).to.deep.equal([true, false]);
  });

  it('cancels a pending open when the pointer leaves first', async () => {
    const { el } = await autoHideRail();
    hover(el);
    pointer(el, 'pointerleave');
    await sleep(160);
    expect(el.peeking).to.equal(false);
  });

  it('cancels a pending close when the pointer returns', async () => {
    const { el } = await autoHideRail();
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    pointer(el, 'pointerleave');
    pointer(el, 'pointerenter');
    await sleep(200);
    expect(el.peeking).to.equal(true);
  });

  it('ignores touch pointers', async () => {
    const { el } = await autoHideRail();
    const seen = peekEvents(el);
    hover(el, { pointerType: 'touch' });
    await sleep(160);
    expect(el.peeking).to.equal(false);
    expect(seen).to.deep.equal([]);
  });

  it('ignores boundary events that carry no movement, then opens on real movement', async () => {
    const { el } = await autoHideRail();
    pointer(el, 'pointerover');
    pointer(el, 'pointerenter');
    pointer(el, 'pointermove', { clientX: 10, clientY: 10, movementX: 0, movementY: 0 });
    await sleep(160);
    expect(el.peeking, 'a resting cursor never peeks').to.equal(false);
    pointer(el, 'pointermove', { clientX: 18, clientY: 14, movementX: 8, movementY: 4 });
    await waitUntil(() => el.peeking, 'real movement peeks', { timeout: 2000 });
  });

  it('peeks from a real mouse moving over the strip and closes when it leaves', async () => {
    const { el } = await autoHideRail();
    const rect = el.getBoundingClientRect();
    const inside: [number, number] = [Math.round(rect.left + rect.width / 2), Math.round(rect.top + 60)];
    await sendMouse({ type: 'move', position: [inside[0] - 6, inside[1] - 6] });
    await sendMouse({ type: 'move', position: inside });
    await waitUntil(() => el.peeking, 'a real mouse opens the peek', { timeout: 3000 });
    await sendMouse({ type: 'move', position: [Math.round(rect.left + 520), inside[1]] });
    await waitUntil(() => !el.peeking, 'leaving closes the peek', { timeout: 3000 });
  });

  it('stays closed in the mobile presentation and closes when the viewport goes mobile', async () => {
    const { el } = await autoHideRail();
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    (el as unknown as { onMobileChange(event: { matches: boolean }): void }).onMobileChange({ matches: true });
    await el.updateComplete;
    expect(el.mode).to.equal('mobile');
    expect(el.peeking).to.equal(false);
    expect(el.hasAttribute('peeking')).to.equal(false);
    hover(el);
    await sleep(160);
    expect(el.peeking).to.equal(false);
  });

  it('closes the peek when auto-hide is switched off', async () => {
    const { el } = await autoHideRail();
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    el.autoHide = false;
    await el.updateComplete;
    expect(el.peeking).to.equal(false);
    expect(el.mode).to.equal('full');
  });

  it('opens promptly for a negative or invalid delay', async () => {
    const { el } = await autoHideRail('ltr', 'peek-open-delay="-50"');
    hover(el);
    await waitUntil(() => el.peeking, 'a negative delay is treated as zero', { timeout: 1000 });
    el.peekCloseDelay = Number.NaN;
    pointer(el, 'pointerleave');
    await waitUntil(() => !el.peeking, 'an invalid close delay falls back to a finite one', { timeout: 3000 });
  });
});

describe('lr-app-rail auto-hide: keyboard peek', () => {
  it('opens when keyboard focus enters the rail and closes after focus leaves', async () => {
    const { el, main } = await autoHideRail();
    const item = itemFocus(el);
    const seen = peekEvents(el);
    await focusByKeyboard(item);
    await waitUntil(() => el.peeking, 'keyboard focus peeks', { timeout: 2000 });
    expect(seen[0]).to.equal(true);
    await focusByKeyboard(main.querySelector<HTMLElement>('button')!);
    await waitUntil(() => !el.peeking, 'focusout closes the peek', { timeout: 2000 });
  });

  it('does not peek for pointer-originated focus', async () => {
    const { el } = await autoHideRail();
    await focusAfterPointer(itemFocus(el));
    await sleep(160);
    expect(el.peeking).to.equal(false);
  });

  it('closes on Escape and stays closed until focus leaves and returns', async () => {
    const { el, main } = await autoHideRail();
    const item = itemFocus(el);
    await focusByKeyboard(item);
    await waitUntil(() => el.peeking, 'keyboard focus peeks', { timeout: 2000 });
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !el.peeking, 'Escape closes the peek', { timeout: 2000 });
    await sleep(120);
    expect(el.peeking, 'focus is still inside, so nothing reopens it').to.equal(false);
    await focusByKeyboard(main.querySelector<HTMLElement>('button')!);
    await sleep(120);
    await focusByKeyboard(item);
    await waitUntil(() => el.peeking, 'returning focus peeks again', { timeout: 2000 });
  });
});

describe('lr-app-rail auto-hide: pin control', () => {
  async function peeked(attrs = ''): Promise<Layout> {
    const result = await autoHideRail('ltr', attrs);
    hover(result.el);
    await waitUntil(() => result.el.peeking, 'peek opens', { timeout: 2000 });
    await result.el.updateComplete;
    return result;
  }

  it('renders a pin button while peeking with aria-pressed false and a localized name', async () => {
    const { el } = await peeked();
    const button = pin(el)!;
    expect(button !== null, 'pin button exists while peeking').to.equal(true);
    expect(button.getAttribute('part')).to.equal('pin-button');
    expect(button.getAttribute('aria-pressed')).to.equal('false');
    expect(button.getAttribute('aria-label')).to.equal('Pin navigation');
    expect(button.getBoundingClientRect().height).to.be.at.least(24);
  });

  it('pins the rail docked at full width, without overlaying, and unpins back to the strip', async () => {
    const { el, main } = await peeked();
    const seen = peekEvents(el);
    const stripMain = main.getBoundingClientRect();
    pin(el)!.click();
    await el.updateComplete;
    expect(el.preferredMode).to.equal('full');
    expect(el.mode).to.equal('full');
    expect(el.peeking, 'a docked rail is not peeking').to.equal(false);
    expect(seen).to.deep.equal([false]);
    const pressed = pin(el)!;
    expect(pressed.getAttribute('aria-pressed')).to.equal('true');
    expect(pressed.getAttribute('aria-label')).to.equal('Unpin navigation');
    await waitUntil(() => base(el).getBoundingClientRect().width > 200, 'rail reaches the docked width', { timeout: 3000 });
    await waitUntil(() => Math.abs(el.getBoundingClientRect().width - base(el).getBoundingClientRect().width) < 1, 'docked footprint equals the rail', { timeout: 3000 });
    expect(main.getBoundingClientRect().left).to.be.greaterThan(stripMain.left + 100);
    pressed.click();
    await el.updateComplete;
    expect(el.preferredMode).to.equal('icon-only');
    expect(el.mode).to.equal('icon-only');
    expect(el.peeking, 'the pointer is still inside, so the rail stays open under it').to.equal(true);
    expect(pin(el)!.getAttribute('aria-pressed')).to.equal('false');
    pointer(el, 'pointerleave');
    await waitUntil(() => !el.peeking, 'then closes after leaving', { timeout: 2000 });
  });

  it('keeps a pinned rail pinned while the pointer comes and goes', async () => {
    const { el } = await peeked();
    pin(el)!.click();
    await el.updateComplete;
    pointer(el, 'pointerleave');
    await sleep(160);
    hover(el);
    await sleep(160);
    expect(el.mode).to.equal('full');
    expect(el.peeking).to.equal(false);
    expect(pin(el)!.getAttribute('aria-pressed')).to.equal('true');
  });

  it('persists the pin through the preferred-mode storage and restores it on reload', async () => {
    const { el } = await peeked('storage-key="auto-hide-test" persist="preferred-mode"');
    pin(el)!.click();
    await el.updateComplete;
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { preferredMode?: string };
    expect(stored.preferredMode).to.equal('full');
    el.remove();
    const reloaded = await fixture<LyraAppRail>(html`
      <lr-app-rail auto-hide storage-key="auto-hide-test" persist="preferred-mode">
        <lr-app-rail-item href="#a" aria-label="Alpha">Alpha</lr-app-rail-item>
      </lr-app-rail>`);
    await reloaded.updateComplete;
    expect(reloaded.mode).to.equal('full');
    expect(reloaded.preferredMode).to.equal('full');
    expect(pin(reloaded)!.getAttribute('aria-pressed')).to.equal('true');
    expect(reloaded.peeking).to.equal(false);
  });

  it('shows no pin control without a peek and no collapse toggle alongside it', async () => {
    const { el } = await autoHideRail('ltr', 'collapsible');
    expect(pin(el) === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="collapse-toggle"]') === null).to.equal(true);
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    await el.updateComplete;
    expect(pin(el) !== null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="collapse-toggle"]') === null).to.equal(true);
  });

  it('toggles from the keyboard', async () => {
    const { el } = await autoHideRail();
    await focusByKeyboard(itemFocus(el));
    await waitUntil(() => el.peeking && pin(el) !== null, 'peek with pin', { timeout: 2000 });
    pin(el)!.focus();
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.mode).to.equal('full');
    expect(pin(el)!.getAttribute('aria-pressed')).to.equal('true');
  });

  it('honors a strings override for both pin names', async () => {
    const el = await fixture<LyraAppRail>(html`
      <lr-app-rail auto-hide force-mode="full" .strings=${{ appRailPin: 'Épingler', appRailUnpin: 'Désépingler' }}>
        <lr-app-rail-item href="#a" aria-label="Alpha">Alpha</lr-app-rail-item>
      </lr-app-rail>`);
    expect(pin(el)!.getAttribute('aria-label')).to.equal('Désépingler');
    el.forceMode = 'auto';
    el.preferredMode = 'icon-only';
    await el.updateComplete;
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    await el.updateComplete;
    expect(pin(el)!.getAttribute('aria-label')).to.equal('Épingler');
  });
});

describe('lr-app-rail auto-hide: overlay presentation', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    it(`overlays the content without reflow in ${dir}`, async () => {
      const { el, main } = await autoHideRail(dir);
      await waitUntil(() => base(el).getBoundingClientRect().width < 100, 'strip width');
      const hostBefore = el.getBoundingClientRect();
      const mainBefore = main.getBoundingClientRect();
      hover(el);
      await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
      await waitUntil(() => base(el).getBoundingClientRect().width > 200, 'rail expands', { timeout: 3000 });
      const hostAfter = el.getBoundingClientRect();
      const mainAfter = main.getBoundingClientRect();
      expect(hostAfter.width, 'the strip keeps its footprint').to.be.closeTo(hostBefore.width, 1);
      expect(hostAfter.left).to.be.closeTo(hostBefore.left, 1);
      expect(mainAfter.left, 'content does not move').to.be.closeTo(mainBefore.left, 1);
      expect(mainAfter.width).to.be.closeTo(mainBefore.width, 1);
      const rail = base(el).getBoundingClientRect();
      expect(rail.width).to.be.greaterThan(hostAfter.width + 100);
      // The expanded rail grows toward the inline end and paints above the content there.
      const probeX = dir === 'ltr' ? hostAfter.right + 40 : hostAfter.left - 40;
      const probeY = hostAfter.top + hostAfter.height / 2;
      expect(rail.left <= probeX && probeX <= rail.right, 'probe sits in the overlaid region').to.equal(true);
      expect(document.elementFromPoint(probeX, probeY) === el).to.equal(true);
      expect(rail.left <= hostAfter.left + 1 && rail.right >= hostAfter.right - 1).to.equal(true);
      if (dir === 'ltr') expect(rail.left).to.be.closeTo(hostAfter.left, 1);
      else expect(rail.right).to.be.closeTo(hostAfter.right, 1);
      pointer(el, 'pointerleave');
      await waitUntil(() => !el.peeking, 'peek closes', { timeout: 2000 });
      await waitUntil(() => base(el).getBoundingClientRect().width < 100, 'rail collapses', { timeout: 3000 });
      expect(document.elementFromPoint(probeX, probeY) === el).to.equal(false);
      expect(main.getBoundingClientRect().left).to.be.closeTo(mainBefore.left, 1);
    });
  }

  it('hides the resizer while peeking and restores it when docked', async () => {
    const { el } = await autoHideRail('ltr', 'resizable');
    expect(el.shadowRoot!.querySelector('[part="resizer"]') === null).to.equal(true);
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resizer"]') === null).to.equal(true);
    pin(el)!.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resizer"]') !== null).to.equal(true);
  });

  it('keeps the strip footprint with a card frame', async () => {
    const { el, main } = await autoHideRail('ltr', 'frame="card"');
    await waitUntil(() => base(el).getBoundingClientRect().width < 100, 'strip width');
    const hostBefore = el.getBoundingClientRect();
    const mainBefore = main.getBoundingClientRect();
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    await waitUntil(() => base(el).getBoundingClientRect().width > 200, 'rail expands', { timeout: 3000 });
    expect(el.getBoundingClientRect().width).to.be.closeTo(hostBefore.width, 1);
    expect(main.getBoundingClientRect().left).to.be.closeTo(mainBefore.left, 1);
  });

  it('sits on a layer token below modal surfaces', async () => {
    const { el } = await autoHideRail();
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    await el.updateComplete;
    const z = Number(getComputedStyle(base(el)).zIndex);
    expect(z).to.be.greaterThan(0);
    expect(z).to.be.lessThan(1000);
  });
});

describe('lr-app-rail auto-hide: motion', () => {
  it('animates the expansion with the motion tokens and keeps the footprint steady', async () => {
    await setReducedMotion('no-preference');
    await waitUntil(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
    const { el, main } = await autoHideRail();
    expect(parseFloat(getComputedStyle(base(el)).transitionDuration)).to.be.greaterThan(0.01);
    const mainBefore = main.getBoundingClientRect().left;
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    for (let frame = 0; frame < 6; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(main.getBoundingClientRect().left, 'content stays put through the transition').to.be.closeTo(mainBefore, 1);
    }
  });

  it('stops animating under prefers-reduced-motion', async () => {
    await setReducedMotion('reduce');
    await waitUntil(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    const { el } = await autoHideRail();
    const durations = getComputedStyle(base(el)).transitionDuration.split(',').map(parseFloat);
    expect(durations.every((duration) => duration <= 0.000002)).to.equal(true);
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    const deadline = Date.now() + 2000;
    while (base(el).getBoundingClientRect().width <= 200 && Date.now() < deadline) await sleep(20);
    expect(base(el).getBoundingClientRect().width, `peeking ${el.peeking}, mode ${el.mode}, host ${el.getBoundingClientRect().width}`).to.be.greaterThan(200);
  });
});

describe('lr-app-rail auto-hide: lifecycle', () => {
  it('resets the transient peek when disconnected and stays closed on reconnect', async () => {
    const { wrapper, el } = await autoHideRail();
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    const seen = peekEvents(el);
    el.remove();
    expect(el.peeking).to.equal(false);
    expect(el.hasAttribute('peeking')).to.equal(false);
    await sleep(160);
    expect(seen, 'no timer fires after disconnect').to.deep.equal([]);
    wrapper.prepend(el);
    await el.updateComplete;
    await sleep(160);
    expect(el.peeking).to.equal(false);
    expect(el.mode).to.equal('icon-only');
  });

  it('cancels a pending open on disconnect', async () => {
    const { el } = await autoHideRail();
    hover(el);
    el.remove();
    await sleep(160);
    expect(el.peeking).to.equal(false);
  });
});

describe('lr-app-rail auto-hide: accessibility', () => {
  it('has no axe violations resting, peeking, or pinned', async () => {
    const { el } = await autoHideRail();
    await expect(el).to.be.accessible();
    hover(el);
    await waitUntil(() => el.peeking, 'peek opens', { timeout: 2000 });
    await el.updateComplete;
    await waitUntil(() => base(el).getBoundingClientRect().width > 200, 'rail expands', { timeout: 3000 });
    await expect(el).to.be.accessible();
    pin(el)!.click();
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('lr-app-rail auto-hide: pointer types', () => {
  it('treats a pen like a mouse', async () => {
    const { el } = await autoHideRail();
    hover(el, { pointerType: 'pen' as Pointer });
    await waitUntil(() => el.peeking, 'a pen hover peeks', { timeout: 2000 });
  });
});
