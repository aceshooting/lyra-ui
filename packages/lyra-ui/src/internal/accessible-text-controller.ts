import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  type AccessibleTextReferences,
  accessibleTextRecordsMatter,
  bindAccessibleTextObserver,
  composedAccessibilityText,
  releaseAccessibleTextReferences,
} from './accessibility-visibility.js';
import { assignedSlotOf } from './composed-tree.js';
import { CustomElementUpgradeObserver } from './custom-element-upgrade-observer.js';
import { OwnedFrame, OwnedTimeout } from './owned-timer.js';

/** Owns label observation in the host's current realm; the first bind is silent. */
export class AccessibleTextController implements ReactiveController {
  private observer?: MutationObserver;
  private readonly upgrades = new CustomElementUpgradeObserver(() => this.changed());
  private readonly visibilityFrame: OwnedFrame;
  private readonly visibilityTimer: OwnedTimeout;
  private active = false;
  private readonly references?: AccessibleTextReferences;
  private slotRoot?: ShadowRoot;
  private readonly onSlotChange = (event: Event): void => {
    // Forwarded slotchange events retain the forwarding slot as their target. Its name
    // belongs to the outer host; the slot in our own root determines which content changed.
    const slot = event.composedPath().find((target): target is HTMLSlotElement =>
      (target as Element).localName === 'slot' && (target as Element).getRootNode() === this.slotRoot,
    );
    if (!slot || !this.slots.includes(slot.name)) return;
    this.changed();
  };

  constructor(
    private readonly host: HTMLElement & ReactiveControllerHost,
    private readonly slots: readonly string[],
    private readonly onChange: (records: readonly MutationRecord[]) => void,
    private readonly extraAttributes: readonly string[] = [],
    private enabled = true,
    trackReferences = false,
  ) {
    if (trackReferences) this.references = { releases: [], changed: () => this.changed() };
    this.visibilityFrame = new OwnedFrame(host);
    this.visibilityTimer = new OwnedTimeout(host);
    host.addController(this);
  }

  hostConnected(): void {
    this.active = true;
    if (this.enabled) {
      this.bindSlotRoot();
      this.rebuild();
    }
  }

  hostUpdated(): void {
    if (this.active && this.enabled) {
      const observer = this.observer;
      const pending = observer?.takeRecords() ?? [];
      const relevant = observer && pending.length > 0 && this.recordsMatter(pending) &&
        accessibleTextRecordsMatter(observer, pending);
      this.bindSlotRoot();
      this.bind();
      if (relevant) queueMicrotask(() => {
        if (this.active && this.enabled && this.observer === observer && this.host.isConnected)
          this.notify(pending);
      });
    }
  }

  hostDisconnected(): void {
    this.active = false;
    this.cancelVisibilityRefresh();
    this.slotRoot?.removeEventListener('slotchange', this.onSlotChange);
    this.slotRoot = undefined;
    this.observer?.disconnect();
    this.observer = undefined;
    this.upgrades.disconnect();
    if (this.references) releaseAccessibleTextReferences(this.references);
  }

  /** A host's adoptedCallback calls this to replace the old realm's observer. */
  adopted(): void {
    if (this.active && this.enabled) this.rebuild();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!this.active) return;
    if (enabled) {
      this.bindSlotRoot();
      this.rebuild();
    } else {
      this.cancelVisibilityRefresh();
      this.slotRoot?.removeEventListener('slotchange', this.onSlotChange);
      this.slotRoot = undefined;
      this.observer?.disconnect();
      this.observer = undefined;
      this.upgrades.disconnect();
      if (this.references) releaseAccessibleTextReferences(this.references);
    }
  }

  /** Rebind after a render path or assigned content changes. */
  bind(): void {
    bindAccessibleTextObserver(this.observer, this.host, this.extraAttributes, this.upgrades, this.references);
  }

  /** Drains pending records for synchronous label getters. */
  takeRecords(): MutationRecord[] { return this.observer?.takeRecords() ?? []; }

  text(): string {
    const root = this.host.shadowRoot;
    const slots = root
      ? [...root.querySelectorAll<HTMLSlotElement>('slot')]
        .filter((slot) => this.slots.includes(slot.name))
      : [];
    const nodes = slots.length
      ? slots.flatMap((slot) => [...slot.assignedNodes({ flatten: true })])
      : [...this.host.childNodes].filter((node) =>
        node.nodeType !== 1 || this.slots.includes((node as Element).getAttribute('slot') ?? ''),
      );
    return composedAccessibilityText(nodes);
  }

  hasContent(): boolean { return this.text().trim().length > 0; }

  private rebuild(): void {
    this.cancelVisibilityRefresh();
    this.observer?.disconnect();
    this.upgrades.disconnect();
    if (this.references) releaseAccessibleTextReferences(this.references);
    const Observer = this.host.ownerDocument.defaultView?.MutationObserver;
    this.observer = Observer
      ? new Observer((records, observer) => {
        if (this.observer !== observer) return;
        if (this.recordsMatter(records) && accessibleTextRecordsMatter(observer, records)) this.changed(records);
      })
      : undefined;
    this.bind();
  }

  private bindSlotRoot(): void {
    const root = this.host.shadowRoot ?? undefined;
    if (this.slotRoot === root) return;
    this.slotRoot?.removeEventListener('slotchange', this.onSlotChange);
    this.slotRoot = root;
    root?.addEventListener('slotchange', this.onSlotChange);
  }

  private recordsMatter(records: readonly MutationRecord[]): boolean {
    if (this.slots.length === 0) return true;
    const feedsSlot = (start: Node): boolean => {
      const visited = new Set<Node>();
      let node: Node | null = start;
      while (node && node !== this.host && !visited.has(node)) {
        visited.add(node);
        if (node.parentNode === this.host) {
          const name = node.nodeType === 1 ? (node as Element).getAttribute('slot') ?? '' : '';
          return this.slots.includes(name);
        }
        node = assignedSlotOf(node) ?? node.parentNode ?? (node as ShadowRoot).host ?? null;
      }
      // Ancestor visibility changes and detached removed content still invalidate the label.
      return true;
    };
    return records.some((record) => {
      if (record.type === 'attributes' && record.attributeName === 'slot') return true;
      if (record.target === this.host && record.type === 'childList') {
        return [...record.addedNodes, ...record.removedNodes].some((node) =>
          node.nodeType !== 1 ? this.slots.includes('') : this.slots.includes((node as Element).getAttribute('slot') ?? ''),
        );
      }
      return feedsSlot(record.target);
    });
  }

  private changed(records: MutationRecord[] = []): void {
    if (!this.active || !this.enabled || !this.host.isConnected) return;
    this.bind();
    this.notify(records);
  }

  private notify(records: readonly MutationRecord[]): void {
    this.onChange(records);
    if (!records.some((record) => record.type === 'attributes' &&
      ['class', 'style', 'hidden'].includes(record.attributeName ?? ''))) return;
    // Slot inheritance can settle after mutation delivery, particularly when a visible descendant
    // overrides a newly hidden parent. Recheck once after the owner realm has applied its cascade.
    if (this.visibilityFrame.pending || this.visibilityTimer.pending) return;
    this.visibilityFrame.schedule(() => {
      this.visibilityTimer.schedule(0, () => {
        if (this.active && this.enabled) this.onChange([]);
      });
    });
  }

  private cancelVisibilityRefresh(): void {
    this.visibilityFrame.cancel();
    this.visibilityTimer.cancel();
  }
}
