import { expect } from '@open-wc/testing';
import { activateOverlay, collectFocusableElements, deepActiveElement } from './overlay-manager.js';

function createOverlay(doc: Document, label: string) {
  const host = doc.createElement('section');
  host.dataset.overlay = label;
  const panel = doc.createElement('div');
  panel.tabIndex = -1;
  const first = doc.createElement('button');
  first.textContent = `${label} first`;
  const last = doc.createElement('button');
  last.textContent = `${label} last`;
  panel.append(first, last);
  host.append(panel);
  doc.body.append(host);
  return { host, panel, first, last };
}

afterEach(() => {
  document.querySelectorAll('[data-overlay], [data-overlay-background]').forEach((el) => el.remove());
});

it('routes Escape only to the topmost overlay across different overlay owners', () => {
  const bottom = createOverlay(document, 'dialog');
  const top = createOverlay(document, 'responsive-panel');
  const dismissed: string[] = [];
  const bottomHandle = activateOverlay({
    host: bottom.host,
    panel: () => bottom.panel,
    onEscape: () => dismissed.push('dialog'),
  });
  const topHandle = activateOverlay({
    host: top.host,
    panel: () => top.panel,
    onEscape: () => dismissed.push('responsive-panel'),
  });

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissed).to.deep.equal(['responsive-panel']);

  topHandle.deactivate();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissed).to.deep.equal(['responsive-panel', 'dialog']);
  bottomHandle.deactivate();
});

it('pulls an escaped focus position back inside and wraps both Tab boundaries', () => {
  const outside = document.createElement('button');
  outside.dataset.overlayBackground = '';
  document.body.append(outside);
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    modal: false,
  });

  outside.focus();
  const escapedForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(escapedForward);
  expect(escapedForward.defaultPrevented).to.be.true;
  expect(deepActiveElement(document)).to.equal(overlay.first);

  overlay.last.focus();
  const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(forward);
  expect(forward.defaultPrevented).to.be.true;
  expect(deepActiveElement(document)).to.equal(overlay.first);

  overlay.first.focus();
  const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(backward);
  expect(backward.defaultPrevented).to.be.true;
  expect(deepActiveElement(document)).to.equal(overlay.last);
  handle.deactivate({ restoreFocus: false });
});

it('captures and restores focus in stack order, including direct deactivation', () => {
  const trigger = document.createElement('button');
  trigger.dataset.overlayBackground = '';
  document.body.append(trigger);
  trigger.focus();

  const bottom = createOverlay(document, 'bottom');
  const bottomHandle = activateOverlay({ host: bottom.host, panel: () => bottom.panel, onEscape: () => undefined });
  bottomHandle.focusInitial();
  expect(deepActiveElement(document)).to.equal(bottom.first);

  bottom.last.focus();
  const top = createOverlay(document, 'top');
  const topHandle = activateOverlay({ host: top.host, panel: () => top.panel, onEscape: () => undefined });
  topHandle.focusInitial();
  topHandle.deactivate();
  expect(deepActiveElement(document)).to.equal(bottom.last);

  bottomHandle.deactivate();
  expect(document.activeElement).to.equal(trigger);
});

it('preserves focus already inside a newly-modal panel and supports a preferred initial target', () => {
  const overlay = createOverlay(document, 'responsive-panel');
  overlay.last.focus();
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    preferredInitialFocus: () => overlay.first,
    onEscape: () => undefined,
  });

  handle.focusInitial();
  expect(deepActiveElement(document)).to.equal(overlay.last);

  const outside = document.createElement('button');
  document.body.append(outside);
  outside.inert = false;
  // Programmatic focus outside a modal is blocked by inert, so temporarily
  // suspend and resume to model an inline-to-modal transition from outside.
  handle.suspend();
  outside.focus();
  handle.resume();
  handle.focusInitial();
  expect(deepActiveElement(document)).to.equal(overlay.first);

  handle.deactivate({ restoreFocus: false });
  outside.remove();
});

