import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './responsive-panel.js';
import type { LyraResponsivePanel, ResponsivePanelModeChangeDetail } from './responsive-panel.js';
import { resolveEffectiveMode } from './responsive-panel.js';
import { styles } from './responsive-panel.styles.js';

it('uses a dynamic viewport fallback and safe-area padding for bottom sheets', () => {
  expect(styles.cssText).to.include('max-block-size: 85vh');
  expect(styles.cssText).to.include('max-block-size: 85dvh');
  expect(styles.cssText).to.include('var(--lyra-safe-area-bottom)');
});

// A stand-in for a slotted component (e.g. lyra-combobox) whose real
// focusable target lives inside its own shadow root rather than the host
// tag's light-DOM subtree. Mirrors lyra-dialog's identical test fixture,
// under a distinct tag name so both test files can register their own copy
// in the same browser context.
class ResponsivePanelTestShadowInput extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'text';
    root.appendChild(input);
  }
}
customElements.define('responsive-panel-test-shadow-input', ResponsivePanelTestShadowInput);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asAny(el: LyraResponsivePanel): any {
  return el;
}

describe('resolveEffectiveMode', () => {
  it('returns the forced mode regardless of breakpoint when mode is inline or overlay', () => {
    expect(resolveEffectiveMode('inline', true)).to.equal('inline');
    expect(resolveEffectiveMode('inline', false)).to.equal('inline');
    expect(resolveEffectiveMode('overlay', true)).to.equal('overlay');
    expect(resolveEffectiveMode('overlay', false)).to.equal('overlay');
  });

  it('tracks the breakpoint when mode is auto', () => {
    expect(resolveEffectiveMode('auto', true)).to.equal('overlay');
    expect(resolveEffectiveMode('auto', false)).to.equal('inline');
  });
});

it('defaults to mode="auto", variant="fullscreen", closed, mobile-breakpoint="768px"', async () => {
  const el = (await fixture(html`<lyra-responsive-panel>body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  expect(el.mode).to.equal('auto');
  expect(el.getAttribute('mode')).to.equal('auto');
  expect(el.variant).to.equal('fullscreen');
  expect(el.open).to.be.false;
  expect(el.mobileBreakpoint).to.equal('768px');
});

it('resolves to inline in mode="auto" on a viewport wider than the breakpoint (the default jsdom/browser test width)', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute('role')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.not.exist;
});

it('forces the overlay presentation regardless of viewport width when mode="overlay"', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open label="Settings">body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-label')).to.equal('Settings');
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.exist;
});

it('forces the inline presentation even at a breakpoint that would otherwise resolve to overlay', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="inline" mobile-breakpoint="99999px" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute('role')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.not.exist;
});

it('uses a real matchMedia query against mobile-breakpoint: an absurdly large breakpoint resolves auto mode to overlay', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mobile-breakpoint="99999px" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
});

it('uses a real matchMedia query against mobile-breakpoint: an absurdly small breakpoint resolves auto mode to inline', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mobile-breakpoint="1px" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute('role')).to.be.false;
});

it('re-evaluates against the new mobile-breakpoint when it changes at runtime while connected in mode="auto"', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mobile-breakpoint="1px" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  let panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute('role'), 'starts inline: viewport is wider than 1px').to.be.false;

  // Flips the real matchMedia result for this instance (the test viewport is
  // never actually below 99999px, so this only proves anything if the
  // component re-queries matchMedia against the new value and picks up the
  // now-true match -- a stale belowBreakpoint would leave this stuck inline).
  el.mobileBreakpoint = '99999px';
  await el.updateComplete;
  panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role'), 'switches to overlay once the new breakpoint matches').to.equal('dialog');
});

it('hides [part="base"] entirely while closed, in both presentations', async () => {
  const inline = (await fixture(html`<lyra-responsive-panel mode="inline">body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  const overlay = (await fixture(html`<lyra-responsive-panel mode="overlay">body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  expect(getComputedStyle(inline.shadowRoot!.querySelector('[part="base"]')!).display).to.equal('none');
  expect(getComputedStyle(overlay.shadowRoot!.querySelector('[part="base"]')!).display).to.equal('none');
});

it('directly invoking the breakpoint-response handler updates the effective presentation without a real resize', async () => {
  const el = (await fixture(html`<lyra-responsive-panel open>body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  await el.updateComplete;
  let panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute('role'), 'starts inline on a wide test viewport').to.be.false;

  asAny(el).handleBreakpointChange(true);
  await el.updateComplete;
  panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');

  asAny(el).handleBreakpointChange(false);
  await el.updateComplete;
  panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.hasAttribute('role')).to.be.false;
});

it('emits lyra-mode-change with the new effective mode when the breakpoint is crossed, but not on initial render', async () => {
  const el = (await fixture(html`<lyra-responsive-panel open>body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  await el.updateComplete;
  let fired = false;
  el.addEventListener('lyra-mode-change', () => (fired = true));

  const listener = oneEvent(el, 'lyra-mode-change');
  asAny(el).handleBreakpointChange(true);
  const event = await listener;
  expect(fired).to.be.true;
  expect((event.detail as ResponsivePanelModeChangeDetail).mode).to.equal('overlay');
});

it('does not emit lyra-mode-change when the breakpoint state is reported without actually changing the effective mode', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="inline" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  let count = 0;
  el.addEventListener('lyra-mode-change', () => count++);

  asAny(el).handleBreakpointChange(true); // mode is forced inline, so this can't change the effective mode
  await el.updateComplete;

  expect(count).to.equal(0);
});

it('a live breakpoint crossing while already open in overlay mode engages scroll-lock/focus-trap without closing the content', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel open><button>inside</button></lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  expect(el.open, 'stays open through the transition').to.be.true;
  expect(document.documentElement.style.overflow).to.equal('');

  asAny(el).handleBreakpointChange(true);
  await el.updateComplete;

  expect(el.open).to.be.true;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(document.documentElement.style.overflow).to.equal('hidden');

  // Crossing back releases it again.
  asAny(el).handleBreakpointChange(false);
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('moves outside focus into the panel when a breakpoint crossing makes it modal', async () => {
  const outside = document.createElement('button');
  outside.textContent = 'outside';
  document.body.appendChild(outside);
  outside.focus();

  const el = (await fixture(
    html`<lyra-responsive-panel mode="inline" open><button>inside</button></lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  await el.updateComplete;

  el.mode = 'auto';
  asAny(el).handleBreakpointChange(true);
  await el.updateComplete;

  expect(document.activeElement?.textContent).to.equal('inside');
  outside.remove();
});

it('preserves panel focus when an open overlay becomes inline', async () => {
  const outside = document.createElement('button');
  outside.textContent = 'outside';
  document.body.appendChild(outside);
  outside.focus();

  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open><button>inside</button></lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  expect(document.activeElement?.textContent).to.equal('inside');

  el.mode = 'inline';
  await el.updateComplete;

  expect(document.activeElement?.textContent).to.equal('inside');
  outside.remove();
});

it('closes on backdrop click and emits lyra-close with reason "backdrop"', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  const listener = oneEvent(el, 'lyra-close');
  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  const event = await listener;

  expect(el.open).to.be.false;
  expect(event.detail).to.equal('backdrop');
});

it('closes on Escape and emits lyra-close with reason "escape"', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  const listener = oneEvent(el, 'lyra-close');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  const event = await listener;

  expect(el.open).to.be.false;
  expect(event.detail).to.equal('escape');
});

it('does not respond to Escape while inline (no document keydown trap is wired up)', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="inline" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  let fired = false;
  el.addEventListener('lyra-close', () => (fired = true));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(fired).to.be.false;
  expect(el.open).to.be.true;
});

it('close() fires lyra-close with reason "api" in the inline presentation too (documented single-event simplification)', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="inline" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  const listener = oneEvent(el, 'lyra-close');
  el.close();
  const event = await listener;

  expect(el.open).to.be.false;
  expect(event.detail).to.equal('api');
});

