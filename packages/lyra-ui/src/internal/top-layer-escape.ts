import { nativePopoverSupported } from './native-popover.js';
import {
  establishesFixedContainingBlock,
  fixedContainingBlockParentNode,
  isLastTraversableFixedContainingBlockNode,
  isNativeTopLayerElement,
} from './fixed-containing-block.js';

/**
 * Top-layer escape for library-placed `position: fixed` surfaces.
 *
 * A `fixed` surface is *trapped* when an ancestor (flat tree, up to the nearest top-layer
 * ancestor) establishes its containing block -- a transform, filter, `contain`, `will-change`,
 * and so on. The ancestor then re-bases its coordinates and any scroller above it clips it, so
 * `fixed` stops meaning "the viewport". Where the native Popover API exists, a trapped surface is
 * shown as a `popover="manual"` element: the browser top layer lays it out against the viewport
 * without moving a single DOM node, so shadow-scoped styles, slots, ARIA relationships and
 * composed event paths are untouched. Clip-only ancestors (`clip-path`, `mask`) re-base nothing
 * and do not count.
 *
 * Ownership: every attribute and inline style this module writes is recorded in a lease keyed by
 * the placed element. A consumer's own `popover` attribute is never written, shown, hidden or
 * removed.
 *
 * Release contract: a promotion is kept until the placed element settles closed by gaining
 * `[hidden]` (observed here), until the surface calls {@link releaseTopLayer} explicitly because
 * it stops being an overlay without `[hidden]`, or until the element is removed (which auto-hides
 * a showing popover; a later placement run strips the stale attributes). It is deliberately not
 * released when a placement run is disposed: surfaces dispose placement at close start, before
 * their exit transition plays, and on every re-place.
 *
 * Known blind spots: a containing block inside a *closed* shadow root is invisible to the walk,
 * and a trap that appears without moving the anchor or resizing either box is caught on the next
 * placement update (scroll, resize or layout shift) rather than immediately.
 * @internal
 */

/** Marks an element whose `popover` attribute this module wrote. */
export const TOP_LAYER_ATTRIBUTE = 'data-lr-top-layer';

interface TopLayerLease {
  owner: HTMLElement;
  members: Set<HTMLElement>;
  observer?: MutationObserver;
  zoom: Map<HTMLElement, string>;
  visibility: Map<HTMLElement, string>;
}

const leaseByOwner = new WeakMap<HTMLElement, TopLayerLease>();
const ownerByMember = new WeakMap<HTMLElement, HTMLElement>();

function leaseFor(member: HTMLElement, owner: HTMLElement): TopLayerLease {
  let lease = leaseByOwner.get(owner);
  if (!lease) {
    lease = { owner, members: new Set([owner]), zoom: new Map(), visibility: new Map() };
    if (typeof MutationObserver === 'function') {
      // Reads the current state, not the record: a close then reopen in one task releases nothing.
      const observer = new MutationObserver(() => {
        if (owner.hidden) releaseTopLayer(owner);
      });
      observer.observe(owner, { attributes: true, attributeFilter: ['hidden'] });
      lease.observer = observer;
    }
    leaseByOwner.set(owner, lease);
    ownerByMember.set(owner, owner);
  }
  lease.members.add(member);
  ownerByMember.set(member, owner);
  return lease;
}

function isLibraryOwned(element: HTMLElement): boolean {
  return element.hasAttribute(TOP_LAYER_ATTRIBUTE);
}

/** True when `element` carries this module's promotion and is currently in the top layer. */
export function isLibraryPromotedAndShowing(element: HTMLElement): boolean {
  return isLibraryOwned(element) && isNativeTopLayerElement(element);
}

/**
 * A `fixed` surface is trapped when an ancestor would become its containing block. The walk stops
 * at a top-layer ancestor, which re-bases nothing -- unless that ancestor is itself trapped: a
 * surface nested inside a promoted popup (a submenu, a hoisted select in a menu) still sees the
 * promoted popup's DOM ancestors as clipping ancestors when Floating UI measures it, so it would be
 * sized to the scroller its parent escaped. It is promoted too.
 */
export function needsTopLayerEscape(element: HTMLElement): boolean {
  let node: Node = fixedContainingBlockParentNode(element);
  while (node instanceof HTMLElement && !isLastTraversableFixedContainingBlockNode(node)) {
    if (establishesFixedContainingBlock(node)) return true;
    // A top-layer ancestor is not a containing block; keep walking past it (see above).
    const parent = fixedContainingBlockParentNode(node);
    if (parent === node) break;
    node = parent;
  }
  return false;
}

