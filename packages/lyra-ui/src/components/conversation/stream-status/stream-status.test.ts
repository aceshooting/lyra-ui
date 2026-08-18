import { fixture as renderFixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './stream-status.js';
import '../../utility/live-region/live-region.js';
import type { LyraStreamStatus } from './stream-status.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.js';

/** Keeps populated stalled fixtures readable while exercising the public transition method. */
async function fixture(...args: Parameters<typeof renderFixture>): Promise<Element> {
  const root = await renderFixture(...args);
  const statuses = [
    ...(root.matches?.('lr-stream-status[data-start-stalled]') ? [root] : []),
    ...(root.querySelectorAll?.('lr-stream-status[data-start-stalled]') ?? []),
  ] as LyraStreamStatus[];
  for (const status of statuses) {
    status.removeAttribute('data-start-stalled');
    status.connectionState = 'streaming';
    await status.updateComplete;
    status.markStalled();
    await status.updateComplete;
  }
  return root;
}

// `@sinonjs/fake-timers` is a devDependency intended for exactly this kind of
// timer-driven component, but it's CJS-only (no ESM build, no "exports"
// field) and fails to import under @web/test-runner's browser-native ESM
// pipeline: `FakeTimers.install()` throws `ReferenceError: require is not
// defined` as soon as the module's top-level `require("@sinonjs/commons")`
// runs, since nothing in this project's web-test-runner.config.js shims CJS
// interop for it the way the hammerjs/maplibre-gl plugins do for those two
// packages. Falling back to real timers with short, generously-margined
// thresholds instead, the same way lr-toast-item's own duration/pause
// timer tests already do.

function liveRegionText(el: LyraStreamStatus): string {
  const region = el.shadowRoot!.querySelector('lr-live-region') as LyraLiveRegion;
  return region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
}

async function mountStreamingWithStallListener(
  stallThresholdMs = 40,
  strings?: LyraStreamStatus['strings'],
): Promise<{ el: LyraStreamStatus; stalled: Promise<Event> }> {
  const host = (await fixture(html`<div></div>`)) as HTMLElement;
  const el = document.createElement('lr-stream-status') as LyraStreamStatus;
  el.connectionState = 'streaming';
  el.stallThresholdMs = stallThresholdMs;
  if (strings) el.strings = strings;
  const stalled = oneEvent(el, 'lr-stall');
  host.append(el);
  return { el, stalled };
}

it('defaults to connection-state="idle" and stallThresholdMs=10000, overridable via stall-threshold-ms', async () => {
  const el = (await fixture(html`<lr-stream-status></lr-stream-status>`)) as LyraStreamStatus;
  expect(el.phase).to.equal('idle');
  expect(el.connectionState).to.equal('idle');
  expect(el.stallThresholdMs).to.equal(10000);
  expect(el.getAttribute('connection-state')).to.equal('idle');

  const withAttr = (await fixture(
    html`<lr-stream-status stall-threshold-ms="250"></lr-stream-status>`,
  )) as LyraStreamStatus;
  expect(withAttr.stallThresholdMs).to.equal(250);
});

it('normalizes invalid connection-state writes and exposes phase as getter-only', async () => {
  // A stray phase="stalled" attribute is deliberately an unrecognized attribute here (phase is
  // getter-only and dev mode warns about it via warnUnknownAttributes) -- stub console.warn
  // around fixture creation so that expected warning doesn't trip WTR_STRICT_CONSOLE.
  const originalWarn = console.warn;
  console.warn = () => {};
  let el: LyraStreamStatus;
  try {
    el = (await fixture(
      html`<lr-stream-status connection-state="unknown" phase="stalled"></lr-stream-status>`,
    )) as LyraStreamStatus;
  } finally {
    console.warn = originalWarn;
  }
  expect(el.connectionState).to.equal('idle');
  expect(el.phase, 'the removed phase attribute cannot install a stall').to.equal('idle');

  (el as unknown as { connectionState: string }).connectionState = 'paused';
  await el.updateComplete;
  expect(el.connectionState).to.equal('idle');
  expect(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'phase')?.set).to.be.undefined;
});