it('rebases an upper overlay return target when a lower overlay disappears', () => {
  const trigger = document.createElement('button');
  trigger.dataset.overlayBackground = '';
  document.body.append(trigger);
  trigger.focus();
  const bottom = createOverlay(document, 'bottom');
  const bottomHandle = activateOverlay({ host: bottom.host, panel: () => bottom.panel, onEscape: () => undefined });
  bottomHandle.focusInitial();
  const top = createOverlay(document, 'top');
  const topHandle = activateOverlay({ host: top.host, panel: () => top.panel, onEscape: () => undefined });
  topHandle.focusInitial();

  bottomHandle.deactivate({ restoreFocus: false });
  bottom.host.remove();
  topHandle.deactivate();

  expect(document.activeElement?.getAttribute('data-overlay-background')).to.equal('');
});

it('suspends and resumes across synchronous reparenting without losing its focus-return record', async () => {
  const trigger = document.createElement('button');
  trigger.dataset.overlayBackground = '';
  document.body.append(trigger);
  trigger.focus();
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  handle.focusInitial();

  handle.suspend();
  const container = document.createElement('div');
  document.body.append(container);
  container.append(overlay.host);
  handle.resume();
  await Promise.resolve();
  handle.deactivate();

  expect(document.activeElement?.getAttribute('data-overlay-background')).to.equal('');
  container.remove();
});

it('preserves the existing stack order when a lower overlay is suspended and resumed in the same document', () => {
  const bottom = createOverlay(document, 'bottom');
  const top = createOverlay(document, 'top');
  const dismissed: string[] = [];
  const bottomHandle = activateOverlay({
    host: bottom.host,
    panel: () => bottom.panel,
    onEscape: () => dismissed.push('bottom'),
  });
  const topHandle = activateOverlay({
    host: top.host,
    panel: () => top.panel,
    onEscape: () => dismissed.push('top'),
  });

  bottomHandle.suspend();
  const container = document.createElement('div');
  document.body.append(container);
  container.append(bottom.host);
  bottomHandle.resume();

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissed).to.deep.equal(['top']);
  expect(Number(top.host.style.getPropertyValue('--lr-overlay-stack-index'))).to.be.greaterThan(
    Number(bottom.host.style.getPropertyValue('--lr-overlay-stack-index')),
  );

  topHandle.deactivate({ restoreFocus: false });
  bottomHandle.deactivate({ restoreFocus: false });
  container.remove();
});

it('does not rebase a lower overlay return target when an upper overlay closes', () => {
  const bottom = createOverlay(document, 'bottom');
  const top = createOverlay(document, 'top');
  const bottomHandle = activateOverlay({
    host: bottom.host,
    panel: () => bottom.panel,
    onEscape: () => undefined,
    restoreFocusTo: top.first,
  });
  const topHandle = activateOverlay({
    host: top.host,
    panel: () => top.panel,
    onEscape: () => undefined,
    restoreFocusTo: bottom.first,
  });

  topHandle.deactivate({ restoreFocus: false });
  bottomHandle.deactivate();

  expect(document.activeElement?.textContent).to.equal('top first');
});

it('moves focus into a surviving lower overlay when the top closes without restoring its opener', () => {
  const bottom = createOverlay(document, 'bottom');
  const bottomHandle = activateOverlay({ host: bottom.host, panel: () => bottom.panel, onEscape: () => undefined });
  bottomHandle.focusInitial();
  const top = createOverlay(document, 'top');
  const topHandle = activateOverlay({ host: top.host, panel: () => top.panel, onEscape: () => undefined });
  topHandle.focusInitial();

  topHandle.deactivate({ restoreFocus: false });

  expect(deepActiveElement(document)?.textContent).to.equal('bottom first');
  bottomHandle.deactivate({ restoreFocus: false });
});

it('makes modal background paths inert and restores pre-existing inert state', () => {
  const preInert = document.createElement('aside');
  preInert.dataset.overlayBackground = '';
  preInert.inert = true;
  const background = document.createElement('main');
  background.dataset.overlayBackground = '';
  document.body.append(preInert, background);
  const overlay = createOverlay(document, 'dialog');

  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  expect(background.inert).to.be.true;
  expect(preInert.inert).to.be.true;
  expect(overlay.host.inert).to.be.false;

  handle.deactivate({ restoreFocus: false });
  expect(background.inert).to.be.false;
  expect(preInert.inert).to.be.true;
});

