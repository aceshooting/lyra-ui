import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './stream-status.js';
import '../live-region/live-region.js';
import type { LyraStreamStatus } from './stream-status.js';
import type { LyraLiveRegion } from '../live-region/live-region.js';

// `@sinonjs/fake-timers` is a devDependency intended for exactly this kind of
// timer-driven component, but it's CJS-only (no ESM build, no "exports"
// field) and fails to import under @web/test-runner's browser-native ESM
// pipeline: `FakeTimers.install()` throws `ReferenceError: require is not
// defined` as soon as the module's top-level `require("@sinonjs/commons")`
// runs, since nothing in this project's web-test-runner.config.js shims CJS
// interop for it the way the hammerjs/maplibre-gl plugins do for those two
// packages. Falling back to real timers with short, generously-margined
// thresholds instead, the same way lyra-toast-item's own duration/pause
// timer tests already do.

function liveRegionText(el: LyraStreamStatus): string {
  const region = el.shadowRoot!.querySelector('lyra-live-region') as LyraLiveRegion;
  return region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
}

it('defaults to phase="idle" and stallThresholdMs=10000, overridable via stall-threshold-ms', async () => {
  const el = (await fixture(html`<lyra-stream-status></lyra-stream-status>`)) as LyraStreamStatus;
  expect(el.phase).to.equal('idle');
  expect(el.stallThresholdMs).to.equal(10000);
  expect(el.getAttribute('phase')).to.equal('idle');

  const withAttr = (await fixture(
    html`<lyra-stream-status stall-threshold-ms="250"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  expect(withAttr.stallThresholdMs).to.equal(250);
});

it('treats recordActivity() as a no-op while idle or connecting -- never throws, never arms a timer', async () => {
  const el = (await fixture(
    html`<lyra-stream-status stall-threshold-ms="40"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lyra-stall', () => (stalled = true));

  expect(() => el.recordActivity()).to.not.throw();
  el.phase = 'connecting';
  await el.updateComplete;
  expect(() => el.recordActivity()).to.not.throw();

  await aTimeout(150);
  expect(el.phase, 'idle/connecting must never self-transition to stalled').to.equal('connecting');
  expect(stalled).to.be.false;
});

it('arms the stall timer on mount when phase starts "streaming", firing lyra-stall after stall-threshold-ms of silence', async () => {
  const el = (await fixture(
    html`<lyra-stream-status phase="streaming" stall-threshold-ms="40"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  await oneEvent(el, 'lyra-stall');
  expect(el.phase).to.equal('stalled');
});

it('recordActivity() while streaming resets the stall deadline instead of just reading a counter', async () => {
  const el = (await fixture(
    html`<lyra-stream-status phase="streaming" stall-threshold-ms="120"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lyra-stall', () => (stalled = true));

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

it('recordActivity() recovers from stalled, firing lyra-recover, and can stall again later', async () => {
  const el = (await fixture(
    html`<lyra-stream-status phase="streaming" stall-threshold-ms="40"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  await oneEvent(el, 'lyra-stall');
  expect(el.phase).to.equal('stalled');

  const recovered = oneEvent(el, 'lyra-recover');
  el.recordActivity();
  await recovered;
  expect(el.phase).to.equal('streaming');

  await oneEvent(el, 'lyra-stall');
  expect(el.phase, 'the recovered timer must have been armed fresh, not left disarmed').to.equal('stalled');
});

it('clears the stall timer when the host directly reassigns phase away from "streaming"', async () => {
  const el = (await fixture(
    html`<lyra-stream-status phase="streaming" stall-threshold-ms="40"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lyra-stall', () => (stalled = true));

  el.phase = 'idle';
  await el.updateComplete;

  await aTimeout(150);
  expect(stalled, 'a stale timer scheduled before the reassignment must not still fire').to.be.false;
  expect(el.phase).to.equal('idle');
});

it('fires lyra-stall for a direct host assignment to phase="stalled", not just the internal timer', async () => {
  const el = (await fixture(html`<lyra-stream-status phase="streaming"></lyra-stream-status>`)) as LyraStreamStatus;
  const ev = oneEvent(el, 'lyra-stall');
  el.phase = 'stalled';
  await ev;
});

it('fires lyra-recover for any direct assignment out of "stalled", even to a phase other than "streaming"', async () => {
  const el = (await fixture(html`<lyra-stream-status phase="stalled"></lyra-stream-status>`)) as LyraStreamStatus;
  const ev = oneEvent(el, 'lyra-recover');
  el.phase = 'connecting';
  await ev;
  expect(el.phase).to.equal('connecting');
});

it('does not fire lyra-stall/lyra-recover again for a no-op reassignment to the same phase', async () => {
  const el = (await fixture(html`<lyra-stream-status phase="stalled"></lyra-stream-status>`)) as LyraStreamStatus;
  let stallCount = 0;
  let recoverCount = 0;
  el.addEventListener('lyra-stall', () => stallCount++);
  el.addEventListener('lyra-recover', () => recoverCount++);

  el.phase = 'stalled';
  await el.updateComplete;

  expect(stallCount).to.equal(0);
  expect(recoverCount).to.equal(0);
});

it('never fires lyra-stall nor announces for the phase the element mounts with, even "stalled"', async () => {
  const el = (await fixture(html`<lyra-stream-status phase="stalled"></lyra-stream-status>`)) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lyra-stall', () => (stalled = true));
  await el.updateComplete;
  expect(stalled).to.be.false;
  expect(liveRegionText(el)).to.equal('');
});

it('announces entering stalled assertively and recovering politely via the internal live region', async () => {
  const el = (await fixture(
    html`<lyra-stream-status phase="streaming" stall-threshold-ms="40"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  const region = el.shadowRoot!.querySelector('lyra-live-region') as LyraLiveRegion;

  await oneEvent(el, 'lyra-stall');
  expect(liveRegionText(el)).to.equal('Connection stalled.');
  expect(region.mode).to.equal('assertive');

  const recovered = oneEvent(el, 'lyra-recover');
  el.recordActivity();
  await recovered;
  expect(liveRegionText(el)).to.equal('Connection restored.');
  expect(region.mode).to.equal('polite');
});

it('never announces from recordActivity() itself while streaming -- only an actual transition announces', async () => {
  const el = (await fixture(
    html`<lyra-stream-status phase="streaming" stall-threshold-ms="500"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  el.recordActivity();
  el.recordActivity();
  el.recordActivity();
  await el.updateComplete;
  expect(liveRegionText(el), 'no phase transition occurred, so nothing should have been announced').to.equal('');
});

it('renders the message part (default slot) only while phase="stalled", with a built-in default when nothing is slotted', async () => {
  const el = (await fixture(html`<lyra-stream-status phase="streaming"></lyra-stream-status>`)) as LyraStreamStatus;
  expect(el.shadowRoot!.querySelector('[part="message"]')).to.not.exist;

  el.phase = 'stalled';
  await el.updateComplete;
  const message = el.shadowRoot!.querySelector('[part="message"]') as HTMLElement;
  expect(message).to.exist;
  const slot = message.querySelector('slot') as HTMLSlotElement;
  // `slot.textContent` would only ever show the fallback children Lit put
  // inside the <slot> element itself, regardless of real assignment -- per
  // the platform's own slot semantics that's not the same as what's actually
  // displayed, so this reads the flattened *assigned* (here: fallback,
  // since nothing real is slotted) nodes instead, mirroring
  // lyra-tool-call-chip's identical `assignedNodes({flatten: true})` check.
  const text = slot
    .assignedNodes({ flatten: true })
    .map((n) => n.textContent)
    .join('')
    .trim();
  expect(text).to.equal('Taking longer than usual…');
});

it('slotted default-slot content overrides the built-in stalled message', async () => {
  const el = (await fixture(
    html`<lyra-stream-status phase="stalled">Custom stall copy</lyra-stream-status>`,
  )) as LyraStreamStatus;
  const slot = el.shadowRoot!.querySelector('[part="message"] slot') as HTMLSlotElement;
  const text = slot
    .assignedNodes({ flatten: true })
    .map((n) => n.textContent)
    .join('')
    .trim();
  expect(text).to.equal('Custom stall copy');
});

it('always renders the actions slot wrapper regardless of phase, hidden only while nothing is slotted', async () => {
  const el = (await fixture(html`<lyra-stream-status phase="idle"></lyra-stream-status>`)) as LyraStreamStatus;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions).to.exist;
  expect(actions.hasAttribute('hidden')).to.be.true;

  el.phase = 'streaming';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="actions"]'), 'the actions wrapper stays in the template').to.exist;
});

it('shows the actions slot once something is slotted, detected on first paint and via slotchange', async () => {
  const el = (await fixture(
    html`<lyra-stream-status phase="stalled"><button slot="actions">Retry</button></lyra-stream-status>`,
  )) as LyraStreamStatus;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions.hasAttribute('hidden')).to.be.false;

  const button = document.createElement('button');
  button.slot = 'actions';
  const other = (await fixture(html`<lyra-stream-status phase="idle"></lyra-stream-status>`)) as LyraStreamStatus;
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
    html`<lyra-stream-status phase="streaming" stall-threshold-ms="40"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lyra-stall', () => (stalled = true));

  el.remove();
  await aTimeout(150);
  expect(stalled, 'a disconnected element must not still transition to stalled').to.be.false;
});

it('never arms a timer for a non-positive stall-threshold-ms', async () => {
  const el = (await fixture(
    html`<lyra-stream-status phase="streaming" stall-threshold-ms="0"></lyra-stream-status>`,
  )) as LyraStreamStatus;
  let stalled = false;
  el.addEventListener('lyra-stall', () => (stalled = true));
  await aTimeout(80);
  expect(stalled).to.be.false;
  expect(el.phase).to.equal('streaming');
});

it('is accessible in the default idle state', async () => {
  const el = (await fixture(html`<lyra-stream-status></lyra-stream-status>`)) as LyraStreamStatus;
  await expect(el).to.be.accessible();
});

it('is accessible while stalled with slotted message and actions', async () => {
  const el = (await fixture(html`
    <lyra-stream-status phase="stalled">
      Taking a while…
      <button slot="actions">Retry</button>
    </lyra-stream-status>
  `)) as LyraStreamStatus;
  await expect(el).to.be.accessible();
});
