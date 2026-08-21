import { expect } from '@open-wc/testing';
import { resolveAccessibleTrigger } from './a11y.js';
import {
  activateOverlay,
  collectAutofocusElements,
  collectFocusableElements,
  deepActiveElement,
  suspendLyraModalsFor,
} from './overlay-manager.js';
import { activateNonmodalOverlay } from './nonmodal-overlay-manager.js';

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

async function waitForCondition(read: () => boolean, message: string): Promise<void> {
  const started = performance.now();
  while (!read()) {
    if (performance.now() - started > 2000) throw new Error(`Timed out waiting for ${message}`);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

afterEach(() => {
  document.querySelectorAll('[data-overlay], [data-overlay-background]').forEach((el) => el.remove());
});

it('reads focus safely in a realm without a global document', async () => {
  const moduleUrl = new URL('./overlay-manager.ts', import.meta.url).href;
  const source = `
    const hasDocument = typeof document !== 'undefined';
    import(${JSON.stringify(moduleUrl)}).then(({ deepActiveElement }) => {
      try {
        postMessage({ hasDocument, returnedNull: deepActiveElement() === null });
      } catch (error) {
        postMessage({
          hasDocument,
          errorName: error instanceof Error ? error.name : typeof error,
        });
      }
    }).catch((error) => {
      postMessage({
        hasDocument,
        importError: error instanceof Error ? error.message : String(error),
      });
    });
  `;
  const workerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl);
  try {
    const result = await new Promise<{
      hasDocument: boolean;
      returnedNull?: boolean;
      errorName?: string;
      importError?: string;
    }>((resolve, reject) => {
      worker.addEventListener('message', (event) => resolve(event.data), { once: true });
      worker.addEventListener('error', () => reject(new Error('The document-less focus probe failed to run')), {
        once: true,
      });
    });
    expect(result.hasDocument).to.be.false;
    expect(result.importError).to.equal(undefined);
    expect(result.errorName).to.equal(undefined);
    expect(result.returnedNull).to.be.true;
  } finally {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  }
});

it('returns an inert handle when an overlay host has no owner document', () => {
  const host = { ownerDocument: undefined } as unknown as HTMLElement;
  let panelReads = 0;
  let dismissals = 0;

  const handle = activateOverlay({
    host,
    panel: () => {
      panelReads++;
      return null;
    },
    onEscape: () => dismissals++,
    onBackdrop: () => dismissals++,
  });

  handle.focusInitial();
  expect(handle.focusAutofocus()).to.be.false;
  handle.updateRestoreFocusTo(null);
  handle.suspend();
  handle.resume();
  expect(handle.isTopmost()).to.be.false;
  expect(handle.isActive()).to.be.false;
  expect(handle.dismissBackdrop()).to.be.false;
  handle.deactivate();
  expect(panelReads).to.equal(0);
  expect(dismissals).to.equal(0);
});

it('uses the lean nonmodal adapter when neither focus trapping nor modal resources are requested', () => {
  const background = document.createElement('button');
  background.dataset.overlayBackground = '';
  document.body.append(background);
  const overlay = createOverlay(document, 'lean-nonmodal');
  let escapes = 0;
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    modal: false,
    trapFocus: false,
    onEscape: () => escapes++,
  });

  try {
    expect(handle.isActive()).to.equal(true);
    expect(handle.isTopmost()).to.equal(true);
    expect(background.inert).to.equal(false);
    document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    }));
    expect(escapes).to.equal(1);
  } finally {
    handle.deactivate({ restoreFocus: false });
    background.remove();
  }
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

it('shares ordering, Escape, inerting, and focus return across modal and nonmodal adapters', () => {
  const background = document.createElement('button');
  background.dataset.overlayBackground = '';
  document.body.append(background);
  background.focus();
  const modal = createOverlay(document, 'mixed-modal');
  const popup = createOverlay(document, 'mixed-nonmodal');
  const dismissed: string[] = [];
  const modalHandle = activateOverlay({
    host: modal.host,
    panel: () => modal.panel,
    onEscape: () => dismissed.push('modal'),
  });
  const popupHandle = activateNonmodalOverlay({
    host: popup.host,
    panel: () => popup.panel,
    onEscape: () => dismissed.push('nonmodal'),
    restoreFocusTo: modal.first,
  });

  expect(background.inert).to.be.true;
  expect(modal.host.inert).to.be.false;
  expect(popup.host.inert).to.be.false;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissed.join(',')).to.equal('nonmodal');

  popupHandle.deactivate();
  expect((deepActiveElement(document) as HTMLElement | null)?.textContent).to.equal('mixed-modal first');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissed.join(',')).to.equal('nonmodal,modal');

  modalHandle.deactivate();
  expect(background.inert).to.be.false;
});

it('moves a suspended nonmodal entry between document stacks without disturbing a modal owner', () => {
  const modal = createOverlay(document, 'adoption-modal');
  const popup = createOverlay(document, 'adoption-nonmodal');
  const dismissed: string[] = [];
  const modalHandle = activateOverlay({
    host: modal.host,
    panel: () => modal.panel,
    onEscape: () => dismissed.push('modal'),
  });
  const popupHandle = activateNonmodalOverlay({
    host: popup.host,
    panel: () => popup.panel,
    onEscape: () => dismissed.push('nonmodal'),
  });
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;

  try {
    popupHandle.suspend();
    frameDocument.body.append(frameDocument.adoptNode(popup.host));
    popupHandle.resume();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(dismissed.join(',')).to.equal('modal,nonmodal');
  } finally {
    popupHandle.deactivate({ restoreFocus: false });
    modalHandle.deactivate({ restoreFocus: false });
    frame.remove();
  }
});