function removeOwnedAttributes(element: HTMLElement): void {
  if (!isLibraryOwned(element)) return;
  element.removeAttribute('popover');
  element.removeAttribute(TOP_LAYER_ATTRIBUTE);
}

/**
 * Shows `element` in the browser top layer as a manual popover. Idempotent: an element that is
 * already showing is not re-shown, so its top-layer order is kept. Never moves focus: the popover
 * focusing steps would otherwise focus an `autofocus` descendant, so the element is kept
 * `visibility: hidden !important` for the duration of the call and its exact inline value and
 * priority are restored afterwards. Returns whether the element is promoted.
 * @param owner - The placed element whose `[hidden]` settle releases this promotion (a hover
 *   bridge is released with its popup).
 */
export function promoteToTopLayer(element: HTMLElement, owner: HTMLElement = element): boolean {
  if (!nativePopoverSupported() || !element.isConnected) return false;
  if (element.hasAttribute('popover') && !isLibraryOwned(element)) return false;
  if (typeof element.showPopover !== 'function') return false;
  if (element.getAttribute('popover') !== 'manual') element.setAttribute('popover', 'manual');
  if (!isLibraryOwned(element)) element.setAttribute(TOP_LAYER_ATTRIBUTE, '');
  if (!isNativeTopLayerElement(element)) {
    const value = element.style.getPropertyValue('visibility');
    const priority = element.style.getPropertyPriority('visibility');
    element.style.setProperty('visibility', 'hidden', 'important');
    try {
      element.showPopover();
    } catch {
      removeOwnedAttributes(element);
      return false;
    } finally {
      element.style.removeProperty('visibility');
      if (value) element.style.setProperty('visibility', value, priority);
    }
  }
  leaseFor(element, owner);
  return true;
}

/** Drops stale promotion attributes from a library-owned element that is no longer showing (a
 *  move or removal auto-hides a popover), so the UA `[popover]:not(:popover-open)` rule cannot
 *  hide it. A no-op for anything else. */
export function stripStaleTopLayer(element: HTMLElement): void {
  if (isLibraryOwned(element) && !isNativeTopLayerElement(element)) removeOwnedAttributes(element);
}

function removeWrittenStyle(element: HTMLElement, property: string, written: string): void {
  if (
    element.style.getPropertyValue(property) === written &&
    element.style.getPropertyPriority(property) === ''
  ) {
    element.style.removeProperty(property);
  }
}

function releaseMember(element: HTMLElement, lease: TopLayerLease | undefined): void {
  if (isLibraryOwned(element) && isNativeTopLayerElement(element)) {
    try {
      element.hidePopover();
    } catch {
      // Already hidden by the user agent (for example on removal).
    }
  }
  removeOwnedAttributes(element);
  const zoom = lease?.zoom.get(element);
  if (zoom !== undefined) removeWrittenStyle(element, 'zoom', zoom);
  const visibility = lease?.visibility.get(element);
  if (visibility !== undefined) removeWrittenStyle(element, 'visibility', visibility);
}

/**
 * Releases everything this module wrote for `element` and the members leased with it (the popup
 * first, then its hover bridge): hides a showing promotion, removes the promotion attributes and
 * any compensating `zoom` or reference-hidden `visibility`. A no-op on an element the escape never
 * touched. Called automatically when the placed element gains `[hidden]`; call it explicitly from a
 * surface that stops being an overlay without `[hidden]`.
 */
export function releaseTopLayer(element: HTMLElement): void {
  const owner = ownerByMember.get(element) ?? element;
  const lease = leaseByOwner.get(owner);
  if (!lease) {
    removeOwnedAttributes(element);
    return;
  }
  lease.observer?.disconnect();
  leaseByOwner.delete(owner);
  for (const member of lease.members) {
    ownerByMember.delete(member);
    releaseMember(member, lease);
  }
}