it('renders persistent localized text for every phase without making it a live region', async () => {
  const el = (await fixture(html`
    <lr-stream-status
      .strings=${{
        audioVisualizerIdle: 'Inactif',
        realtimeSessionConnecting: 'Connexion',
        statusRunning: 'Actif',
        streamStallAnnounce: 'Connexion bloquée.',
      }}
    ></lr-stream-status>
  `)) as LyraStreamStatus;
  const phase = () => el.shadowRoot!.querySelector('[part="phase"]') as HTMLElement;
  expect(phase().textContent).to.equal('Inactif');
  expect(phase().hasAttribute('aria-live')).to.equal(false);
  expect(phase().hasAttribute('role')).to.equal(false);

  for (const [value, text] of [
    ['connecting', 'Connexion'],
    ['streaming', 'Actif'],
  ] as const) {
    el.connectionState = value;
    await el.updateComplete;
    expect(phase().textContent).to.equal(text);
  }
  el.markStalled();
  await el.updateComplete;
  expect(phase().textContent).to.equal('Connexion bloquée.');
});

it('treats recordActivity() as a no-op while idle or connecting -- never throws, never arms a timer', async () => {
  const el = (await fixture(
    html`<lr-stream-status stall-threshold-ms="40"></lr-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));

  expect(() => el.recordActivity()).to.not.throw();
  el.connectionState = 'connecting';
  await el.updateComplete;
  expect(() => el.recordActivity()).to.not.throw();

  await aTimeout(150);
  expect(el.phase, 'idle/connecting must never self-transition to stalled').to.equal('connecting');
  expect(stalled).to.be.false;
});

it('arms the stall timer on mount when phase starts "streaming", firing lr-stall after stall-threshold-ms of silence', async () => {
  const { el, stalled } = await mountStreamingWithStallListener();
  await stalled;
  expect(el.phase).to.equal('stalled');
});

it('recordActivity() while streaming resets the stall deadline instead of just reading a counter', async () => {
  const el = (await fixture(
    html`<lr-stream-status connection-state="streaming" stall-threshold-ms="120"></lr-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));

  await aTimeout(70);
  el.recordActivity(); // pushes the 120ms deadline out from here

  await aTimeout(70); // 140ms since mount, but only 70ms since the reset -- still under threshold
  expect(el.phase, 'the reset must have pushed the deadline out, not just tracked elapsed time').to.equal(
    'streaming',
  );
  expect(stalled).to.be.false;

  await aTimeout(120); // now well past 120ms since the last recordActivity()
  expect(el.phase).to.equal('stalled');
  expect(stalled).to.be.true;
});

it('re-arms the stall timer with the new deadline the moment stallThresholdMs changes mid-stream', async () => {
  const el = (await fixture(
    html`<lr-stream-status connection-state="streaming" stall-threshold-ms="500"></lr-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));

  // Shortening the threshold well below the already-armed 500ms deadline
  // must take effect immediately -- if the already-running timer were left
  // alone (the pre-fix behavior), nothing would fire within this window.
  el.stallThresholdMs = 40;
  await el.updateComplete;

  await aTimeout(120);
  expect(
    stalled,
    'a shortened stall-threshold-ms must apply immediately, not on the next recordActivity()/phase change',
  ).to.be.true;
  expect(el.phase).to.equal('stalled');
});

it('recordActivity() recovers from stalled, firing lr-recover, and can stall again later', async () => {
  const { el, stalled } = await mountStreamingWithStallListener();
  await stalled;
  expect(el.phase).to.equal('stalled');

  const recovered = oneEvent(el, 'lr-recover');
  const stalledAgain = oneEvent(el, 'lr-stall');
  el.recordActivity();
  await recovered;
  expect(el.phase).to.equal('streaming');

  await stalledAgain;
  expect(el.phase, 'the recovered timer must have been armed fresh, not left disarmed').to.equal('stalled');
});

it('clears the stall timer when the host reassigns connectionState away from streaming', async () => {
  const el = (await fixture(
    html`<lr-stream-status connection-state="streaming" stall-threshold-ms="40"></lr-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));

  el.connectionState = 'idle';
  await el.updateComplete;

  await aTimeout(150);
  expect(stalled, 'a stale timer scheduled before the reassignment must not still fire').to.be.false;
  expect(el.phase).to.equal('idle');
});

