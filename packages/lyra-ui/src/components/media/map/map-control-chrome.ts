import { deepActiveElementIn } from '../../../internal/active-element.js';

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
        const document = corner.ownerDocument;
        const active = deepActiveElementIn(document);
        const focus = active instanceof HTMLElement && corner.contains(active) ? active : undefined;
        let transferred = false;
        const trackFocus = (): void => { transferred = true; };
        if (focus) document.addEventListener('focus', trackFocus, true);
        try {
          if (typeof row.moveBefore === 'function') row.moveBefore(corner, before);
          else row.insertBefore(corner, before);
        } finally { if (focus) document.removeEventListener('focus', trackFocus, true); }
        if (!current()) return;
        const remaining = deepActiveElementIn(document);
        const lost = !remaining || remaining === document.body || remaining === document.documentElement;
        // Restore only a passive move-induced loss; a blur handler's focus choice takes precedence.
        if (focus?.isConnected && corner.contains(focus) && focus.ownerDocument === document && !transferred && lost) {
          focus.focus({ preventScroll: true });
        }
      }
    }
  }
}