it('tracks live application inert changes while keeping modal background inert', async () => {
  const background = document.createElement('main');
  background.dataset.overlayBackground = '';
  background.inert = true;
  document.body.append(background);
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });

  background.inert = false;
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(background.inert).to.be.true;

  handle.deactivate({ restoreFocus: false });
  expect(background.inert).to.be.false;
});

it('restores original inert state after a managed background is detached and reinserted', async () => {
  const background = document.createElement('main');
  background.dataset.overlayBackground = '';
  document.body.append(background);
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  background.remove();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(background.inert).to.be.false;

  document.body.prepend(background);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(background.inert).to.be.true;

  handle.deactivate({ restoreFocus: false });
  expect(background.inert).to.be.false;
});

it('tracks live inert intent for a managed sibling inside a consumer shadow root', async () => {
  const app = document.createElement('div');
  const shadow = app.attachShadow({ mode: 'open' });
  const background = document.createElement('aside');
  const overlay = createOverlay(document, 'shadow-dialog');
  shadow.append(background, overlay.host);
  document.body.append(app);
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(background.inert).to.be.true;

  background.inert = false;
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(background.inert).to.be.true;

  handle.deactivate({ restoreFocus: false });
  expect(background.inert).to.be.false;
  app.remove();
});

it('inerts a shadow-root sibling added while its modal overlay is open', async () => {
  const app = document.createElement('div');
  const shadow = app.attachShadow({ mode: 'open' });
  const overlay = createOverlay(document, 'shadow-dialog');
  shadow.append(overlay.host);
  document.body.append(app);
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });

  const added = document.createElement('aside');
  shadow.prepend(added);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(added.inert).to.be.true;

  handle.deactivate({ restoreFocus: false });
  expect(added.inert).to.be.false;
  app.remove();
});

it('scopes its stack and key listener to the overlay ownerDocument', () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const iframeDoc = iframe.contentDocument!;
  const overlay = createOverlay(iframeDoc, 'iframe-dialog');
  let dismissals = 0;
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => dismissals++,
  });

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(dismissals).to.equal(0);
  iframeDoc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(dismissals).to.equal(1);

  handle.deactivate({ restoreFocus: false });
  iframe.remove();
});

it('ignores an Escape that a nested control already handled', () => {
  const overlay = createOverlay(document, 'dialog');
  let dismissals = 0;
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => dismissals++ });
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  event.preventDefault();
  document.dispatchEvent(event);
  expect(dismissals).to.equal(0);
  handle.deactivate({ restoreFocus: false });
});

it('assigns increasing stack levels and gates backdrop dismissal to the topmost overlay', () => {
  const bottom = createOverlay(document, 'bottom');
  const top = createOverlay(document, 'top');
  const dismissed: string[] = [];
  const bottomHandle = activateOverlay({
    host: bottom.host,
    panel: () => bottom.panel,
    onEscape: () => undefined,
    onBackdrop: () => dismissed.push('bottom'),
  });
  const topHandle = activateOverlay({
    host: top.host,
    panel: () => top.panel,
    onEscape: () => undefined,
    onBackdrop: () => dismissed.push('top'),
  });

  expect(Number(top.host.style.getPropertyValue('--lr-overlay-stack-index'))).to.be.greaterThan(
    Number(bottom.host.style.getPropertyValue('--lr-overlay-stack-index')),
  );
  expect(bottomHandle.dismissBackdrop()).to.be.false;
  expect(topHandle.dismissBackdrop()).to.be.true;
  expect(dismissed).to.deep.equal(['top']);
  topHandle.deactivate({ restoreFocus: false });
  bottomHandle.deactivate({ restoreFocus: false });
});