it('scopes a third-party modal above the Lyra stack until its release handle is called', () => {
  const overlay = createOverlay(document, 'lyra-below-external');
  const external = document.createElement('section');
  external.dataset.overlayBackground = '';
  external.dataset.externalModal = '';
  document.body.append(external);
  const dismissed: string[] = [];
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => dismissed.push('lyra'),
  });

  expect(external.inert).to.be.true;
  const release = suspendLyraModalsFor(external);

  expect(external.inert).to.be.false;
  expect(overlay.host.inert).to.be.true;
  expect(handle.isTopmost()).to.be.false;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(dismissed).to.deep.equal([]);

  release();
  release();
  expect(overlay.host.inert).to.be.false;
  expect(external.inert).to.be.true;
  expect(handle.isTopmost()).to.be.true;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(dismissed).to.deep.equal(['lyra']);

  handle.deactivate({ restoreFocus: false });
  expect(external.inert).to.be.false;
  external.remove();
});

it('nests independent external-modal suspension handles without an unbalanced release', () => {
  const overlay = createOverlay(document, 'lyra-below-two-externals');
  const first = document.createElement('section');
  const second = document.createElement('section');
  first.dataset.overlayBackground = '';
  second.dataset.overlayBackground = '';
  document.body.append(first, second);
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });

  const releaseFirst = suspendLyraModalsFor(first);
  const releaseSecond = suspendLyraModalsFor(second);
  expect(first.inert).to.be.false;
  expect(second.inert).to.be.false;
  expect(overlay.host.inert).to.be.true;

  releaseFirst();
  expect(first.inert).to.be.true;
  expect(second.inert).to.be.false;
  expect(handle.isTopmost()).to.be.false;

  releaseSecond();
  expect(first.inert).to.be.true;
  expect(second.inert).to.be.true;
  expect(overlay.host.inert).to.be.false;
  expect(handle.isTopmost()).to.be.true;

  handle.deactivate({ restoreFocus: false });
  first.remove();
  second.remove();
});

it('preserves Lyra stack order and focus-return targets across an external modal', () => {
  const trigger = document.createElement('button');
  trigger.dataset.overlayBackground = '';
  document.body.append(trigger);
  trigger.focus();
  const bottom = createOverlay(document, 'bottom-before-external');
  const bottomHandle = activateOverlay({
    host: bottom.host,
    panel: () => bottom.panel,
    onEscape: () => undefined,
  });
  bottomHandle.focusInitial();
  bottom.last.focus();
  const top = createOverlay(document, 'top-before-external');
  const topHandle = activateOverlay({ host: top.host, panel: () => top.panel, onEscape: () => undefined });
  topHandle.focusInitial();

  const external = document.createElement('section');
  external.dataset.overlayBackground = '';
  document.body.append(external);
  const release = suspendLyraModalsFor(external);
  release();

  expect(topHandle.isTopmost()).to.be.true;
  topHandle.deactivate();
  expect(deepActiveElement(document)).to.equal(bottom.last);
  bottomHandle.deactivate();
  expect(deepActiveElement(document)).to.equal(trigger);
  external.remove();
});

it('automatically releases an external-modal suspension when its owner disconnects', async () => {
  const overlay = createOverlay(document, 'lyra-after-external-disconnect');
  const external = document.createElement('section');
  external.dataset.overlayBackground = '';
  document.body.append(external);
  const dismissed: string[] = [];
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => dismissed.push('lyra'),
  });
  const release = suspendLyraModalsFor(external);

  external.remove();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(handle.isTopmost()).to.be.true;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(dismissed).to.deep.equal(['lyra']);
  expect(() => release()).to.not.throw();

  handle.deactivate({ restoreFocus: false });
});

it('yields Tab without trapping focus while an external modal suspension is active', () => {
  const overlay = createOverlay(document, 'lyra-yields-tab');
  const external = document.createElement('section');
  external.dataset.overlayBackground = '';
  document.body.append(external);
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  handle.focusInitial();
  const before = (deepActiveElement(document) as HTMLElement | null)?.textContent;
  const release = suspendLyraModalsFor(external);

  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(event);

  expect(event.defaultPrevented).to.be.false;
  expect((deepActiveElement(document) as HTMLElement | null)?.textContent).to.equal(before);
  release();
  handle.deactivate({ restoreFocus: false });
  external.remove();
});

it('automatically releases an external-modal suspension when its owner is adopted into another document', async () => {
  const overlay = createOverlay(document, 'lyra-after-external-adoption');
  const external = document.createElement('section');
  external.dataset.overlayBackground = '';
  document.body.append(external);
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  const release = suspendLyraModalsFor(external);
  const iframe = document.createElement('iframe');
  document.body.append(iframe);

  iframe.contentDocument!.body.append(external);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  expect(handle.isTopmost()).to.be.true;
  expect(overlay.host.inert).to.be.false;
  expect(() => release()).to.not.throw();

  handle.deactivate({ restoreFocus: false });
  iframe.remove();
});

