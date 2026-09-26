import { sendKeys } from '@web/test-runner-commands';
import { expect } from '@open-wc/testing';
import { resetMouse, sendMouse } from './wtr-mouse.js';
import { composedParentElement } from '../src/internal/active-element.js';

/**
 * Focus-modality helpers for keyboard-gated hover/focus surfaces.
 *
 * In a shared wtr page the recorded input modality -- and the browser's own `:focus-visible`
 * heuristic -- carry over from earlier tests, so a bare `.focus()` is order-dependent. Every
 * modality-sensitive test sets the modality explicitly with one of these helpers.
 */

/** The nearest composed ancestor that is an open modal overlay host, else `document.body`.
 *  Sentinels go there, never beside the target: a sibling of a slotted trigger would become
 *  `lr-tooltip`/`lr-popover` content, and a click outside an open modal would light-dismiss it. */
function sentinelScope(target: Element): Element {
  for (let node = composedParentElement(target); node; node = composedParentElement(node)) {
    if (
      /-(dialog|drawer)$/.test(node.localName)
      && (node as Element & { open?: unknown }).open === true
    ) {
      return node;
    }
  }
  return target.ownerDocument.body;
}

function sentinel(doc: Document, label: string): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = label;
  // Fixed so the temporary insertion never shifts the fixture under an already-placed pointer.
  button.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;z-index:2147483647;';
  return button;
}

/**
 * Establishes keyboard modality with a real Tab between two temporary sentinels, then focuses
 * `target` by script. Real Tab is the only key every engine treats as keyboard modality, and it
 * leaves the following script focus `:focus-visible`.
 */
export async function focusByKeyboard(target: HTMLElement, scope?: Element): Promise<void> {
  const host = scope ?? sentinelScope(target);
  const doc = target.ownerDocument;
  const first = sentinel(doc, 'keyboard sentinel 1');
  const second = sentinel(doc, 'keyboard sentinel 2');
  host.prepend(first, second);
  try {
    first.focus();
    await sendKeys({ press: 'Tab' });
    expect(doc.activeElement === second, 'Tab reached the second sentinel').to.equal(true);
    target.focus();
  } finally {
    first.remove();
    second.remove();
  }
}

/**
 * Establishes pointer modality with a real click on a temporary sentinel, then focuses `target`
 * by script -- the shape of a drawer's initial focus, or focus restoration, after a tap.
 */
export async function focusAfterPointer(target: HTMLElement, scope?: Element): Promise<void> {
  const host = scope ?? sentinelScope(target);
  const button = sentinel(target.ownerDocument, 'pointer sentinel');
  host.prepend(button);
  try {
    const rect = button.getBoundingClientRect();
    await sendMouse({
      type: 'click',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await resetMouse();
    target.focus();
  } finally {
    button.remove();
  }
}
