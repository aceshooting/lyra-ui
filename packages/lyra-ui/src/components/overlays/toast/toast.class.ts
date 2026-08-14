import { html, render, type TemplateResult } from 'lit';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { property } from 'lit/decorators.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './toast.styles.js';
import type { LyraToastItem, ToastVariant } from './toast-item.class.js';
import './toast-item.class.js';
import {
  isToastRegionEntry,
  TOAST_REGION_ENQUEUE,
  TOAST_REGION_EVICT,
  TOAST_REGION_REJECT,
  TOAST_REGION_SET_ACTIVE,
  type ToastRegionController,
  type ToastRegionEntry,
} from './toast-region-protocol.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_toastOverflow } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const MAX_VISIBLE_TOASTS = 3;
const MAX_QUEUED_TOASTS = 20;

export type ToastPlacement =
  | 'top-start'
  | 'top-center'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-center'
  | 'bottom-end';

export type LyraToastIconContent = string | Node | TemplateResult;
export type LyraToastIcon = LyraToastIconContent | ((ownerDocument: Document) => LyraToastIconContent);

/** Canonical options shared by the imperative helper and a toast region's object-form `create()`. */
export interface LyraToastOptions {
  message: string;
  placement?: ToastPlacement;
  ownerDocument?: Document;
  variant?: ToastVariant;
  duration?: number;
  /** Item size. Long upstream spellings remain observable on the created item. */
  size?: LyraSize;
  withIcon?: boolean;
  /** Safe icon content. Strings are text, nodes are appended/imported, and factories may return a
   * Lit template for the target document; no branch interprets a string as HTML. */
  icon?: LyraToastIcon;
  /** Optional action button rendered after the message. */
  action?: { label: string; onClick: (item: LyraToastItem) => void };
}

/** Options accepted beside the legacy string-form `create(message, options)`. */
export type ToastCreateOptions = Omit<LyraToastOptions, 'message' | 'placement'>;

export interface ToastOverflowDetail {
  /** Number of queued notifications discarded in the coalesced admission burst. */
  count: number;
}

export interface LyraToastEventMap {
  'lr-toast-overflow': CustomEvent<ToastOverflowDetail>;
}

/**
 * `<lr-toast>` — one placement-specific stacking toast region. The `toast()` helper maintains one
 * region per owner document and placement. Each keeps at most three items active and twenty more
 * in a hidden, inert FIFO queue. Further admissions discard the
 * oldest queued work and report the coalesced loss through an event and polite announcement.
 * Membership is reconciled before every admission and reasserted after reconnect/reparent; a
 * lasting region disconnect discards managed work instead of retaining nodes that could resurrect.
 * Mirrors the Web Awesome `<wa-toast>` API under the `lr-` prefix.
 *
 * @customElement lr-toast
 * @slot - `<lr-toast-item>` elements.
 * @event lr-toast-overflow - Noncancelable notification that queued items were discarded to keep
 *   the stack bounded. Synchronous losses are coalesced into `detail: { count }`.
 * @csspart stack - The fl-column container holding the items.
 * @cssprop --gap - Mapped alias for `--lr-toast-gap`.
 * @cssprop --width - Mapped alias for `--lr-toast-width`.
 * @cssprop [--lr-toast-gap=var(--lr-space-s)] - Gap between stacked items.
 * @cssprop [--lr-toast-width=var(--lr-size-28rem)] - Inline size of the stack, capped by the
 *   usable logical safe-area rectangle.
 * @cssprop [--lr-toast-accent-width=var(--lr-size-4px)] - Width of a slotted item's accent bar.
 *   Read by `<lr-toast-item>`'s own stylesheet, so set it on the item.
 * @cssprop [--lr-toast-accent-color=var(--lr-color-border)] - Accent bar / icon color of a slotted
 *   item, auto-swapped per its `variant`. Read by `<lr-toast-item>`, so set it on the item.
 * @cssprop [--lr-toast-padding=var(--lr-space-m)] - Padding of a slotted item, auto-swapped per its
 *   `size`. Read by `<lr-toast-item>`, so set it on the item.
 * @cssprop [--lr-toast-font-size=var(--lr-font-size-m)] - Font size of a slotted item,
 *   auto-swapped per its `size`. Read by `<lr-toast-item>`, so set it on the item.
 * @cssprop [--lr-toast-show-duration=var(--lr-transition-base, 180ms ease-out)] - Show transition
 *   of a slotted item. Read by `<lr-toast-item>`, so set it on the item.
 * @cssprop [--lr-toast-hide-duration=var(--lr-transition-base, 180ms ease-out)] - Hide transition
 *   of a slotted item. Read by `<lr-toast-item>`, so set it on the item.
 * @cssstate visible - Present while the region contains at least one toast item.
 * @status stable
 * @since 4.0.0
 */