it('keeps external-modal suspension document-scoped', () => {
  const main = createOverlay(document, 'main-document-overlay');
  const mainHandle = activateOverlay({ host: main.host, panel: () => main.panel, onEscape: () => undefined });

  const otherDocument = document.implementation.createHTMLDocument('other');
  const other = createOverlay(otherDocument, 'other-document-overlay');
  const external = otherDocument.createElement('section');
  otherDocument.body.append(external);
  const otherHandle = activateOverlay({ host: other.host, panel: () => other.panel, onEscape: () => undefined });
  const release = suspendLyraModalsFor(external);

  expect(mainHandle.isTopmost()).to.be.true;
  expect(main.host.inert).to.be.false;
  expect(otherHandle.isTopmost()).to.be.false;
  expect(other.host.inert).to.be.true;

  release();
  expect(otherHandle.isTopmost()).to.be.true;
  otherHandle.deactivate({ restoreFocus: false });
  mainHandle.deactivate({ restoreFocus: false });
});

it('keeps an external modal path in a shadow root interactive while inerting its sibling', () => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const background = document.createElement('aside');
  const external = document.createElement('section');
  shadow.append(background, external);
  document.body.append(host);
  const release = suspendLyraModalsFor(external);

  try {
    expect(external.inert).to.equal(false);
    expect(background.inert).to.equal(true);
  } finally {
    release();
    expect(background.inert).to.equal(false);
    host.remove();
  }
});

it('does not suspend Lyra overlays for a disconnected external modal root', () => {
  const overlay = createOverlay(document, 'disconnected-external-modal');
  let dismissals = 0;
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => dismissals++,
  });
  const release = suspendLyraModalsFor(document.createElement('section'));

  try {
    expect(handle.isTopmost()).to.equal(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dismissals).to.equal(1);
  } finally {
    release();
    handle.deactivate({ restoreFocus: false });
  }
});

it('updates a return target without changing stack order or moving focus', () => {
  const initialReturn = document.createElement('button');
  initialReturn.dataset.overlayBackground = '';
  initialReturn.dataset.returnTarget = 'initial';
  const nextReturn = document.createElement('button');
  nextReturn.dataset.overlayBackground = '';
  nextReturn.dataset.returnTarget = 'next';
  document.body.append(initialReturn, nextReturn);
  initialReturn.focus();

  const bottom = createOverlay(document, 'bottom-update');
  const top = createOverlay(document, 'top-update');
  const dismissed: string[] = [];
  const bottomHandle = activateOverlay({
    host: bottom.host,
    panel: () => bottom.panel,
    onEscape: () => dismissed.push('bottom'),
    restoreFocusTo: initialReturn,
  });
  const topHandle = activateOverlay({
    host: top.host,
    panel: () => top.panel,
    onEscape: () => dismissed.push('top'),
  });
  top.first.focus();

  bottomHandle.updateRestoreFocusTo(nextReturn);

  expect((deepActiveElement(document) as HTMLElement | null)?.textContent).to.equal('top-update first');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissed).to.deep.equal(['top']);

  topHandle.deactivate({ restoreFocus: false });
  bottomHandle.deactivate();
  expect((document.activeElement as HTMLElement | null)?.dataset.returnTarget).to.equal('next');
});

it('evaluates a live return target after modal inert cleanup reveals its real focus target', () => {
  const tagName = 'test-overlay-live-restore-trigger';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<button id="live-inner-trigger">Open</button>';
        }
      },
    );
  }
  const page = document.createElement('section');
  page.dataset.overlay = 'live-restore-page';
  const header = document.createElement('header');
  const original = document.createElement('button');
  original.id = 'original-live-trigger';
  header.append(original);
  const drawer = document.createElement('aside');
  drawer.tabIndex = -1;
  page.append(header, drawer);
  document.body.append(page);
  original.focus();
  const handle = activateOverlay({
    host: page,
    panel: () => drawer,
    modalRoot: () => drawer,
    onEscape: () => undefined,
  });
  const replacement = document.createElement(tagName);
  replacement.id = 'replacement-live-trigger';
  original.replaceWith(replacement);

  expect(header.inert).to.equal(true);
  expect(resolveAccessibleTrigger(replacement).id).to.equal('replacement-live-trigger');
  let resolverCalls = 0;
  let inertWhenResolved: boolean | undefined;
  handle.updateRestoreFocusTo(() => {
    resolverCalls++;
    inertWhenResolved = header.inert;
    return resolveAccessibleTrigger(replacement);
  });

  handle.deactivate();

  expect(resolverCalls).to.equal(1);
  expect(inertWhenResolved).to.equal(false);
  expect(header.inert).to.equal(false);
  expect((deepActiveElement(document) as HTMLElement | null)?.id).to.equal('live-inner-trigger');
});

it('fails closed for detached, throwing, fake, and foreign live return targets', () => {
  const bottom = createOverlay(document, 'invalid-live-return-bottom');
  const bottomHandle = activateOverlay({
    host: bottom.host,
    panel: () => bottom.panel,
    onEscape: () => undefined,
  });
  const detached = document.createElement('button');
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const foreign = iframe.contentDocument!.createElement('button');
  foreign.id = 'foreign-live-return';
  iframe.contentDocument!.body.append(foreign);
  const resolvers = [
    () => detached,
    () => {
      throw new Error('consumer restore resolver failed');
    },
    () => ({ nodeType: 1, localName: 'button' } as unknown as HTMLElement),
    () => foreign,
  ];

  try {
    for (let index = 0; index < resolvers.length; index++) {
      const top = createOverlay(document, `invalid-live-return-top-${index}`);
      const topHandle = activateOverlay({
        host: top.host,
        panel: () => top.panel,
        onEscape: () => undefined,
        restoreFocusTo: resolvers[index],
      });
      topHandle.focusInitial();

      expect(() => topHandle.deactivate()).to.not.throw();
      expect((deepActiveElement(document) as HTMLElement | null)?.textContent).to.equal(
        'invalid-live-return-bottom first',
      );
    }
    expect((iframe.contentDocument!.activeElement as HTMLElement | null)?.id).to.not.equal('foreign-live-return');
  } finally {
    bottomHandle.deactivate({ restoreFocus: false });
    iframe.remove();
  }
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

it('keeps the legacy initial-focus path unchanged when no focus hook is supplied', () => {
  const overlay = createOverlay(document, 'legacy-initial-focus');
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    modal: false,
  });

  handle.focusInitial();

  expect(deepActiveElement(document)?.textContent).to.equal('legacy-initial-focus first');
  handle.deactivate({ restoreFocus: false });
});

