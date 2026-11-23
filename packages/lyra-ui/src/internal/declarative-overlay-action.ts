import { asciiWhitespaceTokens } from './ascii-whitespace.js';

/**
 * Declarative overlay actions: markup-only open and close triggers driven by a `data-<kind>`
 * attribute, so a page can wire an overlay without script.
 *
 * - `data-<kind>="open <id>"` on any element opens the registered overlay of that kind whose `id`
 *   matches, looked up in the trigger's own tree (its shadow root or document) first and then in
 *   its document.
 * - `data-<kind>="close"` on an element inside a registered overlay of that kind closes the
 *   nearest such overlay in the composed event path, so a nested overlay consumes its own action.
 *
 * Overlays register themselves while connected, so lookups never depend on a tag name and a
 * renamed or scoped definition behaves like the default one. One delegated `click` listener is
 * installed per document when its first overlay connects and removed when its last one
 * disconnects. A click, not a pointer event, is observed, so keyboard activation of a native or
 * custom button triggers the action too.
 */

/** The `data-*` attribute vocabulary: `'dialog'` reads `data-dialog`, `'drawer'` reads `data-drawer`. */
type DeclarativeOverlayKind = 'dialog' | 'drawer';

/** What a registered overlay does when one of its declarative actions is activated. */
export interface DeclarativeOverlayTarget {
  /** Which `data-*` attribute addresses this overlay. Read on every activation. */
  readonly kind: () => DeclarativeOverlayKind;
  /** Opens the overlay. `source` is the activated trigger element. */
  open(source: Element): void;
  /** Closes the overlay. `source` is the activated action element. */
  close(source: Element): void;
}

const KINDS: readonly DeclarativeOverlayKind[] = ['dialog', 'drawer'];
const targets = new WeakMap<Element, DeclarativeOverlayTarget>();
const documentRegistrations = new WeakMap<Document, number>();

type DisableableElement = Element & { disabled?: unknown; effectiveDisabled?: unknown };

/**
 * Whether a declarative action element must not act: it (or a custom element's resolved state) is
 * disabled, it is `aria-disabled="true"`, or it sits inside an inert subtree.
 */
export function isDeclarativeActionInert(element: Element): boolean {
  const state = element as DisableableElement;
  return state.effectiveDisabled === true
    || state.disabled === true
    || element.hasAttribute('disabled')
    || element.getAttribute('aria-disabled')?.trim().toLowerCase() === 'true'
    || element.closest('[inert]') !== null;
}

/**
 * The nearest element in `path[0..end)` that carries `attribute` and, when given, satisfies
 * `accept` for its value. Non-element targets (text, shadow roots, document, window) are skipped.
 */
export function findDeclarativeAction(
  path: readonly EventTarget[],
  attribute: string,
  end = path.length,
  accept?: (value: string) => boolean,
): Element | undefined {
  for (let index = 0; index < end; index += 1) {
    const target = path[index] as Partial<Element> | undefined;
    if (!target || (target as Node).nodeType !== 1) continue;
    const value = (target as Element).getAttribute(attribute);
    if (value === null) continue;
    if (!accept || accept(value)) return target as Element;
  }
  return undefined;
}

function lookupById(trigger: Element, id: string): Element | null {
  const root = trigger.getRootNode() as Partial<DocumentOrShadowRoot> & Partial<Document>;
  const scoped = typeof root.getElementById === 'function' ? root.getElementById(id) : null;
  return scoped ?? trigger.ownerDocument.getElementById(id);
}

function runAction(path: readonly EventTarget[], kind: DeclarativeOverlayKind): void {
  const attribute = `data-${kind}`;
  const action = findDeclarativeAction(path, attribute);
  if (!action) return;
  const [command, id] = asciiWhitespaceTokens(action.getAttribute(attribute));
  const verb = command?.toLowerCase();
  if ((verb !== 'open' && verb !== 'close') || isDeclarativeActionInert(action)) return;
  if (verb === 'open') {
    if (!id) return;
    const element = lookupById(action, id);
    const target = element ? targets.get(element) : undefined;
    if (target && target.kind() === kind) target.open(action);
    return;
  }
  for (let index = path.indexOf(action) + 1; index < path.length; index += 1) {
    const target = targets.get(path[index] as Element);
    if (target && target.kind() === kind) {
      target.close(action);
      return;
    }
  }
}

function onDocumentClick(event: Event): void {
  if (event.defaultPrevented) return;
  const path = event.composedPath();
  for (const kind of KINDS) runAction(path, kind);
}

/**
 * Registers `host` for declarative actions on its current document and returns the release
 * function. Call it from `connectedCallback()` and the release from `disconnectedCallback()`; the
 * shared listener lives exactly as long as at least one registered host in that document.
 */
export function registerDeclarativeOverlay(
  host: Element,
  target: DeclarativeOverlayTarget,
): () => void {
  const doc = host.ownerDocument;
  targets.set(host, target);
  const count = documentRegistrations.get(doc) ?? 0;
  if (count === 0) doc.addEventListener('click', onDocumentClick);
  documentRegistrations.set(doc, count + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (targets.get(host) === target) targets.delete(host);
    const remaining = (documentRegistrations.get(doc) ?? 1) - 1;
    if (remaining > 0) {
      documentRegistrations.set(doc, remaining);
      return;
    }
    documentRegistrations.delete(doc);
    doc.removeEventListener('click', onDocumentClick);
  };
}