export class LyraToast extends LyraElement<LyraToastEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    toastOverflow: LYRA_DEFAULT_toastOverflow,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Where the stack anchors on screen. */
  @property({ reflect: true }) placement: ToastPlacement = 'top-end';

  private readonly toastInternals = attachInternalsSafely(this);
  private childObserver?: MutationObserver;
  private readonly managedEntries = new Set<ToastRegionEntry>();
  private readonly activeEntries: ToastRegionEntry[] = [];
  private readonly queuedEntries: ToastRegionEntry[] = [];
  private readonly admissionsInProgress = new Set<ToastRegionEntry>();
  private connectionGeneration = 0;
  private overflowSink?: AnnouncementSink;
  private pendingOverflowCount = 0;
  private overflowNotificationScheduled = false;

  /** Live stack element, or `null` before the render root is populated. */
  get stack(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('[part="stack"]');
  }

  private syncVisibleState = (): void => {
    const hasToast =
      this.isConnected && Array.from(this.children).some((child) => isToastRegionEntry(child));
    setCustomState(this.toastInternals, 'visible', hasToast);
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.connectionGeneration += 1;
    this.overflowSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    const MutationObserverConstructor = this.ownerDocument.defaultView?.MutationObserver;
    if (MutationObserverConstructor) {
      this.childObserver = new MutationObserverConstructor(this.reconcileEntries);
      this.childObserver.observe(this, { childList: true });
    }
    this.reconcileEntries();
    this.syncVisibleState();
  }

  override disconnectedCallback(): void {
    const connectionGeneration = ++this.connectionGeneration;
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.overflowSink?.release();
    this.overflowSink = undefined;
    this.pendingOverflowCount = 0;
    this.overflowNotificationScheduled = false;
    setCustomState(this.toastInternals, 'visible', false);
    const releaseAfterLastingDisconnect = (): void => {
      if (connectionGeneration !== this.connectionGeneration || this.isConnected) return;
      for (const entry of [...this.managedEntries]) {
        this.forgetEntry(entry);
        entry[TOAST_REGION_EVICT](this.regionController, 'rejected');
        // An entry can already have relinquished stale protocol ownership while still physically
        // parented here. A disconnected region must never retain and later resurrect that work.
        if (entry.parentElement === this) entry.remove();
      }
      this.activeEntries.length = 0;
      this.queuedEntries.length = 0;
      this.managedEntries.clear();
      this.admissionsInProgress.clear();
    };
    const view = this.ownerDocument.defaultView;
    if (view) view.queueMicrotask(releaseAfterLastingDisconnect);
    else queueMicrotask(releaseAfterLastingDisconnect);
    super.disconnectedCallback();
  }

  private get regionController(): ToastRegionController {
    // The symbol protocol is deliberately structural and runtime-only. Keeping the cast here
    // prevents its private coordination types from becoming accidental root-package API.
    return this as unknown as ToastRegionController;
  }

  /** @internal */
  [TOAST_REGION_ENQUEUE](entry: HTMLElement): void {
    if (!isToastRegionEntry(entry)) return;
    this.pruneAbsentEntries();
    this.promoteQueuedEntries();
    if (entry.parentElement !== this) {
      this.admissionsInProgress.add(entry);
      try {
        this.appendChild(entry);
      } finally {
        this.admissionsInProgress.delete(entry);
      }
    } else if (this.admissionsInProgress.has(entry)) {
      // appendChild() synchronously invokes the entry's connectedCallback. Let the outer admission
      // finish after that callback returns instead of recursively admitting the same node twice.
      return;
    }
    if (entry.parentElement !== this) return;
    if (!this.managedEntries.has(entry)) this.admitEntry(entry);
    else this.reassertEntry(entry);
    this.syncVisibleState();
  }

  /** @internal */
  [TOAST_REGION_REJECT](entry: HTMLElement): void {
    if (!isToastRegionEntry(entry)) return;
    if (!this.managedEntries.has(entry)) return;
    this.forgetEntry(entry);
    entry[TOAST_REGION_EVICT](this.regionController, 'rejected');
    this.promoteQueuedEntries();
    this.syncVisibleState();
  }

  private admitEntry(entry: ToastRegionEntry): void {
    if (entry.parentElement !== this) return;
    this.managedEntries.add(entry);
    if (this.activeEntries.length < MAX_VISIBLE_TOASTS) {
      this.activeEntries.push(entry);
      entry[TOAST_REGION_SET_ACTIVE](this.regionController, true);
      return;
    }

    if (this.queuedEntries.length >= MAX_QUEUED_TOASTS) {
      const evicted = this.queuedEntries.shift();
      if (evicted) {
        this.managedEntries.delete(evicted);
        evicted[TOAST_REGION_EVICT](this.regionController, 'overflow');
        this.recordOverflow();
      }
    }
    this.queuedEntries.push(entry);
    entry[TOAST_REGION_SET_ACTIVE](this.regionController, false);
  }

  private reassertEntry(entry: ToastRegionEntry): void {
    if (entry.parentElement !== this) return;
    if (this.activeEntries.includes(entry)) {
      entry[TOAST_REGION_SET_ACTIVE](this.regionController, true);
      return;
    }
    if (this.queuedEntries.includes(entry)) {
      entry[TOAST_REGION_SET_ACTIVE](this.regionController, false);
      return;
    }
    // Repair an internally inconsistent membership atomically instead of keeping a managed entry
    // that occupies neither capacity bucket.
    this.managedEntries.delete(entry);
    this.admitEntry(entry);
  }

  private pruneAbsentEntries(): void {
    for (const entry of [...this.managedEntries]) {
      if (entry.parentElement !== this) this.forgetEntry(entry);
    }
  }

  private forgetEntry(entry: ToastRegionEntry): void {
    this.managedEntries.delete(entry);
    const activeIndex = this.activeEntries.indexOf(entry);
    if (activeIndex >= 0) this.activeEntries.splice(activeIndex, 1);
    const queuedIndex = this.queuedEntries.indexOf(entry);
    if (queuedIndex >= 0) this.queuedEntries.splice(queuedIndex, 1);
  }

  private promoteQueuedEntries(): void {
    while (this.activeEntries.length < MAX_VISIBLE_TOASTS && this.queuedEntries.length > 0) {
      const entry = this.queuedEntries.shift();
      if (!entry || !this.managedEntries.has(entry) || entry.parentElement !== this) continue;
      this.activeEntries.push(entry);
      entry[TOAST_REGION_SET_ACTIVE](this.regionController, true);
    }
  }

  private reconcileEntries = (): void => {
    const children = Array.from(this.children);
    this.pruneAbsentEntries();
    this.promoteQueuedEntries();
    for (const child of children) {
      if (!isToastRegionEntry(child)) {
        if (child.localName === tag('toast-item')) child.remove();
        continue;
      }
      if (!this.managedEntries.has(child)) this.admitEntry(child);
      else this.reassertEntry(child);
    }
    this.promoteQueuedEntries();
    this.syncVisibleState();
  };

  private recordOverflow(): void {
    this.pendingOverflowCount += 1;
    if (this.overflowNotificationScheduled) return;
    this.overflowNotificationScheduled = true;
    const notify = (): void => {
      this.overflowNotificationScheduled = false;
      const count = this.pendingOverflowCount;
      this.pendingOverflowCount = 0;
      if (count <= 0) return;
      this.emit('lr-toast-overflow', { count });
      if (this.isConnected) {
        this.overflowSink?.announce(this.localize('toastOverflow', undefined, { count }));
      }
    };
    const view = this.ownerDocument.defaultView;
    if (view) view.queueMicrotask(notify);
    else queueMicrotask(notify);
  }

  /** Create and append a toast item programmatically. The object form shares the canonical
   * `LyraToastOptions` contract with `toast()`; the legacy string form remains supported. A
   * detached region rejects immediately rather than returning an update promise that cannot run. */
  create(options: LyraToastOptions): Promise<LyraToastItem>;
  create(message: string, options?: ToastCreateOptions): Promise<LyraToastItem>;
  async create(
    messageOrOptions: string | LyraToastOptions,
    legacyOptions: ToastCreateOptions = {},
  ): Promise<LyraToastItem> {
    if (!this.isConnected) throw new TypeError('A toast region must be connected before create().');
    const options: LyraToastOptions = typeof messageOrOptions === 'string'
      ? { ...legacyOptions, message: messageOrOptions }
      : messageOrOptions;
    if (options.ownerDocument && options.ownerDocument !== this.ownerDocument) {
      throw new TypeError('Toast ownerDocument must match the region owner document.');
    }
    if (options.placement && options.placement !== this.placement) {
      throw new TypeError('Toast placement must match the region placement.');
    }
    const itemTag = tag('toast-item');
    const ownerRegistry = this.ownerDocument.defaultView?.customElements;
    if (!ownerRegistry?.get(itemTag)) {
      throw new TypeError(`${itemTag} is not registered in the toast owner document.`);
    }
    const item = this.ownerDocument.createElement(itemTag) as LyraToastItem;
    if (typeof item.hide !== 'function' || !('updateComplete' in item)) {
      throw new TypeError(`${itemTag} does not expose the Lyra toast-item contract.`);
    }
    // Only assign what the caller actually specified -- a freshly-created
    // <lr-toast-item> already carries its own property defaults, so
    // falling back to a literal here (e.g. `?? 5000`) would duplicate those
    // defaults in a second place that has no way of staying in sync if the
    // property declaration in toast-item.ts ever changes.
    if (options.variant !== undefined) item.variant = options.variant;
    if (options.duration !== undefined) item.duration = options.duration;
    if (options.size !== undefined) item.size = options.size;
    if (options.withIcon !== undefined) item.withIcon = options.withIcon;
    item.textContent = options.message;
    if (options.icon !== undefined) {
      item.withIcon = true;
      const iconHost = this.ownerDocument.createElement('span');
      iconHost.slot = 'icon';
      iconHost.setAttribute('aria-hidden', 'true');
      const content = typeof options.icon === 'function'
        ? options.icon(this.ownerDocument)
        : options.icon;
      if (typeof content === 'string') {
        iconHost.textContent = content;
      } else if (content && typeof content === 'object' && 'nodeType' in content) {
        const node = content as Node;
        iconHost.append(node.ownerDocument === this.ownerDocument
          ? node
          : this.ownerDocument.importNode(node, true));
      } else {
        render(content, iconHost);
      }
      item.append(iconHost);
    }
    if (options.action) {
      const action = this.ownerDocument.createElement('button');
      action.type = 'button';
      action.textContent = options.action.label;
      action.addEventListener('click', () => options.action?.onClick(item));
      item.append(action);
    }
    if (!isToastRegionEntry(item)) {
      throw new TypeError(`${itemTag} does not expose the bounded toast-region protocol.`);
    }
    this[TOAST_REGION_ENQUEUE](item);
    this.syncVisibleState();
    await item.updateComplete;
    return item;
  }

  override render(): TemplateResult {
    // Toast items announce their normalized messages through the shared
    // light-DOM sinks. Keeping a live role on this visible stack would pull
    // its controls back into an atomic announcement subtree.
    return html`<div part="stack"><slot @slotchange=${this.syncVisibleState}></slot></div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-toast': LyraToast;
  }
}
