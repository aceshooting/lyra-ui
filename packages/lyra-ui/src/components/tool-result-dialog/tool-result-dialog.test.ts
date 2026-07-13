import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './tool-result-dialog.js';
import type { LyraToolResultDialog } from './tool-result-dialog.js';

// A stand-in for a slotted component (e.g. lyra-tabs) whose real focusable
// target lives inside its own shadow root rather than the host tag's
// light-DOM subtree. Mirrors lyra-dialog's/lyra-widget's identical test
// fixture, under a distinct tag name so every test file can register its
// own copy in the same browser context.
class ToolResultDialogTestShadowInput extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'text';
    root.appendChild(input);
  }
}
customElements.define('tool-result-dialog-test-shadow-input', ToolResultDialogTestShadowInput);

it('renders closed by default, with no role/aria-modal on the panel', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(panel.hasAttribute('role')).to.be.false;
  expect(panel.hasAttribute('aria-modal')).to.be.false;
});

it('reflects open as an attribute and sets dialog semantics once open', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  el.open = true;
  await el.updateComplete;

  expect(el.hasAttribute('open')).to.be.true;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="tool-name"]')!.id);
});

it('defaults to pending status and reflects status changes onto the host attribute', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  expect(el.status).to.equal('pending');
  expect(el.getAttribute('status')).to.equal('pending');

  el.status = 'error';
  await el.updateComplete;
  expect(el.getAttribute('status')).to.equal('error');
});

it('renders the tool name, falling back to "Tool call" when unset', async () => {
  const withName = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  expect(withName.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('run_python');

  const withoutName = (await fixture(html`<lyra-tool-result-dialog></lyra-tool-result-dialog>`)) as LyraToolResultDialog;
  expect(withoutName.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('Tool call');
});

it('shows a visible status label for every status value, not just a color', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" status="denied"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.include('Denied');
});

it('falls back to a pending badge instead of throwing for an out-of-union status attribute', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" status="bogus"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  expect(el.status).to.equal('pending');
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.include('Pending');
});

it('falls back to a pending badge instead of throwing when status is assigned an out-of-union value directly', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  el.status = 'bogus' as LyraToolResultDialog['status'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.include('Pending');
});

it('omits the duration part entirely when duration-ms is unset', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  expect(el.shadowRoot!.querySelector('[part="duration"]')).to.not.exist;
});

it('formats sub-second durations in milliseconds and second-plus durations in seconds', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" duration-ms="820"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  expect(el.shadowRoot!.querySelector('[part="duration"]')!.textContent).to.equal('820ms');

  el.durationMs = 1500;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="duration"]')!.textContent).to.equal('1.5s');

  el.durationMs = 2000;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="duration"]')!.textContent).to.equal('2s');
});

it('toggles maximized and emits lyra-maximize-change when the maximize button is clicked', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  await el.updateComplete;
  expect(el.maximized).to.be.false;

  const listener = oneEvent(el, 'lyra-maximize-change');
  (el.shadowRoot!.querySelector('[part="maximize-button"]') as HTMLElement).click();
  const { detail } = await listener;

  expect(detail).to.be.true;
  expect(el.maximized).to.be.true;
  expect(el.hasAttribute('maximized')).to.be.true;
});

it('closes on backdrop click and emits lyra-dialog-close with reason "backdrop"', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  const listener = oneEvent(el, 'lyra-dialog-close');
  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  const { detail } = await listener;

  expect(el.open).to.be.false;
  expect(detail).to.equal('backdrop');
});

it('closes on the built-in close button and emits lyra-dialog-close with reason "close-button"', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  const listener = oneEvent(el, 'lyra-dialog-close');
  (el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement).click();
  const { detail } = await listener;

  expect(el.open).to.be.false;
  expect(detail).to.equal('close-button');
});

it('closes on Escape and emits lyra-dialog-close with reason "escape"', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  const listener = oneEvent(el, 'lyra-dialog-close');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  const { detail } = await listener;

  expect(el.open).to.be.false;
  expect(detail).to.equal('escape');
});

it('does not respond to Escape while closed', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  let fired = false;
  el.addEventListener('lyra-dialog-close', () => (fired = true));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(fired).to.be.false;
});

it('close() is a no-op when already closed (no duplicate event, no error)', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  let count = 0;
  el.addEventListener('lyra-dialog-close', () => count++);

  el.close('api');
  el.close('api');
  await el.updateComplete;

  expect(count).to.equal(0);
});

it('close() sets open false, emits with the given reason, and is idempotent once closed', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  let count = 0;
  let detail: unknown;
  el.addEventListener('lyra-dialog-close', (e) => {
    count++;
    detail = (e as CustomEvent).detail;
  });

  el.close('rerun');
  el.close('rerun');
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(count).to.equal(1);
  expect(detail).to.equal('rerun');
});

it('moves focus to the first focusable element (the maximize button) when opened with no slotted content', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="maximize-button"]'));
});

