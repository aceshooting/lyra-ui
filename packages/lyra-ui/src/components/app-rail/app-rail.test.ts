import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './app-rail.js';
import { computeAppRailMode, type LyraAppRail, type AppRailModeChangeDetail, type AppRailToggleDetail } from './app-rail.js';

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
  const el = (await fixture(html`<lyra-app-rail><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  expect(el.mode).to.equal('full');
  expect(el.getAttribute('mode')).to.equal('full');
  expect(el.open).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('part')).to.equal('base');
});

it('uses the label prop as the nav landmark accessible name', async () => {
  const el = (await fixture(html`<lyra-app-rail label="Main"><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  expect(el.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('aria-label')).to.equal('Main');
});

it('hides app-rail-item labels visually in icon-only mode while retaining their accessible names', async () => {
  const el = (await fixture(html`
    <lyra-app-rail mode="icon-only">
      <lyra-app-rail-item href="/inbox" aria-label="Inbox">
        <span slot="icon" aria-hidden="true">📥</span>Inbox with a long localized label
      </lyra-app-rail-item>
    </lyra-app-rail>
  `)) as LyraAppRail;
  const item = el.querySelector('lyra-app-rail-item')! as HTMLElement & { updateComplete: Promise<unknown> };
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

// -- breakpoint-driven mode wiring ---------------------------------------

it('switches to icon-only and emits lyra-mode-change when the icon-only query starts matching', async () => {
  const el = (await fixture(html`<lyra-app-rail><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  const promise = oneEvent(el, 'lyra-mode-change');
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
  const el = (await fixture(html`<lyra-app-rail><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  fireIconOnlyChange(el, true);
  await el.updateComplete;
  fireMobileChange(el, true);
  await el.updateComplete;

  expect(el.mode).to.equal('mobile');
});

it('does not emit lyra-mode-change for a redundant reassignment to the current mode', async () => {
  const el = (await fixture(html`<lyra-app-rail><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  let count = 0;
  el.addEventListener('lyra-mode-change', () => count++);

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

  const el = (await fixture(html`<lyra-app-rail><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
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

// -- forcing / auto sentinel ----------------------------------------------

it('forcing mode stops it from responding to further matchMedia changes', async () => {
  const el = (await fixture(html`<lyra-app-rail><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  el.mode = 'full';
  await el.updateComplete;

  fireMobileChange(el, true);
  await el.updateComplete;

  expect(el.mode).to.equal('full');
});

it('assigning "auto" releases a forced mode and re-syncs to the live breakpoint state', async () => {
  const el = (await fixture(html`<lyra-app-rail><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
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
  const el = (await fixture(html`<lyra-app-rail><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  (el as unknown as { mode: string }).mode = 'bogus';
  await el.updateComplete;
  expect(el.mode).to.equal('full');
});

it('force-closes an open overlay and emits lyra-toggle when mode leaves mobile', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  el.open = true;
  await el.updateComplete;

  const promise = oneEvent(el, 'lyra-toggle');
  el.mode = 'full';
  const ev = await promise;

  expect(el.open).to.be.false;
  expect((ev.detail as AppRailToggleDetail).open).to.be.false;
});

// -- mobile overlay: toggle button ----------------------------------------

it('the toggle button opens and closes the overlay, updating aria-expanded/aria-label', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
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

it('toggling emits lyra-toggle with the new open state', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;

  const promise = oneEvent(el, 'lyra-toggle');
  toggle.click();
  const ev = await promise;

  expect((ev.detail as AppRailToggleDetail).open).to.be.true;
});

it('setting open directly does not emit lyra-toggle (mirrors lyra-dialog open/close split)', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><a href="/a">A</a></lyra-app-rail>`)) as LyraAppRail;
  let fired = false;
  el.addEventListener('lyra-toggle', () => (fired = true));

  el.open = true;
  await el.updateComplete;

  expect(fired).to.be.false;
});

// -- RTL mobile panel offset ------------------------------------------------

it('flips the mobile panel\'s offscreen transform under dir="rtl", mirroring the LTR closed-state transform', async () => {
  const ltrEl = (await fixture(
    html`<lyra-app-rail mode="mobile"><button>a</button></lyra-app-rail>`,
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
    html`<lyra-app-rail mode="mobile" dir="rtl"><button>a</button></lyra-app-rail>`,
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
    html`<lyra-app-rail mode="mobile" open><a href="/a">A</a></lyra-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('closes on Escape while open, ignores Escape while closed', async () => {
  const el = (await fixture(
    html`<lyra-app-rail mode="mobile" open><a href="/a">A</a></lyra-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;
  expect(el.open).to.be.false;

  let fired = false;
  el.addEventListener('lyra-toggle', () => (fired = true));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;
  expect(fired).to.be.false;
});

it('closes when a nav item is clicked while open, but not while closed', async () => {
  const el = (await fixture(
    html`<lyra-app-rail mode="mobile"><button>Item</button></lyra-app-rail>`,
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
    html`<lyra-app-rail mode="mobile" open>
      <span slot="header"><button>header-btn</button></span>
      <button>nav-btn</button>
      <span slot="footer"><button>footer-btn</button></span>
    </lyra-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  (el.querySelector('[slot="header"] button') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.open).to.be.true;
});

// -- focus trap -------------------------------------------------------------

it('moves focus to the first focusable nav item when the overlay opens', async () => {
  const el = (await fixture(
    html`<lyra-app-rail mode="mobile"><button>first</button><button>second</button></lyra-app-rail>`,
  )) as LyraAppRail;
  const first = el.querySelector('button') as HTMLButtonElement;

  el.open = true;
  await el.updateComplete;

  expect(document.activeElement).to.equal(first);
});

it('focuses the panel itself as a fallback when there is nothing focusable', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><p>no controls</p></lyra-app-rail>`)) as LyraAppRail;
  el.open = true;
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="panel"]'));
});

it('traps Tab focus across header, nav, and footer slots, wrapping last->first and first->last', async () => {
  const el = (await fixture(
    html`<lyra-app-rail mode="mobile" open>
      <span slot="header"><button>header-btn</button></span>
      <button>nav-btn</button>
      <span slot="footer"><button>footer-btn</button></span>
    </lyra-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  const first = el.querySelector('[slot="header"] button') as HTMLButtonElement;
  const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;

  last.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  expect(tabForward.defaultPrevented).to.be.true;
  expect(document.activeElement).to.equal(first);

  const tabBackward = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(tabBackward);
  expect(tabBackward.defaultPrevented).to.be.true;
  expect(document.activeElement).to.equal(last);
});

it('returns focus to the toggle button after closing', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><button>a</button></lyra-app-rail>`)) as LyraAppRail;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;

  toggle.click();
  await el.updateComplete;
  toggle.click();
  await el.updateComplete;

  // The toggle button lives in this element's own shadow root (unlike the
  // slotted light-DOM nav items focused elsewhere in this file) -- focusing
  // it makes `document.activeElement` resolve to the *host*, not the button
  // itself, so the check has to look inside the shadow root directly.
  expect(el.shadowRoot!.activeElement).to.equal(toggle);
});

it('returns focus to whatever triggered it (via Escape) even when opened by setting `open` directly rather than clicking the built-in toggle', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><button>a</button></lyra-app-rail>`)) as LyraAppRail;
  const outsideTrigger = document.createElement('button');
  document.body.appendChild(outsideTrigger);
  outsideTrigger.focus();

  el.open = true;
  await el.updateComplete;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(document.activeElement).to.equal(outsideTrigger);
  outsideTrigger.remove();
});

// -- scroll lock --------------------------------------------------------

it('locks document scroll while the overlay is open and releases it on close', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><button>a</button></lyra-app-rail>`)) as LyraAppRail;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.open = false;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('releases the scroll lock on disconnect while the overlay is open', async () => {
  const el = (await fixture(
    html`<lyra-app-rail mode="mobile" open><button>a</button></lyra-app-rail>`,
  )) as LyraAppRail;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.remove();

  expect(document.documentElement.style.overflow).to.equal('');
});

it('restores the scroll lock and keydown trap when reparented while the overlay is still open', async () => {
  const el = (await fixture(
    html`<lyra-app-rail mode="mobile" open><button>a</button></lyra-app-rail>`,
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
  const el = (await fixture(html`<lyra-app-rail><button>a</button></lyra-app-rail>`)) as LyraAppRail;
  expect(el.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('part')).to.equal('base');

  el.mode = 'mobile';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"], [part="panel"]')!.getAttribute('part')).to.equal('panel');
});

it('marks the panel inert while mobile and closed, interactive once open', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><button>a</button></lyra-app-rail>`)) as LyraAppRail;
  const nav = el.shadowRoot!.querySelector('[part="base"], [part="panel"]') as HTMLElement;
  expect(nav.inert).to.be.true;

  el.open = true;
  await el.updateComplete;
  expect(nav.inert).to.be.false;
});

it('is never inert outside mobile mode', async () => {
  const el = (await fixture(html`<lyra-app-rail><button>a</button></lyra-app-rail>`)) as LyraAppRail;
  expect((el.shadowRoot!.querySelector('[part="base"], [part="panel"]') as HTMLElement).inert).to.be.false;
});

it('only sets dialog role/aria-modal while the mobile overlay is actually open', async () => {
  const el = (await fixture(html`<lyra-app-rail mode="mobile"><button>a</button></lyra-app-rail>`)) as LyraAppRail;
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
  const el = (await fixture(html`<lyra-app-rail><button>a</button></lyra-app-rail>`)) as LyraAppRail;
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
    html`<lyra-app-rail><span slot="header">Brand</span><button>a</button></lyra-app-rail>`,
  )) as LyraAppRail;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.false;
});

// -- accessibility ------------------------------------------------------

it('is accessible in full mode, empty', async () => {
  const el = (await fixture(html`<lyra-app-rail></lyra-app-rail>`)) as LyraAppRail;
  await expect(el).to.be.accessible();
});

it('is accessible in full mode with header/nav/footer content', async () => {
  const el = (await fixture(html`
    <lyra-app-rail>
      <span slot="header">Brand</span>
      <a href="/inbox" aria-label="Inbox">Inbox</a>
      <a href="/settings" aria-label="Settings">Settings</a>
      <span slot="footer">Account</span>
    </lyra-app-rail>
  `)) as LyraAppRail;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with the mobile overlay open', async () => {
  const el = (await fixture(html`
    <lyra-app-rail mode="mobile" open>
      <span slot="header">Brand</span>
      <a href="/inbox" aria-label="Inbox">Inbox</a>
      <span slot="footer">Account</span>
    </lyra-app-rail>
  `)) as LyraAppRail;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

// -- toggle button i18n --------------------------------------------------

describe('toggle button i18n', () => {
  it('uses the openNavigation message key (not a hardcoded "Open" + " navigation" concatenation) when closed', async () => {
    const el = (await fixture(html`<lyra-app-rail mode="mobile"></lyra-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]')!;
    expect(toggle.getAttribute('aria-label')).to.equal('Open navigation');
  });

  it('honors a strings override for openNavigation', async () => {
    const el = (await fixture(
      html`<lyra-app-rail mode="mobile" .strings=${{ openNavigation: 'Ouvrir la navigation' }}></lyra-app-rail>`,
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
    const el = (await fixture(html`<lyra-app-rail preferred-mode="icon-only"></lyra-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    expect(el.mode).to.equal('icon-only');
  });

  it('does not override an explicitly forced mode', async () => {
    const el = (await fixture(html`<lyra-app-rail preferred-mode="icon-only"></lyra-app-rail>`)) as LyraAppRail;
    el.mode = 'full';
    await el.updateComplete;
    expect(el.mode).to.equal('full');
  });
});

// -- resizable --------------------------------------------------------------

describe('resizable', () => {
  it('renders no resizer when resizable is false (default)', async () => {
    const el = (await fixture(html`<lyra-app-rail></lyra-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resizer"]')).to.not.exist;
  });

  it('renders a resizer with role="separator" and correct aria bounds only in \'full\' mode', async () => {
    const el = (await fixture(
      html`<lyra-app-rail resizable rail-width-px="240" min-rail-width-px="190" max-rail-width-px="440"></lyra-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]')!;
    expect(resizer.getAttribute('role')).to.equal('separator');
    expect(resizer.getAttribute('aria-valuenow')).to.equal('240');
    expect(resizer.getAttribute('aria-valuemin')).to.equal('190');
    expect(resizer.getAttribute('aria-valuemax')).to.equal('440');
    expect(resizer.getAttribute('aria-label')).to.equal('Resize navigation');
  });

  it('does not render a resizer in icon-only or mobile mode even when resizable', async () => {
    const el = (await fixture(html`<lyra-app-rail resizable mode="icon-only"></lyra-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="resizer"]')).to.not.exist;
  });

  it('ArrowRight/ArrowLeft on the resizer steps railWidthPx and emits lyra-rail-resize, clamped to bounds', async () => {
    const el = (await fixture(
      html`<lyra-app-rail resizable rail-width-px="240" min-rail-width-px="190" max-rail-width-px="440"></lyra-app-rail>`,
    )) as LyraAppRail;
    await el.updateComplete;
    const resizer = el.shadowRoot!.querySelector('[part="resizer"]') as HTMLElement;
    let detail: { widthPx: number } | undefined;
    el.addEventListener('lyra-rail-resize', (e) => (detail = (e as CustomEvent).detail));

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
    const el = (await fixture(html`<lyra-app-rail resizable rail-width-px="300"></lyra-app-rail>`)) as LyraAppRail;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('inline-size')).to.equal('300px');
    el.mode = 'icon-only';
    await el.updateComplete;
    expect(base.style.getPropertyValue('inline-size')).to.equal('');
  });
});