it('fires lr-stall for an explicit markStalled() override, not just the internal timer', async () => {
  const el = (await fixture(html`<lr-stream-status connection-state="streaming"></lr-stream-status>`)) as LyraStreamStatus;
  const ev = oneEvent(el, 'lr-stall');
  el.markStalled();
  await ev;
});

it('fires lr-recover when host connectionState leaves a component-owned stall', async () => {
  const el = (await fixture(html`<lr-stream-status data-start-stalled></lr-stream-status>`)) as LyraStreamStatus;
  const ev = oneEvent(el, 'lr-recover');
  el.connectionState = 'connecting';
  await ev;
  expect(el.phase).to.equal('connecting');
  // The event still fires unconditionally, but landing on "connecting" is
  // the host abandoning the stall, not the stream recovering -- the
  // announced text must say so, not claim "restored".
  expect(liveRegionText(el)).to.equal('No longer stalled.');
});

it('announces a neutral message, never "restored", when a stall is abandoned to idle', async () => {
  const el = (await fixture(html`<lr-stream-status data-start-stalled></lr-stream-status>`)) as LyraStreamStatus;
  const ev = oneEvent(el, 'lr-recover');
  el.connectionState = 'idle';
  await ev;
  expect(el.phase).to.equal('idle');
  expect(liveRegionText(el)).to.equal('No longer stalled.');
});

it('does not fire lr-stall/lr-recover again for a no-op reassignment to the same phase', async () => {
  const el = (await fixture(html`<lr-stream-status data-start-stalled></lr-stream-status>`)) as LyraStreamStatus;
  let stallCount = 0;
  let recoverCount = 0;
  el.addEventListener('lr-stall', () => stallCount++);
  el.addEventListener('lr-recover', () => recoverCount++);

  el.markStalled();
  await el.updateComplete;

  expect(stallCount).to.equal(0);
  expect(recoverCount).to.equal(0);
});

it('never fires lr-stall nor announces when the element mounts with a preinstalled stall', async () => {
  const host = (await fixture(html`<div></div>`)) as HTMLElement;
  const el = document.createElement('lr-stream-status') as LyraStreamStatus;
  el.connectionState = 'streaming';
  el.markStalled();
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));
  host.append(el);
  await el.updateComplete;
  expect(stalled).to.be.false;
  expect(liveRegionText(el)).to.equal('');
});

it('announces entering stalled assertively and recovering politely via the internal live region', async () => {
  const { el, stalled } = await mountStreamingWithStallListener();
  const region = el.shadowRoot!.querySelector('lr-live-region') as LyraLiveRegion;

  await stalled;
  expect(liveRegionText(el)).to.equal('Connection stalled.');
  expect(region.mode).to.equal('assertive');

  const recovered = oneEvent(el, 'lr-recover');
  el.recordActivity();
  await recovered;
  expect(liveRegionText(el)).to.equal('Connection restored.');
  expect(region.mode).to.equal('polite');
});

it('never announces from recordActivity() itself while streaming -- only an actual transition announces', async () => {
  const el = (await fixture(
    html`<lr-stream-status connection-state="streaming" stall-threshold-ms="500"></lr-stream-status>`,
  )) as LyraStreamStatus;
  el.recordActivity();
  el.recordActivity();
  el.recordActivity();
  await el.updateComplete;
  expect(liveRegionText(el), 'no phase transition occurred, so nothing should have been announced').to.equal('');
});

