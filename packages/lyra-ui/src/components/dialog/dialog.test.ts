import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './dialog.js';
import type { LyraDialog } from './dialog.js';
import { styles } from './dialog.styles.js';

it('includes safe-area insets in the fixed dialog frame', () => {
  expect(styles.cssText).to.include('var(--lyra-safe-area-top)');
  expect(styles.cssText).to.include('var(--lyra-safe-area-bottom)');
  expect(styles.cssText).to.include('var(--lyra-safe-area-inline-start)');
  expect(styles.cssText).to.include('var(--lyra-safe-area-inline-end)');
});

// A stand-in for a slotted component (e.g. lyra-combobox) whose real
// focusable target lives inside its own shadow root rather than the host
// tag's light-DOM subtree. Mirrors lyra-widget's identical test fixture,
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
  const el = (await fixture(html`<lyra-dialog label="Untitled">body</lyra-dialog>`)) as LyraDialog;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(panel.hasAttribute('role')).to.be.false;
  expect(panel.hasAttribute('aria-modal')).to.be.false;
});

it('reflects open as an attribute and sets dialog semantics once open', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled">body</lyra-dialog>`)) as LyraDialog;
  el.open = true;
  await el.updateComplete;

  expect(el.hasAttribute('open')).to.be.true;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
});

it('closes on backdrop click and emits lyra-dialog-close with reason "backdrop"', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled" open>body</lyra-dialog>`)) as LyraDialog;
  let detail: unknown;
  el.addEventListener('lyra-dialog-close', (e) => (detail = (e as CustomEvent).detail));

  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('backdrop');
});

it('closes on Escape and emits lyra-dialog-close with reason "escape"', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled" open>body</lyra-dialog>`)) as LyraDialog;
  let detail: unknown;
  el.addEventListener('lyra-dialog-close', (e) => (detail = (e as CustomEvent).detail));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('escape');
});

it('does not respond to Escape while closed', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled">body</lyra-dialog>`)) as LyraDialog;
  let fired = false;
  el.addEventListener('lyra-dialog-close', () => (fired = true));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(fired).to.be.false;
});

it('close() is a no-op when already closed (no duplicate event, no error)', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled">body</lyra-dialog>`)) as LyraDialog;
  let count = 0;
  el.addEventListener('lyra-dialog-close', () => count++);

  el.close('api');
  el.close('api');
  await el.updateComplete;

  expect(count).to.equal(0);
});

it('close() sets open false, emits with the given reason, and is idempotent once closed', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled" open>body</lyra-dialog>`)) as LyraDialog;
  let count = 0;
  let detail: unknown;
  el.addEventListener('lyra-dialog-close', (e) => {
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
    html`<lyra-dialog label="Untitled"><button>first</button><button>second</button></lyra-dialog>`,
  )) as LyraDialog;
  const first = el.querySelector('button') as HTMLButtonElement;

  el.open = true;
  await el.updateComplete;

  // The focusable elements are light-DOM slot content, so the focused node
  // reads directly off `document.activeElement` -- unlike lyra-widget's own
  // shadow-DOM buttons, there's no shadow-root indirection here.
  expect(document.activeElement).to.equal(first);
});

it('focuses the panel itself as a fallback when there is nothing focusable', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled"><p>no controls</p></lyra-dialog>`)) as LyraDialog;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="panel"]'));
});

