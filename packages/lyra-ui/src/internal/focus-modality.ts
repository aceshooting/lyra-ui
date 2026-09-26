import { activeElementIn } from './active-element.js';

export type LyraInputModality = 'keyboard' | 'pointer' | 'unknown';

const armedViews = new WeakSet<Window>();
const modalities = new WeakMap<Document, LyraInputModality>();

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229 || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
  const view = event.currentTarget as Window;
  modalities.set(view.document, 'keyboard');
}

function onPointerdown(event: PointerEvent): void {
  const view = event.currentTarget as Window;
  modalities.set(view.document, 'pointer');
}

function onBlur(event: FocusEvent): void {
  if (event.target !== event.currentTarget) return;
  const view = event.currentTarget as Window;
  modalities.delete(view.document);
}

/** Records the last input modality for a document. The listeners are passive and window-scoped. */
export function trackInputModality(doc: Document | null | undefined): void {
  const view = doc?.defaultView;
  if (!view || armedViews.has(view)) return;
  armedViews.add(view);
  modalities.set(doc!, 'unknown');
  view.addEventListener('keydown', onKeydown, { capture: true, passive: true });
  view.addEventListener('pointerdown', onPointerdown, { capture: true, passive: true });
  view.addEventListener('blur', onBlur, { passive: true });
}

export function lastInputModality(doc: Document | null | undefined): LyraInputModality {
  return (doc && modalities.get(doc)) ?? 'unknown';
}

/** Whether a focus event represents keyboard-visible focus on its actually focused target. */
export function isKeyboardFocusEvent(event: Event): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const target = (path.find((item): item is Element => item instanceof Element) ??
    (event.target instanceof Element ? event.target : null));
  if (!target) return false;
  const root = target.getRootNode();
  if (!('activeElement' in root) || activeElementIn(root as unknown as DocumentOrShadowRoot) !== target) return false;
  const modality = lastInputModality(target.ownerDocument);
  if (modality === 'pointer') return false;
  let visible = true;
  try {
    visible = target.matches(':focus-visible');
  } catch {
    return true;
  }
  if (visible) return true;
  if (modality === 'keyboard') return true;
  if (modality !== 'unknown') return false;
  if (target.localName.includes('-') && target.shadowRoot === null && !target.hasAttribute('tabindex') && !(target as HTMLElement).isContentEditable) return true;
  return false;
}