describe('announcement/message localization', () => {
  it('localizes the stall/recover live-region announcements via this.localize()', async () => {
    const { el, stalled } = await mountStreamingWithStallListener(40, {
      streamStallAnnounce: 'Connexion interrompue.',
      streamRecoverAnnounce: 'Connexion rétablie.',
    });

    await stalled;
    expect(liveRegionText(el)).to.equal('Connexion interrompue.');

    const recovered = oneEvent(el, 'lr-recover');
    el.recordActivity();
    await recovered;
    expect(liveRegionText(el)).to.equal('Connexion rétablie.');
  });

  it('localizes the neutral "no longer stalled" announcement via this.localize() when a stall is abandoned to idle', async () => {
    const el = (await fixture(
      html`<lr-stream-status
        data-start-stalled
        .strings=${{ streamStallClearedAnnounce: 'Plus interrompu.' }}
      ></lr-stream-status>`,
    )) as LyraStreamStatus;
    const ev = oneEvent(el, 'lr-recover');
    el.connectionState = 'idle';
    await ev;
    expect(liveRegionText(el)).to.equal('Plus interrompu.');
  });

  it('localizes the default stalled message via this.localize() when .strings overrides streamStalled', async () => {
    const el = (await fixture(
      html`<lr-stream-status
        data-start-stalled
        .strings=${{ streamStalled: 'Cela prend plus de temps que d’habitude…' }}
      ></lr-stream-status>`,
    )) as LyraStreamStatus;
    const message = el.shadowRoot!.querySelector('[part="message"]') as HTMLElement;
    expect(message.textContent!.trim()).to.equal('Cela prend plus de temps que d’habitude…');
  });
});

it('renders the message part only while effectively stalled, with a built-in default', async () => {
  const el = (await fixture(html`<lr-stream-status connection-state="streaming"></lr-stream-status>`)) as LyraStreamStatus;
  expect((el.shadowRoot!.querySelector('[part="message"]')) == null).to.be.true;

  el.markStalled();
  await el.updateComplete;
  const message = el.shadowRoot!.querySelector('[part="message"]') as HTMLElement;
  expect((message) != null).to.equal(true);
  // The default message is rendered as a sibling of the <slot>, not as
  // native <slot> fallback content (see isRealMessageNode()'s doc comment
  // for why), so the rendered part's own textContent is what's actually
  // displayed -- unlike reading `slot.assignedNodes()`, which would show
  // nothing at all once fallback content is no longer how this is rendered.
  expect(message.textContent!.trim()).to.equal('Taking longer than usual…');
});

it('shows the built-in default message even when the only assigned node is whitespace-only, matching ordinary indented markup', async () => {
  // Mirrors the DefaultStalledMessage story's shape verbatim: a newline plus
  // indentation before the slotted <button> is itself a whitespace-only text
  // node assigned to the *default* slot. Native <slot> fallback content is
  // suppressed by any assigned node, whitespace or not, which previously
  // left this message area blank in exactly this common, unremarkable case.
  const el = (await fixture(html`
    <lr-stream-status data-start-stalled>
      <button slot="actions">Retry</button>
    </lr-stream-status>
  `)) as LyraStreamStatus;
  const message = el.shadowRoot!.querySelector('[part="message"]') as HTMLElement;
  expect(message.textContent!.trim()).to.equal('Taking longer than usual…');
});

it('slotted default-slot content overrides the built-in stalled message', async () => {
  const el = (await fixture(
    html`<lr-stream-status data-start-stalled>Custom stall copy</lr-stream-status>`,
  )) as LyraStreamStatus;
  const message = el.shadowRoot!.querySelector('[part="message"]') as HTMLElement;
  // `message.textContent` never reflects real assigned/distributed content
  // (that lives in the light DOM, a different tree from the shadow tree
  // `textContent` walks) -- only `assignedNodes({flatten: true})` shows what
  // the <slot> actually renders, mirroring lr-tool-call-chip's identical
  // check.
  const slot = message.querySelector('slot') as HTMLSlotElement;
  const text = slot
    .assignedNodes({ flatten: true })
    .map((n) => n.textContent)
    .join('')
    .trim();
  expect(text).to.equal('Custom stall copy');
  // The built-in default must not *also* render alongside real slotted
  // content. It would only ever show up as a literal sibling text node in
  // the shadow tree itself (rendered when hasMessageContent is false), so
  // `message.textContent` -- which does reflect that literal sibling, even
  // though it can't reflect the slot's distributed content -- must be
  // empty here.
  expect(message.textContent!.trim()).to.equal('');
});

