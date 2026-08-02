import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './dialog.js';
import type { LyraDialog } from './dialog.js';
import { styles } from './dialog.styles.js';
import { setAnimation } from '../../../utilities/animation-registry.js';

it('includes safe-area insets in the fixed dialog frame', () => {
  expect(styles.cssText).to.include('var(--lr-safe-area-top)');
  expect(styles.cssText).to.include('var(--lr-safe-area-bottom)');
  expect(styles.cssText).to.include('var(--lr-safe-area-inline-start)');
  expect(styles.cssText).to.include('var(--lr-safe-area-inline-end)');
});

// A stand-in for a slotted component (e.g. lr-combobox) whose real
// focusable target lives inside its own shadow root rather than the host
// tag's light-DOM subtree. Mirrors lr-widget's identical test fixture,
// under a distinct tag name so both test files can register their own copy
// in the same browser context.
class DialogTestShadowInput extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'text';
    root.appendChild(input);
  }
}
customElements.define('dialog-test-shadow-input', DialogTestShadowInput);

it('renders closed by default, with no role/aria-modal on the panel', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(panel.hasAttribute('role')).to.be.false;
  expect(panel.hasAttribute('aria-modal')).to.be.false;
});

it('reflects the pinned Web Awesome label property', async () => {
  const el = (await fixture(html`<lr-dialog>body</lr-dialog>`)) as LyraDialog;
  el.label = 'Account settings';
  await el.updateComplete;
  expect(el.getAttribute('label')).to.equal('Account settings');
});

it('reflects open as an attribute and sets dialog semantics once open', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
  el.open = true;
  await el.updateComplete;

  expect(el.hasAttribute('open')).to.be.true;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
});

it('closes on backdrop click and emits lr-dialog-close with reason "backdrop"', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" open light-dismiss>body</lr-dialog>`)) as LyraDialog;
  let detail: unknown;
  el.addEventListener('lr-dialog-close', (e) => (detail = (e as CustomEvent).detail));

  (el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('backdrop');
});

it('closes on Escape and emits lr-dialog-close with reason "escape"', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
  let detail: unknown;
  el.addEventListener('lr-dialog-close', (e) => (detail = (e as CustomEvent).detail));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('escape');
});

it('does not respond to Escape while closed', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
  let fired = false;
  el.addEventListener('lr-dialog-close', () => (fired = true));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(fired).to.be.false;
});

it('close() is a no-op when already closed (no duplicate event, no error)', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
  let count = 0;
  el.addEventListener('lr-dialog-close', () => count++);

  el.close('api');
  el.close('api');
  await el.updateComplete;

  expect(count).to.equal(0);
});

it('close() sets open false, emits with the given reason, and is idempotent once closed', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
  let count = 0;
  let detail: unknown;
  el.addEventListener('lr-dialog-close', (e) => {
    count++;
    detail = (e as CustomEvent).detail;
  });

  el.close('save');
  el.close('save');
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(count).to.equal(1);
  expect(detail).to.equal('save');
});

it('moves focus into the panel to the first focusable element when opened', async () => {
  const el = (await fixture(
    html`<lr-dialog label="Untitled" closable="false"><button>first</button><button>second</button></lr-dialog>`,
  )) as LyraDialog;
  const first = el.querySelector('button') as HTMLButtonElement;
  let initialFocusEvents = 0;
  el.addEventListener('lr-initial-focus', () => initialFocusEvents++);

  el.open = true;
  await el.updateComplete;

  // The focusable elements are light-DOM slot content, so the focused node
  // reads directly off `document.activeElement` -- unlike lr-widget's own
  // shadow-DOM buttons, there's no shadow-root indirection here.
  expect(document.activeElement).to.equal(first);
  expect(initialFocusEvents).to.equal(1);
});

it('focuses the panel itself as a fallback when there is nothing focusable', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" closable="false"><p>no controls</p></lr-dialog>`)) as LyraDialog;
  el.open = true;
  await el.updateComplete;

  // Compares a part name/tag, not the live DOM nodes directly -- a direct `.to.equal()` between
  // two DOM nodes serializes both sides via structuredClone if the assertion ever fails, which
  // throws on a DOM node and silently drops the failure message, hanging the whole test session
  // until the 180s watchdog kills it (see AGENTS.md's testing-conventions digest).
  const active = el.shadowRoot!.activeElement;
  expect(active?.tagName).to.equal('DIV');
  expect(active?.getAttribute('part')?.split(/\s+/)).to.include('panel');
});

it('returns focus to the element that was focused before the dialog opened', async () => {
  const trigger = document.createElement('button');
  trigger.textContent = 'open';
  document.body.appendChild(trigger);
  trigger.focus();

  const el = (await fixture(html`<lr-dialog label="Untitled" closable="false"><button>inside</button></lr-dialog>`)) as LyraDialog;
  const inside = el.querySelector('button') as HTMLButtonElement;
  el.open = true;
  await el.updateComplete;
  expect(document.activeElement).to.equal(inside);

  el.close('api');
  await el.updateComplete;
  expect(document.activeElement).to.equal(trigger);

  trigger.remove();
});

it('locks document scroll while open and releases it on close', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.close('api');
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('releases the scroll lock on disconnect while open', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.remove();

  expect(document.documentElement.style.overflow).to.equal('');
});

it('does not acquire scroll lock or Escape ownership when opened while detached', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
  const parent = el.parentElement!;
  el.remove();
  el.open = true;
  await el.updateComplete;

  expect(document.documentElement.style.overflow).to.equal('');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;
  expect(el.open, 'a detached dialog must not own global Escape').to.be.true;

  parent.append(el);
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('restores the scroll lock and keydown trap when reparented while still open', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
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

it('re-activates an open dialog when reconnecting without an existing overlay handle', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  (el as unknown as { overlay?: unknown }).overlay = undefined;

  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  otherContainer.appendChild(el);
  await el.updateComplete;

  expect(document.documentElement.style.overflow).to.equal('hidden');
  el.close('api');
  await el.updateComplete;
  otherContainer.remove();
});

it('traps Tab focus inside the panel, wrapping last->first and first->last', async () => {
  const el = (await fixture(
    html`<lr-dialog label="Untitled" closable="false" open
      ><button>first</button
      ><div slot="footer"><button>last</button></div></lr-dialog
    >`,
  )) as LyraDialog;
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

it('prevents Tab from doing anything when there is nothing focusable', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" closable="false" open><p>no controls</p></lr-dialog>`)) as LyraDialog;
  await el.updateComplete;

  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tab);

  expect(tab.defaultPrevented).to.be.true;
});

it('does not intercept a forward Tab press that is not leaving the last focusable element', async () => {
  const el = (await fixture(
    html`<lr-dialog label="Untitled" closable="false" open><button>a</button><button>b</button></lr-dialog>`,
  )) as LyraDialog;
  await el.updateComplete;
  const a = el.querySelectorAll('button')[0];
  a.focus();

  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tab);

  expect(tab.defaultPrevented).to.be.false;
});

