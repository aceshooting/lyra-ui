import { fixture, expect, html, oneEvent, aTimeout, waitUntil } from '@open-wc/testing';
import './poll-status.js';
import '../live-region/live-region.js';
import type { LyraPollStatus } from './poll-status.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function liveRegionText(el: LyraPollStatus): string {
  const region = el.shadowRoot!.querySelector('lr-live-region') as LyraLiveRegion;
  return region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
}

describe('lr-poll-status', () => {
  it('ticks down the countdown display and reaches the due phase, firing lr-poll-due', async () => {
    const started = performance.now();
    const el = (await fixture(html`<lr-poll-status next-in-ms="40"></lr-poll-status>`)) as LyraPollStatus;
    await oneEvent(el, 'lr-poll-due');
    expect(performance.now() - started).to.be.lessThan(300);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');
  });

  it('shows 0:00 for a due-immediately cycle until its scheduled due tick advances the phase', async () => {
    const el = document.createElement('lr-poll-status') as LyraPollStatus;
    el.nextInMs = 0;
    const due = oneEvent(el, 'lr-poll-due');
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('0:00');
      await due;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');
    } finally {
      el.remove();
    }
  });

  it('exposes restart() for deliberately restarting the same configured delay', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="20"></lr-poll-status>`)) as LyraPollStatus;
    await oneEvent(el, 'lr-poll-due');
    const nextDue = oneEvent(el, 'lr-poll-due');
    el.restart();
    await nextDue;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');
  });

  it('never replays a consumed deadline when active toggles off and on', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="20"></lr-poll-status>`)) as LyraPollStatus;
    let dueCount = 0;
    el.addEventListener('lr-poll-due', () => dueCount++);
    await oneEvent(el, 'lr-poll-due');
    expect(dueCount).to.equal(1);

    el.active = false;
    await el.updateComplete;
    el.active = true;
    await el.updateComplete;
    await aTimeout(1150);
    expect(dueCount).to.equal(1);
  });

  it('pauses on the built-in pause button, suppressing lr-poll-due, and announces the transition', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    const pauseButton = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
    setTimeout(() => pauseButton.click());
    const event = await oneEvent(el, 'lr-pause-change');
    expect(event.detail).to.deep.equal({ paused: true });
    expect(Object.isFrozen(event.detail)).to.equal(true);
    expect(el.paused).to.be.true;
    await aTimeout(50);
    expect(liveRegionText(el)).to.include('Paused');
  });

  it('does not tick or fire lr-poll-due while paused', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="40" paused></lr-poll-status>`)) as LyraPollStatus;
    let fired = false;
    el.addEventListener('lr-poll-due', () => (fired = true));
    await aTimeout(150);
    expect(fired).to.be.false;
  });

  it('freezes remaining time across repeated programmatic pause/resume transitions', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="120"></lr-poll-status>`)) as LyraPollStatus;
    let dueCount = 0;
    el.addEventListener('lr-poll-due', () => {
      dueCount += 1;
    });
    await aTimeout(30);
    el.paused = true;
    await el.updateComplete;
    await aTimeout(160);
    expect(dueCount).to.equal(0);

    el.paused = false;
    await el.updateComplete;
    await aTimeout(25);
    el.paused = true;
    await el.updateComplete;
    await aTimeout(120);
    expect(dueCount).to.equal(0);

    const due = oneEvent(el, 'lr-poll-due');
    const resumedAt = performance.now();
    el.paused = false;
    await el.updateComplete;
    await due;
    const elapsed = performance.now() - resumedAt;
    expect(elapsed).to.be.greaterThan(15);
    expect(elapsed).to.be.lessThan(250);
    expect(dueCount).to.equal(1);
  });

  it('restart while paused replaces the frozen remainder with the configured full delay', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="90" paused></lr-poll-status>`)) as LyraPollStatus;
    await aTimeout(120);
    el.restart();
    const due = oneEvent(el, 'lr-poll-due');
    const resumedAt = performance.now();
    el.paused = false;
    await el.updateComplete;
    await due;
    expect(performance.now() - resumedAt).to.be.greaterThan(40);
  });

  it('never announces "Resumed." on a bare mount, even though paused defaults to false', async () => {
    // Regression test: Lit's ReactiveElement records every declared reactive property as changed
    // during construction, so a bare updated()'s changed.has('paused') is true on the very first
    // update too -- without an isMounting guard, this fires the "resumed" announcement for a
    // component that was never actually paused/resumed by anything a user did.
    const el = (await fixture(html`<lr-poll-status next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    expect(liveRegionText(el)).to.equal('');
  });

  it('never arms the ticker (and never fires a spurious lr-poll-due) when mounted with no next-in-ms scheduled', async () => {
    // Regression test: connectedCallback() used to unconditionally arm the
    // ticker whenever active && !paused -- true by default -- even though
    // targetAt is still its 0 default when next-in-ms was never set. The
    // very first tick then saw targetAt - Date.now() <= 0 and immediately
    // fired lr-poll-due for a countdown that never actually ran.
    const el = (await fixture(html`<lr-poll-status></lr-poll-status>`)) as LyraPollStatus;
    let fired = false;
    el.addEventListener('lr-poll-due', () => (fired = true));
    await aTimeout(1150); // outlives one full tick interval (1000ms)
    expect(fired, 'no countdown was ever started, so due can never legitimately be reached').to.be.false;
    expect(el.shadowRoot!.querySelector('[part="indicator"]')!.hasAttribute('data-due')).to.be.false;
  });

  it('clamps a NaN/negative next-in-ms to a due-immediately countdown instead of permanently bricking the ticker', async () => {
    // Regression test: `Date.now() + NaN` poisons `targetAt` with NaN, and every subsequent tick's
    // `Math.max(0, targetAt - Date.now())` also evaluates to NaN (Math.max never recovers from a
    // NaN operand) -- `remainingMs` never becomes exactly `0`, so `lr-poll-due` never fires and
    // the ticker runs forever in the background.
    const nan = (await fixture(html`<lr-poll-status next-in-ms="NaN"></lr-poll-status>`)) as LyraPollStatus;
    await oneEvent(nan, 'lr-poll-due');
    await nan.updateComplete;
    expect(nan.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');

    const negative = (await fixture(html`<lr-poll-status next-in-ms="-500"></lr-poll-status>`)) as LyraPollStatus;
    await oneEvent(negative, 'lr-poll-due');
    await negative.updateComplete;
    expect(negative.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');
  });

  it('disarms the ticker when next-in-ms is cleared, instead of leaving a stale deadline running', async () => {
    // Regression test: updated() only reacted to nextInMs becoming non-null;
    // clearing it left the ticker armed for the previous deadline still
    // running in the background, eventually firing a stale lr-poll-due
    // (and flipping the indicator's data-due) even though [part='countdown']
    // already renders nothing once next-in-ms is unset.
    const el = (await fixture(html`<lr-poll-status next-in-ms="40"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.nextInMs = undefined;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('');

    let fired = false;
    el.addEventListener('lr-poll-due', () => (fired = true));
    await aTimeout(150);
    expect(fired, 'clearing next-in-ms should stop the ticker armed for the previous deadline').to.be.false;
    expect(el.shadowRoot!.querySelector('[part="indicator"]')!.hasAttribute('data-due')).to.be.false;
  });

  it('freezes the countdown and suppresses lr-poll-due while active is set to false', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="40"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.active = false;
    await el.updateComplete;

    let fired = false;
    el.addEventListener('lr-poll-due', () => (fired = true));
    await aTimeout(150); // outlives the original 40ms deadline
    expect(fired, 'no tick should run while inactive, so due can never be reached').to.be.false;
  });

  it('renders a localized inactive state and disables the pause action while active is false', async () => {
    const el = (await fixture(
      html`<lr-poll-status
        next-in-ms="10000"
        active="false"
        .strings=${{ pollInactive: 'Inactive locale' }}
      ></lr-poll-status>`,
    )) as LyraPollStatus;
    const button = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('Inactive locale');
    expect(button.disabled).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="indicator"]')!.hasAttribute('data-due')).to.be.false;

    let changed = false;
    el.addEventListener('lr-pause-change', () => (changed = true));
    button.click();
    expect(el.paused).to.be.false;
    expect(changed).to.be.false;
  });

  it('renders the localized inactive state even when no next countdown is scheduled', async () => {
    const el = (await fixture(
      html`<lr-poll-status active="false" .strings=${{ pollInactive: 'Inactive without deadline' }}></lr-poll-status>`,
    )) as LyraPollStatus;
    expect(el.nextInMs).to.equal(undefined);
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('Inactive without deadline');
  });

  it('uses the effective locale for every digit in the countdown', async () => {
    const el = (await fixture(
      html`<lr-poll-status lang="ar-EG" next-in-ms="65000"></lr-poll-status>`,
    )) as LyraPollStatus;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('١:٠٥');
  });

  it('accepts active="false" as a plain-HTML attribute string, not just a JS property binding', async () => {
    // Regression test: `active`'s default Boolean converter can never distinguish a plain
    // active="false" attribute from the attribute being absent altogether, so the countdown kept
    // ticking and lr-poll-due kept firing for any consumer using markup instead of `el.active = false`.
    const el = (await fixture(
      html`<lr-poll-status next-in-ms="40" active="false"></lr-poll-status>`,
    )) as LyraPollStatus;
    expect(el.active).to.be.false;
    await el.updateComplete;

    let fired = false;
    el.addEventListener('lr-poll-due', () => (fired = true));
    await aTimeout(150); // outlives the 40ms deadline
    expect(fired, 'active="false" as a plain attribute should suppress the ticker just like the JS property').to.be
      .false;
  });

  it('resumes ticking toward the existing deadline once active is toggled back to true', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="60"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.active = false;
    await el.updateComplete;
    el.active = true;
    await el.updateComplete;

    await oneEvent(el, 'lr-poll-due');
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');
  });

  it('clears the running deadline timer on disconnect, so a removed element never fires a late lr-poll-due', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="40"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-poll-due', () => (fired = true));
    el.remove();
    await aTimeout(150);
    expect(fired, 'disarmTicker() should have run in disconnectedCallback').to.be.false;
  });

  it('owns countdown deadline timers in the adopted window and rejects stale ticks', async () => {
    const el = (await fixture(html`<lr-poll-status></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.remove();
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalMainSet = window.setTimeout;
    const originalMainClear = window.clearTimeout;
    const originalFrameSet = frameWindow.setTimeout;
    const originalFrameClear = frameWindow.clearTimeout;
    const mainCallbacks = new Map<number, VoidFunction>();
    const frameCallbacks = new Map<number, VoidFunction>();
    const frameCancellations: number[] = [];
    let mainHandle = 6500;
    let frameHandle = 7500;

    window.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler !== 'function') throw new TypeError('Expected a timer callback.');
      const handle = ++mainHandle;
      mainCallbacks.set(handle, handler as VoidFunction);
      return handle;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) mainCallbacks.delete(handle);
    }) as typeof window.clearTimeout;
    frameWindow.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler !== 'function') throw new TypeError('Expected a timer callback.');
      const handle = ++frameHandle;
      frameCallbacks.set(handle, handler as VoidFunction);
      return handle;
    }) as typeof frameWindow.setTimeout;
    frameWindow.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) {
        frameCancellations.push(handle);
        frameCallbacks.delete(handle);
      }
    }) as typeof frameWindow.clearTimeout;

    try {
      let dueCount = 0;
      el.addEventListener('lr-poll-due', () => dueCount++);
      frameDocument.adoptNode(el);
      expect(frameCallbacks.size, 'detached adoption must not arm a ticker').to.equal(0);

      frameDocument.body.append(el);
      el.nextInMs = 0;
      await el.updateComplete;
      expect(mainCallbacks.size, 'the parent window must not own an iframe ticker').to.equal(0);
      expect(frameCallbacks.size).to.equal(1);
      const [oldHandle, staleTick] = Array.from(frameCallbacks.entries())[0]!;

      document.adoptNode(el);
      expect(frameCancellations, 'adoption clears through the retained iframe owner').to.include(oldHandle);
      expect(mainCallbacks.size, 'detached adoption must not arm the destination ticker').to.equal(0);
      staleTick();
      expect(dueCount, 'a stale source-realm tick cannot consume the deadline').to.equal(0);

      document.body.append(el);
      expect(mainCallbacks.size, 'reconnect re-arms in the destination window').to.equal(1);
      Array.from(mainCallbacks.values())[0]!();
      expect(dueCount).to.equal(1);
    } finally {
      el.remove();
      window.setTimeout = originalMainSet;
      window.clearTimeout = originalMainClear;
      frameWindow.setTimeout = originalFrameSet;
      frameWindow.clearTimeout = originalFrameClear;
      iframe.remove();
    }
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    await expect(el).to.be.accessible();
  });

  it('defaults to English "Pause"/"Resume" aria-labels when no strings override is set', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    const pauseButton = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
    expect(pauseButton.getAttribute('aria-label')).to.equal('Pause');
    el.paused = true;
    await el.updateComplete;
    expect(pauseButton.getAttribute('aria-label')).to.equal('Resume');
  });

  it('localizes the pause-button aria-label via this.localize()', async () => {
    const el = (await fixture(
      html`<lr-poll-status
        next-in-ms="10000"
        .strings=${{ pollPause: 'Interrompre', pollResume: 'Reprendre' }}
      ></lr-poll-status>`,
    )) as LyraPollStatus;
    await el.updateComplete;
    const pauseButton = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
    expect(pauseButton.getAttribute('aria-label')).to.equal('Interrompre');
    el.paused = true;
    await el.updateComplete;
    expect(pauseButton.getAttribute('aria-label')).to.equal('Reprendre');
  });

  it('localizes the due-state countdown text via this.localize()', async () => {
    const el = (await fixture(
      html`<lr-poll-status next-in-ms="40" .strings=${{ pollRefreshing: 'Actualisation…' }}></lr-poll-status>`,
    )) as LyraPollStatus;
    await oneEvent(el, 'lr-poll-due');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('Actualisation…');
  });

  it('localizes the pause/resume live-region announcements via this.localize()', async () => {
    const el = (await fixture(
      html`<lr-poll-status
        next-in-ms="10000"
        .strings=${{
          pollPausedAnnounce: 'Interrompu.',
          pollResumedAnnounce: 'Repris.',
        }}
      ></lr-poll-status>`,
    )) as LyraPollStatus;
    await el.updateComplete;
    el.paused = true;
    await el.updateComplete;
    expect(liveRegionText(el)).to.equal('Interrompu.');
    el.paused = false;
    await el.updateComplete;
    expect(liveRegionText(el)).to.equal('Repris.');
  });

  it('localizes the due live-region announcement via this.localize()', async () => {
    const el = (await fixture(
      html`<lr-poll-status
        next-in-ms="40"
        .strings=${{ pollRefreshingAnnounce: 'Actualisation en cours.' }}
      ></lr-poll-status>`,
    )) as LyraPollStatus;
    await oneEvent(el, 'lr-poll-due');
    await el.updateComplete;
    expect(liveRegionText(el)).to.equal('Actualisation en cours.');
  });

  it('shows a distinct "Paused" countdown text instead of a frozen value while paused', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.paused = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('Paused');
  });

  it('localizes the paused countdown text via this.localize()', async () => {
    const el = (await fixture(
      html`<lr-poll-status next-in-ms="10000" .strings=${{ pollPaused: 'En pause' }}></lr-poll-status>`,
    )) as LyraPollStatus;
    await el.updateComplete;
    el.paused = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('En pause');
  });

  it('uses the ambient transition token for its looping pulse animation', async () => {
    const el = (await fixture(html`<lr-poll-status></lr-poll-status>`)) as LyraPollStatus;
    const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
    expect(getComputedStyle(indicator).animationDuration).to.equal('1.8s');
  });

  it('paints the enabled pause-button hover treatment under a real pointer', async () => {
    const el = await fixture<LyraPollStatus>(html`
      <lr-poll-status
        style="--lr-color-brand-quiet: rgb(1, 2, 3); --lr-color-brand: rgb(4, 5, 6)"
      ></lr-poll-status>
    `);
    const button = el.shadowRoot!.querySelector<HTMLElement>('[part="pause-button"]')!;
    button.scrollIntoView({ block: 'center' });
    const rect = button.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      await waitUntil(() => {
        const computed = getComputedStyle(button);
        return computed.backgroundColor === 'rgb(1, 2, 3)' && computed.color === 'rgb(4, 5, 6)';
      }, 'the poll-status pause-button hover treatment never painted');
    } finally {
      await resetMouse();
    }
  });

  it('recolors the due indicator dot from an ancestor --lr-poll-status-due-bg, not the bare shared --lr-color-success token', async () => {
    // This was the only test in the file using next-in-ms="10" -- every sibling test uses 40ms
    // or more. armTicker() arms its real setTimeout the moment the element connects (inside
    // fixture()'s own promise, before this line ever runs), so a delay that tight raced
    // fixture()'s own async setup: once the browser's custom-element/stylesheet caches warm up
    // partway through the file, fixture() started resolving in ~14-17ms -- *after* the 10ms
    // ticker had already fired and set `due` -- so the oneEvent() listener attached below missed
    // an event that had already dispatched and hung until mocha's own timeout. Matching the
    // rest of the file's delay (comfortably above fixture()'s own overhead) removes the race
    // rather than papering over it with a longer wait or a retry loop.
    const wrapper = (await fixture(
      html`<div style="--lr-poll-status-due-bg: rgb(0, 51, 102);">
        <lr-poll-status next-in-ms="40"></lr-poll-status>
      </div>`,
    )) as HTMLDivElement;
    const el = wrapper.querySelector('lr-poll-status') as LyraPollStatus;
    await oneEvent(el, 'lr-poll-due');
    await el.updateComplete;
    const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
    expect(getComputedStyle(indicator).backgroundColor).to.equal('rgb(0, 51, 102)');
  });
});