it('treats slot="" as explicit default-slot content', async () => {
  const el = (await fixture(html`
    <lr-stream-status data-start-stalled><span slot="">Explicit default</span></lr-stream-status>
  `)) as LyraStreamStatus;
  const message = el.shadowRoot!.querySelector('[part="message"]') as HTMLElement;
  expect(message.textContent!.trim()).to.equal('');
  const slot = message.querySelector('slot') as HTMLSlotElement;
  expect(slot.assignedElements().map((item) => item.textContent).join('')).to.equal('Explicit default');
});

it('always renders the actions slot wrapper regardless of phase, hidden only while nothing is slotted', async () => {
  const el = (await fixture(html`<lr-stream-status connection-state="idle"></lr-stream-status>`)) as LyraStreamStatus;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect((actions) != null).to.equal(true);
  expect(actions.hasAttribute('hidden')).to.be.true;

  el.connectionState = 'streaming';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="actions"]'), 'the actions wrapper stays in the template').to.exist;
});

it('shows the actions slot once something is slotted, detected on first paint and via slotchange', async () => {
  const el = (await fixture(
    html`<lr-stream-status data-start-stalled><button slot="actions">Retry</button></lr-stream-status>`,
  )) as LyraStreamStatus;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions.hasAttribute('hidden')).to.be.false;

  const button = document.createElement('button');
  button.slot = 'actions';
  const other = (await fixture(html`<lr-stream-status connection-state="idle"></lr-stream-status>`)) as LyraStreamStatus;
  const otherActions = other.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  const otherSlot = other.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;
  expect(otherActions.hasAttribute('hidden')).to.be.true;

  other.appendChild(button);
  otherSlot.dispatchEvent(new Event('slotchange'));
  await other.updateComplete;
  expect(otherActions.hasAttribute('hidden')).to.be.false;
});

it('clears the stall timer on disconnect so it cannot fire on a detached element', async () => {
  const el = (await fixture(
    html`<lr-stream-status connection-state="streaming" stall-threshold-ms="40"></lr-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));

  el.remove();
  await aTimeout(150);
  expect(stalled, 'a disconnected element must not still transition to stalled').to.be.false;
});

it('does not emit or announce a phase transition applied while detached', async () => {
  const wrapper = (await fixture(html`<div><lr-stream-status connection-state="idle"></lr-stream-status></div>`)) as HTMLElement;
  const el = wrapper.querySelector('lr-stream-status') as LyraStreamStatus;
  let stalled = 0;
  el.addEventListener('lr-stall', () => stalled++);
  wrapper.removeChild(el);
  el.connectionState = 'streaming';
  el.markStalled();
  wrapper.appendChild(el);
  await el.updateComplete;
  expect(el.phase).to.equal('stalled');
  expect(stalled).to.equal(0);
  expect(liveRegionText(el)).to.equal('');

  el.recordActivity();
  await el.updateComplete;
  el.markStalled();
  await el.updateComplete;
  expect(stalled, 'a transition after reconnect must not remain suppressed').to.equal(1);
});

it('re-arms the stall timer on reconnect while still "streaming", e.g. after being moved elsewhere in the page', async () => {
  const el = (await fixture(
    html`<lr-stream-status connection-state="streaming" stall-threshold-ms="120"></lr-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));
  el.recordActivity();
  await el.updateComplete;

  // Reparenting fires disconnectedCallback (which disarms the timer) then
  // connectedCallback, with `phase` never changing -- no `updated()` cycle
  // runs to re-arm it, so only connectedCallback() itself can resume
  // detection here.
  const parent = el.parentNode!;
  parent.removeChild(el);
  parent.appendChild(el);

  await aTimeout(220);
  expect(stalled, 'reconnecting mid-stream must resume stall detection, not leave it disarmed').to.be.true;
  expect(el.phase).to.equal('stalled');
});