it('runs the initial-focus hook once and honors both its allow and veto decisions', () => {
  const outside = document.createElement('button');
  outside.dataset.overlayBackground = '';
  outside.id = 'initial-focus-hook-outside';
  document.body.append(outside);

  const allowed = createOverlay(document, 'allowed-initial-focus');
  let allowCalls = 0;
  outside.focus();
  const allowedHandle = activateOverlay({
    host: allowed.host,
    panel: () => allowed.panel,
    onEscape: () => undefined,
    modal: false,
    beforeInitialFocus: () => {
      allowCalls++;
      return true;
    },
  });
  allowedHandle.focusInitial();
  allowedHandle.focusInitial();
  expect(allowCalls).to.equal(1);
  expect(deepActiveElement(document)?.textContent).to.equal('allowed-initial-focus first');
  allowedHandle.deactivate({ restoreFocus: false });

  const vetoed = createOverlay(document, 'vetoed-initial-focus');
  let vetoCalls = 0;
  outside.focus();
  const vetoedHandle = activateOverlay({
    host: vetoed.host,
    panel: () => vetoed.panel,
    onEscape: () => undefined,
    modal: false,
    beforeInitialFocus: () => {
      vetoCalls++;
      return false;
    },
  });
  vetoedHandle.focusInitial();
  vetoedHandle.focusInitial();
  expect(vetoCalls).to.equal(1);
  expect((deepActiveElement(document) as HTMLElement | null)?.id).to.equal('initial-focus-hook-outside');
  vetoedHandle.deactivate({ restoreFocus: false });
  outside.remove();
});

it('defers the one-shot initial-focus hook until a hidden panel renders', async () => {
  const outside = document.createElement('button');
  outside.dataset.overlayBackground = '';
  document.body.append(outside);
  outside.focus();
  const ancestor = document.createElement('div');
  ancestor.dataset.overlayBackground = '';
  ancestor.style.display = 'none';
  const overlay = createOverlay(document, 'deferred-initial-focus');
  ancestor.append(overlay.host);
  document.body.append(ancestor);
  let hookCalls = 0;
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    modal: false,
    suspendWhenUnrendered: true,
    beforeInitialFocus: () => {
      hookCalls++;
      return true;
    },
  });

  handle.focusInitial();
  expect(hookCalls).to.equal(0);
  ancestor.style.display = '';
  await waitForCondition(
    () => hookCalls === 1 && deepActiveElement(document)?.textContent === 'deferred-initial-focus first',
    'the rendered panel to run its initial-focus hook',
  );

  handle.deactivate({ restoreFocus: false });
  ancestor.remove();
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

it('rebases a live return resolver through a nested overlay and evaluates it after final cleanup', () => {
  const tagName = 'test-overlay-rebased-live-trigger';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<button id="rebased-live-inner">Open</button>';
        }
      },
    );
  }
  const trigger = document.createElement(tagName);
  trigger.dataset.overlayBackground = '';
  document.body.append(trigger);
  const inner = trigger.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
  inner.focus();
  let resolverCalls = 0;
  const bottom = createOverlay(document, 'rebased-live-bottom');
  const bottomHandle = activateOverlay({
    host: bottom.host,
    panel: () => bottom.panel,
    onEscape: () => undefined,
    restoreFocusTo: () => {
      resolverCalls++;
      return resolveAccessibleTrigger(trigger);
    },
  });
  bottomHandle.focusInitial();
  const top = createOverlay(document, 'rebased-live-top');
  const topHandle = activateOverlay({ host: top.host, panel: () => top.panel, onEscape: () => undefined });
  topHandle.focusInitial();

  bottomHandle.deactivate({ restoreFocus: false });
  bottom.host.remove();
  expect(trigger.inert).to.equal(true);
  expect(resolverCalls).to.equal(0);

  topHandle.deactivate();

  expect(resolverCalls).to.equal(1);
  expect((deepActiveElement(document) as HTMLElement | null)?.id).to.equal('rebased-live-inner');
});

it('resolves a live return target in the overlay current document after adoption', () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const overlay = createOverlay(document, 'adopted-live-return');
  let liveTarget: HTMLElement | null = null;
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    restoreFocusTo: () => liveTarget,
  });
  handle.focusInitial();

  try {
    handle.suspend();
    iframe.contentDocument!.body.append(overlay.host);
    liveTarget = iframe.contentDocument!.createElement('button');
    liveTarget.id = 'adopted-live-return-target';
    iframe.contentDocument!.body.append(liveTarget);
    handle.resume();
    handle.focusInitial();

    handle.deactivate();

    expect((deepActiveElement(iframe.contentDocument!) as HTMLElement | null)?.id).to.equal(
      'adopted-live-return-target',
    );
  } finally {
    handle.deactivate({ restoreFocus: false });
    iframe.remove();
  }
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

