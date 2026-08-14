import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { hasRealContent } from './a11y.js';
import { SEED_FIRST_RENDER_STATE, SLOT_PRESENCE_UNRESOLVED } from './lyra-element.js';

type SlotPresenceHost = ReactiveControllerHost &
  Element & {
    readonly renderRoot?: EventTarget & ParentNode;
    readonly hasUpdated?: boolean;
    [SEED_FIRST_RENDER_STATE]?: (seed: () => void) => void;
    [SLOT_PRESENCE_UNRESOLVED]?: () => boolean;
  };

/** Realm-neutral slot check: constructor identity is not shared across iframe documents. */
function isSlotElement(node: Node): node is HTMLSlotElement {
  return (
    node.nodeType === 1 &&
    (node as Element).localName === 'slot' &&
    typeof (node as Partial<HTMLSlotElement>).assignedNodes === 'function'
  );
}

/** Resolves only real assignments through forwarding slots. Native `flatten: true` substitutes an
 * unassigned nested slot's fallback, but that fallback is component chrome rather than consumer
 * content. The active-path set also makes malformed/crafted assignment cycles fail closed. */
function assignedConsumerNodes(slot: HTMLSlotElement, active = new Set<Node>()): Node[] {
  if (active.has(slot)) return [];
  active.add(slot);
  const resolved: Node[] = [];
  for (const node of slot.assignedNodes()) {
    if (isSlotElement(node)) resolved.push(...assignedConsumerNodes(node, active));
    else resolved.push(node);
  }
  active.delete(slot);
  return resolved;
}

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
  #reconcileQueued = false;
  #connected = false;

  constructor(private readonly host: SlotPresenceHost) {
    host.addController(this);
  }

  /** Whether the named slot has real content. Omit `name` for the default slot. */
  has(name = ''): boolean {
    return (this.#presence.get(name) ?? false) ||
      (this.host[SLOT_PRESENCE_UNRESOLVED]?.() ?? false);
  }

  hostConnected(): void {
    this.#connected = true;
    const seed = (): void => this.#seedAvailablePresence(true);
    if (this.host[SEED_FIRST_RENDER_STATE]) this.host[SEED_FIRST_RENDER_STATE](seed);
    else seed();
    this.#listen();
  }

  hostUpdate(): void {
    // Covers children appended while disconnected before the first/reconnect update, and any SSR
    // adapter that renders without delivering a browser `slotchange` event.
    // This runs before render, so the new map participates in the update already in progress and
    // must not schedule a redundant Lit update from inside the current cycle.
    const seed = (): void => this.#seedAvailablePresence(false);
    if (this.host[SEED_FIRST_RENDER_STATE]) this.host[SEED_FIRST_RENDER_STATE](seed);
    else seed();
  }

  hostUpdated(): void {
    this.#listen();
    this.#queueRenderedSlotReconciliation();
  }

  hostDisconnected(): void {
    this.#connected = false;
    this.#stopListening();
  }

  readonly #onSlotChange = (): void => {
    // Slot assignment can move one node between two names, so reseed every light-DOM group instead
    // of trusting only event.target.name. The number of direct children on presence-driven
    // controls is small, and this keeps both sides of a reassignment correct after one event.
    this.#queueRenderedSlotReconciliation();
  };

  #queueRenderedSlotReconciliation(): void {
    if (this.#reconcileQueued) return;
    this.#reconcileQueued = true;
    // ReactiveElement invokes controller hostUpdated callbacks before its change-in-update check.
    // A synchronous requestUpdate here therefore warns even though native slot assignment can only
    // be sampled after render. The next microtask is past that check, and for a slotchange listener
    // it runs before the waiting test/consumer continuation observes the corrective update promise.
    queueMicrotask(() => {
      this.#reconcileQueued = false;
      if (!this.#connected) return;
      const seed = (): void => this.#seedRenderedSlots(true);
      if (this.host[SEED_FIRST_RENDER_STATE]) this.host[SEED_FIRST_RENDER_STATE](seed);
      else seed();
    });
  }

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
      this.#setPresence(name, present, requestUpdate);
    }
  }

  #seedRenderedSlots(requestUpdate: boolean): void {
    const root = this.host.renderRoot;
    if (!root || typeof root.querySelectorAll !== 'function') {
      this.#seedLightDom(requestUpdate);
      return;
    }
    const seen = new Set<string>();
    for (const slot of root.querySelectorAll('slot')) {
      if (!isSlotElement(slot)) continue;
      const name = slot.name;
      seen.add(name);
      const present = hasRealContent(assignedConsumerNodes(slot));
      this.#setPresence(name, present, requestUpdate);
    }
    for (const name of this.#presence.keys()) {
      if (!seen.has(name)) this.#setPresence(name, this.#lightDomPresence(name), requestUpdate);
    }
  }

  #lightDomPresence(name: string): boolean {
    if (typeof Node === 'undefined' || !('childNodes' in this.host)) return false;
    const nodes = Array.from(this.host.childNodes).filter((node) => {
      const assignedName =
        node.nodeType === Node.ELEMENT_NODE ? ((node as Element).getAttribute('slot') ?? '') : '';
      return assignedName === name;
    });
    const resolved = nodes.flatMap((node) => {
      if (isSlotElement(node)) return assignedConsumerNodes(node);
      return [node];
    });
    return hasRealContent(resolved);
  }

  #seedAvailablePresence(requestUpdate: boolean): void {
    // Before the first render there are no component-owned slots to resolve. Once a render root
    // exists, its native assignment is authoritative, including forwarding slots whose direct
    // light-DOM node is merely plumbing rather than real consumer content.
    if (this.host.hasUpdated) this.#seedRenderedSlots(requestUpdate);
    else this.#seedLightDom(requestUpdate);
  }

  #setPresence(name: string, present: boolean, requestUpdate: boolean): void {
    if (present === (this.#presence.get(name) ?? false)) return;
    this.#presence.set(name, present);
    if (requestUpdate) this.host.requestUpdate();
  }
}