it('owns the stall timeout in the adopted window and rejects stale callbacks', async () => {
  const el = (await fixture(html`<lr-stream-status></lr-stream-status>`)) as LyraStreamStatus;
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
  let mainHandle = 6400;
  let frameHandle = 7400;

  window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay !== 43210) return originalMainSet.call(window, handler, delay, ...args);
    if (typeof handler !== 'function') throw new TypeError('Expected a timeout callback.');
    const handle = ++mainHandle;
    mainCallbacks.set(handle, handler as VoidFunction);
    return handle;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((handle?: number) => {
    if (handle !== undefined && mainCallbacks.has(handle)) mainCallbacks.delete(handle);
    else originalMainClear.call(window, handle);
  }) as typeof window.clearTimeout;
  frameWindow.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay !== 43210) return originalFrameSet.call(frameWindow, handler, delay, ...args);
    if (typeof handler !== 'function') throw new TypeError('Expected a timeout callback.');
    const handle = ++frameHandle;
    frameCallbacks.set(handle, handler as VoidFunction);
    return handle;
  }) as typeof frameWindow.setTimeout;
  frameWindow.clearTimeout = ((handle?: number) => {
    if (handle !== undefined && frameCallbacks.has(handle)) {
      frameCancellations.push(handle);
      frameCallbacks.delete(handle);
    } else {
      originalFrameClear.call(frameWindow, handle);
    }
  }) as typeof frameWindow.clearTimeout;

  try {
    frameDocument.adoptNode(el);
    expect(frameCallbacks.size, 'detached adoption must not arm a timeout').to.equal(0);

    frameDocument.body.append(el);
    el.connectionState = 'streaming';
    el.stallThresholdMs = 43210;
    await el.updateComplete;
    expect(mainCallbacks.size, 'the parent window must not own an iframe timeout').to.equal(0);
    expect(frameCallbacks.size).to.equal(1);
    const [oldHandle, staleTimeout] = Array.from(frameCallbacks.entries())[0]!;

    document.adoptNode(el);
    expect(frameCancellations, 'adoption clears through the retained iframe owner').to.include(oldHandle);
    expect(mainCallbacks.size, 'detached adoption must not arm the destination timeout').to.equal(0);
    staleTimeout();
    expect(el.phase, 'a stale source-realm timeout cannot stall the adopted component').to.equal('streaming');

    document.body.append(el);
    expect(mainCallbacks.size, 'reconnect re-arms in the destination window').to.equal(1);
    Array.from(mainCallbacks.values())[0]!();
    expect(el.phase).to.equal('stalled');
  } finally {
    el.remove();
    window.setTimeout = originalMainSet;
    window.clearTimeout = originalMainClear;
    frameWindow.setTimeout = originalFrameSet;
    frameWindow.clearTimeout = originalFrameClear;
    iframe.remove();
  }
});

it('does not arm a stall timer on connect while phase is not "streaming"', async () => {
  const el = (await fixture(html`<lr-stream-status stall-threshold-ms="40"></lr-stream-status>`)) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));

  const parent = el.parentNode!;
  parent.removeChild(el);
  parent.appendChild(el);

  await aTimeout(80);
  expect(stalled).to.be.false;
  expect(el.phase).to.equal('idle');
});