it('suspends inerting, focus trapping, stack ownership, and scroll lock while its host has no layout box', async () => {
  const trigger = document.createElement('button');
  trigger.dataset.overlayBackground = '';
  trigger.dataset.returnTarget = 'rendered-lifecycle';
  document.body.append(trigger);
  trigger.focus();
  const background = document.createElement('main');
  background.dataset.overlayBackground = '';
  document.body.append(background);
  const overlay = createOverlay(document, 'rendered-lifecycle');
  let dismissals = 0;
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => dismissals++,
    lockScroll: true,
    suspendWhenUnrendered: true,
  });
  handle.focusInitial();

  expect(background.inert).to.be.true;
  expect(document.documentElement.style.overflow).to.equal('hidden');
  expect(handle.isTopmost()).to.be.true;

  overlay.host.style.display = 'none';
  await waitForCondition(
    () => !background.inert && document.documentElement.style.overflow !== 'hidden',
    'the hidden overlay to release modal resources',
  );
  expect(handle.isActive()).to.be.true;
  expect(handle.isTopmost()).to.be.false;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissals).to.equal(0);

  overlay.host.style.display = '';
  await waitForCondition(
    () => background.inert && document.documentElement.style.overflow === 'hidden' && handle.isTopmost(),
    'the visible overlay to reclaim modal resources',
  );
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissals).to.equal(1);

  handle.deactivate();
  expect(document.activeElement?.getAttribute('data-return-target')).to.equal('rendered-lifecycle');
});

it('does not claim modal resources when activated under a hidden ancestor, then resumes in place', async () => {
  const background = document.createElement('main');
  background.dataset.overlayBackground = '';
  document.body.append(background);
  const ancestor = document.createElement('div');
  ancestor.dataset.overlayBackground = '';
  ancestor.style.display = 'none';
  const overlay = createOverlay(document, 'hidden-before-open');
  ancestor.append(overlay.host);
  document.body.append(ancestor);
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    lockScroll: true,
    suspendWhenUnrendered: true,
  });

  expect(handle.isActive()).to.be.true;
  expect(handle.isTopmost()).to.be.false;
  expect(background.inert).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');

  ancestor.style.display = '';
  await waitForCondition(
    () => handle.isTopmost() && background.inert && document.documentElement.style.overflow === 'hidden',
    'the ancestor-hidden overlay to become active',
  );

  handle.deactivate({ restoreFocus: false });
  ancestor.remove();
});

it('restores original stack order when a hidden top overlay becomes rendered again', async () => {
  const bottom = createOverlay(document, 'rendered-bottom');
  const top = createOverlay(document, 'rendered-top');
  const dismissals: string[] = [];
  const bottomHandle = activateOverlay({
    host: bottom.host,
    panel: () => bottom.panel,
    onEscape: () => dismissals.push('bottom'),
    lockScroll: true,
    suspendWhenUnrendered: true,
  });
  const topHandle = activateOverlay({
    host: top.host,
    panel: () => top.panel,
    onEscape: () => dismissals.push('top'),
    lockScroll: true,
    suspendWhenUnrendered: true,
  });

  bottom.host.hidden = true;
  await waitForCondition(() => topHandle.isTopmost() && !bottomHandle.isTopmost(), 'the top overlay to retain ownership');
  bottom.host.hidden = false;
  await waitForCondition(
    () => bottom.host.getClientRects().length > 0,
    'the lower overlay to render again',
  );
  expect(topHandle.isTopmost()).to.be.true;
  expect(Number(top.host.style.getPropertyValue('--lr-overlay-stack-index'))).to.be.greaterThan(
    Number(bottom.host.style.getPropertyValue('--lr-overlay-stack-index')),
  );

  top.host.hidden = true;
  await waitForCondition(() => bottomHandle.isTopmost() && !topHandle.isTopmost(), 'the lower overlay to take ownership');
  expect(document.documentElement.style.overflow).to.equal('hidden');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissals).to.deep.equal(['bottom']);

  top.host.hidden = false;
  await waitForCondition(() => topHandle.isTopmost(), 'the original top overlay to reclaim ownership');
  expect(Number(top.host.style.getPropertyValue('--lr-overlay-stack-index'))).to.be.greaterThan(
    Number(bottom.host.style.getPropertyValue('--lr-overlay-stack-index')),
  );
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(dismissals).to.deep.equal(['bottom', 'top']);

  topHandle.deactivate({ restoreFocus: false });
  bottomHandle.deactivate({ restoreFocus: false });
});

it('keeps rendered suspension across a synchronous disconnect/reconnect until the host is visible', async () => {
  const overlay = createOverlay(document, 'rendered-reconnect');
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    lockScroll: true,
    suspendWhenUnrendered: true,
  });
  overlay.host.style.display = 'none';
  await waitForCondition(() => !handle.isTopmost(), 'the overlay to suspend before reparenting');

  handle.suspend();
  const destination = document.createElement('div');
  destination.dataset.overlayBackground = '';
  document.body.append(destination);
  destination.append(overlay.host);
  handle.resume();
  await Promise.resolve();

  expect(handle.isActive()).to.be.true;
  expect(handle.isTopmost()).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');

  overlay.host.style.display = '';
  await waitForCondition(() => handle.isTopmost(), 'the reconnected overlay to resume once visible');
  expect(document.documentElement.style.overflow).to.equal('hidden');

  handle.deactivate({ restoreFocus: false });
  destination.remove();
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

