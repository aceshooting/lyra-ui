import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './app-rail.js';
import { computeAppRailMode, type LyraAppRail, type AppRailModeChangeDetail, type AppRailToggleDetail } from './app-rail.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

// Deterministic matchMedia stand-in -- avoids depending on the real test
// browser's viewport width (which @web/test-runner gives no control over)
// for every test below. Both queries start unmatched (mode resolves to
// 'full'); tests that need a specific mode either force it via the `mode`
// property or invoke the component's own private matchMedia listener
// directly with a fabricated event -- see computeAppRailMode's doc for why
// the breakpoint-response logic is a separately-testable pure function.
let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

it('inherits independent toggle and resizer hover/pressed paint from an ancestor', async () => {
  const mobileWrapper = await fixture<HTMLElement>(html`
    <div style="
      --lr-app-rail-toggle-hover-bg: rgb(1, 2, 3);
      --lr-app-rail-toggle-hover-color: rgb(4, 5, 6);
      --lr-app-rail-toggle-active-bg: rgb(7, 8, 9);
      --lr-app-rail-toggle-active-color: rgb(10, 11, 12);
    ">
      <lr-app-rail mode="mobile"></lr-app-rail>
    </div>
  `);
  const mobile = mobileWrapper.querySelector('lr-app-rail') as LyraAppRail;
  const toggle = mobile.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!;
  toggle.scrollIntoView();
  let rect = toggle.getBoundingClientRect();
  try {
    await sendMouse({ type: 'move', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    expect(getComputedStyle(toggle).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(toggle).color).to.equal('rgb(4, 5, 6)');
    await sendMouse({ type: 'down' });
    expect(getComputedStyle(toggle).backgroundColor).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(toggle).color).to.equal('rgb(10, 11, 12)');
  } finally {
    await resetMouse();
  }
  mobileWrapper.remove();

  const fullWrapper = await fixture<HTMLElement>(html`
    <div style="
      --lr-transition-fast: 0ms;
      --lr-app-rail-resizer-hover-bg: rgb(13, 14, 15);
      --lr-app-rail-resizer-active-bg: rgb(16, 17, 18);
    ">
      <lr-app-rail
        mode="full"
        resizable
        style="inline-size: var(--lr-app-rail-width); block-size: var(--lr-size-10rem);"
      ></lr-app-rail>
    </div>
  `);
  const full = fullWrapper.querySelector('lr-app-rail') as LyraAppRail;
  full.style.setProperty('--lr-transition-fast', '0ms');
  const resizer = full.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
  const track = full.shadowRoot!.querySelector<HTMLElement>('[part="resizer-track"]')!;
  resizer.scrollIntoView();
  rect = resizer.getBoundingClientRect();
  try {
    await sendMouse({ type: 'move', position: [Math.round(rect.left + 10), Math.round(rect.top + rect.height / 2)] });
    expect(getComputedStyle(track).backgroundColor).to.equal('rgb(13, 14, 15)');
    await sendMouse({ type: 'down' });
    expect(getComputedStyle(track).backgroundColor).to.equal('rgb(16, 17, 18)');
  } finally {
    await resetMouse();
  }
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

type PrivateMediaListener = (e: { matches: boolean }) => void;
function fireIconOnlyChange(el: LyraAppRail, matches: boolean): void {
  (el as unknown as { onIconOnlyChange: PrivateMediaListener }).onIconOnlyChange({ matches });
}
function fireMobileChange(el: LyraAppRail, matches: boolean): void {
  (el as unknown as { onMobileChange: PrivateMediaListener }).onMobileChange({ matches });
}

// -- computeAppRailMode (pure) -----------------------------------------

it('computeAppRailMode resolves full when neither breakpoint matches', () => {
  expect(computeAppRailMode(false, false)).to.equal('full');
});

it('computeAppRailMode resolves icon-only when only the icon-only breakpoint matches', () => {
  expect(computeAppRailMode(true, false)).to.equal('icon-only');
});

it('computeAppRailMode resolves mobile when the mobile breakpoint matches', () => {
  expect(computeAppRailMode(false, true)).to.equal('mobile');
});

it('computeAppRailMode prefers mobile when both breakpoints match at once', () => {
  expect(computeAppRailMode(true, true)).to.equal('mobile');
});

// -- default state / reflection -----------------------------------------

it('defaults to full mode, reflected as an attribute, with the overlay closed', async () => {
  const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  expect(el.mode).to.equal('full');
  expect(el.getAttribute('mode')).to.equal('full');
  expect(el.open).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('part')).to.equal('base');
});

it('uses the label prop as the nav landmark accessible name', async () => {
  const el = (await fixture(html`<lr-app-rail label="Main"><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  expect(el.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('aria-label')).to.equal('Main');
});

it('hides app-rail-item labels visually in icon-only mode while retaining their accessible names', async () => {
  const el = (await fixture(html`
    <lr-app-rail mode="icon-only">
      <lr-app-rail-item href="/inbox" aria-label="Inbox">
        <span slot="icon" aria-hidden="true">📥</span>Inbox with a long localized label
      </lr-app-rail-item>
    </lr-app-rail>
  `)) as LyraAppRail;
  const item = el.querySelector('lr-app-rail-item')! as HTMLElement & { updateComplete: Promise<unknown> };
  await item.updateComplete;

  expect(item.hasAttribute('icon-only')).to.be.true;
  const label = item.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(getComputedStyle(label).position).to.equal('absolute');
  expect(item.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Inbox');

  el.mode = 'full';
  await el.updateComplete;
  await item.updateComplete;
  expect(item.hasAttribute('icon-only')).to.be.false;
  expect(getComputedStyle(label).position).to.not.equal('absolute');
});

it('releases parent-owned icon-only state when an item leaves the rail', async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-app-rail mode="icon-only">
        <lr-app-rail-item>Inbox</lr-app-rail-item>
      </lr-app-rail>
      <div id="outside"></div>
    </div>
  `)) as HTMLElement;
  const rail = wrapper.querySelector('lr-app-rail') as LyraAppRail;
  const item = wrapper.querySelector('lr-app-rail-item') as HTMLElement;
  expect(item.hasAttribute('icon-only')).to.be.true;

  wrapper.querySelector('#outside')!.append(item);
  await new Promise<void>((resolve) => setTimeout(resolve));
  await rail.updateComplete;

  expect(item.hasAttribute('icon-only')).to.be.false;
});

it('manages destination-realm app-rail items structurally after adoption', async () => {
  const rail = (await fixture(html`<lr-app-rail mode="icon-only"></lr-app-rail>`)) as LyraAppRail;
  rail.remove();
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  if (!frameDocument) throw new Error('The iframe document was unavailable.');

  try {
    frameDocument.adoptNode(rail);
    frameDocument.body.append(rail);
    await rail.updateComplete;
    const slot = rail.shadowRoot!.querySelector<HTMLSlotElement>('[part="nav"] > slot')!;
    const item = frameDocument.createElement('lr-app-rail-item');
    item.textContent = 'Destination item';
    const assigned = oneEvent(slot, 'slotchange');
    rail.append(item);
    await assigned;
    await rail.updateComplete;

    expect(item.hasAttribute('icon-only')).to.be.true;

    const released = oneEvent(slot, 'slotchange');
    frameDocument.body.append(item);
    await released;
    await rail.updateComplete;
    expect(item.hasAttribute('icon-only')).to.be.false;
    item.remove();
  } finally {
    rail.remove();
    frame.remove();
  }
});

// -- breakpoint-driven mode wiring ---------------------------------------

it('resolves the correct mode on the first rendered frame, before any matchMedia change event', async () => {
  // Regression guard mirroring split.test.ts's first-paint collapse-state test: `mode` is derived
  // from `matchMedia().matches` synchronously in connectedCallback -> setupMediaQueries (there is
  // no ResizeObserver on this element), so the VERY FIRST render must already land on the correct
  // mode -- not 'full' first and the real mode only after a change event/second frame. The stub's
  // add/removeEventListener are no-ops, so the only path to a non-'full' mode here is that initial
  // synchronous `.matches` read; pre-matching every `max-width` query makes both breakpoints match,
  // and computeAppRailMode(true, true) resolves to 'mobile'.
  const savedMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  try {
    const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
    // Assert on the very first update -- no second `await el.updateComplete` and no manual
    // matchMedia change-event dispatch between fixture creation and this assertion.
    expect(el.mode).to.equal('mobile');
    expect(el.getAttribute('mode'), 'first frame, not a second frame').to.equal('mobile');
  } finally {
    window.matchMedia = savedMatchMedia;
  }
});

it('switches to icon-only and emits lr-mode-change when the icon-only query starts matching', async () => {
  const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  const promise = oneEvent(el, 'lr-mode-change');
  fireIconOnlyChange(el, true);
  const ev = await promise;

  expect(el.mode).to.equal('icon-only');
  expect((ev.detail as AppRailModeChangeDetail).mode).to.equal('icon-only');
  await el.updateComplete;
  // `mode`'s custom accessor is registered via `static properties` with
  // `noAccessor: true` rather than `@property()` -- confirms Lit's generic
  // reflect-on-update step still fires off the manual `requestUpdate('mode',
  // old)` call in setEffectiveMode, not just for the attribute a consumer
  // set before upgrade.
  expect(el.getAttribute('mode')).to.equal('icon-only');
});

it('switches to mobile when the mobile query matches, overriding a matching icon-only query', async () => {
  const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  fireIconOnlyChange(el, true);
  await el.updateComplete;
  fireMobileChange(el, true);
  await el.updateComplete;

  expect(el.mode).to.equal('mobile');
});

it('does not emit lr-mode-change for a redundant reassignment to the current mode', async () => {
  const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  let count = 0;
  el.addEventListener('lr-mode-change', () => count++);

  el.mode = 'full';
  await el.updateComplete;

  expect(count).to.equal(0);
});

it('detaches the old MediaQueryList listener and attaches a new one when icon-only-breakpoint changes', async () => {
  const created: Array<{ query: string; addCalls: number; removeCalls: number }> = [];
  window.matchMedia = ((query: string) => {
    const entry = { query, addCalls: 0, removeCalls: 0 };
    created.push(entry);
    return {
      matches: false,
      media: query,
      addEventListener: () => entry.addCalls++,
      removeEventListener: () => entry.removeCalls++,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  // One MediaQueryList per breakpoint on initial connect.
  expect(created.length).to.equal(2);
  expect(created[0]!.addCalls).to.equal(1);

  el.iconOnlyBreakpoint = '1200px';
  await el.updateComplete;

  // Both old lists are torn down together (teardownMediaQueries has no
  // per-query granularity) and two fresh ones created for the new pair.
  expect(created.length).to.equal(4);
  expect(created[0]!.removeCalls).to.equal(1);
  expect(created[1]!.removeCalls).to.equal(1);
  expect(created[2]!.query).to.equal('(max-width: 1200px)');
});

it('does not arm breakpoint listeners for updates while detached and uses the latest values on reconnect', async () => {
  const created: Array<{ query: string; addCalls: number; removeCalls: number }> = [];
  window.matchMedia = ((query: string) => {
    const entry = { query, addCalls: 0, removeCalls: 0 };
    created.push(entry);
    return {
      matches: false,
      media: query,
      addEventListener: () => entry.addCalls++,
      removeEventListener: () => entry.removeCalls++,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  const el = (await fixture(html`<lr-app-rail></lr-app-rail>`)) as LyraAppRail;
  expect(created.length).to.equal(2);
  el.remove();
  expect(created[0]!.removeCalls).to.equal(1);
  expect(created[1]!.removeCalls).to.equal(1);

  el.iconOnlyBreakpoint = '777px';
  el.mobileBreakpoint = '333px';
  await el.updateComplete;
  expect(created.length, 'a detached update must not bind ambient listeners').to.equal(2);

  document.body.append(el);
  await el.updateComplete;
  expect(created.map(({ query }) => query)).to.deep.equal([
    '(max-width: 960px)',
    '(max-width: 600px)',
    '(max-width: 777px)',
    '(max-width: 333px)',
  ]);
  expect(created[2]!.addCalls).to.equal(1);
  expect(created[3]!.addCalls).to.equal(1);
  el.remove();
});

it('ignores a queued old-owner media-query callback after adoption while current callbacks still apply', async () => {
  type MediaRecord = {
    query: string;
    listeners: Set<(event: MediaQueryListEvent) => void>;
  };
  const install = (owner: Window): { records: MediaRecord[]; restore(): void } => {
    const original = owner.matchMedia;
    const records: MediaRecord[] = [];
    owner.matchMedia = ((query: string) => {
      const record: MediaRecord = { query, listeners: new Set() };
      records.push(record);
      return {
        matches: false,
        media: query,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
          record.listeners.add(listener),
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
          record.listeners.delete(listener),
      } as unknown as MediaQueryList;
    }) as typeof owner.matchMedia;
    return {
      records,
      restore(): void {
        owner.matchMedia = original;
      },
    };
  };

  const ambient = install(window);
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) throw new Error('The iframe realm was unavailable.');
  const destination = install(frameWindow);
  let el: LyraAppRail | undefined;

  try {
    el = (await fixture(html`<lr-app-rail></lr-app-rail>`)) as LyraAppRail;
    const stale = [...ambient.records[0]!.listeners][0]!;
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;
    expect(ambient.records[0]!.listeners.size).to.equal(0);
    expect(destination.records.length).to.equal(2);

    stale({ matches: true, media: ambient.records[0]!.query } as MediaQueryListEvent);
    await el.updateComplete;
    expect(el.mode, 'a queued callback from the old owner must be inert').to.equal('full');

    const current = [...destination.records[0]!.listeners][0]!;
    current({ matches: true, media: destination.records[0]!.query } as MediaQueryListEvent);
    await el.updateComplete;
    expect(el.mode).to.equal('icon-only');
  } finally {
    el?.remove();
    destination.restore();
    ambient.restore();
    frame.remove();
  }
});

// -- forcing / auto sentinel ----------------------------------------------

it('forcing mode stops it from responding to further matchMedia changes', async () => {
  const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  el.mode = 'full';
  await el.updateComplete;

  fireMobileChange(el, true);
  await el.updateComplete;

  expect(el.mode).to.equal('full');
});

it('assigning "auto" releases a forced mode and re-syncs to the live breakpoint state', async () => {
  const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  fireMobileChange(el, true);
  await el.updateComplete;
  expect(el.mode).to.equal('mobile');

  el.mode = 'full'; // force full despite the live mobile match
  await el.updateComplete;
  expect(el.mode).to.equal('full');

  el.mode = 'auto';
  await el.updateComplete;
  expect(el.mode).to.equal('mobile'); // resumes tracking, immediately re-reads the still-matching query
});

it('ignores an invalid mode assignment', async () => {
  const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  (el as unknown as { mode: string }).mode = 'bogus';
  await el.updateComplete;
  expect(el.mode).to.equal('full');
});

it('force-closes an open overlay and emits lr-toggle when mode leaves mobile, ignoring preventDefault', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  el.open = true;
  await el.updateComplete;
  // Unlike a user-initiated close, leaving 'mobile' while open is a forced consistency fix-up
  // (documented: "closes the overlay as a side effect... rather than leaving a now-invisible
  // overlay primed to reappear") -- it must not be vetoable, or `open` could get stuck `true`
  // while `mode` is no longer `'mobile'`, where `open` is documented as meaningless.
  el.addEventListener('lr-toggle', (e) => e.preventDefault());

  const promise = oneEvent(el, 'lr-toggle');
  el.mode = 'full';
  const ev = await promise;

  expect(el.open).to.be.false;
  expect((ev.detail as AppRailToggleDetail).open).to.be.false;
  expect(ev.cancelable, 'a forced mode-change close cannot be vetoed').to.be.false;
});

// -- mobile overlay: toggle button ----------------------------------------

it('the toggle button opens and closes the overlay, updating aria-expanded/aria-label', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(toggle.getAttribute('aria-expanded')).to.equal('false');
  expect(toggle.getAttribute('aria-label')).to.equal('Open navigation');

  toggle.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  expect(toggle.getAttribute('aria-label')).to.equal('Close navigation');

  toggle.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('keeps the close toggle above the open mobile panel', async () => {
  // Renders both parts and reads their real, resolved z-index rather than regexing the
  // stylesheet's source text -- a regression that broke the actual stacking (e.g. the panel
  // ending up above the toggle) would go undetected by a source-text-only check.
  const el = (await fixture(
    html`<lr-app-rail mode="mobile" open><a href="/a">A</a></lr-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  const toggleZ = Number(getComputedStyle(toggle).zIndex);
  const panelZ = Number(getComputedStyle(panel).zIndex);
  expect(Number.isNaN(toggleZ), 'toggle must resolve to a real numeric z-index').to.be.false;
  expect(Number.isNaN(panelZ), 'panel must resolve to a real numeric z-index').to.be.false;
  expect(toggleZ).to.be.greaterThan(panelZ);
});

it('toggling emits lr-toggle with the new open state', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;

  const promise = oneEvent(el, 'lr-toggle');
  toggle.click();
  const ev = await promise;

  expect((ev.detail as AppRailToggleDetail).open).to.be.true;
});

it('fires lr-toggle as cancelable and keeps the overlay open when a host calls preventDefault()', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  el.addEventListener('lr-toggle', (e) => e.preventDefault());

  const listener = oneEvent(el, 'lr-toggle');
  toggle.click();
  const ev = await listener;

  expect(ev.cancelable).to.be.true;
  expect(el.open).to.be.false;
});

it('setting open directly does not emit lr-toggle (mirrors lr-dialog open/close split)', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
  let fired = false;
  el.addEventListener('lr-toggle', () => (fired = true));

  el.open = true;
  await el.updateComplete;

  expect(fired).to.be.false;
});

// -- RTL mobile panel offset ------------------------------------------------

it('flips the mobile panel\'s offscreen transform under dir="rtl", mirroring the LTR closed-state transform', async () => {
  const ltrEl = (await fixture(
    html`<lr-app-rail mode="mobile"><button>a</button></lr-app-rail>`,
  )) as LyraAppRail;
  await ltrEl.updateComplete;
  const ltrPanel = ltrEl.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  const ltrTransform = getComputedStyle(ltrPanel).transform;

  // dir="rtl" is set on the fixture markup itself (not mutated after
  // connection) so the RTL computed style is this element's very first
  // style resolution -- mutating it post-connect would instead trigger the
  // real transition on `transform` declared alongside these rules, making
  // an immediate getComputedStyle() read a mid-transition value rather than
  // the final one.
  const rtlEl = (await fixture(
    html`<lr-app-rail mode="mobile" dir="rtl"><button>a</button></lr-app-rail>`,
  )) as LyraAppRail;
  await rtlEl.updateComplete;
  const rtlPanel = rtlEl.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  const rtlTransform = getComputedStyle(rtlPanel).transform;

  expect(rtlPanel.matches(':dir(rtl)')).to.be.true;
  expect(rtlTransform).to.not.equal(ltrTransform);

  // Both resolve to a 2D matrix() whose tx component (m41) is the only
  // difference -- LTR slides fully offscreen to the left (negative), RTL's
  // :host(:dir(rtl)) override mirrors that to the right (positive), by the
  // exact same magnitude since only the sign of the translateX flips.
  const ltrTx = new DOMMatrixReadOnly(ltrTransform).m41;
  const rtlTx = new DOMMatrixReadOnly(rtlTransform).m41;
  expect(ltrTx).to.be.lessThan(0);
  expect(rtlTx).to.be.greaterThan(0);
  expect(rtlTx).to.equal(-ltrTx);
});

// -- mobile overlay: dismissal paths ---------------------------------------

it('closes on backdrop click', async () => {
  const el = (await fixture(
    html`<lr-app-rail mode="mobile" open><a href="/a">A</a></lr-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('closes on Escape while open, ignores Escape while closed', async () => {
  const el = (await fixture(
    html`<lr-app-rail mode="mobile" open><a href="/a">A</a></lr-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;
  expect(el.open).to.be.false;

  let fired = false;
  el.addEventListener('lr-toggle', () => (fired = true));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;
  expect(fired).to.be.false;
});

it('closes when a nav item is clicked while open, but not while closed', async () => {
  const el = (await fixture(
    html`<lr-app-rail mode="mobile"><button>Item</button></lr-app-rail>`,
  )) as LyraAppRail;
  const item = el.querySelector('button') as HTMLButtonElement;

  item.click();
  await el.updateComplete;
  expect(el.open).to.be.false; // no-op while already closed

  el.open = true;
  await el.updateComplete;
  item.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('does not close on a click inside the header or footer slot while open', async () => {
  const el = (await fixture(
    html`<lr-app-rail mode="mobile" open>
      <span slot="header"><button>header-btn</button></span>
      <button>nav-btn</button>
      <span slot="footer"><button>footer-btn</button></span>
    </lr-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  (el.querySelector('[slot="header"] button') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.open).to.be.true;
});

// -- focus trap -------------------------------------------------------------

it('moves focus to the first focusable nav item when the overlay opens', async () => {
  const el = (await fixture(
    html`<lr-app-rail mode="mobile"><button>first</button><button>second</button></lr-app-rail>`,
  )) as LyraAppRail;
  const first = el.querySelector('button') as HTMLButtonElement;

  el.open = true;
  await el.updateComplete;

  expect((document.activeElement) === (first)).to.equal(true);
});

it('focuses the panel itself as a fallback when there is nothing focusable', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><p>no controls</p></lr-app-rail>`)) as LyraAppRail;
  el.open = true;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  const active = el.shadowRoot!.activeElement as HTMLElement | null;
  // Compared by id, not `.to.equal(panel)` -- a live-DOM-node equality failure would carry two
  // Elements into @web/test-runner-mocha's session-finished message, which structuredClone can't
  // serialize, silently hanging the whole file until the per-file watchdog kills it.
  expect((active) !== (null), 'the panel must be the focused element').to.equal(true);
  expect(active!.id).to.equal(panel.id);
  expect(active!.getAttribute('part')).to.equal('panel');
});

it('traps Tab focus across header, nav, and footer slots, wrapping last->first and first->last', async () => {
  const el = (await fixture(
    html`<lr-app-rail mode="mobile" open>
      <span slot="header"><button>header-btn</button></span>
      <button>nav-btn</button>
      <span slot="footer"><button>footer-btn</button></span>
    </lr-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  const first = el.querySelector('[slot="header"] button') as HTMLButtonElement;
  const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;

  last.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  expect(tabForward.defaultPrevented).to.be.true;
  expect((document.activeElement) === (first)).to.equal(true);

  const tabBackward = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(tabBackward);
  expect(tabBackward.defaultPrevented).to.be.true;
  expect((document.activeElement) === (last)).to.equal(true);
});

it('returns focus to the toggle button after closing', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><button>a</button></lr-app-rail>`)) as LyraAppRail;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;

  toggle.click();
  await el.updateComplete;
  toggle.click();
  await el.updateComplete;

  // The toggle button lives in this element's own shadow root (unlike the
  // slotted light-DOM nav items focused elsewhere in this file) -- focusing
  // it makes `document.activeElement` resolve to the *host*, not the button
  // itself, so the check has to look inside the shadow root directly.
  expect((el.shadowRoot!.activeElement) === (toggle)).to.equal(true);
});

it('returns focus to whatever triggered it (via Escape) even when opened by setting `open` directly rather than clicking the built-in toggle', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><button>a</button></lr-app-rail>`)) as LyraAppRail;
  const outsideTrigger = document.createElement('button');
  document.body.appendChild(outsideTrigger);
  outsideTrigger.focus();

  el.open = true;
  await el.updateComplete;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect((document.activeElement) === (outsideTrigger)).to.equal(true);
  outsideTrigger.remove();
});

// -- scroll lock --------------------------------------------------------

it('locks document scroll while the overlay is open and releases it on close', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><button>a</button></lr-app-rail>`)) as LyraAppRail;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.open = false;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('releases the scroll lock on disconnect while the overlay is open', async () => {
  const el = (await fixture(
    html`<lr-app-rail mode="mobile" open><button>a</button></lr-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.remove();

  expect(document.documentElement.style.overflow).to.equal('');
});

it('restores the scroll lock and keydown trap when reparented while the overlay is still open', async () => {
  const el = (await fixture(
    html`<lr-app-rail mode="mobile" open><button>a</button></lr-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  otherContainer.appendChild(el); // reparenting an already-connected node fires disconnectedCallback then connectedCallback synchronously
  expect(el.open).to.be.true;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');

  otherContainer.remove();
});

// -- part swap / inert / aria semantics ------------------------------------

it('uses part="base" while inline and part="panel" while mobile -- never both', async () => {
  const el = (await fixture(html`<lr-app-rail><button>a</button></lr-app-rail>`)) as LyraAppRail;
  expect(el.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('part')).to.equal('base');

  el.mode = 'mobile';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('part')).to.equal('panel');
});

it('marks the panel inert while mobile and closed, interactive once open', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><button>a</button></lr-app-rail>`)) as LyraAppRail;
  const nav = el.shadowRoot!.querySelector('[part="base"], [part="panel"]') as HTMLElement;
  expect(nav.inert).to.be.true;

  el.open = true;
  await el.updateComplete;
  expect(nav.inert).to.be.false;
});

it('is never inert outside mobile mode', async () => {
  const el = (await fixture(html`<lr-app-rail><button>a</button></lr-app-rail>`)) as LyraAppRail;
  expect((el.shadowRoot!.querySelector('[part="base"], [part="panel"]') as HTMLElement).inert).to.be.false;
});

it('only sets dialog role/aria-modal while the mobile overlay is actually open', async () => {
  const el = (await fixture(html`<lr-app-rail mode="mobile"><button>a</button></lr-app-rail>`)) as LyraAppRail;
  const nav = el.shadowRoot!.querySelector('[part="base"], [part="panel"]') as HTMLElement;
  // A plain landmark role (not "dialog") while closed -- a literal <nav> tag
  // can't have its implicit role swapped for "dialog" without an
  // aria-allowed-role violation, so this is a <div role="navigation"> instead.
  expect(nav.getAttribute('role')).to.equal('navigation');
  expect(nav.hasAttribute('aria-modal')).to.be.false;

  el.open = true;
  await el.updateComplete;
  expect(nav.getAttribute('role')).to.equal('dialog');
  expect(nav.getAttribute('aria-modal')).to.equal('true');
});

// -- header/footer slot presence --------------------------------------------

it('hides the header/footer wrappers when nothing is slotted, shows them once slotted', async () => {
  const el = (await fixture(html`<lr-app-rail><button>a</button></lr-app-rail>`)) as LyraAppRail;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.true;
  expect(footer.hasAttribute('hidden')).to.be.true;

  const logo = document.createElement('span');
  logo.slot = 'header';
  el.appendChild(logo);
  el.shadowRoot!.querySelector('slot[name="header"]')!.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(header.hasAttribute('hidden')).to.be.false;
});

it('renders the header wrapper visible on first paint when header content is present before upgrade', async () => {
  const el = (await fixture(
    html`<lr-app-rail><span slot="header">Brand</span><button>a</button></lr-app-rail>`,
  )) as LyraAppRail;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.false;
});

// -- accessibility ------------------------------------------------------

it('is accessible in full mode, empty', async () => {
  const el = (await fixture(html`<lr-app-rail></lr-app-rail>`)) as LyraAppRail;
  await expect(el).to.be.accessible();
});

it('is accessible in full mode with header/nav/footer content', async () => {
  const el = (await fixture(html`
    <lr-app-rail>
      <span slot="header">Brand</span>
      <a href="/inbox" aria-label="Inbox">Inbox</a>
      <a href="/settings" aria-label="Settings">Settings</a>
      <span slot="footer">Account</span>
    </lr-app-rail>
  `)) as LyraAppRail;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with the mobile overlay open', async () => {
  const el = (await fixture(html`
    <lr-app-rail mode="mobile" open>
      <span slot="header">Brand</span>
      <a href="/inbox" aria-label="Inbox">Inbox</a>
      <span slot="footer">Account</span>
    </lr-app-rail>
  `)) as LyraAppRail;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

// -- toggle button i18n --------------------------------------------------

describe('toggle button i18n', () => {
  it('uses the openNavigation message key (not a hardcoded "Open" + " navigation" concatenation) when closed', async () => {
    const el = (await fixture(html`<lr-app-rail mode="mobile"></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]')!;
    expect(toggle.getAttribute('aria-label')).to.equal('Open navigation');
  });

  it('honors a strings override for openNavigation', async () => {
    const el = (await fixture(
      html`<lr-app-rail mode="mobile" .strings=${{ openNavigation: 'Ouvrir la navigation' }}></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]')!;
    expect(toggle.getAttribute('aria-label')).to.equal('Ouvrir la navigation');
  });
});

// -- preferredMode --------------------------------------------------------

describe('preferredMode', () => {
  it('computeAppRailMode: preferredMode wins over iconOnlyMatches, but mobileMatches always wins over preferredMode', () => {
    expect(computeAppRailMode(false, false, 'icon-only')).to.equal('icon-only');
    expect(computeAppRailMode(true, false, 'full')).to.equal('full');
    expect(computeAppRailMode(false, true, 'full')).to.equal('mobile');
    expect(computeAppRailMode(false, false, null)).to.equal('full');
    expect(computeAppRailMode(true, false, undefined)).to.equal('icon-only');
  });

  it('applies preferredMode on the live element while unforced, and yields to the mobile breakpoint', async () => {
    const el = (await fixture(html`<lr-app-rail preferred-mode="icon-only"></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    expect(el.mode).to.equal('icon-only');
  });

  it('does not override an explicitly forced mode', async () => {
    const el = (await fixture(html`<lr-app-rail preferred-mode="icon-only"></lr-app-rail>`)) as LyraAppRail;
    el.mode = 'full';
    await el.updateComplete;
    expect(el.mode).to.equal('full');
  });
});

// -- resizable --------------------------------------------------------------

describe('resizable', () => {
  it('renders no resizer when resizable is false (default)', async () => {
    const el = (await fixture(html`<lr-app-rail></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resizer"]')).to.not.exist;
  });

  it('renders a resizer with role="separator" and correct aria bounds only in \'full\' mode', async () => {
    const el = (await fixture(
      html`<lr-app-rail mode="full" resizable rail-width-px="240" min-rail-width-px="190" max-rail-width-px="440"></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]')!;
    expect(resizer.getAttribute('role')).to.equal('separator');
    expect(resizer.getAttribute('aria-valuenow')).to.equal('240');
    expect(resizer.getAttribute('aria-valuemin')).to.equal('190');
    expect(resizer.getAttribute('aria-valuemax')).to.equal('440');
    expect(resizer.getAttribute('aria-label')).to.equal('Resize navigation');
  });

  it('gives the resizer hit target the shared minimum tappable size without inflating the visible drag line', async () => {
    const el = (await fixture(html`<lr-app-rail resizable></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    const track = resizer.querySelector('[part="resizer-track"]') as HTMLElement;
    expect(getComputedStyle(resizer).minInlineSize).to.equal('40px');
    expect(getComputedStyle(resizer).minBlockSize).to.equal('40px');
    // The visible drag line itself stays a slim 3px bar, not blown up to 40px -- the handle's own
    // box grows around it via flex centering instead.
    expect(getComputedStyle(track).inlineSize).to.equal('3px');
  });

  it('does not render a resizer in icon-only or mobile mode even when resizable', async () => {
    const el = (await fixture(html`<lr-app-rail resizable mode="icon-only"></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resizer"]')).to.not.exist;
  });

  it('ArrowRight/ArrowLeft on the resizer steps railWidthPx and emits lr-rail-resize, clamped to bounds', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="240" min-rail-width-px="190" max-rail-width-px="440"></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    let detail: { widthPx: number } | undefined;
    el.addEventListener('lr-rail-resize', (e) => (detail = (e as CustomEvent).detail));

    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.railWidthPx).to.equal(248);
    expect(detail).to.deep.equal({ widthPx: 248 });

    el.railWidthPx = 438;
    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.railWidthPx).to.equal(440); // clamped to maxRailWidthPx

    el.railWidthPx = 192;
    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(el.railWidthPx).to.equal(190); // clamped to minRailWidthPx
  });

  it('sets [part=base]\'s inline-size from railWidthPx only while resizable and in \'full\' mode', async () => {
    const el = (await fixture(html`<lr-app-rail resizable rail-width-px="300"></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('inline-size')).to.equal('300px');
    el.mode = 'icon-only';
    await el.updateComplete;
    expect(base.style.getPropertyValue('inline-size')).to.equal('');
  });

  it('reflects dragging=true only for the duration of a pointer-driven resize, and suppresses the base transition while true', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="240" min-rail-width-px="190" max-rail-width-px="440"></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    expect(el.dragging).to.be.false;
    expect(getComputedStyle(base).transitionProperty).to.not.equal('none');

    // Synthetic PointerEvents do not create a browser-owned active pointer, so Firefox correctly
    // throws InvalidPointerId from the native capture method. Pointer-capture behavior is covered
    // by real-pointer tests; this state/transition test stubs only that browser primitive.
    resizer.setPointerCapture = () => {};
    resizer.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, bubbles: true }));
    await el.updateComplete;
    expect(el.dragging).to.be.true;
    expect(getComputedStyle(base).transitionProperty).to.equal('none');

    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    await el.updateComplete;
    expect(el.dragging).to.be.false;
    expect(getComputedStyle(base).transitionProperty).to.not.equal('none');
  });

  it('routes an adopted resizer gesture through its owner window and detaches from that window on adoption', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="240" min-rail-width-px="190" max-rail-width-px="440"></lr-app-rail>`,
    )) as LyraAppRail;
    el.remove();
    const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) throw new Error('The iframe realm was unavailable.');
    const originalRemoveEventListener = frameWindow.removeEventListener;
    const removedPointerTypes: string[] = [];
    frameWindow.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) => {
      if (type.startsWith('pointer') || type === 'lostpointercapture') removedPointerTypes.push(type);
      originalRemoveEventListener.call(frameWindow, type, listener, options);
    }) as typeof frameWindow.removeEventListener;

    try {
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      el.mode = 'full';
      await el.updateComplete;
      const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
      const resizerTrack = resizer.querySelector('[part="resizer-track"]') as HTMLElement;
      resizer.setPointerCapture = () => {};
      resizerTrack.dispatchEvent(
        new frameWindow.PointerEvent('pointerdown', { pointerId: 71, clientX: 0, bubbles: true }),
      );

      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 71, clientX: 40 }));
      expect(el.railWidthPx, 'the ambient window must not own the adopted drag').to.equal(240);

      frameWindow.dispatchEvent(
        new frameWindow.PointerEvent('pointermove', { pointerId: 71, clientX: 40 }),
      );
      expect(el.railWidthPx).to.equal(280);
      expect(el.dragging).to.be.true;

      document.adoptNode(el);
      expect(el.dragging).to.be.false;
      expect([...new Set(removedPointerTypes)].sort()).to.deep.equal(
        ['lostpointercapture', 'pointercancel', 'pointermove', 'pointerup'],
      );
      frameWindow.dispatchEvent(
        new frameWindow.PointerEvent('pointermove', { pointerId: 71, clientX: 80 }),
      );
      expect(el.railWidthPx, 'the old owner window listener must be removed').to.equal(280);
    } finally {
      if (el.ownerDocument !== document) document.adoptNode(el);
      frameWindow.removeEventListener = originalRemoveEventListener;
      el.remove();
      frame.remove();
    }
  });

  it('aborts an active pointer resize when resizable is revoked', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="240"></lr-app-rail>`,
    )) as LyraAppRail;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    resizer.setPointerCapture = () => {};
    let events = 0;
    el.addEventListener('lr-rail-resize', () => (events += 1));
    resizer.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 41, clientX: 0, bubbles: true }),
    );

    el.resizable = false;
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 41, clientX: 100 }),
    );

    expect(el.railWidthPx).to.equal(240);
    expect(el.dragging).to.be.false;
    expect(events).to.equal(0);
  });

  it('aborts an active pointer resize when full mode is revoked', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="240"></lr-app-rail>`,
    )) as LyraAppRail;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    resizer.setPointerCapture = () => {};
    resizer.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 42, clientX: 0, bubbles: true }),
    );

    el.mode = 'icon-only';
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 42, clientX: 100 }),
    );

    expect(el.railWidthPx).to.equal(240);
    expect(el.dragging).to.be.false;
  });

  it('does not toggle dragging for keyboard-driven resize steps', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="240" min-rail-width-px="190" max-rail-width-px="440"></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.dragging).to.be.false;
  });

  // -- numeric guard regressions (railWidthPx/minRailWidthPx/maxRailWidthPx) --

  it('clamps a NaN or negative railWidthPx to a sane in-bounds width instead of leaking through to layout', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable min-rail-width-px="190" max-rail-width-px="440"></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;

    el.railWidthPx = NaN;
    await el.updateComplete;
    expect(base.style.getPropertyValue('inline-size')).to.equal('190px');
    expect(resizer.getAttribute('aria-valuenow')).to.equal('190');

    el.railWidthPx = -999;
    await el.updateComplete;
    expect(base.style.getPropertyValue('inline-size')).to.equal('190px');
    expect(resizer.getAttribute('aria-valuenow')).to.equal('190');
  });

  it('sanitizes a NaN minRailWidthPx/maxRailWidthPx instead of letting it poison every clamp', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="9999" min-rail-width-px="NaN" max-rail-width-px="NaN"></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    expect(resizer.getAttribute('aria-valuemin')).to.equal('190');
    expect(resizer.getAttribute('aria-valuemax')).to.equal('440');
    expect(resizer.getAttribute('aria-valuenow')).to.equal('440'); // clamped down into the sanitized bounds
  });

  it('keeps maxRailWidthPx from resolving below minRailWidthPx for an inverted pair', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable rail-width-px="240" min-rail-width-px="500" max-rail-width-px="100"></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    const min = Number(resizer.getAttribute('aria-valuemin'));
    const max = Number(resizer.getAttribute('aria-valuemax'));
    expect(min).to.equal(500);
    expect(max).to.be.at.least(min);
    expect(resizer.getAttribute('aria-valuenow')).to.equal('500'); // 240 clamped up into range
  });
});

describe('hideToggle', () => {
  it('hides [part=toggle] when set, in mobile mode', async () => {
    const el = (await fixture(html`<lr-app-rail hide-toggle mode="mobile"></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
    expect(getComputedStyle(toggle).display).to.equal('none');
  });

  it('defaults to false, unchanged output', async () => {
    const el = (await fixture(html`<lr-app-rail mode="mobile"></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    expect(el.hideToggle).to.be.false;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
    expect(getComputedStyle(toggle).display).to.not.equal('none');
  });
});

describe('aria-label forwarding', () => {
  it('unset host aria-label reproduces today\'s exact localized-default/label-prop output', async () => {
    const withDefault = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
    expect(withDefault.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('aria-label')).to.equal(
      'Navigation',
    );

    const withLabel = (await fixture(html`<lr-app-rail label="Main"><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
    expect(withLabel.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('aria-label')).to.equal(
      'Main',
    );
  });

  it('a host-level aria-label attribute overrides the label prop / localized default on the nav landmark', async () => {
    const el = (await fixture(
      html`<lr-app-rail label="Main" aria-label="Custom nav name"><a href="/a">A</a></lr-app-rail>`,
    )) as LyraAppRail;
    expect(el.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('aria-label')).to.equal(
      'Custom nav name',
    );
  });

  it('the host-level aria-label override also applies to the dialog role while the mobile overlay is open', async () => {
    const el = (await fixture(
      html`<lr-app-rail mode="mobile" open aria-label="Custom nav name"><a href="/a">A</a></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(panel.getAttribute('role')).to.equal('dialog');
    expect(panel.getAttribute('aria-label')).to.equal('Custom nav name');
  });
});

describe('storage-key persistence', () => {
  const keys: string[] = [];
  function uniqueKey(): string {
    const k = `test-${keys.length}-${window.location.pathname.length}`;
    keys.push(k);
    return k;
  }
  afterEach(() => {
    for (const k of keys) {
      try {
        localStorage.removeItem(`lr-app-rail:${k}`);
      } catch {
        /* ignore */
      }
    }
    keys.length = 0;
  });

  it('persists railWidthPx and restores it on a fresh mount', async () => {
    const key = uniqueKey();
    const el = (await fixture(
      html`<lr-app-rail resizable storage-key=${key}><a href="/a">A</a></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    el.railWidthPx = 260;
    await el.updateComplete;

    const el2 = (await fixture(
      html`<lr-app-rail resizable storage-key=${key}><a href="/a">A</a></lr-app-rail>`,
    )) as LyraAppRail;
    await el2.updateComplete;
    expect(el2.railWidthPx).to.equal(260);
  });

  it('does not touch localStorage when storage-key is unset', async () => {
    const el = (await fixture(html`<lr-app-rail resizable><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    const before = localStorage.length;
    el.railWidthPx = 300;
    await el.updateComplete;
    expect(localStorage.length).to.equal(before);
  });

  it('does not persist mode (breakpoint-derived), only open and railWidthPx', async () => {
    const key = uniqueKey();
    const el = (await fixture(
      html`<lr-app-rail resizable storage-key=${key}><a href="/a">A</a></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    el.railWidthPx = 220;
    await el.updateComplete;
    const stored = JSON.parse(localStorage.getItem(`lr-app-rail:${key}`)!) as Record<string, unknown>;
    expect(Object.keys(stored).sort()).to.deep.equal(['open', 'railWidthPx']);
  });

  it('persists only the fields selected by persist, including preferredMode', async () => {
    const key = uniqueKey();
    const el = (await fixture(
      html`<lr-app-rail
        storage-key=${key}
        persist="width preferred-mode"
      ><a href="/a">A</a></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;

    el.open = true;
    el.railWidthPx = 275;
    el.preferredMode = 'icon-only';
    await el.updateComplete;

    const stored = JSON.parse(localStorage.getItem(`lr-app-rail:${key}`)!) as Record<
      string,
      unknown
    >;
    expect(stored).to.deep.equal({
      railWidthPx: 275,
      preferredMode: 'icon-only',
    });
  });

  it('does not restore controlled open state when persist excludes open', async () => {
    const key = uniqueKey();
    localStorage.setItem(
      `lr-app-rail:${key}`,
      JSON.stringify({
        open: true,
        railWidthPx: 260,
        preferredMode: 'icon-only',
      }),
    );

    const el = (await fixture(
      html`<lr-app-rail
        storage-key=${key}
        persist="width preferred-mode"
        .open=${false}
      ><a href="/a">A</a></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(el.railWidthPx).to.equal(260);
    expect(el.preferredMode).to.equal('icon-only');
    expect(el.mode).to.equal('icon-only');
  });
});

describe('layout: resizer anchor, overflow, and mobile containing block', () => {
  it('anchors the resizer within the host, not the viewport', async () => {
    const el = (await fixture(
      html`<lr-app-rail resizable style="block-size: 300px;"><a href="/a">A</a></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    const hostRect = el.getBoundingClientRect();
    const resizerRect = resizer.getBoundingClientRect();
    // Before the fix (:host had no position) inset-block:0 resolved against the viewport, so the
    // resizer spanned the full viewport height -- far taller than the 300px host.
    expect(Math.round(resizerRect.height)).to.equal(Math.round(hostRect.height));
  });

  it('sets overflow-x to clip on the scrollable base so no spurious horizontal scrollbar appears', async () => {
    const el = (await fixture(html`<lr-app-rail><a href="/a">A</a></lr-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // Chromium normalizes overflow-x:clip to 'hidden' when the cross axis is a scroll container;
    // either value pins the axis and prevents the auto-computed horizontal scrollbar. What matters
    // is that it is no longer 'visible'/'auto'.
    expect(['clip', 'hidden']).to.include(getComputedStyle(base).overflowX);
  });

  it('settles the open mobile panel at transform:none so fixed descendants are not trapped', async () => {
    const el = (await fixture(
      html`<lr-app-rail mode="mobile" open><a href="/a">A</a></lr-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    // A non-none transform (even translateX(0) -> matrix(1,0,0,1,0,0)) establishes a containing
    // block for position:fixed. The open state must compute to 'none'.
    expect(getComputedStyle(panel).transform).to.equal('none');
  });

  it('contains long localized header, item, and footer content in an open 320px RTL mobile rail', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-app-rail
          label="التنقل الرئيسي"
          mode="mobile"
          open
          style="--lr-app-rail-mobile-width: 320px;"
        >
          <span slot="header">عنوان-تطبيق-طويل-جداً-غير-قابل-للفصل-ويجب-أن-يلتف-داخل-اللوحة</span>
          <lr-app-rail-item href="#reports">
            <span slot="icon" aria-hidden="true">📊</span>
            تقرير-تحليلي-طويل-جداً-غير-قابل-للفصل
          </lr-app-rail-item>
          <span slot="footer">حساب-مستخدم-طويل-جداً-غير-قابل-للفصل</span>
        </lr-app-rail>
      </div>
    `);
    const el = wrapper.querySelector('lr-app-rail') as LyraAppRail;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;
    const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
    const nav = el.shadowRoot!.querySelector<HTMLElement>('[part="nav"]')!;
    const footer = el.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!;

    expect(Math.ceil(panel.getBoundingClientRect().width)).to.be.at.most(320);
    expect(header.scrollWidth).to.be.at.most(header.clientWidth);
    expect(nav.scrollWidth).to.be.at.most(nav.clientWidth);
    expect(footer.scrollWidth).to.be.at.most(footer.clientWidth);
    expect(getComputedStyle(panel).direction).to.equal('rtl');
  });
});