it('never arms a timer for a non-positive stall-threshold-ms', async () => {
  const el = (await fixture(
    html`<lr-stream-status connection-state="streaming" stall-threshold-ms="0"></lr-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));
  await aTimeout(80);
  expect(stalled).to.be.false;
  expect(el.phase).to.equal('streaming');
});

it('caps an absurdly large stall-threshold-ms at the browser timer ceiling instead of overflowing into an near-immediate stall', async () => {
  // `setTimeout` takes a 32-bit signed-int delay under the hood -- a raw value above
  // MAX_TIMEOUT_MS (2_147_483_647) overflows and gets silently coerced down to ~1ms in every
  // engine this library targets, which would fire `lr-stall` almost instantly instead of after
  // the (much longer) delay the host actually asked for. finiteDuration's cap prevents that.
  const el = (await fixture(
    html`<lr-stream-status connection-state="streaming" stall-threshold-ms="9007199254740991"></lr-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lr-stall', () => (stalled = true));
  await aTimeout(80);
  expect(stalled, 'an uncapped delay would have overflowed and fired within a few ms').to.be.false;
  expect(el.phase).to.equal('streaming');
});

it('is accessible in the default idle state', async () => {
  const el = (await fixture(html`<lr-stream-status></lr-stream-status>`)) as LyraStreamStatus;
  await expect(el).to.be.accessible();
});

it('is accessible while stalled with slotted message and actions', async () => {
  const el = (await fixture(html`
    <lr-stream-status data-start-stalled>
      Taking a while…
      <button slot="actions">Retry</button>
    </lr-stream-status>
  `)) as LyraStreamStatus;
  await expect(el).to.be.accessible();
});

describe('phase-dot cssprop escape hatches', () => {
  const indicator = (el: LyraStreamStatus): HTMLElement =>
    el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;

  const resolvedInShadow = (el: LyraStreamStatus, declaration: string, property: string): string => {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  };

  it('inherits dot color and opacity from an ancestor in a phase with its own defaults', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-stream-status-dot-color: rgb(0, 51, 102); --lr-stream-status-dot-opacity: 0.42;">
        <lr-stream-status data-start-stalled></lr-stream-status>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-stream-status') as LyraStreamStatus;
    const dot = indicator(el);

    expect(getComputedStyle(dot).backgroundColor).to.equal('rgb(0, 51, 102)');
    expect(getComputedStyle(dot).opacity).to.equal('0.42');
    await expect(el).to.be.accessible();
  });

  it('lets an element-level dot override win over an ancestor', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-stream-status-dot-color: rgb(0, 51, 102); --lr-stream-status-dot-opacity: 0.42;">
        <lr-stream-status
          data-start-stalled
          style="--lr-stream-status-dot-color: rgb(102, 0, 51); --lr-stream-status-dot-opacity: 0.73;"
        ></lr-stream-status>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-stream-status') as LyraStreamStatus;
    const dot = indicator(el);

    expect(getComputedStyle(dot).backgroundColor).to.equal('rgb(102, 0, 51)');
    expect(getComputedStyle(dot).opacity).to.equal('0.73');
  });

  it('keeps the stalled phase defaults when the public hooks are unset', async () => {
    const el = (await fixture(html`<lr-stream-status data-start-stalled></lr-stream-status>`)) as LyraStreamStatus;
    const dot = indicator(el);

    expect(getComputedStyle(dot).backgroundColor).to.equal(
      resolvedInShadow(el, 'color: var(--lr-color-warning)', 'color'),
    );
    expect(getComputedStyle(dot).opacity).to.equal('1');
  });
});