it('can keep a modal subtree interactive while inerting same-host application siblings', async () => {
  const page = document.createElement('section');
  page.dataset.overlay = 'same-host-page';
  const header = document.createElement('header');
  const main = document.createElement('main');
  const footer = document.createElement('footer');
  const drawer = document.createElement('aside');
  drawer.tabIndex = -1;
  header.inert = true;
  page.append(header, main, footer, drawer);
  const outside = document.createElement('div');
  outside.dataset.overlayBackground = '';
  document.body.append(page, outside);

  const pageHandle = activateOverlay({
    host: page,
    panel: () => drawer,
    modalRoot: () => drawer,
    onEscape: () => undefined,
  });

  expect(page.inert).to.equal(false);
  expect(drawer.inert).to.equal(false);
  expect(header.inert).to.equal(true);
  expect(main.inert).to.equal(true);
  expect(footer.inert).to.equal(true);
  expect(outside.inert).to.equal(true);

  const lateNavigation = document.createElement('nav');
  page.append(lateNavigation);
  await waitForCondition(() => lateNavigation.inert, 'late same-host background content to become inert');

  const nestedHost = document.createElement('section');
  const nestedPanel = document.createElement('div');
  nestedPanel.tabIndex = -1;
  nestedHost.append(nestedPanel);
  page.append(nestedHost);
  const nestedHandle = activateOverlay({
    host: nestedHost,
    panel: () => nestedPanel,
    modalRoot: () => nestedPanel,
    onEscape: () => undefined,
  });
  expect(nestedHost.inert).to.equal(false);
  expect(nestedPanel.inert).to.equal(false);
  expect(drawer.inert).to.equal(true);

  nestedHandle.deactivate({ restoreFocus: false });
  expect(nestedHost.inert).to.equal(true);
  expect(drawer.inert).to.equal(false);
  pageHandle.deactivate({ restoreFocus: false });
  expect(header.inert).to.equal(true);
  expect(main.inert).to.equal(false);
  expect(footer.inert).to.equal(false);
  expect(lateNavigation.inert).to.equal(false);
  expect(nestedHost.inert).to.equal(false);
  expect(outside.inert).to.equal(false);
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

it('accepts a ShadowRoot directly when collecting autofocus targets', () => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const input = document.createElement('input');
  input.id = 'shadow-autofocus-target';
  input.setAttribute('autofocus', '');
  shadow.append(input);
  document.body.append(host);

  try {
    expect(collectAutofocusElements(shadow).map((element) => element.id)).to.deep.equal(['shadow-autofocus-target']);
  } finally {
    host.remove();
  }
});

it('hands autofocus from a non-focusable host to its focusable shadow descendant', () => {
  const overlay = createOverlay(document, 'shadow-autofocus-overlay');
  const autofocusHost = document.createElement('section');
  autofocusHost.setAttribute('autofocus', '');
  const shadow = autofocusHost.attachShadow({ mode: 'open' });
  const input = document.createElement('input');
  input.id = 'shadow-autofocus-descendant';
  shadow.append(input);
  overlay.panel.prepend(autofocusHost);
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    modal: false,
    onEscape: () => undefined,
  });

  try {
    expect(handle.focusAutofocus()).to.equal(true);
    expect(deepActiveElement(document)?.id).to.equal('shadow-autofocus-descendant');
  } finally {
    handle.deactivate({ restoreFocus: false });
  }
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

it('preserves a newer external overlay stack style while retaining active stack ownership', async () => {
  const overlay = createOverlay(document, 'externally-restyled-dialog');
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    modal: false,
  });

  overlay.host.style.setProperty('--lr-overlay-stack-index', 'external-latest', 'important');
  await waitForCondition(
    () => overlay.host.style.getPropertyValue('--lr-overlay-stack-index') !== 'external-latest',
    'the active overlay manager to retain stack-style ownership',
  );

  handle.deactivate({ restoreFocus: false });
  expect(overlay.host.style.getPropertyValue('--lr-overlay-stack-index')).to.equal('external-latest');
  expect(overlay.host.style.getPropertyPriority('--lr-overlay-stack-index')).to.equal('important');
});

it('takes a fresh stack-style baseline after suspension and document adoption', () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const overlay = createOverlay(document, 'adopted-restyled-dialog');
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    modal: false,
  });

  try {
    handle.suspend();
    overlay.host.style.setProperty('--lr-overlay-stack-index', 'adopted-external', 'important');
    iframe.contentDocument!.body.append(overlay.host);
    handle.resume();
    expect(overlay.host.style.getPropertyValue('--lr-overlay-stack-index')).to.not.equal('adopted-external');

    handle.deactivate({ restoreFocus: false });
    expect(overlay.host.style.getPropertyValue('--lr-overlay-stack-index')).to.equal('adopted-external');
    expect(overlay.host.style.getPropertyPriority('--lr-overlay-stack-index')).to.equal('important');
  } finally {
    handle.deactivate({ restoreFocus: false });
    iframe.remove();
  }
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

it('excludes an inert focus candidate from the collected list', () => {
  const root = document.createElement('div');
  const visible = document.createElement('button');
  visible.textContent = 'visible';
  const inertButton = document.createElement('button');
  inertButton.textContent = 'inert';
  inertButton.inert = true;
  root.append(visible, inertButton);
  document.body.append(root);

  const focusable = collectFocusableElements(root);

  expect(focusable.map((el) => el.textContent)).to.deep.equal(['visible']);
  root.remove();
});

function createScrollRegion(overflow: string, contentHeight: string): { root: HTMLDivElement; region: HTMLDivElement } {
  const root = document.createElement('div');
  const region = document.createElement('div');
  region.id = 'scroll-region';
  region.tabIndex = -1;
  region.style.overflow = overflow;
  region.style.blockSize = '40px';
  region.style.inlineSize = '80px';
  const filler = document.createElement('div');
  filler.style.blockSize = contentHeight;
  filler.textContent = 'prose';
  region.append(filler);
  root.append(region);
  document.body.append(root);
  return { root, region };
}