function computedZoom(element: Element): number {
  const view = element.ownerDocument.defaultView;
  if (!view) return 1;
  const zoom = Number.parseFloat(view.getComputedStyle(element).zoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function currentCssZoom(element: Element): number | undefined {
  const value = (element as Element & { currentCSSZoom?: number }).currentCSSZoom;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * The product of the computed CSS `zoom` over `element`'s flat-tree ancestors, excluding
 * `<html>` and `<body>` (page zoom is not compensated). Unlike the containing-block walk it never
 * stops at a top-layer ancestor: effective zoom inherits through the DOM into the top layer.
 */
export function ancestorZoom(element: HTMLElement): number {
  const doc = element.ownerDocument;
  const own = currentCssZoom(element);
  const body = doc.body ? currentCssZoom(doc.body) : undefined;
  // `currentCSSZoom` is 1 for an element without a box, so the fast path needs a rendered box.
  if (own !== undefined && body !== undefined && element.getClientRects().length > 0) {
    return own / computedZoom(element) / body;
  }
  let product = 1;
  let node: Node = fixedContainingBlockParentNode(element);
  while (node instanceof Element && !isLastTraversableFixedContainingBlockNode(node)) {
    product *= computedZoom(node);
    const parent = fixedContainingBlockParentNode(node);
    if (parent === node) break;
    node = parent;
  }
  return product;
}

/** {@link ancestorZoom} including `element`'s own computed `zoom`. */
function effectiveZoom(element: Element): number {
  return element instanceof HTMLElement
    ? ancestorZoom(element) * computedZoom(element)
    : computedZoom(element);
}

/**
 * Normalises `element`'s effective zoom relative to `offsetParent` (the viewport when `null`) to
 * 1, so coordinates computed in unzoomed viewport pixels land where Floating UI measured them.
 * Returns whether the written value changed. Never overwrites an inline `zoom` it did not write.
 */
export function compensateAncestorZoom(
  element: HTMLElement,
  offsetParent: Element | null,
  owner: HTMLElement = element,
): boolean {
  const zoom = ancestorZoom(element) / (offsetParent ? effectiveZoom(offsetParent) : 1);
  const lease = leaseByOwner.get(owner);
  const written = lease?.zoom.get(element);
  const current = element.style.getPropertyValue('zoom');
  if (!Number.isFinite(zoom) || zoom <= 0 || Math.abs(zoom - 1) < 1e-6) {
    if (written === undefined) return false;
    removeWrittenStyle(element, 'zoom', written);
    lease?.zoom.delete(element);
    return true;
  }
  if (written === undefined) {
    if (current !== '') return false;
    element.style.setProperty('zoom', `${1 / zoom}`);
    leaseFor(element, owner).zoom.set(element, element.style.getPropertyValue('zoom'));
    return true;
  }
  if (current !== written) {
    // Someone else rewrote the inline value since; it is theirs now.
    lease?.zoom.delete(element);
    return false;
  }
  element.style.setProperty('zoom', `${1 / zoom}`);
  const value = element.style.getPropertyValue('zoom');
  if (value === written) return false;
  leaseFor(element, owner).zoom.set(element, value);
  return true;
}

/**
 * Whether `element` sits inside a native top-layer ancestor (an open popover, a modal dialog).
 * Floating UI measures such an element's clipping ancestors straight past the top layer, so its
 * reference-hidden answer would describe scrollers that no longer clip it.
 */
export function hasTopLayerAncestor(element: Element): boolean {
  let node: Node = fixedContainingBlockParentNode(element);
  while (node instanceof Element && !isLastTraversableFixedContainingBlockNode(node)) {
    if (isNativeTopLayerElement(node)) return true;
    const parent = fixedContainingBlockParentNode(node);
    if (parent === node) break;
    node = parent;
  }
  return false;
}

/**
 * Hides a library-promoted popup whose reference has scrolled out of its clipping ancestors, and
 * shows it again once the reference is visible. A promoted popup has no clipping ancestors of its
 * own, so without this it would float detached over the page. Never writes while another inline
 * `visibility` value is present (for example the pending-placement `hidden !important`), and only
 * ever removes the value it wrote.
 */
export function applyReferenceHidden(
  popup: HTMLElement,
  referenceHidden: boolean,
  owner: HTMLElement = popup,
): void {
  const hide = referenceHidden && isLibraryPromotedAndShowing(popup);
  const lease = leaseByOwner.get(owner);
  const written = lease?.visibility.get(popup);
  if (hide) {
    if (written !== undefined || popup.style.getPropertyValue('visibility') !== '') return;
    popup.style.setProperty('visibility', 'hidden');
    leaseFor(popup, owner).visibility.set(popup, popup.style.getPropertyValue('visibility'));
    return;
  }
  if (written === undefined) return;
  // A pending-placement conceal holds `hidden !important` over our value and restores it later,
  // so keep the claim until that conceal is gone.
  if (popup.style.getPropertyPriority('visibility') === 'important') return;
  removeWrittenStyle(popup, 'visibility', written);
  lease?.visibility.delete(popup);
}
