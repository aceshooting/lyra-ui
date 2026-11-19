import { deepActiveElementIn } from '../../../internal/active-element.js';
import { composedContains } from '../../../internal/composed-tree.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';

/**
 * Runs a DOM move of `element` and returns a repair for the focus it may have dropped. The repair
 * refocuses only a passive, move-induced loss: a focus handler's own choice of target wins.
 */
export function moveKeepingFocus(element: HTMLElement, move: () => void): () => void {
  const document = element.ownerDocument;
  const active = deepActiveElementIn(document);
  const focus = isHtmlElement(active) && composedContains(element, active) ? active : undefined;
  let transferred = false;
  const trackFocus = (): void => { transferred = true; };
  if (focus) document.addEventListener('focus', trackFocus, true);
  try { move(); } finally { if (focus) document.removeEventListener('focus', trackFocus, true); }
  return () => {
    const remaining = deepActiveElementIn(document);
    const lost = !remaining || remaining === document.body || remaining === document.documentElement;
    if (focus?.isConnected && composedContains(element, focus) && focus.ownerDocument === document && !transferred && lost) {
      focus.focus({ preventScroll: true });
    }
  };
}

/** Separate row formatting contexts let each pair of native corners share its own width. */
export function syncMapControlRows(container: HTMLElement, isCurrent: () => boolean): void {
  for (const controls of container.querySelectorAll<HTMLElement>('.maplibregl-control-container')) {
    const current = (): boolean => isCurrent() && container.contains(controls);
    for (const edge of ['top', 'bottom']) {
      if (!current()) return;
      let row = controls.querySelector<HTMLElement>(`:scope > .map-control-row-${edge}`);
      if (!row) {
        row = container.ownerDocument.createElement('div');
        row.className = `map-control-row map-control-row-${edge}`;
        row.part.add(edge === 'top' ? 'controls-top' : 'controls-bottom');
        controls.append(row);
      }
      for (const side of ['right', 'left']) {
        if (!current()) return;
        const corner = controls.querySelector<HTMLElement>(`.maplibregl-ctrl-${edge}-${side}`);
        if (!corner) continue;
        const before = side === 'left' ? row.querySelector(`.maplibregl-ctrl-${edge}-right`) : null;
        if (corner.parentNode === row && corner.nextSibling === before) continue;
        const restore = moveKeepingFocus(corner, () => {
          if (typeof row.moveBefore === 'function') row.moveBefore(corner, before);
          else row.insertBefore(corner, before);
        });
        if (!current()) return;
        restore();
      }
    }
  }
}