describe('stalled-row cssprop escape hatches', () => {
  const base = (el: LyraStreamStatus): HTMLElement =>
    el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const message = (el: LyraStreamStatus): HTMLElement =>
    el.shadowRoot!.querySelector('[part="message"]') as HTMLElement;

  const resolvedInShadow = (el: LyraStreamStatus, declaration: string, property: string): string => {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  };

  it('lets --lr-stream-status-stalled-bg override the base row background while stalled', async () => {
    const el = (await fixture(html`
      <lr-stream-status
        data-start-stalled
        style="--lr-stream-status-stalled-bg: rgb(0, 51, 102);"
      ></lr-stream-status>
    `)) as LyraStreamStatus;
    expect(getComputedStyle(base(el)).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('lets --lr-stream-status-stalled-border-color override the base row border while stalled', async () => {
    const el = (await fixture(html`
      <lr-stream-status
        data-start-stalled
        style="--lr-stream-status-stalled-border-color: rgb(102, 0, 51);"
      ></lr-stream-status>
    `)) as LyraStreamStatus;
    expect(getComputedStyle(base(el)).borderTopColor).to.equal('rgb(102, 0, 51)');
  });

  it('lets --lr-stream-status-message-color override the message text color while stalled, independent of the border token', async () => {
    const el = (await fixture(html`
      <lr-stream-status
        data-start-stalled
        style="--lr-stream-status-message-color: rgb(51, 0, 102);"
      ></lr-stream-status>
    `)) as LyraStreamStatus;
    expect(getComputedStyle(message(el)).color).to.equal('rgb(51, 0, 102)');
  });

  it('keeps today\'s shared-warning-token defaults for background/border/message color when the new cssprops are unset', async () => {
    const el = (await fixture(html`<lr-stream-status data-start-stalled></lr-stream-status>`)) as LyraStreamStatus;
    const warningQuiet = resolvedInShadow(el, 'color: var(--lr-color-warning-quiet)', 'color');
    const warning = resolvedInShadow(el, 'color: var(--lr-color-warning)', 'color');

    expect(getComputedStyle(base(el)).backgroundColor).to.equal(warningQuiet);
    expect(getComputedStyle(base(el)).borderTopColor).to.equal(warning);
    expect(getComputedStyle(message(el)).color).to.equal(warning);
  });
});

it('contains a long stalled message and two actions in a 320px allocation', async () => {
  const longMessage = 'ConnectionRecoveryExplanationWithoutNaturalBreaks'.repeat(4);
  const container = document.createElement('div');
  container.style.inlineSize = '320px';
  const el = (await fixture(
    html`<lr-stream-status data-start-stalled style="inline-size:100%">
      ${longMessage}
      <button slot="actions">Cancel</button>
      <button slot="actions">Retry</button>
    </lr-stream-status>`,
    { parentNode: container },
  )) as LyraStreamStatus;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const message = el.shadowRoot!.querySelector('[part="message"]') as HTMLElement;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  const retry = el.querySelector<HTMLButtonElement>('button[slot="actions"]:last-child')!;

  expect(el.getBoundingClientRect().width).to.be.at.most(321);
  expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
  expect(message.scrollWidth).to.be.at.most(message.clientWidth + 1);
  expect(actions.scrollWidth).to.be.at.most(actions.clientWidth + 1);
  expect(retry.getBoundingClientRect().right).to.be.at.most(container.getBoundingClientRect().right + 1);
});

it('uses the ambient transition token for its streaming-phase pulse animation', async () => {
  const el = (await fixture(html`<lr-stream-status connection-state="streaming"></lr-stream-status>`)) as LyraStreamStatus;
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(indicator).animationDuration).to.equal('1.8s');
});

it('does not slow down the base/border-color state transitions (only the loop uses the ambient token)', async () => {
  const el = (await fixture(html`<lr-stream-status connection-state="streaming"></lr-stream-status>`)) as LyraStreamStatus;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  // [part='base'] has two comma-separated transition entries (background-color,
  // border-color), so the computed transitionDuration list has one 0.18s per
  // entry -- neither is the 1.8s ambient token.
  expect(getComputedStyle(base).transitionDuration).to.equal('0.18s, 0.18s');
});

it('wires the LiveDemo story before its first Connect click', async () => {
  const { LiveDemo } = await import('./stream-status.stories.js');
  const root = (await fixture(LiveDemo.render!({}, null as never))) as HTMLElement;
  const status = root.querySelector('lr-stream-status') as LyraStreamStatus;
  const connect = root.querySelector<HTMLButtonElement>('[data-connect]')!;
  const stop = root.querySelector<HTMLButtonElement>('[data-stop]')!;

  try {
    connect.click();
    expect(status.phase).to.equal('connecting');
    expect(root.querySelector<HTMLElement>('[data-log]')!.textContent).to.include(
      'connectionState = "connecting"',
    );
  } finally {
    stop.click();
  }
});