it('treats an overflowing scroll region as a tab stop even when its tabindex is negative', () => {
  const { root, region } = createScrollRegion('auto', '400px');
  try {
    const focusable = collectFocusableElements(root);
    expect(focusable.length).to.equal(1);
    expect(focusable[0]?.id).to.equal(region.id);
  } finally {
    root.remove();
  }
});

it('treats a horizontally overflowing auto region as a tab stop', () => {
  const root = document.createElement('div');
  const region = document.createElement('div');
  region.id = 'horizontal-scroll-region';
  region.tabIndex = -1;
  region.style.overflowX = 'auto';
  region.style.overflowY = 'hidden';
  region.style.inlineSize = '80px';
  region.style.blockSize = '40px';
  const filler = document.createElement('div');
  filler.style.inlineSize = '400px';
  filler.style.blockSize = '1px';
  region.append(filler);
  root.append(region);
  document.body.append(root);

  try {
    expect(region.scrollWidth, 'fixture must overflow horizontally').to.be.greaterThan(region.clientWidth);
    expect(collectFocusableElements(root).map((element) => element.id)).to.deep.equal(['horizontal-scroll-region']);
  } finally {
    root.remove();
  }
});

it('treats an explicit overflow:scroll region as a tab stop even without real overflow', () => {
  const { root, region } = createScrollRegion('scroll', '5px');
  try {
    const focusable = collectFocusableElements(root);
    expect(focusable.length).to.equal(1);
    expect(focusable[0]?.id).to.equal(region.id);
  } finally {
    root.remove();
  }
});

it('leaves a non-overflowing overflow:auto region out of the tab order', () => {
  const { root } = createScrollRegion('auto', '5px');
  try {
    expect(collectFocusableElements(root).length).to.equal(0);
  } finally {
    root.remove();
  }
});

it('honours tabindex="-1" on a natively focusable control even when it scrolls', () => {
  const root = document.createElement('div');
  const textarea = document.createElement('textarea');
  textarea.tabIndex = -1;
  textarea.style.overflow = 'auto';
  textarea.style.blockSize = '20px';
  textarea.value = 'line\n'.repeat(40);
  root.append(textarea);
  document.body.append(root);
  try {
    expect(textarea.scrollHeight, 'fixture must overflow').to.be.greaterThan(textarea.clientHeight);
    expect(collectFocusableElements(root).length).to.equal(0);
  } finally {
    root.remove();
  }
});

it('keeps a non-scrolling tabindex="-1" element out of the tab order', () => {
  const root = document.createElement('div');
  const panel = document.createElement('div');
  panel.tabIndex = -1;
  panel.style.overflow = 'visible';
  root.append(panel);
  document.body.append(root);
  try {
    expect(collectFocusableElements(root).length).to.equal(0);
  } finally {
    root.remove();
  }
});

it('keeps Tab inside a panel whose only stop is an overflowing scroll region', () => {
  const host = document.createElement('section');
  host.dataset.overlay = 'scroll-panel';
  const panel = document.createElement('div');
  panel.tabIndex = -1;
  const region = document.createElement('div');
  region.id = 'trapped-scroll-region';
  region.tabIndex = -1;
  region.style.overflow = 'auto';
  region.style.blockSize = '40px';
  const filler = document.createElement('div');
  filler.style.blockSize = '400px';
  region.append(filler);
  panel.append(region);
  host.append(panel);
  document.body.append(host);
  const handle = activateOverlay({ host, panel: () => panel, onEscape: () => undefined });
  try {
    panel.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).to.be.true;
    expect((deepActiveElement(document) as HTMLElement | null)?.id).to.equal(region.id);
  } finally {
    handle.deactivate({ restoreFocus: false });
    host.remove();
  }
});

it('falls back to getClientRects when checkVisibility is unavailable on the element', () => {
  const root = document.createElement('div');
  const button = document.createElement('button');
  button.textContent = 'target';
  root.append(button);
  document.body.append(root);
  const original = button.checkVisibility;
  (button as unknown as { checkVisibility: typeof button.checkVisibility | undefined }).checkVisibility = undefined;
  try {
    const focusable = collectFocusableElements(root);
    expect(focusable.length).to.equal(1);
    expect(focusable[0].textContent).to.equal('target');
  } finally {
    button.checkVisibility = original;
    root.remove();
  }
});

it('no-ops focusInitial and ignores Tab when the panel is not yet rendered', () => {
  const host = document.createElement('section');
  document.body.append(host);
  const handle = activateOverlay({ host, panel: () => null, onEscape: () => undefined });

  expect(() => handle.focusInitial()).to.not.throw();

  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  expect(event.defaultPrevented).to.be.false;

  handle.deactivate({ restoreFocus: false });
  host.remove();
});

it('wraps Tab (and Shift+Tab) to an edge focusable target when nothing is currently focused', () => {
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({
    host: overlay.host,
    panel: () => overlay.panel,
    onEscape: () => undefined,
    modal: false,
  });

  const dispatchWithNoActiveElement = (shiftKey: boolean) => {
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null });
    try {
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      document.dispatchEvent(event);
      return event;
    } finally {
      delete (document as unknown as { activeElement?: unknown }).activeElement;
    }
  };

  const forwardEvent = dispatchWithNoActiveElement(false);
  expect(forwardEvent.defaultPrevented).to.be.true;
  expect(deepActiveElement(document)?.textContent).to.equal('dialog first');

  overlay.first.blur();
  const backwardEvent = dispatchWithNoActiveElement(true);
  expect(backwardEvent.defaultPrevented).to.be.true;
  expect(deepActiveElement(document)?.textContent).to.equal('dialog last');

  handle.deactivate({ restoreFocus: false });
});