it('close() is a no-op when already closed (no duplicate event, no error)', async () => {
  const el = (await fixture(html`<lyra-responsive-panel mode="overlay">body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  let count = 0;
  el.addEventListener('lyra-close', () => count++);

  el.close();
  el.close();
  await el.updateComplete;

  expect(count).to.equal(0);
});

it('a plain open = false property write does not fire lyra-close', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open>body</lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  let fired = false;
  el.addEventListener('lyra-close', () => (fired = true));

  el.open = false;
  await el.updateComplete;

  expect(fired).to.be.false;
});

it('locks document scroll while open in the overlay presentation and releases it on close', async () => {
  const el = (await fixture(html`<lyra-responsive-panel mode="overlay">body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.close();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('does not lock document scroll for the inline presentation', async () => {
  const el = (await fixture(html`<lyra-responsive-panel mode="inline">body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('releases the scroll lock on disconnect while open in the overlay presentation', async () => {
  const el = (await fixture(html`<lyra-responsive-panel mode="overlay" open>body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.remove();

  expect(document.documentElement.style.overflow).to.equal('');
});

it('restores the scroll lock and keydown trap when reparented while still open in the overlay presentation', async () => {
  const el = (await fixture(html`<lyra-responsive-panel mode="overlay" open>body</lyra-responsive-panel>`)) as LyraResponsivePanel;
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

it('moves focus into the panel to the first focusable element when opened in the overlay presentation', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay"><button>first</button><button>second</button></lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  const first = el.querySelector('button') as HTMLButtonElement;

  el.open = true;
  await el.updateComplete;

  expect(document.activeElement).to.equal(first);
});

it('does not move focus for the inline presentation when opened', async () => {
  const outside = document.createElement('button');
  outside.textContent = 'outside';
  document.body.appendChild(outside);
  outside.focus();

  const el = (await fixture(
    html`<lyra-responsive-panel mode="inline"><button>inside</button></lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  el.open = true;
  await el.updateComplete;

  expect(document.activeElement).to.equal(outside);
  outside.remove();
});

it('traps Tab focus inside the panel while overlay chrome is active, wrapping last->first and first->last', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open
      ><button>first</button
      ><div slot="footer"><button>last</button></div></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const first = el.querySelector('button') as HTMLButtonElement;
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

it('traps Tab/Shift+Tab at a slotted element whose focusable target lives in its own shadow root', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open
      ><responsive-panel-test-shadow-input></responsive-panel-test-shadow-input
      ><div slot="footer"><button>last</button></div></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const shadowHost = el.querySelector('responsive-panel-test-shadow-input') as ResponsivePanelTestShadowInput;
  const input = shadowHost.shadowRoot!.querySelector('input') as HTMLInputElement;
  const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;

  expect(shadowHost.shadowRoot!.activeElement).to.equal(input);

  const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(shiftTab);
  expect(shiftTab.defaultPrevented).to.be.true;
  expect(document.activeElement).to.equal(last);
});

it('hides the header/footer wrappers when nothing is slotted into them, shows them once slotted', async () => {
  const el = (await fixture(html`<lyra-responsive-panel mode="inline" open>body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.true;
  expect(footer.hasAttribute('hidden')).to.be.true;

  const h = document.createElement('span');
  h.slot = 'header';
  el.appendChild(h);
  el.shadowRoot!.querySelector('slot[name="header"]')!.dispatchEvent(new Event('slotchange'));
  const f = document.createElement('span');
  f.slot = 'footer';
  el.appendChild(f);
  el.shadowRoot!.querySelector('slot[name="footer"]')!.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(header.hasAttribute('hidden')).to.be.false;
  expect(footer.hasAttribute('hidden')).to.be.false;
});

it('renders the header/footer wrappers visible on first paint when content is present before upgrade', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="inline" open
      ><span slot="header">Title</span>body<span slot="footer">OK</span></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.false;
  expect(footer.hasAttribute('hidden')).to.be.false;
});

it('reflects the variant attribute', async () => {
  const el = (await fixture(html`<lyra-responsive-panel variant="bottom-sheet">body</lyra-responsive-panel>`)) as LyraResponsivePanel;
  expect(el.getAttribute('variant')).to.equal('bottom-sheet');
});

it('is accessible while closed (empty/default state)', async () => {
  const el = (await fixture(html`<lyra-responsive-panel></lyra-responsive-panel>`)) as LyraResponsivePanel;
  await expect(el).to.be.accessible();
});

it('is accessible while open in the inline presentation with header/body/footer content', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="inline" open
      ><span slot="header">Filters</span>
      <p>Filter controls go here.</p>
      <div slot="footer"><button>Apply</button></div></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while open in the overlay presentation with a label', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open label="Conversation history"
      ><p>History items go here.</p>
      <div slot="footer"><button>Close</button></div></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('falls back to the header slot content as aria-label when label is unset', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open
      ><span slot="header">Filters</span>
      <p>Filter controls go here.</p></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-label')).to.equal('Filters');
});

it('prefers a heading element within the header slot over its full text when both are present', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open
      ><h2 slot="header">Filters</h2
      ><button slot="header">Reset</button>
      <p>Filter controls go here.</p></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-label')).to.equal('Filters');
});

it('prefers an explicit label over the header slot fallback', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open label="Explicit label"
      ><span slot="header">Header text</span></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-label')).to.equal('Explicit label');
});

it('is accessible while open in the overlay presentation with header-slot content but no label', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" open
      ><span slot="header">Conversation history</span>
      <p>History items go here.</p>
      <div slot="footer"><button>Close</button></div></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('captures lastTrigger only on a genuine open transition, so it survives a later breakpoint crossing into overlay and close() returns focus to the true original trigger (not something focused inside the panel meanwhile)', async () => {
  const outsideTrigger = document.createElement('button');
  outsideTrigger.textContent = 'outside trigger';
  document.body.appendChild(outsideTrigger);
  outsideTrigger.focus();

  const el = (await fixture(
    html`<lyra-responsive-panel mode="inline" open><button id="inside">inside</button></lyra-responsive-panel>`,
  )) as LyraResponsivePanel;
  await el.updateComplete;

  // The user then interacts with something inside the (currently inline/docked) panel.
  const inside = el.querySelector('#inside') as HTMLButtonElement;
  inside.focus();

  // Crossing into overlay while still open must not re-capture "inside" as
  // the trigger, even though the overlay-chrome-engage branch fires here.
  el.mode = 'auto';
  (el as any).handleBreakpointChange(true);
  await el.updateComplete;
  expect(el.open, 'stays open through the transition').to.be.true;

  el.close('escape');
  await el.updateComplete;

  expect(document.activeElement).to.equal(outsideTrigger);
  outsideTrigger.remove();
});

it('is accessible while open in the bottom-sheet overlay variant', async () => {
  const el = (await fixture(
    html`<lyra-responsive-panel mode="overlay" variant="bottom-sheet" open label="Actions"
      ><button>Share</button></lyra-responsive-panel
    >`,
  )) as LyraResponsivePanel;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
