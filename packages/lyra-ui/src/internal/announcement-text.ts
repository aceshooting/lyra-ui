/**
 * Compatibility entry for the shared bounded composed accessibility-text traversal.
 *
 * The implementation lives with the visibility predicates it consumes so label, announcement,
 * typeahead and semantic-owner paths cannot drift into separate recursive walkers.
 */
import {
  composedAccessibilityTextResult,
  type ComposedAccessibilityTextOptions,
} from './accessibility-visibility.js';

export {
  composedAccessibilityText,
  composedAccessibilityTextResult,
} from './accessibility-visibility.js';

import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { CustomElementUpgradeObserver } from './custom-element-upgrade-observer.js';

/** Collects announcement text and follows definitions that can introduce new shadow roots. */
class AnnouncementUpgradeObserver extends CustomElementUpgradeObserver {
  collect(
    node: Node,
    roots: Set<ShadowRoot>,
    options: ComposedAccessibilityTextOptions = {},
  ): string {
    const result = composedAccessibilityTextResult(node, {
      ...options,
      shouldPrune: (element) => {
        if (options.shouldPrune?.(element)) return true;
        this.observeElement(element);
        return false;
      },
    });
    for (const root of result.traversedShadowRoots) roots.add(root);
    return result.text;
  }

}

/** Attributes whose change can alter the announced text or its exposure. */
const ANNOUNCEMENT_ATTRIBUTES = [
  'alt', 'aria-hidden', 'aria-label', 'class', 'hidden', 'inert', 'open', 'slot', 'style',
];

export interface SlottedAnnouncementOptions {
  /** True for a top-level light child of the host that feeds the announcement (slot membership). */
  feeds: (top: Node) => boolean;
  /** Builds the announcement text; call `controller.collect(node)` for each fed child. */
  text: (controller: SlottedAnnouncementController) => string;
  /** Called with the changed text once the controller is armed (never for the first mount). */
  announce: (text: string) => void;
  /** Extra gate (for example `open`); announcements and baselines are skipped while false. */
  canAnnounce?: () => boolean;
  /** Further filter for mutation records whose target is inside the host. Defaults to relevant. */
  isRelevantMutation?: (record: MutationRecord) => boolean;
  /** Runs once after arming, so a host can force an opted-in initial announcement. */
  armed?: (controller: SlottedAnnouncementController) => void;
  /** Wait a paint before arming so first slot distribution is never mistaken for a change. */
  waitForFrame?: boolean;
}

/**
 * Observes slotted live-region content in the host's owner realm and announces later changes.
 *
 * Owns the mutation observer, forwarding-slot walk, shadow-root and custom-element-upgrade
 * tracking, the arming baseline (the first mount is silent) and a generation guard against stale
 * callbacks after disconnect or reconnect. The host supplies the text and the announcement.
 */
export class SlottedAnnouncementController implements ReactiveController {
  /** True once the baseline is seeded; before then changes only refresh observation. */
  armed = false;
  readonly roots = new Set<ShadowRoot>();
  private observer?: MutationObserver;
  private lastText = '';
  private generation = 0;
  private connected = false;
  private readonly upgrades = new AnnouncementUpgradeObserver(() => this.refresh());
  private readonly onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    if (!this.forwardingSlots().includes(slot)) return;
    this.refresh();
  };

  constructor(
    private readonly host: HTMLElement & ReactiveControllerHost,
    private readonly options: SlottedAnnouncementOptions,
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.connected = true;
    this.host.addEventListener('slotchange', this.onSlotChange);
    this.armed = false;
    this.lastText = '';
    const Observer = this.host.ownerDocument.defaultView?.MutationObserver;
    if (Observer) {
      const observer: MutationObserver = new Observer((records) => {
        if (this.observer !== observer) return;
        if (records.some((record) =>
          !this.host.contains(record.target) || (this.options.isRelevantMutation?.(record) ?? true))) this.refresh();
      });
      this.observer = observer;
      this.observe();
    }
    const generation = ++this.generation;
    const live = (): boolean => this.connected && this.host.isConnected && generation === this.generation;
    void this.host.updateComplete
      .then(() => {
        const view = this.host.ownerDocument?.defaultView;
        return this.options.waitForFrame && typeof view?.requestAnimationFrame === 'function'
          ? new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()))
          : undefined;
      })
      .then(() => this.host.updateComplete)
      .then(() => {
        if (!live()) return;
        this.lastText = this.options.text(this);
        // Seeding can discover shadow roots of late-rendering children.
        this.observe();
        this.armed = true;
        this.options.armed?.(this);
      });
  }

  hostDisconnected(): void {
    this.connected = false;
    this.generation++;
    this.armed = false;
    this.lastText = '';
    this.observer?.disconnect();
    this.observer = undefined;
    this.roots.clear();
    this.upgrades.disconnect();
    this.host.removeEventListener('slotchange', this.onSlotChange);
  }

  /** Extracts one fed child's text through the upgrade-aware traversal, recording shadow roots. */
  collect(node: Node): string {
    return this.upgrades.collect(node, this.roots);
  }

  /** Clears the shadow roots recorded by the previous extraction; call at the start of `text()`. */
  resetRoots(): void {
    this.roots.clear();
  }

  /** Top-level light children that feed the announcement. */
  topLevel(node: Node): Node | undefined {
    let top: Node = node;
    while (top.parentNode && top.parentNode !== this.host) top = top.parentNode;
    return top.parentNode === this.host ? top : undefined;
  }

  /** Slots forwarded from the host's light DOM into a fed child, whose assignment changes announce. */
  forwardingSlots(): HTMLSlotElement[] {
    return Array.from(this.host.querySelectorAll<HTMLSlotElement>('slot')).filter((slot) => {
      const top = this.topLevel(slot);
      return !!top && this.options.feeds(top);
    });
  }

  /** (Re)binds the observer to the host, assigned forwarded content and discovered shadow roots. */
  observe(): void {
    const observer = this.observer;
    if (!observer) return;
    observer.disconnect();
    const init: MutationObserverInit = {
      attributes: true,
      attributeFilter: ANNOUNCEMENT_ATTRIBUTES,
      characterData: true,
      childList: true,
      subtree: true,
    };
    observer.observe(this.host, init);
    for (const slot of this.forwardingSlots()) {
      if (slot.assignedNodes().length === 0) continue;
      for (const assigned of slot.assignedNodes({ flatten: true })) observer.observe(assigned, init);
    }
    for (const root of this.roots) observer.observe(root, init);
  }

  /** Announces the current text when armed, gated and different from the last (or when forced). */
  announceCurrent(force = false): void {
    if (!this.armed || !this.connected || !this.host.isConnected) return;
    if (this.options.canAnnounce && !this.options.canAnnounce()) return;
    const text = this.options.text(this);
    if (!force && text === this.lastText) return;
    this.lastText = text;
    this.options.announce(text);
  }

  private refresh(): void {
    this.announceCurrent();
    this.observe();
  }
}