it('collects rendered focus targets through slots and nested shadow roots', () => {
  const hostName = `overlay-focus-probe-${Math.random().toString(36).slice(2)}`;
  customElements.define(
    hostName,
    class extends HTMLElement {
      constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const input = document.createElement('input');
        shadow.append(input);
      }
    },
  );
  const wrapper = document.createElement('div');
  const probe = document.createElement(hostName);
  const hidden = document.createElement('button');
  hidden.hidden = true;
  wrapper.append(probe, hidden);
  document.body.append(wrapper);

  const focusable = collectFocusableElements(wrapper);
  expect(focusable.length).to.equal(1);
  expect(focusable[0].tagName).to.equal('INPUT');
  wrapper.remove();
});

it('accepts a ShadowRoot directly when collecting focus targets', () => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const input = document.createElement('input');
  shadow.append(input);
  document.body.append(host);

  expect(collectFocusableElements(shadow)).to.deep.equal([input]);
  host.remove();
});

it('restores a pre-existing overlay stack style after deactivation', () => {
  const overlay = createOverlay(document, 'styled-dialog');
  overlay.host.style.setProperty('--lr-overlay-stack-index', 'custom', 'important');
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    modal: false,
  });

  expect(overlay.host.style.getPropertyValue('--lr-overlay-stack-index')).to.not.equal('custom');
  handle.deactivate({ restoreFocus: false });
  expect(overlay.host.style.getPropertyValue('--lr-overlay-stack-index')).to.equal('custom');
  expect(overlay.host.style.getPropertyPriority('--lr-overlay-stack-index')).to.equal('important');
});

it('skips visibility-hidden focus targets and focuses the next rendered target', () => {
  const overlay = createOverlay(document, 'dialog');
  overlay.first.style.visibility = 'hidden';
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    modal: false,
  });

  handle.focusInitial();

  expect(deepActiveElement(document)?.textContent).to.equal('dialog last');
  handle.deactivate({ restoreFocus: false });
});

it('models each native radio group as one Tab stop', () => {
  const root = document.createElement('div');
  const unchecked = document.createElement('input');
  unchecked.type = 'radio';
  unchecked.name = 'choice';
  unchecked.dataset.radio = 'unchecked';
  const checked = document.createElement('input');
  checked.type = 'radio';
  checked.name = 'choice';
  checked.checked = true;
  checked.dataset.radio = 'checked';
  const otherGroup = document.createElement('input');
  otherGroup.type = 'radio';
  otherGroup.name = 'other';
  otherGroup.dataset.radio = 'other';
  const unnamed = document.createElement('input');
  unnamed.type = 'radio';
  unnamed.dataset.radio = 'unnamed';
  root.append(unchecked, checked, otherGroup, unnamed);
  document.body.append(root);

  const focusable = collectFocusableElements(root);

  expect(focusable.map((element) => element.dataset.radio)).to.deep.equal(['checked', 'other', 'unnamed']);
  root.remove();
});

it('traverses fallback content of an unassigned slot', () => {
  const hostName = `overlay-slot-fallback-${Math.random().toString(36).slice(2)}`;
  customElements.define(
    hostName,
    class extends HTMLElement {
      constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const slot = document.createElement('slot');
        const fallback = document.createElement('button');
        fallback.textContent = 'fallback';
        slot.append(fallback);
        shadow.append(slot);
      }
    },
  );
  const host = document.createElement(hostName);
  document.body.append(host);

  const focusable = collectFocusableElements(host);

  expect(focusable.length).to.equal(1);
  expect(focusable[0].textContent).to.equal('fallback');
  host.remove();
});

it('does not traverse slot fallback content when assigned text suppresses it', () => {
  const hostName = `overlay-slot-text-${Math.random().toString(36).slice(2)}`;
  customElements.define(
    hostName,
    class extends HTMLElement {
      constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const slot = document.createElement('slot');
        const fallback = document.createElement('button');
        fallback.textContent = 'fallback';
        slot.append(fallback);
        shadow.append(slot);
      }
    },
  );
  const host = document.createElement(hostName);
  host.textContent = 'assigned text';
  document.body.append(host);
  const suppressedFallback = host.shadowRoot!.querySelector('button')!;
  suppressedFallback.checkVisibility = () => true;

  const focusable = collectFocusableElements(host);

  expect(focusable.length).to.equal(0);
  host.remove();
});
