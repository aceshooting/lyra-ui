import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { fixture, expect, html, oneEvent, aTimeout, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './poll-status.js';
import '../live-region/live-region.js';
import type { LyraPollStatus } from './poll-status.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function liveRegionText(el: LyraPollStatus): string {
  const region = el.shadowRoot!.querySelector('lr-live-region') as LyraLiveRegion;
  return region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
}

expectLocaleFallback('ar-EG', ['pollPause', 'pollRefresh']);

describe('lr-poll-status', () => {
  it('ticks down the countdown display and reaches the due phase, firing lr-poll-due', async () => {
    const started = performance.now();
    const el = (await fixture(html`<lr-poll-status next-in-ms="40"></lr-poll-status>`)) as LyraPollStatus;
    await oneEvent(el, 'lr-poll-due');
    expect(performance.now() - started).to.be.lessThan(300);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');
  });

  it('keeps the existing DOM and automatic null-detail event when the refresh option is unset', async () => {
    const wrapper = await fixture(html`<div><lr-poll-status next-in-ms="100"></lr-poll-status></div>`);
    const el = wrapper.querySelector('lr-poll-status') as LyraPollStatus;
    expect(el.withRefresh).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="refresh-button"]') === null).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('button')).to.have.length(1);

    const due = await oneEvent(wrapper, 'lr-poll-due');
    expect((due as CustomEvent<null>).detail).to.equal(null);
    expect(due.bubbles).to.be.true;
    expect(due.composed).to.be.true;
  });

  it('requests manual refresh with a localized keyboard action and restarts just one automatic deadline', async () => {
    const wrapper = await fixture(html`
      <div>
        <lr-poll-status
          with-refresh
          next-in-ms="900"
          .strings=${{ pollRefresh: 'Actualiser maintenant' }}
        ></lr-poll-status>
      </div>
    `);
    const el = wrapper.querySelector('lr-poll-status') as LyraPollStatus;
    const button = el.shadowRoot!.querySelector('[part="refresh-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Actualiser maintenant');
    expect(button.querySelector('svg') !== null).to.equal(true);
    expect(parseFloat(getComputedStyle(button).minInlineSize)).to.be.greaterThan(0);
    expect(button.getBoundingClientRect().width).to.be.at.least(
      parseFloat(getComputedStyle(button).minInlineSize),
    );
    await expect(el).to.be.accessible();

    await focusByKeyboard(button);
    expect(button.matches(':focus-visible')).to.be.true;
    const events: CustomEvent<{ readonly manual: true } | null>[] = [];
    wrapper.addEventListener('lr-poll-due', (event) =>
      events.push(event as CustomEvent<{ readonly manual: true } | null>),
    );
    await sendKeys({ press: 'Enter' });
    expect(events).to.have.length(1);
    expect(events[0]!.detail).to.deep.equal({ manual: true });
    expect(Object.isFrozen(events[0]!.detail)).to.be.true;
    expect(events[0]!.bubbles).to.be.true;
    expect(events[0]!.composed).to.be.true;

    // wait-reason: real timer semantics, time must pass before the restart so the deadline is provably measured from the click
    await aTimeout(200);
    const restartedAt = performance.now();
    button.click();
    expect(events).to.have.length(2);
    expect(events[1]!.detail).to.deep.equal({ manual: true });
    await waitUntil(
      () => events.length >= 3,
      'the restarted automatic deadline fires',
      { timeout: 2200 },
    );
    expect(events[2]!.detail).to.equal(null);
    expect(performance.now() - restartedAt).to.be.greaterThan(800);
    // wait-reason: negative assertion, no extra automatic event may follow the restarted deadline
    await aTimeout(100);
    expect(events).to.have.length(3);
  });

  it('arms the restarted timer before synchronous manual-event listeners run', async () => {
    const el = (await fixture(html`<lr-poll-status with-refresh next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="refresh-button"]') as HTMLButtonElement;
    const originalSetTimeout = window.setTimeout;
    const scheduledHandles: number[] = [];
    window.setTimeout = ((...args: Parameters<typeof window.setTimeout>) => {
      const handle = Reflect.apply(originalSetTimeout, window, args) as number;
      scheduledHandles.push(handle);
      return handle;
    }) as typeof window.setTimeout;
    let timersVisibleToListener = -1;
    el.addEventListener('lr-poll-due', (event) => {
      if ((event as CustomEvent<{ manual?: boolean } | null>).detail?.manual) {
        timersVisibleToListener = scheduledHandles.length;
      }
    });

    try {
      button.click();
      expect(timersVisibleToListener).to.equal(1);
    } finally {
      window.setTimeout = originalSetTimeout;
      el.remove();
    }
  });

  it('emits the manual signal before the automatic event for a restarted zero delay', async () => {
    const el = (await fixture(
      html`<lr-poll-status with-refresh next-in-ms="0" paused></lr-poll-status>`,
    )) as LyraPollStatus;
    const button = el.shadowRoot!.querySelector('[part="refresh-button"]') as HTMLButtonElement;
    const details: Array<{ manual: true } | null> = [];
    el.addEventListener('lr-poll-due', (event) => {
      details.push((event as CustomEvent<{ manual: true } | null>).detail);
    });

    el.paused = false;
    button.click();
    expect(details).to.deep.equal([{ manual: true }]);
    await waitUntil(
      () => details.length === 2,
      'one zero-delay automatic event follows the manual event',
    );
    expect(details[1]).to.equal(null);
    // wait-reason: negative assertion, no second zero-delay automatic event may follow
    await aTimeout(40);
    expect(details).to.have.length(2);
  });

  it('allows manual refresh while paused without resuming or arming an automatic tick', async () => {
    const el = (await fixture(html`<lr-poll-status with-refresh next-in-ms="25" paused></lr-poll-status>`)) as LyraPollStatus;
    const button = el.shadowRoot!.querySelector('[part="refresh-button"]') as HTMLButtonElement;
    let dueCount = 0;
    let detail: unknown;
    el.addEventListener('lr-poll-due', (event) => {
      dueCount++;
      detail = (event as CustomEvent).detail;
    });

    button.click();
    expect(detail).to.deep.equal({ manual: true });
    expect(el.paused).to.be.true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('Paused');
    // wait-reason: negative assertion, a manual refresh while paused must not arm an automatic tick (25ms deadline)
    await aTimeout(100);
    expect(dueCount).to.equal(1);
  });

  it('disables manual refresh while inactive and does not emit', async () => {
    const el = (await fixture(
      html`<lr-poll-status with-refresh next-in-ms="25" active="false"></lr-poll-status>`,
    )) as LyraPollStatus;
    const button = el.shadowRoot!.querySelector('[part="refresh-button"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
    expect(button.getAttribute('aria-label')).to.equal('Refresh now');
    let dueCount = 0;
    el.addEventListener('lr-poll-due', () => dueCount++);
    button.click();
    // wait-reason: negative assertion, a disabled refresh button must not emit (25ms deadline)
    await aTimeout(100);
    expect(dueCount).to.equal(0);
  });

  it('emits a manual refresh with no configured countdown but never arms a timer', async () => {
    const el = (await fixture(html`<lr-poll-status with-refresh></lr-poll-status>`)) as LyraPollStatus;
    const button = el.shadowRoot!.querySelector('[part="refresh-button"]') as HTMLButtonElement;
    let dueCount = 0;
    let detail: unknown;
    el.addEventListener('lr-poll-due', (event) => {
      dueCount++;
      detail = (event as CustomEvent).detail;
    });

    button.click();
    expect(detail).to.deep.equal({ manual: true });
    // wait-reason: negative assertion, no timer may arm without a configured delay; outlives one 1000ms tick interval
    await aTimeout(1150);
    expect(dueCount).to.equal(1);
  });

  it('fits both controls and a long inactive label inside 320px in LTR and RTL', async () => {
    for (const direction of ['ltr', 'rtl'] as const) {
      const wrapper = await fixture(html`
        <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
          <lr-poll-status
            with-refresh
            .active=${false}
            .strings=${{ pollInactive: 'Hintergrundaktualisierungsverfügbarkeitsüberprüfung' }}
          ></lr-poll-status>
        </div>
      `);
      const container = wrapper as HTMLDivElement;
      const el = container.querySelector('lr-poll-status') as LyraPollStatus;
      expect(el.getBoundingClientRect().width).to.be.at.most(container.clientWidth);
      expect(el.shadowRoot!.querySelector('[part="refresh-button"]')).to.exist;
      const refreshButton = el.shadowRoot!.querySelector('[part="refresh-button"]') as HTMLButtonElement;
      expect(refreshButton.disabled).to.be.true;
      expect(el.shadowRoot!.querySelector('[part="pause-button"]')).to.exist;
    }
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
    // wait-reason: negative assertion, toggling active must not re-arm a fired deadline; outlives one 1000ms tick interval
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
    await waitUntil(() => liveRegionText(el).includes('Paused'), 'paused announcement flushed', { timeout: 3000 });
    expect(liveRegionText(el)).to.include('Paused');
  });

  it('does not tick or fire lr-poll-due while paused', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="40" paused></lr-poll-status>`)) as LyraPollStatus;
    let fired = false;
    el.addEventListener('lr-poll-due', () => (fired = true));
    // wait-reason: negative assertion, a paused poll must not tick past its 40ms deadline
    await aTimeout(150);
    expect(fired).to.be.false;
  });

  it('freezes remaining time across repeated programmatic pause/resume transitions', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="120"></lr-poll-status>`)) as LyraPollStatus;
    let dueCount = 0;
    el.addEventListener('lr-poll-due', () => {
      dueCount += 1;
    });
    // wait-reason: real timer semantics, elapsed time before pausing must be frozen out of the remaining 120ms
    await aTimeout(30);
    el.paused = true;
    await el.updateComplete;
    // wait-reason: negative assertion, a paused poll must not fire past the 120ms deadline
    await aTimeout(160);
    expect(dueCount).to.equal(0);

    el.paused = false;
    await el.updateComplete;
    // wait-reason: real timer semantics, elapsed running time between pauses must be frozen out of the remaining delay
    await aTimeout(25);
    el.paused = true;
    await el.updateComplete;
    // wait-reason: negative assertion, a re-paused poll must not fire past the remaining delay
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
    // wait-reason: real timer semantics, a paused poll must outlive its 90ms deadline before restart()
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
    // wait-reason: negative assertion, no countdown was started; outlives one 1000ms tick interval
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
    // wait-reason: negative assertion, a cleared deadline must not fire (40ms original deadline)
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
    // wait-reason: negative assertion, an inactive poll must not fire past its 40ms deadline
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

  it('uses an hour field for countdowns longer than an hour', async () => {
    const el = (await fixture(
      html`<lr-poll-status lang="en-US" next-in-ms="3661000"></lr-poll-status>`,
    )) as LyraPollStatus;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('1:01:01');
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
    // wait-reason: Outlive the 40 ms deadline to catch a tick from the false attribute.
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
    // wait-reason: negative assertion, a removed element must not fire past its 40ms deadline
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
      <lr-poll-status data-lr-theme-scope
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

  it('keeps pause-button hover overrides scoped while refresh follows shared brand tokens', async () => {
    const el = await fixture<LyraPollStatus>(html`
      <lr-poll-status data-lr-theme-scope
        with-refresh
        style="
          --lr-color-brand-quiet: rgb(1, 2, 3);
          --lr-color-brand: rgb(4, 5, 6);
          --lr-poll-status-pause-hover-bg: rgb(7, 8, 9);
          --lr-poll-status-pause-hover-color: rgb(10, 11, 12);
          --lr-poll-status-pause-active-bg: rgb(13, 14, 15);
          --lr-poll-status-pause-active-color: rgb(16, 17, 18);
        "
      ></lr-poll-status>
    `);
    const button = el.shadowRoot!.querySelector<HTMLElement>('[part="pause-button"]')!;
    try {
      await hoverUntilMatched(button, 'poll-status pause-button never registered :hover');
      await waitUntil(() => {
        const computed = getComputedStyle(button);
        return computed.backgroundColor === 'rgb(7, 8, 9)' && computed.color === 'rgb(10, 11, 12)';
      }, 'the dedicated pause-button hover hooks never painted over the shared brand tokens');
      await sendMouse({ type: 'down' });
      await waitUntil(() => {
        const computed = getComputedStyle(button);
        return computed.backgroundColor === 'rgb(13, 14, 15)' && computed.color === 'rgb(16, 17, 18)';
      }, 'the dedicated pause-button active hooks never painted over the shared brand tokens');
      await sendMouse({ type: 'up' });
      await resetMouse();
      const refreshButton = el.shadowRoot!.querySelector<HTMLElement>('[part="refresh-button"]')!;
      await hoverUntilMatched(refreshButton, 'poll-status refresh-button never registered :hover');
      await waitUntil(() => {
        const computed = getComputedStyle(refreshButton);
        return computed.backgroundColor === 'rgb(1, 2, 3)' && computed.color === 'rgb(4, 5, 6)';
      }, 'pause-button hover tokens leaked into the independent refresh-button surface');
    } finally {
      await sendMouse({ type: 'up' });
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

describe('poll-status timer and adoption hardening', () => {
  it('re-arms the ticker when adoptedCallback runs while still connected (manual invocation)', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    expect((el as unknown as { tickTimer?: number }).tickTimer).to.not.equal(undefined);
    (el as unknown as { adoptedCallback(): void }).adoptedCallback();
    expect(
      (el as unknown as { tickTimer?: number }).tickTimer,
      're-arming after a still-connected adoptedCallback schedules a fresh timer',
    ).to.not.equal(undefined);
  });

  it('restart() clears pending countdown state when next-in-ms is unset instead of restarting a phantom cycle', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.nextInMs = undefined;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-poll-due', () => (fired = true));
    el.restart();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('');
    // wait-reason: negative assertion, restart() with no configured delay must not arm a ticker
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(fired, 'restart() with no configured delay must not arm a ticker').to.be.false;
  });

  it('re-schedules the next tick instead of finishing immediately when more than one display second remains', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="1500"></lr-poll-status>`)) as LyraPollStatus;
    const countdown = el.shadowRoot!.querySelector('[part="countdown"]') as HTMLElement;
    const due = oneEvent(el, 'lr-poll-due');
    await waitUntil(
      () => countdown.textContent === '0:01',
      'the countdown must tick down to the last second before reaching due',
      { timeout: 2000 },
    );
    await due;
  });

  it('names the pause toggle by its action alone, with no pressed state', async () => {
    const el = (await fixture(html`<lr-poll-status next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    const button = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
    expect(button.hasAttribute('aria-pressed')).to.equal(false);
    el.paused = true;
    await el.updateComplete;
    expect(button.hasAttribute('aria-pressed')).to.equal(false);
    expect(button.getAttribute('aria-label')).to.equal('Resume');
  });

  it('draws its refresh glyph inline instead of registering lr-icon', async () => {
    expect(customElements.get('lr-icon') === undefined).to.equal(true);
    const el = (await fixture(html`<lr-poll-status with-refresh next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    const refresh = el.shadowRoot!.querySelector('[part="refresh-button"]')!;
    expect(refresh.querySelector('lr-icon') === null).to.equal(true);
    expect(refresh.querySelector('svg[aria-hidden="true"]') !== null).to.equal(true);
  });

  it('sizes its icon buttons from the component font, not the UA control font', async () => {
    const el = (await fixture(html`<lr-poll-status with-refresh next-in-ms="10000"></lr-poll-status>`)) as LyraPollStatus;
    const countdown = el.shadowRoot!.querySelector('[part="countdown"]') as HTMLElement;
    for (const part of ['pause-button', 'refresh-button']) {
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      expect(getComputedStyle(button).fontSize).to.equal(getComputedStyle(countdown).fontSize);
    }
  });
});