it('traps Tab/Shift+Tab at a slotted element whose focusable target lives in its own shadow root', async () => {
  const el = (await fixture(
    html`<lr-dialog label="Untitled" closable="false" open
      ><dialog-test-shadow-input></dialog-test-shadow-input
      ><div slot="footer"><button>last</button></div></lr-dialog
    >`,
  )) as LyraDialog;
  await el.updateComplete;
  const shadowHost = el.querySelector('dialog-test-shadow-input') as DialogTestShadowInput;
  const input = shadowHost.shadowRoot!.querySelector('input') as HTMLInputElement;
  const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;

  expect(
    shadowHost.shadowRoot!.activeElement,
    'the shadow input should be the first focusable element, focused automatically on open',
  ).to.equal(input);

  // Shift+Tab from the first focusable must wrap to the last.
  const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(shiftTab);
  expect(shiftTab.defaultPrevented).to.be.true;
  expect(document.activeElement).to.equal(last);

  // Tab from the last focusable must wrap back to the shadow input.
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  expect(tabForward.defaultPrevented).to.be.true;
  expect(shadowHost.shadowRoot!.activeElement).to.equal(input);
});

it('renders the mapped label prop visibly and uses it for aria-labelledby', async () => {
  const el = (await fixture(html`<lr-dialog label="Delete item?">body</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  const labelledby = panel.getAttribute('aria-labelledby');
  expect(labelledby).to.exist;
  const labelEl = el.shadowRoot!.getElementById(labelledby!);
  expect(labelEl!.textContent).to.equal('Delete item?');
  expect(labelEl!.getAttribute('part')?.split(/\s+/)).to.include.members(['heading', 'title']);
  expect(getComputedStyle(labelEl!).display).to.not.equal('none');
});

it('prefers a slotted heading over the label prop, using aria-label (not aria-labelledby) for it', async () => {
  const el = (await fixture(
    html`<lr-dialog label="ignored"><h2>Real heading</h2></lr-dialog>`,
  )) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;

  // aria-label (a plain string), not aria-labelledby -- the heading is
  // light-DOM content and [part~="panel"] is in the shadow tree, so an
  // ID-reference attribute can't resolve across that boundary.
  expect(panel.getAttribute('aria-label')).to.equal('Real heading');
  expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  // The label prop's own sr-only element must not be rendered once a heading wins.
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
});

it('re-detects a heading added after the initial render via slotchange', async () => {
  const el = (await fixture(html`<lr-dialog label="fallback">body</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  let panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part~="title"]')!.id);

  const heading = document.createElement('h3');
  heading.textContent = 'Added later';
  el.insertBefore(heading, el.firstChild);
  el.shadowRoot!.querySelector('slot:not([name])')!.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-label')).to.equal('Added later');
  expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
});

it('keeps the dialog name synchronized when an already-slotted heading text node changes', async () => {
  const el = (await fixture(
    html`<lr-dialog open><h2>Original heading</h2><p>Body</p></lr-dialog>`,
  )) as LyraDialog;
  const heading = el.querySelector('h2') as HTMLHeadingElement;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-label')).to.equal('Original heading');

  heading.firstChild!.textContent = 'Updated heading';
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;

  expect(panel.getAttribute('aria-label')).to.equal('Updated heading');
});

it('renders a visible header with the heading text and uses it for aria-labelledby when no heading is slotted', async () => {
  const el = (await fixture(html`<lr-dialog heading="Title">body</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  const headingEl = el.shadowRoot!.querySelector('[part~="heading"]') as HTMLElement;

  expect(headingEl).to.exist;
  expect(headingEl.textContent).to.equal('Title');
  const labelledby = panel.getAttribute('aria-labelledby');
  expect(labelledby).to.exist;
  expect(el.shadowRoot!.getElementById(labelledby!)).to.equal(headingEl);
  expect(panel.hasAttribute('aria-label')).to.be.false;
  // Only one element should ever claim aria-labelledby -- the sr-only label
  // element must not also render once `heading` wins.
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
});

it('a slotted heading still wins over `heading` when both are present', async () => {
  const el = (await fixture(
    html`<lr-dialog heading="ignored"><h2>Real heading</h2></lr-dialog>`,
  )) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;

  expect(panel.getAttribute('aria-label')).to.equal('Real heading');
  expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part~="heading"]')).to.not.exist;
});

it('a consumer-slotted heading keeps working completely unchanged when `heading` is left unset', async () => {
  const el = (await fixture(html`<lr-dialog closable="false"><h2>Real heading</h2></lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;

  expect(panel.getAttribute('aria-label')).to.equal('Real heading');
  expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
});

describe('aria-label host attribute (ARIA-name forwarding)', () => {
  it('wins over the label prop -- previously silently ignored', async () => {
    const el = (await fixture(
      html`<lr-dialog label="Delete item?" aria-label="Custom name">body</lr-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;

    expect(panel.getAttribute('aria-label')).to.equal('Custom name');
    expect(panel.hasAttribute('aria-labelledby')).to.be.false;
    // The label prop's own sr-only element must not render once aria-label wins.
    expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
  });

  it('wins over the heading prop for naming without suppressing its visible header chrome', async () => {
    const el = (await fixture(
      html`<lr-dialog heading="Title" aria-label="Custom name">body</lr-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;

    expect(panel.getAttribute('aria-label')).to.equal('Custom name');
    expect(panel.hasAttribute('aria-labelledby')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part~="heading"]')?.textContent).to.equal('Title');
  });

  it('wins even over a slotted heading', async () => {
    const el = (await fixture(
      html`<lr-dialog aria-label="Custom name"><h2>Real heading</h2></lr-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;

    expect(panel.getAttribute('aria-label')).to.equal('Custom name');
    expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  });

  it("leaves today's 3-tier precedence untouched when aria-label is left unset (regression)", async () => {
    const el = (await fixture(html`<lr-dialog label="Delete item?">body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    expect(panel.hasAttribute('aria-label')).to.be.false;
    expect(panel.getAttribute('aria-labelledby')).to.exist;
  });

  it('is accessible with only a host aria-label attribute set (no label/heading props)', async () => {
    const el = (await fixture(
      html`<lr-dialog aria-label="Delete item?" open>Are you sure?</lr-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

it('renders the mapped visible label and close affordance by default', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part~="heading"]')?.textContent).to.equal('Untitled');
  expect(el.shadowRoot!.querySelector('[part~="close-button"]')).to.exist;
});

it('renders a close button when closable is set, which closes the dialog via the same close() path as Escape/backdrop', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" open closable>body</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  let detail: unknown;
  el.addEventListener('lr-dialog-close', (e) => (detail = (e as CustomEvent).detail));

  const closeButton = el.shadowRoot!.querySelector('[part~="close-button"]') as HTMLButtonElement;
  expect(closeButton).to.exist;
  closeButton.click();
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('close-button');
});

it('renders a header row containing just the close button when no visible title is set', async () => {
  const el = (await fixture(
    html`<lr-dialog accessible-label="Untitled" closable>body</lr-dialog>`,
  )) as LyraDialog;
  await el.updateComplete;
  const header = el.shadowRoot!.querySelector('[part="header"]');
  expect(header).to.exist;
  expect(header!.querySelector('[part~="heading"]')).to.not.exist;
  expect(header!.querySelector('[part~="close-button"]')).to.exist;
});

it('defaults --lr-dialog-max-width\'s effect to 32rem, overridable via the CSS custom property on the host', async () => {
  // `open` so the panel is actually part of the render tree: WebKit doesn't
  // recompute custom-property-dependent values inside a `display: none`
  // subtree after the property changes, even after forcing layout.
  const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  // getComputedStyle resolves rem to px, so compare against the root font
  // size rather than a literal "32rem" string.
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  expect(getComputedStyle(panel).maxInlineSize).to.equal(`min(${32 * remPx}px, 100%)`);

  el.style.setProperty('--lr-dialog-max-width', '60rem');
  await el.updateComplete;
  expect(getComputedStyle(panel).maxInlineSize).to.equal(`min(${60 * remPx}px, 100%)`);
});

it('hides the footer wrapper when nothing is slotted into it, shows it once slotted', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(footer.hasAttribute('hidden')).to.be.true;

  const button = document.createElement('button');
  button.slot = 'footer';
  el.appendChild(button);
  el.shadowRoot!.querySelector('slot[name="footer"]')!.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(footer.hasAttribute('hidden')).to.be.false;
});

it('renders the footer wrapper visible on first paint when footer content is present before upgrade', async () => {
  const el = (await fixture(
    html`<lr-dialog label="Untitled"><button slot="footer">OK</button>body</lr-dialog>`,
  )) as LyraDialog;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(footer.hasAttribute('hidden')).to.be.false;
});

it('is accessible while closed', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
  await expect(el).to.be.accessible();
});

it('is accessible while open with a label prop and footer actions', async () => {
  const el = (await fixture(
    html`<lr-dialog label="Delete item?" open
      >Are you sure?
      <div slot="footer"><button>Cancel</button><button>Delete</button></div></lr-dialog
    >`,
  )) as LyraDialog;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while open with a slotted heading', async () => {
  const el = (await fixture(
    html`<lr-dialog open><h2>Delete item?</h2><p>Are you sure?</p></lr-dialog>`,
  )) as LyraDialog;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while open with a heading, closable close button, and footer actions', async () => {
  // Populated-state axe check: the header row and the icon-only close button only exist in
  // this state, so an axe pass on the default render proves nothing about them. Assert the
  // populated chrome actually rendered before running axe, so the test can't silently pass
  // against a fixture that never reached the intended state.
  const el = (await fixture(
    html`<lr-dialog heading="Delete item?" open closable
      >Are you sure?
      <div slot="footer"><button>Cancel</button><button>Delete</button></div></lr-dialog
    >`,
  )) as LyraDialog;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part~="close-button"]')).to.exist;
  await expect(el).to.be.accessible();
});

describe('stacked dialogs', () => {
  it('closes only the topmost dialog on Escape, leaving dialogs beneath it open', async () => {
    const bottom = (await fixture(html`<lr-dialog label="Bottom" open>bottom body</lr-dialog>`)) as LyraDialog;
    const top = (await fixture(html`<lr-dialog label="Top" open>top body</lr-dialog>`)) as LyraDialog;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await bottom.updateComplete;
    await top.updateComplete;

    expect(top.open, 'the topmost dialog should close').to.be.false;
    expect(bottom.open, 'the dialog beneath it should remain open').to.be.true;

    bottom.close('api');
    await bottom.updateComplete;
  });

  it('closes the new topmost dialog on a second Escape once the original topmost is gone', async () => {
    const bottom = (await fixture(html`<lr-dialog label="Bottom" open>bottom body</lr-dialog>`)) as LyraDialog;
    const top = (await fixture(html`<lr-dialog label="Top" open>top body</lr-dialog>`)) as LyraDialog;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await bottom.updateComplete;
    await top.updateComplete;
    expect(top.open).to.be.false;
    expect(bottom.open).to.be.true;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await bottom.updateComplete;
    expect(bottom.open, 'now-topmost dialog should close on the next Escape').to.be.false;
  });

  it('does not swallow Tab for the topmost dialog when a dialog beneath it has no focusable content', async () => {
    const bottom = (await fixture(html`<lr-dialog label="Bottom" open><p>no controls</p></lr-dialog>`)) as LyraDialog;
    const top = (await fixture(
      html`<lr-dialog label="Top" open
        ><button>first</button><button>middle</button><button>last</button></lr-dialog
      >`,
    )) as LyraDialog;
    await top.updateComplete;

    // Focus a middle button -- neither wrap branch in top's own handler
    // should fire, so the only way defaultPrevented ends up true is if the
    // non-topmost (bottom) dialog's zero-focusable early-return wrongly swallows it.
    const middle = top.querySelectorAll('button')[1];
    middle.focus();

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tab);

    expect(tab.defaultPrevented, 'a non-topmost dialog with no focusable content must not swallow Tab').to.be.false;

    top.close('api');
    bottom.close('api');
    await top.updateComplete;
    await bottom.updateComplete;
  });
});

describe('lightDismiss', () => {
  it('a backdrop click dismisses when set', async () => {
    const el = (await fixture(html`<lr-dialog light-dismiss open>Body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const backdrop = el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement;
    backdrop.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  // Opt-in, matching `wa-dialog`. The attribute used to be `no-light-dismiss`, whose default left
  // backdrop dismissal ON -- a mechanical `wa-` -> `lr-` rename therefore flipped the behaviour
  // silently, which is worse than not renaming at all.
  it('a backdrop click does nothing by default', async () => {
    const el = (await fixture(html`<lr-dialog open>Body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    expect(el.lightDismiss).to.be.false;
    const backdrop = el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement;
    backdrop.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
  });
});

describe('close() respects preventDefault()', () => {
  it('a lr-dialog-close listener calling preventDefault() stops the dialog from closing, for every close path', async () => {
    const el = (await fixture(html`<lr-dialog open closable>Body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    el.addEventListener('lr-dialog-close', (e) => e.preventDefault());

    // Escape.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;
    expect(el.open).to.be.true;

    // Close button.
    (el.shadowRoot!.querySelector('[part~="close-button"]') as HTMLElement).click();
    await el.updateComplete;
    expect(el.open).to.be.true;

    // Backdrop.
    (el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement).click();
    await el.updateComplete;
    expect(el.open).to.be.true;

    // A consumer's own close() call.
    el.close('api');
    await el.updateComplete;
    expect(el.open).to.be.true;
  });

  it('close() still closes normally when nothing calls preventDefault() (regression)', async () => {
    const el = (await fixture(html`<lr-dialog open>Body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    el.close('api');
    expect(el.open).to.be.false;
  });

  it('lr-dialog-close is cancelable', async () => {
    const el = (await fixture(html`<lr-dialog open>Body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-dialog-close');
    el.close('api');
    const event = await listener;
    expect((event as Event).cancelable).to.be.true;
  });
});

describe('external removal while open', () => {
  it('emits lr-dialog-close with reason "unmount" when removed from the DOM without calling close()', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
    let detail: unknown;
    let count = 0;
    el.addEventListener('lr-dialog-close', (e) => {
      count++;
      detail = (e as CustomEvent).detail;
    });

    el.remove();
    // The emit is deferred a microtask so a synchronous reparent (disconnect
    // immediately followed by reconnect) isn't mistaken for a real removal.
    await Promise.resolve();
    await Promise.resolve();

    expect(count).to.equal(1);
    expect(detail).to.equal('unmount');
    expect(el.open).to.be.false;
  });

  it('does not emit lr-dialog-close on a synchronous reparent while still open', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
    let count = 0;
    el.addEventListener('lr-dialog-close', () => count++);

    const otherContainer = document.createElement('div');
    document.body.appendChild(otherContainer);
    otherContainer.appendChild(el); // disconnect + reconnect synchronously, same instance

    await Promise.resolve();
    await Promise.resolve();

    expect(count, 'a reparent must not be mistaken for a real removal').to.equal(0);
    expect(el.open).to.be.true;

    el.close('api');
    await el.updateComplete;
    otherContainer.remove();
  });
});

it('lets a consumer set an assertive width via --lr-dialog-width, not just a cap', async () => {
  const el = (await fixture(html`<lr-dialog open>short</lr-dialog>`)) as LyraDialog;
  // 600px: comfortably under the test runner's fixed 800px-wide iframe (minus the
  // host's own inline padding) so this exercises the assertive-width path itself,
  // not the separate 100%-viewport safety clamp asserted by the test below.
  el.style.setProperty('--lr-dialog-width', '600px');
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  expect(getComputedStyle(panel).inlineSize).to.equal('600px');
});

it("leaves today's shrink-to-fit-content behavior unchanged when --lr-dialog-width is unset", async () => {
  const el = (await fixture(html`<lr-dialog open>short</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  expect(getComputedStyle(panel).inlineSize).to.not.equal('600px');
});

describe('unified show/hide lifecycle', () => {
  it('emits lr-show before the dialog opens, then lr-after-show once the enter animation finishes', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    const order: string[] = [];
    let openWhenShowFired: boolean | undefined;
    el.addEventListener('lr-show', () => {
      order.push('lr-show');
      openWhenShowFired = el.open;
    });
    el.addEventListener('lr-after-show', () => order.push('lr-after-show'));

    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    expect(el.open, 'show() opens synchronously once lr-show is not vetoed').to.be.true;
    await afterShow;

    expect(order).to.deep.equal(['lr-show', 'lr-after-show']);
    expect(openWhenShowFired, 'lr-show announces an impending open, not a completed one').to.be.false;
    el.close('api');
  });

  it('emits lr-hide before the dialog closes, then lr-after-hide once the exit animation finishes', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const order: string[] = [];
    let openWhenHideFired: boolean | undefined;
    el.addEventListener('lr-hide', () => {
      order.push('lr-hide');
      openWhenHideFired = el.open;
    });
    el.addEventListener('lr-dialog-close', () => order.push('lr-dialog-close'));
    el.addEventListener('lr-after-hide', () => order.push('lr-after-hide'));

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect(el.open).to.be.false;
    await afterHide;

    expect(order).to.deep.equal(['lr-hide', 'lr-dialog-close', 'lr-after-hide']);
    expect(openWhenHideFired, 'lr-hide announces an impending close').to.be.true;
  });

  it('lr-show is cancelable and a veto leaves both the property and the attribute closed', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    let cancelable: boolean | undefined;
    el.addEventListener('lr-show', (event) => {
      cancelable = (event as Event).cancelable;
      (event as Event).preventDefault();
    });

    el.show();
    await el.updateComplete;

    expect(cancelable).to.be.true;
    expect(el.open).to.be.false;
    expect(el.hasAttribute('open')).to.be.false;
    expect(document.documentElement.style.overflow).to.equal('');
  });

  it('lr-hide is cancelable and a veto keeps the dialog open for every close path', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled" open closable>body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    let closeCount = 0;
    el.addEventListener('lr-dialog-close', () => closeCount++);
    el.addEventListener('lr-hide', (event) => (event as Event).preventDefault());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;
    expect(el.open, 'Escape').to.be.true;

    (el.shadowRoot!.querySelector('[part~="close-button"]') as HTMLElement).click();
    await el.updateComplete;
    expect(el.open, 'close button').to.be.true;

    el.hide();
    await el.updateComplete;
    expect(el.open, 'hide()').to.be.true;

    el.open = false;
    await el.updateComplete;
    expect(el.open, 'open = false').to.be.true;
    expect(el.hasAttribute('open'), 'the reflected attribute must not drift from the vetoed state').to.be.true;
    expect(closeCount, 'a vetoed lr-hide never reaches lr-dialog-close').to.equal(0);

    el.removeEventListener('lr-hide', () => undefined);
  });

  it('assigning open drives the same lifecycle as show()/hide()', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    const shown = oneEvent(el, 'lr-show');
    el.open = true;
    await shown;
    expect(el.open).to.be.true;

    const hidden = oneEvent(el, 'lr-hide');
    el.open = false;
    await hidden;
    expect(el.open).to.be.false;
  });

  it('fires no lifecycle events for markup that renders open from the start', async () => {
    let fired = 0;
    const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      el.addEventListener(name, () => fired++);
    }
    await el.updateComplete;
    expect(fired).to.equal(0);
    expect(el.open).to.be.true;
    el.close('api');
  });

  it('lr-after-show and lr-after-hide are not cancelable', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    const shown = oneEvent(el, 'lr-after-show');
    el.show();
    expect((await shown).cancelable).to.be.false;
    const hidden = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect((await hidden).cancelable).to.be.false;
  });

  it('show()/hide() are no-ops in the state they already represent', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    let count = 0;
    for (const name of ['lr-show', 'lr-hide']) el.addEventListener(name, () => count++);
    el.hide();
    expect(count).to.equal(0);
    el.show();
    expect(count).to.equal(1);
    el.show();
    expect(count).to.equal(1);
  });
});

describe('top layer', () => {
  it('promotes an open dialog into the browser top layer, so a consumer stacking context cannot trap it', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    expect(CSS.supports('selector(:popover-open)'), 'this browser must support the popover top layer').to.be.true;
    expect(el.matches(':popover-open')).to.be.false;

    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await el.updateComplete;
    expect(el.getAttribute('popover'), 'manual, so the UA never light-dismisses it out from under us').to.equal(
      'manual',
    );
    expect(el.matches(':popover-open'), 'an open dialog is in the top layer').to.be.true;
    await afterShow;

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.close('api');
    await afterHide;
    expect(el.matches(':popover-open'), 'a closed dialog leaves the top layer').to.be.false;
  });

  it('renders above a consumer stacking context that would otherwise trap a z-index overlay', async () => {
    const frame = (await fixture(html`
      <div>
        <div id="trap" style="position: relative; z-index: 2147483647; isolation: isolate;">
          <div id="blocker" style="position: absolute; inset: 0; background: red;"></div>
        </div>
        <lr-dialog label="Untitled" light-dismiss><button>inside</button></lr-dialog>
      </div>
    `)) as HTMLElement;
    const el = frame.querySelector('lr-dialog') as LyraDialog;
    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await afterShow;

    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const box = panel.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    // elementFromPoint reports the deepest light-DOM element, which for slotted dialog content is
    // the slotted node itself -- so the assertion is "the hit landed inside the dialog", not
    // "the hit is the host". Comparing an id/containment keeps a DOM node out of chai's actual.
    expect(hit?.id, 'the trapping stacking context must not be on top').to.not.equal('blocker');
    expect(hit !== null && (hit === el || el.contains(hit)), 'the hit landed inside the dialog').to.be.true;
    el.close('api');
  });

  it('re-promotes an open dialog after a reparent', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const otherContainer = document.createElement('div');
    document.body.appendChild(otherContainer);
    otherContainer.appendChild(el);
    await el.updateComplete;

    expect(el.matches(':popover-open')).to.be.true;
    el.close('api');
    await el.updateComplete;
    otherContainer.remove();
  });
});

describe('initial focus', () => {
  it('honours [autofocus] on slotted content instead of the first focusable element', async () => {
    const el = (await fixture(
      html`<lr-dialog label="Untitled"><button>first</button><button autofocus>second</button></lr-dialog>`,
    )) as LyraDialog;
    el.show();
    await el.updateComplete;

    expect((document.activeElement as HTMLElement | null)?.textContent).to.equal('second');
    el.close('api');
  });

  it('reaches an [autofocus] target inside a slotted element own shadow root', async () => {
    const el = (await fixture(
      html`<lr-dialog label="Untitled"
        ><button>first</button><dialog-test-shadow-input autofocus></dialog-test-shadow-input></lr-dialog
      >`,
    )) as LyraDialog;
    el.show();
    await el.updateComplete;

    const host = el.querySelector('dialog-test-shadow-input') as HTMLElement;
    expect(host.shadowRoot!.activeElement?.tagName).to.equal('INPUT');
    el.close('api');
  });

  it('falls back to the first focusable element when nothing is marked (regression)', async () => {
    const el = (await fixture(
      html`<lr-dialog label="Untitled"><button>first</button><button>second</button></lr-dialog>`,
    )) as LyraDialog;
    el.show();
    await el.updateComplete;

    expect((document.activeElement as HTMLElement | null)?.textContent).to.equal('first');
    el.close('api');
  });
});

const animationDuration = (target: HTMLElement, id: string): number | undefined => {
  const animation = target.getAnimations().find((candidate) => candidate.id === id);
  const duration = animation?.effect?.getTiming().duration;
  return typeof duration === 'number' ? duration : undefined;
};

describe('enter/exit animation', () => {
  it('animates the panel and the backdrop from the motion tokens on open and on close', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const backdrop = el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement;

    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await el.updateComplete;
    expect(panel.getAnimations().length, 'the panel runs an enter animation').to.be.greaterThan(0);
    expect(backdrop.getAnimations().length, 'the backdrop runs an enter animation').to.be.greaterThan(0);
    await afterShow;

    el.close('api');
    await el.updateComplete;
    expect(panel.getAnimations().length, 'the panel runs an exit animation').to.be.greaterThan(0);
    expect(
      getComputedStyle(el).display,
      'the host stays rendered until the exit animation completes',
    ).to.not.equal('none');
    await oneEvent(el, 'lr-after-hide');
    expect(getComputedStyle(el).display, 'the host is hidden once the exit animation completes').to.equal('none');
  });

  it('exposes per-surface duration knobs', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const backdrop = el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement;

    el.style.setProperty('--lr-dialog-panel-duration', '400ms');
    el.style.setProperty('--lr-dialog-backdrop-duration', '250ms');
    const shown = el.show();
    await el.updateComplete;
    expect(animationDuration(panel, 'dialog.show')).to.equal(400);
    expect(animationDuration(backdrop, 'dialog.overlay.show')).to.equal(250);
    await shown;
    await el.close('api');
  });

  // prefers-reduced-motion cannot be emulated from inside the test runner, so the reduced-motion
  // branch is exercised by writing exactly what the reduced-motion block in tokens.styles.ts
  // writes -- the duration tokens the animation resolves through.
  it('flattens to the reduced-motion duration and still completes both lifecycles', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    el.style.setProperty('--lr-duration-base', '0.001ms');
    el.style.setProperty('--lr-duration-fast', '0.001ms');
    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    await afterShow;

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.close('api');
    await afterHide;
    expect(el.open).to.be.false;
  });

  it('resolves per-dialog panel/backdrop overrides and keeps the after-event before promise settlement', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled">body</lr-dialog>`)) as LyraDialog;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const releasePanel = setAnimation(el, 'dialog.show', {
      keyframes: [{ opacity: 0.15 }, { opacity: 0.85 }],
      options: { duration: 10_000 },
    });
    const releaseBackdrop = setAnimation(el, 'dialog.overlay.show', null);
    const releasePanelHide = setAnimation(el, 'dialog.hide', null);
    const releaseBackdropHide = setAnimation(el, 'dialog.overlay.hide', null);
    const order: string[] = [];
    el.addEventListener('lr-after-show', () => order.push('after-show'));
    el.addEventListener('lr-after-hide', () => order.push('after-hide'));
    try {
      const shown = el.show().then(() => order.push('show-promise'));
      await el.updateComplete;
      const animation = panel.getAnimations().find((candidate) => candidate.id === 'dialog.show');
      expect(animation?.id).to.equal('dialog.show');
      expect(String(animation?.effect?.getKeyframes()[0]?.opacity)).to.equal('0.15');
      animation?.finish();
      await shown;

      await el.hide().then(() => order.push('hide-promise'));
      expect(order).to.deep.equal(['after-show', 'show-promise', 'after-hide', 'hide-promise']);
    } finally {
      releaseBackdropHide();
      releasePanelHide();
      releaseBackdrop();
      releasePanel();
    }
  });
});

describe('header chrome', () => {
  it('renders the label slot in the header and names the panel from it', async () => {
    const el = (await fixture(
      html`<lr-dialog open><span slot="label">Rich <em>title</em></span>body</lr-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const heading = el.shadowRoot!.querySelector('[part~="heading"]') as HTMLElement;

    expect(el.shadowRoot!.querySelectorAll('[part="header"]').length).to.equal(1);
    expect(heading.querySelector('slot[name="label"]')).to.exist;
    expect(panel.getAttribute('aria-labelledby')).to.equal(heading.id);
    el.close('api');
  });

  it('renders the header-actions slot before the close button', async () => {
    const el = (await fixture(
      html`<lr-dialog heading="Title" closable open
        ><button slot="header-actions">Help</button>body</lr-dialog
      >`,
    )) as LyraDialog;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const actions = el.shadowRoot!.querySelector('[part="header-actions"]') as HTMLElement;
    const closeButton = el.shadowRoot!.querySelector('[part~="close-button"]') as HTMLElement;

    expect(actions).to.exist;
    expect(
      actions.compareDocumentPosition(closeButton) & Node.DOCUMENT_POSITION_FOLLOWING,
      'header-actions come before the close button',
    ).to.be.greaterThan(0);
    expect(header.contains(actions)).to.be.true;
    el.close('api');
  });

  it('withoutHeader suppresses the header row even when heading/closable/label-slot are set', async () => {
    const el = (await fixture(
      html`<lr-dialog heading="Title" closable without-header open
        ><span slot="label">Rich</span>body</lr-dialog
      >`,
    )) as LyraDialog;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="header"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part~="close-button"]').length).to.equal(0);
    el.close('api');
  });

  it('uses the mapped title and close chrome when opt-outs are unset', async () => {
    const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    expect(el.withoutHeader).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="header"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part~="close-button"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="header-actions"]').length).to.equal(0);
    el.close('api');
  });

  it('lets a consumer retheme region padding and the backdrop filter', async () => {
    const el = (await fixture(html`<lr-dialog heading="Title" open>body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const backdrop = el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement;

    el.style.setProperty('--lr-dialog-spacing', '31px');
    el.style.setProperty('--lr-dialog-backdrop-filter', 'blur(3px)');
    await el.updateComplete;
    expect(getComputedStyle(body).paddingTop).to.equal('31px');
    expect(getComputedStyle(backdrop).backdropFilter).to.equal('blur(3px)');
    el.close('api');
  });

  it('is accessible with the label and header-actions slots populated', async () => {
    const el = (await fixture(
      html`<lr-dialog open closable
        ><span slot="label">Delete item?</span><button slot="header-actions">Help</button>Are you
        sure?</lr-dialog
      >`,
    )) as LyraDialog;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="header-actions"]').length).to.equal(1);
    await expect(el).to.be.accessible();
    el.close('api');
  });
});

describe('mapped dialog compatibility', () => {
  it('keeps accessible-only naming separate from the visible label', async () => {
    const el = (await fixture(
      html`<lr-dialog open label="Visible title" accessible-label="Announced dialog">Body</lr-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    expect(el.shadowRoot!.querySelector('[part~="title"]')?.textContent).to.equal('Visible title');
    expect(panel.getAttribute('aria-label')).to.equal('Announced dialog');
    expect(panel.hasAttribute('aria-labelledby')).to.equal(false);
    await expect(el).to.be.accessible();
  });

  it('supports no-header and an explicit false value for the true-default close affordance', async () => {
    const noHeader = (await fixture(
      html`<lr-dialog open label="Title" no-header>Body</lr-dialog>`,
    )) as LyraDialog;
    expect(noHeader.shadowRoot!.querySelector('[part="header"]')).to.equal(null);

    const noClose = (await fixture(
      html`<lr-dialog open label="Title" closable="false">Body</lr-dialog>`,
    )) as LyraDialog;
    expect(noClose.closable).to.equal(false);
    expect(noClose.shadowRoot!.querySelector('[part~="close-button"]')).to.equal(null);
    expect(noClose.shadowRoot!.querySelector('[part="header"]')).to.exist;
  });

  it('uses with-footer as an SSR visibility hint without requiring assigned content', async () => {
    const el = (await fixture(html`<lr-dialog label="Title" with-footer>Body</lr-dialog>`)) as LyraDialog;
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(footer.hidden).to.equal(false);
  });

  it('returns promises after the matching after-events for show, hide, and close', async () => {
    const el = (await fixture(html`<lr-dialog label="Title">Body</lr-dialog>`)) as LyraDialog;
    el.style.setProperty('--show-duration', '0.001ms');
    el.style.setProperty('--hide-duration', '0.001ms');
    const order: string[] = [];
    el.addEventListener('lr-after-show', () => order.push('after-show'));
    el.addEventListener('lr-after-hide', () => order.push('after-hide'));
    await el.show().then(() => order.push('show-promise'));
    await el.hide().then(() => order.push('hide-promise'));
    await el.show();
    await el.close('done').then(() => order.push('close-promise'));
    expect(order.slice(0, 4)).to.deep.equal(['after-show', 'show-promise', 'after-hide', 'hide-promise']);
    expect(order.at(-2)).to.equal('after-hide');
    expect(order.at(-1)).to.equal('close-promise');
  });

  it('applies the mapped width, backdrop, spacing, and duration properties', async () => {
    const el = (await fixture(html`
      <lr-dialog
        open
        label="Title"
        style="--width: 400px; --backdrop-filter: blur(1px); --spacing: 17px; --header-spacing: 11px; --body-spacing: 12px; --footer-spacing: 13px; --show-duration: 1ms; --hide-duration: 2ms"
      >
        Body
        <button slot="footer">Done</button>
      </lr-dialog>
    `)) as LyraDialog;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    const backdrop = el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(panel.getBoundingClientRect().width).to.be.closeTo(400, 1);
    expect(getComputedStyle(backdrop).backdropFilter).to.equal('blur(1px)');
    expect(getComputedStyle(header).paddingTop).to.equal('11px');
    expect(getComputedStyle(body).paddingTop).to.equal('12px');
    expect(getComputedStyle(footer).paddingTop).to.equal('13px');
    await el.hide();

    // WebKit does not reliably invalidate a shadow descendant's padding shorthand when an
    // inherited custom property is removed at runtime. Verify the shared fallback on a fresh
    // instance so this remains a rendered-style assertion in every supported engine.
    const fallbackEl = (await fixture(html`
      <lr-dialog label="Fallback spacing" style="--spacing: 17px">
        Body
        <button slot="footer">Done</button>
      </lr-dialog>
    `)) as LyraDialog;
    const fallbackHeader = fallbackEl.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const fallbackBody = fallbackEl.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const fallbackFooter = fallbackEl.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(getComputedStyle(fallbackHeader).paddingTop).to.equal('17px');
    expect(getComputedStyle(fallbackBody).paddingTop).to.equal('17px');
    expect(getComputedStyle(fallbackFooter).paddingTop).to.equal('17px');

    const afterShow = oneEvent(el, 'lr-after-show');
    void el.show();
    await el.updateComplete;
    expect(animationDuration(panel, 'dialog.show')).to.equal(1);
    await afterShow;
    void el.hide();
    await el.updateComplete;
    expect(animationDuration(panel, 'dialog.hide')).to.equal(2);
  });

  it('lets lr-initial-focus veto automatic focus movement', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="dialog-focus-outside">Outside</button>
        <lr-dialog label="Title"><button id="dialog-focus-inside">Inside</button></lr-dialog>
      </div>
    `);
    const outside = wrapper.querySelector('#dialog-focus-outside') as HTMLButtonElement;
    outside.focus();
    const el = wrapper.querySelector('lr-dialog') as LyraDialog;
    let cancelable = false;
    let eventCount = 0;
    el.addEventListener('lr-initial-focus', (event) => {
      eventCount++;
      cancelable = event.cancelable;
      event.preventDefault();
    });
    void el.show();
    await el.updateComplete;
    const started = performance.now();
    while (eventCount === 0) {
      if (performance.now() - started > 2000) throw new Error('Timed out waiting for lr-initial-focus');
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    expect(cancelable).to.equal(true);
    expect(eventCount).to.equal(1);
    expect((document.activeElement as HTMLElement | null)?.id).to.not.equal('dialog-focus-inside');
  });

  it('defers lr-initial-focus while CSS-hidden and emits it once when rendered', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="display: none">
        <lr-dialog label="Title" closable="false"><button id="hidden-dialog-target">Inside</button></lr-dialog>
      </div>
    `);
    const el = wrapper.querySelector('lr-dialog') as LyraDialog;
    let eventCount = 0;
    el.addEventListener('lr-initial-focus', () => eventCount++);

    void el.show();
    await el.updateComplete;
    expect(eventCount).to.equal(0);

    wrapper.style.display = '';
    const started = performance.now();
    while (eventCount === 0) {
      if (performance.now() - started > 2000) throw new Error('Timed out waiting for lr-initial-focus');
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    expect(eventCount).to.equal(1);
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('hidden-dialog-target');
  });

  it('does not repeat lr-initial-focus during a synchronous reconnect', async () => {
    const el = (await fixture(
      html`<lr-dialog label="Title" closable="false"><button id="reconnected-dialog-target">Inside</button></lr-dialog>`,
    )) as LyraDialog;
    let eventCount = 0;
    el.addEventListener('lr-initial-focus', () => eventCount++);
    void el.show();
    await el.updateComplete;
    expect(eventCount).to.equal(1);

    const destination = document.createElement('div');
    document.body.append(destination);
    destination.append(el);
    await Promise.resolve();
    expect(eventCount).to.equal(1);

    await el.hide();
    destination.remove();
  });

  it('emits cancelable request-close sources before user-driven close', async () => {
    const el = (await fixture(html`<lr-dialog open label="Title" light-dismiss>Body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const sources: string[] = [];
    const hideSourceParts: string[][] = [];
    const vetoOverlay = (event: Event): void => {
      const detail = (event as CustomEvent<{ source: string }>).detail;
      sources.push(detail.source);
      if (detail.source === 'overlay') event.preventDefault();
    };
    el.addEventListener('lr-request-close', vetoOverlay);
    el.addEventListener('lr-hide', (event) => {
      const source = (event as CustomEvent<{ source: Element }>).detail.source;
      hideSourceParts.push((source.getAttribute('part') ?? source.localName).split(/\s+/));
    });

    (el.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement).click();
    await el.updateComplete;
    expect(el.open).to.equal(true);

    (el.shadowRoot!.querySelector('[part~="close-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.open).to.equal(false);
    expect(sources).to.deep.equal(['overlay', 'close-button']);
    expect(hideSourceParts).to.deep.equal([['close-button', 'close-button__base']]);
  });

  it('exposes modal activateExternal/deactivateExternal compatibility', async () => {
    const el = (await fixture(html`<lr-dialog open label="Title">Body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    el.modal.activateExternal();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.open).to.equal(true);
    el.modal.deactivateExternal();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.open).to.equal(false);
  });

  it('keeps the mapped modal controller field writable', async () => {
    const el = (await fixture(html`<lr-dialog label="Title">Body</lr-dialog>`)) as LyraDialog;
    const replacement = { activateExternal: () => undefined, deactivateExternal: () => undefined };
    el.modal = replacement;
    expect(el.modal).to.equal(replacement);
  });

  it('publishes mapped aliases on the functional part nodes', async () => {
    const el = (await fixture(html`<lr-dialog open label="Title">Body</lr-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const panelParts = el.shadowRoot!.querySelector('[part~="panel"]')!.getAttribute('part')!.split(/\s+/);
    const backdropParts = el.shadowRoot!.querySelector('[part~="backdrop"]')!.getAttribute('part')!.split(/\s+/);
    const closeParts = el.shadowRoot!.querySelector('[part~="close-button"]')!.getAttribute('part')!.split(/\s+/);
    expect(el.shadowRoot!.querySelector('[part~="base"]')).to.exist;
    expect(panelParts).to.include.members(['panel', 'dialog']);
    expect(backdropParts).to.include.members(['backdrop', 'overlay']);
    expect(closeParts).to.include.members(['close-button', 'close-button__base']);
  });
});

// --- dark-mode panel separation -----------------------------------------------------
//
// A modal panel cannot share the page surface token in dark mode: both resolve to the same
// near-black, so an open dialog reads as a scrim with text floating on it and no panel at all.
// The panel therefore paints --lr-color-surface-overlay, which dark mode moves off the page
// surface. Both colours are read back at runtime from the component's own scope -- a hardcoded
// literal here would assert the generated palette instead of this component's token wiring.

let darkThemeSheetPromise: Promise<CSSStyleSheet> | undefined;

function loadThemeSheet(): Promise<CSSStyleSheet> {
  darkThemeSheetPromise ??= fetch(new URL('../../../theme.css', import.meta.url))
    .then((response) => response.text())
    .then((text) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      return sheet;
    });
  return darkThemeSheetPromise;
}

async function withThemeCss<T>(run: () => Promise<T>): Promise<T> {
  const sheet = await loadThemeSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  try {
    return await run();
  } finally {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((adopted) => adopted !== sheet);
  }
}

// Custom properties resolve to their authored syntax (#1a1a1a), while backgroundColor resolves to
// rgb(). Round-tripping the token value through a real element normalizes both into the same space
// so the two colour STRINGS are actually comparable.
function toComputedColor(rawTokenValue: string): string {
  const probe = document.createElement('div');
  probe.style.backgroundColor = rawTokenValue;
  document.body.append(probe);
  try {
    return getComputedStyle(probe).backgroundColor;
  } finally {
    probe.remove();
  }
}

it('paints its panel a surface distinct from the page surface in dark mode', async () => {
  await withThemeCss(async () => {
    const wrapper = (await fixture(
      html`<div class="lr-dark"><lr-dialog label="Untitled" open>body</lr-dialog></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-dialog') as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;

    const pageSurface = toComputedColor(getComputedStyle(el).getPropertyValue('--lr-color-surface').trim());
    const overlaySurface = toComputedColor(
      getComputedStyle(el).getPropertyValue('--lr-color-surface-overlay').trim(),
    );
    const panelBackground = getComputedStyle(panel).backgroundColor;

    // Guards a mistyped token name resolving to the empty string, which would make every
    // comparison below vacuous.
    expect(pageSurface, 'page surface resolved').to.match(/^rgba?\(/);
    expect(overlaySurface, 'overlay surface resolved').to.match(/^rgba?\(/);
    expect(overlaySurface, 'dark mode moves the overlay surface off the page surface').to.not.equal(pageSurface);

    expect(panelBackground).to.equal(overlaySurface);
    expect(panelBackground).to.not.equal(pageSurface);
    el.close('api');
  });
});

// Same normalization trick as toComputedColor, for the elevation scale: a shadow token expands to
// a length triple plus an rgb(), while computed boxShadow reorders it and resolves the colour.
function toComputedShadow(rawTokenValue: string): string {
  const probe = document.createElement('div');
  probe.style.boxShadow = rawTokenValue;
  document.body.append(probe);
  try {
    return getComputedStyle(probe).boxShadow;
  } finally {
    probe.remove();
  }
}

it('elevates its panel at the modal tier, not the default anchored-overlay one', async () => {
  const el = (await fixture(html`<lr-dialog label="Untitled" open>body</lr-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  const scope = getComputedStyle(el);

  const modalTier = toComputedShadow(scope.getPropertyValue('--lr-shadow-xl').trim());
  const defaultTier = toComputedShadow(scope.getPropertyValue('--lr-shadow').trim());

  expect(modalTier, 'the xl step resolved').to.not.equal('none');
  expect(modalTier, 'the modal tier is a distinct step from the default').to.not.equal(defaultTier);
  expect(getComputedStyle(panel).boxShadow).to.equal(modalTier);
  el.close('api');
});
