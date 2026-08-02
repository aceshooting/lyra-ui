import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { hasRealContent } from './a11y.js';

type SlotPresenceHost = ReactiveControllerHost &
  Element & {
    readonly renderRoot?: EventTarget;
  };

/**
 * Tracks whether each light-DOM slot carries meaningful consumer content.
 *
 * Presence is seeded directly from the host's children during connection, before Lit's first
 * render, so declarative labels/adornments never flash through an empty state while waiting for
 * `slotchange`. After render, one delegated listener on the render root keeps every slot name in
 * sync. Reading light DOM also excludes a `<slot>` element's fallback children: fallback is
 * component chrome, not consumer-provided slot presence.
 *
 * The controller intentionally answers only the generic presence question. Components whose
 * default slot is an option/item collection keep their specialized assigned-element handler for
 * identity, ordering, and mutation semantics.
 */
export class SlotPresenceController implements ReactiveController {
  readonly #presence = new Map<string, boolean>();
  #listeningRoot?: EventTarget;

  constructor(private readonly host: SlotPresenceHost) {
    host.addController(this);
    this.#seedLightDom(false);
  }

  /** Whether the named slot has real content. Omit `name` for the default slot. */
  has(name = ''): boolean {
    return this.#presence.get(name) ?? false;
  }

  hostConnected(): void {
    this.#seedLightDom(true);
    this.#listen();
  }

  hostUpdate(): void {
    // Covers children appended while disconnected before the first/reconnect update, and any SSR
    // adapter that renders without delivering a browser `slotchange` event.
    // This runs before render, so the new map participates in the update already in progress and
    // must not schedule a redundant Lit update from inside the current cycle.
    this.#seedLightDom(false);
  }

  hostUpdated(): void {
    this.#listen();
  }

  hostDisconnected(): void {
    this.#stopListening();
  }

  readonly #onSlotChange = (): void => {
    // Slot assignment can move one node between two names, so reseed every light-DOM group instead
    // of trusting only event.target.name. The number of direct children on presence-driven
    // controls is small, and this keeps both sides of a reassignment correct after one event.
    this.#seedLightDom(true);
  };

  #listen(): void {
    const root = this.host.renderRoot;
    if (!root || typeof root.addEventListener !== 'function' || root === this.#listeningRoot) return;
    this.#stopListening();
    root.addEventListener('slotchange', this.#onSlotChange, true);
    this.#listeningRoot = root;
  }

  #stopListening(): void {
    this.#listeningRoot?.removeEventListener('slotchange', this.#onSlotChange, true);
    this.#listeningRoot = undefined;
  }

  #seedLightDom(requestUpdate: boolean): void {
    // `Node` and even `childNodes` can be absent in server-only adapters. In that environment the
    // safe pre-hydration answer is false; a browser reconnect seeds the real light DOM later.
    if (typeof Node === 'undefined' || !('childNodes' in this.host)) return;

    const groups = new Map<string, Node[]>();
    for (const node of Array.from(this.host.childNodes)) {
      const name =
        node.nodeType === Node.ELEMENT_NODE ? ((node as Element).getAttribute('slot') ?? '') : '';
      const nodes = groups.get(name) ?? [];
      nodes.push(node);
      groups.set(name, nodes);
    }

    // Retain old names in the pass so removing the final node from a slot flips it back to false.
    const names = new Set([...this.#presence.keys(), ...groups.keys()]);
    for (const name of names) {
      const present = hasRealContent(groups.get(name) ?? []);
      if (present === (this.#presence.get(name) ?? false)) continue;
      this.#presence.set(name, present);
      if (requestUpdate) this.host.requestUpdate();
    }
  }
}
