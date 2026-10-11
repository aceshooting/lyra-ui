import { assignedSlotOf, flattenedParentElement } from './composed-tree.js';

const ATTRIBUTE = 'data-lr-open-overlay-descendant';
const VALUE = 'open';
export const OPEN_OVERLAY_ANCESTOR_SELECTOR = `[${ATTRIBUTE}='${VALUE}']`;

interface Ownership {
  count: number;
  previous: string | null;
}
const owners = new WeakMap<Element, Ownership>();

function acquireBoundary(boundary: Element): void {
  const existing = owners.get(boundary);
  if (existing) existing.count++;
  else {
    owners.set(boundary, { count: 1, previous: boundary.getAttribute(ATTRIBUTE) });
    boundary.setAttribute(ATTRIBUTE, VALUE);
  }
}

function releaseBoundary(boundary: Element): void {
  const ownership = owners.get(boundary);
  if (!ownership || --ownership.count > 0) return;
  owners.delete(boundary);
  // An external attribute edit made during ownership belongs to that author.
  if (boundary.getAttribute(ATTRIBUTE) !== VALUE) return;
  if (ownership.previous === null) boundary.removeAttribute(ATTRIBUTE);
  else boundary.setAttribute(ATTRIBUTE, ownership.previous);
}

/** Reflects open overlay ownership at the boundaries CSS descendant selectors cannot cross. */
export function acquireOpenOverlayAncestors(host: Element): () => void {
  let boundaries = new Set<Element>();
  let slots = new Set<Element>();
  let released = false;
  const sync = (): void => {
    if (released) return;
    const nextBoundaries = new Set<Element>();
    const nextSlots = new Set<Element>();
    for (let current: Element | null = host; current;) {
      const slot = assignedSlotOf(current);
      const parent = flattenedParentElement(current);
      if (slot) nextSlots.add(slot);
      if (parent && (slot === parent || current.parentElement === null)) nextBoundaries.add(parent);
      current = parent;
    }
    for (const boundary of nextBoundaries) if (!boundaries.has(boundary)) acquireBoundary(boundary);
    for (const boundary of boundaries) if (!nextBoundaries.has(boundary)) releaseBoundary(boundary);
    for (const slot of slots) if (!nextSlots.has(slot)) slot.removeEventListener('slotchange', sync);
    for (const slot of nextSlots) if (!slots.has(slot)) slot.addEventListener('slotchange', sync);
    boundaries = nextBoundaries;
    slots = nextSlots;
  };
  sync();
  return () => {
    if (released) return;
    released = true;
    for (const slot of slots) slot.removeEventListener('slotchange', sync);
    for (const boundary of boundaries) releaseBoundary(boundary);
    slots.clear();
    boundaries.clear();
  };
}
