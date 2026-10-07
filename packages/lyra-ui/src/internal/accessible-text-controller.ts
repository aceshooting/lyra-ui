import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  accessibleTextRecordsMatter,
  bindAccessibleTextObserver,
  composedAccessibilityText,
} from './accessibility-visibility.js';
import { CustomElementUpgradeObserver } from './custom-element-upgrade-observer.js';

/** Owns label observation in the host's current realm; the first bind is silent. */
export class AccessibleTextController implements ReactiveController {
  private observer?: MutationObserver;
  private readonly upgrades = new CustomElementUpgradeObserver(() => this.changed());
  private active = false;
  private slotRoot?: ShadowRoot;
  private readonly onSlotChange = (event: Event): void => {
    const slot = event.target as Element | null;
    if (slot?.localName !== 'slot' || !this.slots.includes(slot.getAttribute('name') ?? '')) return;
    this.changed();
  };

  constructor(
    private readonly host: HTMLElement & ReactiveControllerHost,
    private readonly slots: readonly string[],
    private readonly onChange: (records: readonly MutationRecord[]) => void,
    private readonly extraAttributes: readonly string[] = [],
    private enabled = true,
  ) {
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
      const relevant = observer && pending.length > 0 && accessibleTextRecordsMatter(observer, pending);
      this.bindSlotRoot();
      this.bind();
      if (relevant) queueMicrotask(() => {
        if (this.active && this.enabled && this.observer === observer && this.host.isConnected)
          this.onChange(pending);
      });
    }
  }

  hostDisconnected(): void {
    this.active = false;
    this.slotRoot?.removeEventListener('slotchange', this.onSlotChange);
    this.slotRoot = undefined;
    this.observer?.disconnect();
    this.observer = undefined;
    this.upgrades.disconnect();
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
      this.slotRoot?.removeEventListener('slotchange', this.onSlotChange);
      this.slotRoot = undefined;
      this.observer?.disconnect();
      this.observer = undefined;
      this.upgrades.disconnect();
    }
  }

  /** Rebind after a render path or assigned content changes. */
  bind(): void {
    bindAccessibleTextObserver(this.observer, this.host, this.extraAttributes, this.upgrades);
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
    this.observer?.disconnect();
    this.upgrades.disconnect();
    const Observer = this.host.ownerDocument.defaultView?.MutationObserver;
    this.observer = Observer
      ? new Observer((records, observer) => {
        if (accessibleTextRecordsMatter(observer, records)) this.changed(records);
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

  private changed(records: MutationRecord[] = []): void {
    if (!this.active || !this.enabled || !this.host.isConnected) return;
    this.bind();
    this.onChange(records);
  }
}