it('coalesces a second inert-update mutation batch that arrives before the first is applied', async () => {
  const background = document.createElement('main');
  background.dataset.overlayBackground = '';
  document.body.append(background);
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });

  const originalQueueMicrotask = globalThis.queueMicrotask;
  const captured: Array<() => void> = [];
  globalThis.queueMicrotask = (callback: () => void) => {
    captured.push(callback);
  };
  try {
    // A live mutation schedules the coalesced update, but since queueMicrotask is stubbed to only
    // capture (not run) it, the update never actually applies during this window.
    background.inert = false;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(captured.length).to.equal(1);

    // A second, independent mutation batch (a childList change) arrives while the first update is
    // still pending -- it must find the update already queued and fold into it rather than scheduling
    // a second one.
    const second = document.createElement('aside');
    second.dataset.overlayBackground = '';
    document.body.append(second);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(captured.length).to.equal(1);
  } finally {
    globalThis.queueMicrotask = originalQueueMicrotask;
  }

  // Manually flush the single captured update now that real scheduling is restored, so the module's
  // internal "update queued" flag and the background's inert state settle correctly for later tests.
  captured.forEach((callback) => callback());
  expect(background.inert).to.be.true;

  handle.deactivate({ restoreFocus: false });
});

it('coalesces two rapid same-element inert attribute changes into their final settled value', async () => {
  const background = document.createElement('main');
  background.dataset.overlayBackground = '';
  document.body.append(background);
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });

  // Two synchronous, same-tick toggles on the SAME element land in one MutationObserver batch as two
  // records; handleMutations must look ahead to the second record's outcome rather than react to the
  // (already-superseded) first one.
  background.inert = false;
  background.inert = true;
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  expect(background.inert).to.be.true;
  handle.deactivate({ restoreFocus: false });
});

it('falls back to the global MutationObserver constructor for a document with no defaultView', () => {
  const detachedDoc = document.implementation.createHTMLDocument('detached');
  const host = detachedDoc.createElement('section');
  const panel = detachedDoc.createElement('div');
  panel.tabIndex = -1;
  host.append(panel);
  detachedDoc.body.append(host);

  expect(detachedDoc.defaultView).to.be.null;

  const handle = activateOverlay({ host, panel: () => panel, onEscape: () => undefined });
  expect(handle.isActive()).to.be.true;

  handle.deactivate({ restoreFocus: false });
});

it('returns an inert rendered-state handle when an SSR host has no owner document', () => {
  const host = {} as HTMLElement;
  const handle = activateOverlay({
    host,
    panel: () => null,
    onEscape: () => undefined,
    lockScroll: true,
    suspendWhenUnrendered: true,
  });

  expect(handle.isActive()).to.be.false;
  expect(handle.isTopmost()).to.be.false;
  expect(() => handle.focusInitial()).to.not.throw();
  expect(() => handle.deactivate()).to.not.throw();
});

it('skips inerting a non-HTMLElement sibling such as an SVG element', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.append(svg);
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });

  expect('inert' in svg).to.be.false;
  expect((svg as unknown as { inert?: boolean }).inert).to.not.be.true;

  handle.deactivate({ restoreFocus: false });
  svg.remove();
});

it('walks composed children through a slot when the overlay host is distributed light DOM', () => {
  const hostName = `overlay-slot-host-${Math.random().toString(36).slice(2)}`;
  customElements.define(
    hostName,
    class extends HTMLElement {
      constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const slot = document.createElement('slot');
        shadow.append(slot);
      }
    },
  );
  const wrapper = document.createElement(hostName);
  const sibling = document.createElement('button');
  sibling.textContent = 'sibling';
  const overlay = createOverlay(document, 'dialog');
  wrapper.append(sibling, overlay.host);
  document.body.append(wrapper);

  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });

  expect(sibling.inert).to.be.true;

  handle.deactivate({ restoreFocus: false });
  wrapper.remove();
});

it('does not throw when restoring focus fails and no overlay remains in the stack', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  handle.focusInitial();

  trigger.remove(); // the captured restore-focus target is no longer connected/focusable

  expect(() => handle.deactivate()).to.not.throw();
});

it('captures no return-focus target when nothing is focused at activation', () => {
  const overlay = createOverlay(document, 'dialog');
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null });
  let handle: ReturnType<typeof activateOverlay>;
  try {
    handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  } finally {
    delete (document as unknown as { activeElement?: unknown }).activeElement;
  }
  expect(() => handle.deactivate()).to.not.throw();
});

it('no-ops suspend on an already-deactivated handle', () => {
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  handle.deactivate({ restoreFocus: false });

  expect(() => handle.suspend()).to.not.throw();
  expect(handle.isActive()).to.be.false;
});

it('no-ops a second consecutive suspend call while still active but unregistered', () => {
  const overlay = createOverlay(document, 'dialog');
  const handle = activateOverlay({ host: overlay.host, panel: () => overlay.panel, onEscape: () => undefined });
  handle.suspend();

  expect(() => handle.suspend()).to.not.throw();
  expect(handle.isActive()).to.be.true;

  handle.resume();
  handle.deactivate({ restoreFocus: false });
});
