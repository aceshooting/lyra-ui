/**
 * Keyboard-focus detection for supplementary hover/focus disclosures (tooltips, previews, detail
 * popups over a control).
 *
 * A focus event counts as keyboard focus only when all three hold:
 * (0) the event's deepest element target is the element that actually holds focus in its own
 *     tree, so a synthetic `focus`/`focusin` on an unfocused element never counts;
 * (a) that element matches `:focus-visible` (a closed-shadow-root host, whose inner state cannot
 *     be read, is decided by (b) alone);
 * (b) the owning document's recorded input modality is not `pointer`.
 *
 * The recorder listens on the *window* in the capture phase, which is the first stop of every
 * event path for a node in that document. It therefore records a key or press before any document-
 * or element-level handler, including one that synchronously moves focus on Enter. Only a
 * window-capture listener registered before arming runs earlier; such a listener that moves focus
 * synchronously, or calls `stopImmediatePropagation`, can defeat the recording. Window placement
 * also keeps these listeners invisible to spies on `document.addEventListener`.
 *
 * `LyraElement.connectedCallback()` arms the recorder, so any earlier-connected Lyra element makes
 * a lazily rendered surface see the press that revealed it. When no Lyra element was connected
 * before the user's first press, that press is not recorded (late arming) and (a) alone decides.
 *
 * A window `blur` (focus leaving for browser UI, another window, or a child frame) resets the
 * modality to `unknown`, because keys pressed elsewhere never reach this document; on re-entry the
 * browser's own `:focus-visible` decides. Focus landing on a frame-owning element (`iframe`,
 * `frame`, `object`, `embed`) resets it as well, since not every engine blurs the parent window
 * when a child frame takes focus.
 *
 * Text-entry controls are deliberately not exempt from (b): they match `:focus-visible` after any
 * focus, so exempting them would let a tap-opened drawer's initial text-field focus pop its
 * tooltip. Their description stays wired, and a mouse user can still hover them.
 *
 * This is not an Escape route and dismisses nothing: the listeners are passive and never call
 * `preventDefault()`/`stopPropagation()`. They are permanent for the window's lifetime.
 */
import { activeElementIn } from './active-element.js';

export type LyraInputModality = 'keyboard' | 'pointer' | 'unknown';

const armedViews = new WeakSet<Window>();
const modalities = new WeakMap<Document, LyraInputModality>();
const BARE_MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229 || BARE_MODIFIERS.has(event.key)) return;
  modalities.set((event.currentTarget as Window).document, 'keyboard');
}

function onPointerdown(event: Event): void {
  modalities.set((event.currentTarget as Window).document, 'pointer');
}

function onBlur(event: Event): void {
  // A bubbling synthetic element `blur` must not count; only the window's own blur resets.
  if (event.target !== event.currentTarget) return;
  modalities.delete((event.currentTarget as Window).document);
}

// A frame owner (`iframe`, `frame`, `object`, `embed`) holding focus means keys now go to a child
// frame and never reach this document. Firefox can move focus into a frame with neither a window
// `blur` nor a `focusin` for the frame element (only this document's `focusout`), so both focus
// transitions re-check `activeElement` once the change settles. A getter that throws (a DOM
// emulator or a test stub) leaves the modality alone.
const FRAME_OWNER = /^(?:i?frame|object|embed)$/;

function onFocusChange(event: Event): void {
  const doc = (event.currentTarget as Window).document;
  queueMicrotask(() => {
    try {
      if (FRAME_OWNER.test(doc.activeElement?.localName ?? '')) modalities.delete(doc);
    } catch {
      /* nothing to judge */
    }
  });
}

/** Arms the recorder on `doc`'s window once. Idempotent; no-op without `doc.defaultView` (SSR,
 *  inert documents). */
export function trackInputModality(doc: Document | null | undefined): void {
  const view = doc?.defaultView;
  if (!view || armedViews.has(view)) return;
  armedViews.add(view);
  view.addEventListener('keydown', onKeydown, { capture: true, passive: true });
  view.addEventListener('pointerdown', onPointerdown, { capture: true, passive: true });
  view.addEventListener('blur', onBlur, { passive: true });
  view.addEventListener('focusin', onFocusChange, { capture: true, passive: true });
  view.addEventListener('focusout', onFocusChange, { capture: true, passive: true });
}

/** Last recorded modality for `doc`: `'unknown'` until a counted key or pointer press, after the
 *  window blurs, or when the window is not armed. */
export function lastInputModality(doc: Document | null | undefined): LyraInputModality {
  return (doc && modalities.get(doc)) ?? 'unknown';
}

const isElement = (value: unknown): value is Element =>
  value != null && (value as Partial<Node>).nodeType === 1;

/** Whether the focus that produced `event` (`focus`/`focusin`) counts as keyboard focus. */
export function isKeyboardFocusEvent(event: Event): boolean {
  // `nodeType`, not `instanceof Element`: a target in another realm (an iframe document) is not an
  // instance of this window's `Element`.
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const target = path.find(isElement) ?? (isElement(event.target) ? event.target : null);
  if (!target) return false;
  const root = target.getRootNode();
  if (!('activeElement' in root) || activeElementIn(root as unknown as DocumentOrShadowRoot) !== target) {
    return false;
  }
  if (lastInputModality(target.ownerDocument) === 'pointer') return false;
  let visible: boolean;
  try {
    visible = target.matches(':focus-visible');
  } catch {
    // An engine or DOM emulator without `:focus-visible` fails open to the pre-gate behavior.
    return true;
  }
  if (visible) return true;
  // Focus inside a closed shadow root cannot be inspected: the host never matches, so the
  // modality (already known not to be `pointer`) decides alone.
  return (
    target.localName.includes('-')
    && target.shadowRoot === null
    && !target.hasAttribute('tabindex')
    && !(target as HTMLElement).isContentEditable
  );
}