it('returns focus to the element that was focused before the dialog opened', async () => {
  const trigger = document.createElement('button');
  trigger.textContent = 'open';
  document.body.appendChild(trigger);
  trigger.focus();

  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"><button slot="body">inside</button></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  el.open = true;
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="maximize-button"]'));

  el.close('api');
  await el.updateComplete;
  expect(document.activeElement).to.equal(trigger);

  trigger.remove();
});

it('restores focus to the trigger when open is set to false directly, not just via close()', async () => {
  const trigger = document.createElement('button');
  trigger.textContent = 'open';
  document.body.appendChild(trigger);
  trigger.focus();

  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  el.open = true;
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="maximize-button"]'));

  el.open = false;
  await el.updateComplete;
  expect(document.activeElement).to.equal(trigger);

  trigger.remove();
});

it('locks document scroll while open and releases it on close', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  el.open = true;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.close('api');
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('');
});

it('releases the scroll lock on disconnect while open', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.remove();

  expect(document.documentElement.style.overflow).to.equal('');
});

it('restores the scroll lock and keydown trap when reparented while still open', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
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

it('closes only the topmost dialog on Escape when two instances are open at once', async () => {
  const back = (await fixture(
    html`<lyra-tool-result-dialog tool-name="first" open></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  await back.updateComplete;

  const front = (await fixture(
    html`<lyra-tool-result-dialog tool-name="second" open></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  await front.updateComplete;

  const listener = oneEvent(front, 'lyra-dialog-close');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  const { detail } = await listener;

  expect(detail).to.equal('escape');
  expect(front.open).to.be.false;
  expect(back.open, 'the dialog beneath the topmost must stay open').to.be.true;

  back.close('api');
  await back.updateComplete;
});

it('traps Tab focus inside the panel, wrapping last->first and first->last', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open
      ><button slot="body">body-button</button
      ><div slot="footer"><button>last</button></div></lyra-tool-result-dialog
    >`,
  )) as LyraToolResultDialog;
  await el.updateComplete;
  const last = el.querySelector('[slot="footer"] button') as HTMLButtonElement;
  const maximizeButton = el.shadowRoot!.querySelector('[part="maximize-button"]') as HTMLButtonElement;

  last.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  expect(tabForward.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(maximizeButton);

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
  // The shadow-input stand-in is slotted into `footer` (not `body`) so it
  // lands *last* in tab order -- this component's own header buttons always
  // precede the body slot (see getFocusableElements' ordering comment), so
  // unlike lyra-dialog's equivalent test a slotted body element here is
  // never the *first* focusable.
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open
      ><p slot="body">body content</p
      ><tool-result-dialog-test-shadow-input slot="footer"></tool-result-dialog-test-shadow-input
    ></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  await el.updateComplete;
  const shadowHost = el.querySelector('tool-result-dialog-test-shadow-input') as ToolResultDialogTestShadowInput;
  const input = shadowHost.shadowRoot!.querySelector('input') as HTMLInputElement;
  const maximizeButton = el.shadowRoot!.querySelector('[part="maximize-button"]') as HTMLButtonElement;

  input.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  expect(tabForward.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(maximizeButton);

  const tabBackward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(tabBackward);
  expect(tabBackward.defaultPrevented).to.be.true;
  expect(shadowHost.shadowRoot!.activeElement).to.equal(input);
});

it('hides the footer wrapper when nothing is slotted into it, shows it once slotted', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
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
    html`<lyra-tool-result-dialog tool-name="run_python"
      ><button slot="footer">OK</button></lyra-tool-result-dialog
    >`,
  )) as LyraToolResultDialog;
  const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
  expect(footer.hasAttribute('hidden')).to.be.false;
});

it('does not intercept lyra-tabs-change bubbling up from a slotted lyra-tabs', async () => {
  // This component listens for none of its own tab-related events -- a
  // slotted <lyra-tabs>'s lyra-tabs-change simply composes/bubbles through
  // the light DOM on its own, with no interception or re-firing needed.
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" open
      ><div slot="body"><button id="inner-emitter"></button></div></lyra-tool-result-dialog
    >`,
  )) as LyraToolResultDialog;
  await el.updateComplete;

  const listener = oneEvent(el, 'lyra-tabs-change');
  el.querySelector('#inner-emitter')!.dispatchEvent(
    new CustomEvent('lyra-tabs-change', { bubbles: true, composed: true, detail: { tabId: 'json' } }),
  );
  const { detail } = await listener;
  expect(detail).to.deep.equal({ tabId: 'json' });
});

it('is accessible while closed', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python"></lyra-tool-result-dialog>`,
  )) as LyraToolResultDialog;
  await expect(el).to.be.accessible();
});

it('is accessible while open with body and footer content', async () => {
  const el = (await fixture(
    html`<lyra-tool-result-dialog tool-name="run_python" status="success" duration-ms="820" open
      ><p slot="body">Ran successfully.</p>
      <div slot="footer"><button>Close</button></div></lyra-tool-result-dialog
    >`,
  )) as LyraToolResultDialog;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