it('returns focus to the element that was focused before the dialog opened', async () => {
  const trigger = document.createElement('button');
  trigger.textContent = 'open';
  document.body.appendChild(trigger);
  trigger.focus();

  const el = (await fixture(html`<lyra-dialog label="Untitled"><button>inside</button></lyra-dialog>`)) as LyraDialog;
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
  const el = (await fixture(html`<lyra-dialog label="Untitled">body</lyra-dialog>`)) as LyraDialog;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.close('api');
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('releases the scroll lock on disconnect while open', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled" open>body</lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.remove();

  expect(document.documentElement.style.overflow).to.equal('');
});

it('restores the scroll lock and keydown trap when reparented while still open', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled" open>body</lyra-dialog>`)) as LyraDialog;
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

it('traps Tab focus inside the panel, wrapping last->first and first->last', async () => {
  const el = (await fixture(
    html`<lyra-dialog label="Untitled" open
      ><button>first</button
      ><div slot="footer"><button>last</button></div></lyra-dialog
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
  const el = (await fixture(html`<lyra-dialog label="Untitled" open><p>no controls</p></lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;

  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tab);

  expect(tab.defaultPrevented).to.be.true;
});

it('does not intercept a forward Tab press that is not leaving the last focusable element', async () => {
  const el = (await fixture(
    html`<lyra-dialog label="Untitled" open><button>a</button><button>b</button></lyra-dialog>`,
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
    html`<lyra-dialog label="Untitled" open
      ><dialog-test-shadow-input></dialog-test-shadow-input
      ><div slot="footer"><button>last</button></div></lyra-dialog
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

it('uses the label prop for aria-labelledby via an invisible element when no heading is slotted', async () => {
  const el = (await fixture(html`<lyra-dialog label="Delete item?">body</lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  const labelledby = panel.getAttribute('aria-labelledby');
  expect(labelledby).to.exist;
  const labelEl = el.shadowRoot!.getElementById(labelledby!);
  expect(labelEl!.textContent).to.equal('Delete item?');
  expect(labelEl!.getAttribute('part')).to.equal('label');
});

it('prefers a slotted heading over the label prop, using aria-label (not aria-labelledby) for it', async () => {
  const el = (await fixture(
    html`<lyra-dialog label="ignored"><h2>Real heading</h2></lyra-dialog>`,
  )) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

  // aria-label (a plain string), not aria-labelledby -- the heading is
  // light-DOM content and [part="panel"] is in the shadow tree, so an
  // ID-reference attribute can't resolve across that boundary.
  expect(panel.getAttribute('aria-label')).to.equal('Real heading');
  expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  // The label prop's own sr-only element must not be rendered once a heading wins.
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
});

it('re-detects a heading added after the initial render via slotchange', async () => {
  const el = (await fixture(html`<lyra-dialog label="fallback">body</lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  let panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="label"]')!.id);

  const heading = document.createElement('h3');
  heading.textContent = 'Added later';
  el.insertBefore(heading, el.firstChild);
  el.shadowRoot!.querySelector('slot:not([name])')!.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-label')).to.equal('Added later');
  expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
});

it('renders a visible header with the heading text and uses it for aria-labelledby when no heading is slotted', async () => {
  const el = (await fixture(html`<lyra-dialog heading="Title">body</lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  const headingEl = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;

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
    html`<lyra-dialog heading="ignored"><h2>Real heading</h2></lyra-dialog>`,
  )) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

  expect(panel.getAttribute('aria-label')).to.equal('Real heading');
  expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="heading"]')).to.not.exist;
});

it('a consumer-slotted heading keeps working completely unchanged when `heading` is left unset', async () => {
  const el = (await fixture(html`<lyra-dialog><h2>Real heading</h2></lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

  expect(panel.getAttribute('aria-label')).to.equal('Real heading');
  expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
});

describe('aria-label host attribute (ARIA-name forwarding)', () => {
  it('wins over the label prop -- previously silently ignored', async () => {
    const el = (await fixture(
      html`<lyra-dialog label="Delete item?" aria-label="Custom name">body</lyra-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

    expect(panel.getAttribute('aria-label')).to.equal('Custom name');
    expect(panel.hasAttribute('aria-labelledby')).to.be.false;
    // The label prop's own sr-only element must not render once aria-label wins.
    expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
  });

  it('wins over the heading prop, including its visible header chrome', async () => {
    const el = (await fixture(
      html`<lyra-dialog heading="Title" aria-label="Custom name">body</lyra-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

    expect(panel.getAttribute('aria-label')).to.equal('Custom name');
    expect(panel.hasAttribute('aria-labelledby')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="heading"]')).to.not.exist;
  });

  it('wins even over a slotted heading', async () => {
    const el = (await fixture(
      html`<lyra-dialog aria-label="Custom name"><h2>Real heading</h2></lyra-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

    expect(panel.getAttribute('aria-label')).to.equal('Custom name');
    expect(panel.hasAttribute('aria-labelledby')).to.be.false;
  });

  it("leaves today's 3-tier precedence untouched when aria-label is left unset (regression)", async () => {
    const el = (await fixture(html`<lyra-dialog label="Delete item?">body</lyra-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    expect(panel.hasAttribute('aria-label')).to.be.false;
    expect(panel.getAttribute('aria-labelledby')).to.exist;
  });

  it('is accessible with only a host aria-label attribute set (no label/heading props)', async () => {
    const el = (await fixture(
      html`<lyra-dialog aria-label="Delete item?" open>Are you sure?</lyra-dialog>`,
    )) as LyraDialog;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

it('renders no header row at all when both `heading` and `closable` are unset (default)', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled">body</lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
});

it('renders a close button when closable is set, which closes the dialog via the same close() path as Escape/backdrop', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled" open closable>body</lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  let detail: unknown;
  el.addEventListener('lyra-dialog-close', (e) => (detail = (e as CustomEvent).detail));

  const closeButton = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  expect(closeButton).to.exist;
  closeButton.click();
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('close-button');
});

it('renders a header row containing just the close button when closable is set but heading is unset', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled" closable>body</lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const header = el.shadowRoot!.querySelector('[part="header"]');
  expect(header).to.exist;
  expect(header!.querySelector('[part="heading"]')).to.not.exist;
  expect(header!.querySelector('[part="close-button"]')).to.exist;
});

it('defaults --lyra-dialog-max-width\'s effect to 32rem, overridable via the CSS custom property on the host', async () => {
  // `open` so the panel is actually part of the render tree: WebKit doesn't
  // recompute custom-property-dependent values inside a `display: none`
  // subtree after the property changes, even after forcing layout.
  const el = (await fixture(html`<lyra-dialog label="Untitled" open>body</lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  // getComputedStyle resolves rem to px, so compare against the root font
  // size rather than a literal "32rem" string.
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  expect(getComputedStyle(panel).maxInlineSize).to.equal(`min(${32 * remPx}px, 100%)`);

  el.style.setProperty('--lyra-dialog-max-width', '60rem');
  await el.updateComplete;
  expect(getComputedStyle(panel).maxInlineSize).to.equal(`min(${60 * remPx}px, 100%)`);
});

it('hides the footer wrapper when nothing is slotted into it, shows it once slotted', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled">body</lyra-dialog>`)) as LyraDialog;
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
    html`<lyra-dialog label="Untitled"><button slot="footer">OK</button>body</lyra-dialog>`,
  )) as LyraDialog;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(footer.hasAttribute('hidden')).to.be.false;
});

it('is accessible while closed', async () => {
  const el = (await fixture(html`<lyra-dialog label="Untitled">body</lyra-dialog>`)) as LyraDialog;
  await expect(el).to.be.accessible();
});

it('is accessible while open with a label prop and footer actions', async () => {
  const el = (await fixture(
    html`<lyra-dialog label="Delete item?" open
      >Are you sure?
      <div slot="footer"><button>Cancel</button><button>Delete</button></div></lyra-dialog
    >`,
  )) as LyraDialog;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while open with a slotted heading', async () => {
  const el = (await fixture(
    html`<lyra-dialog open><h2>Delete item?</h2><p>Are you sure?</p></lyra-dialog>`,
  )) as LyraDialog;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

describe('stacked dialogs', () => {
  it('closes only the topmost dialog on Escape, leaving dialogs beneath it open', async () => {
    const bottom = (await fixture(html`<lyra-dialog label="Bottom" open>bottom body</lyra-dialog>`)) as LyraDialog;
    const top = (await fixture(html`<lyra-dialog label="Top" open>top body</lyra-dialog>`)) as LyraDialog;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await bottom.updateComplete;
    await top.updateComplete;

    expect(top.open, 'the topmost dialog should close').to.be.false;
    expect(bottom.open, 'the dialog beneath it should remain open').to.be.true;

    bottom.close('api');
    await bottom.updateComplete;
  });

  it('closes the new topmost dialog on a second Escape once the original topmost is gone', async () => {
    const bottom = (await fixture(html`<lyra-dialog label="Bottom" open>bottom body</lyra-dialog>`)) as LyraDialog;
    const top = (await fixture(html`<lyra-dialog label="Top" open>top body</lyra-dialog>`)) as LyraDialog;

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
    const bottom = (await fixture(html`<lyra-dialog label="Bottom" open><p>no controls</p></lyra-dialog>`)) as LyraDialog;
    const top = (await fixture(
      html`<lyra-dialog label="Top" open
        ><button>first</button><button>middle</button><button>last</button></lyra-dialog
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

describe('noLightDismiss', () => {
  it('a backdrop click does nothing when true', async () => {
    const el = (await fixture(html`<lyra-dialog no-light-dismiss open>Body</lyra-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const backdrop = el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement;
    backdrop.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
  });

  it('a backdrop click still dismisses when false (default, regression)', async () => {
    const el = (await fixture(html`<lyra-dialog open>Body</lyra-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const backdrop = el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement;
    backdrop.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});

describe('close() respects preventDefault()', () => {
  it('a lyra-dialog-close listener calling preventDefault() stops the dialog from closing, for every close path', async () => {
    const el = (await fixture(html`<lyra-dialog open closable>Body</lyra-dialog>`)) as LyraDialog;
    await el.updateComplete;
    el.addEventListener('lyra-dialog-close', (e) => e.preventDefault());

    // Escape.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;
    expect(el.open).to.be.true;

    // Close button.
    (el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement).click();
    await el.updateComplete;
    expect(el.open).to.be.true;

    // Backdrop.
    (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
    await el.updateComplete;
    expect(el.open).to.be.true;

    // A consumer's own close() call.
    el.close('api');
    await el.updateComplete;
    expect(el.open).to.be.true;
  });

  it('close() still closes normally when nothing calls preventDefault() (regression)', async () => {
    const el = (await fixture(html`<lyra-dialog open>Body</lyra-dialog>`)) as LyraDialog;
    await el.updateComplete;
    el.close('api');
    expect(el.open).to.be.false;
  });

  it('lyra-dialog-close is cancelable', async () => {
    const el = (await fixture(html`<lyra-dialog open>Body</lyra-dialog>`)) as LyraDialog;
    await el.updateComplete;
    const listener = oneEvent(el, 'lyra-dialog-close');
    el.close('api');
    const event = await listener;
    expect((event as Event).cancelable).to.be.true;
  });
});

describe('external removal while open', () => {
  it('emits lyra-dialog-close with reason "unmount" when removed from the DOM without calling close()', async () => {
    const el = (await fixture(html`<lyra-dialog label="Untitled" open>body</lyra-dialog>`)) as LyraDialog;
    let detail: unknown;
    let count = 0;
    el.addEventListener('lyra-dialog-close', (e) => {
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

  it('does not emit lyra-dialog-close on a synchronous reparent while still open', async () => {
    const el = (await fixture(html`<lyra-dialog label="Untitled" open>body</lyra-dialog>`)) as LyraDialog;
    let count = 0;
    el.addEventListener('lyra-dialog-close', () => count++);

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

it('lets a consumer set an assertive width via --lyra-dialog-width, not just a cap', async () => {
  const el = (await fixture(html`<lyra-dialog open>short</lyra-dialog>`)) as LyraDialog;
  // 600px: comfortably under the test runner's fixed 800px-wide iframe (minus the
  // host's own inline padding) so this exercises the assertive-width path itself,
  // not the separate 100%-viewport safety clamp asserted by the test below.
  el.style.setProperty('--lyra-dialog-width', '600px');
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(getComputedStyle(panel).inlineSize).to.equal('600px');
});

it("leaves today's shrink-to-fit-content behavior unchanged when --lyra-dialog-width is unset", async () => {
  const el = (await fixture(html`<lyra-dialog open>short</lyra-dialog>`)) as LyraDialog;
  await el.updateComplete;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(getComputedStyle(panel).inlineSize).to.not.equal('600px');
});
