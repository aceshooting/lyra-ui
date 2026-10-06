import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { tag } from './prefix.js';

type SlottedOverlayHost = ReactiveControllerHost & HTMLElement;

/** Lifecycle events every anchored Lyra overlay emits; all of them bubble and are composed. */
const OVERLAY_LIFECYCLE_EVENTS = ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide'] as const;

/**
 * The anchored surfaces whose public `open` reports their settled state and whose panel can open
 * into the top layer: the menu overlays and the pickers that emit the same lifecycle. Disclosures
 * and alerts also emit it, but their content stays inside the slot, so they are deliberately absent.
 */
const overlayTags = (): readonly string[] => [
  tag('dropdown'),
  tag('popover'),
  tag('context-menu'),
  tag('select'),
  tag('combobox'),
  tag('color-picker'),
  tag('date-input'),
  tag('time-input'),
  tag('export-button'),
];

const overlaySelector = (): string => overlayTags().join(', ');

function isAnchoredOverlay(node: EventTarget | undefined): node is Element {
  if (!node || (node as Partial<Node>).nodeType !== 1) return false;
  return overlayTags().includes((node as Element).localName);
}

const isOpenOverlay = (overlay: Element): boolean =>
  overlay.isConnected && (overlay as { open?: unknown }).open === true;

/**
 * Tracks whether an anchored overlay (`lr-dropdown`, `lr-popover`, `lr-context-menu`, or a picker
 * such as `lr-select` or `lr-color-picker`, including one composed inside another component's
 * shadow root) opened from content assigned to one of the host's slots is open, and requests a host
 * update whenever that answer changes.
 *
 * Such an overlay opens into the browser top layer, and Chromium and WebKit then stop matching
 * `:hover` and `:focus-within` on its DOM ancestors while the pointer or focus is inside the popup.
 * A row or card that reveals its actions on hover or focus would therefore hide the very trigger
 * whose menu the user is in -- and a `display`-based reveal would also conceal the menu, because a
 * positioned popup is hidden once its trigger stops being measurable. The host renders this answer
 * as a state so its reveal survives the whole time the overlay is open, however it was opened.
 *
 * The answer comes from the overlays' own lifecycle events, so an overlay nested in another
 * component's shadow root is tracked too. `lr-show` and `lr-hide` fire before a listener can still
 * veto the change, so the settled `open` value is read once the dispatch has finished.
 */
export class SlottedOverlayController implements ReactiveController {
  readonly #host: SlottedOverlayHost;
  readonly #slot: () => HTMLSlotElement | null | undefined;
  readonly #tracked = new Set<Element>();
  #open = false;
  #connected = false;
  #reconcilePending = false;

  constructor(host: SlottedOverlayHost, slot: () => HTMLSlotElement | null | undefined) {
    this.#host = host;
    this.#slot = slot;
    host.addController(this);
  }

  /** Whether an overlay opened from the slot's content is open right now. */
  get open(): boolean {
    return this.#open;
  }

  hostConnected(): void {
    this.#connected = true;
    for (const type of OVERLAY_LIFECYCLE_EVENTS) {
      this.#host.addEventListener(type, this.#onLifecycle);
    }
    // An overlay that stays open across a move (a keyed reorder, a virtualized row coming back)
    // emits no lifecycle event when it reconnects, so read the slot -- now on a reconnect, or after
    // the first render has created it.
    if (this.#slot()) this.#reconcile();
    else this.#reconcilePending = true;
  }

  hostUpdated(): void {
    if (!this.#reconcilePending) return;
    this.#reconcilePending = false;
    this.#reconcile();
  }

  hostDisconnected(): void {
    this.#connected = false;
    this.#reconcilePending = false;
    for (const type of OVERLAY_LIFECYCLE_EVENTS) {
      this.#host.removeEventListener(type, this.#onLifecycle);
    }
    this.#tracked.clear();
    this.#sync();
  }

  #onLifecycle = (event: Event): void => {
    const path = event.composedPath();
    const overlay = path[0];
    const slot = this.#slot();
    if (!isAnchoredOverlay(overlay) || !slot || !path.includes(slot)) return;
    queueMicrotask(() => {
      if (!this.#connected) return;
      if (isOpenOverlay(overlay)) this.#tracked.add(overlay);
      else this.#tracked.delete(overlay);
      this.#sync();
    });
  };

  #reconcile(): void {
    const slot = this.#slot();
    if (slot) {
      const selector = overlaySelector();
      for (const assigned of slot.assignedElements({ flatten: true })) {
        const candidates = [
          ...(assigned.matches(selector) ? [assigned] : []),
          ...assigned.querySelectorAll(selector),
        ];
        for (const overlay of candidates) {
          if (isOpenOverlay(overlay)) this.#tracked.add(overlay);
        }
      }
    }
    this.#sync();
  }

  #sync(): void {
    // An overlay removed while open emits nothing, so prune whenever the answer is recomputed.
    for (const overlay of this.#tracked) {
      if (!isOpenOverlay(overlay)) this.#tracked.delete(overlay);
    }
    const next = this.#tracked.size > 0;
    if (next === this.#open) return;
    this.#open = next;
    this.#host.requestUpdate();
  }
}
