import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './intersection-observer.styles.js';
import { disconnectObserver, slottedElementTargets } from '../../../internal/slotted-observer.js';

export interface LyraIntersectionObserverEventMap {
  'lr-intersection': CustomEvent<{ entries: IntersectionObserverEntry[] }>;
  'lr-intersect': CustomEvent<{ entry: IntersectionObserverEntry }>;
}

function isElementNode(value: unknown): value is Element {
  const candidate = value as {
    nodeType?: unknown;
    ownerDocument?: { nodeType?: unknown };
    getAttribute?: unknown;
    matches?: unknown;
    getBoundingClientRect?: unknown;
  } | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    candidate.nodeType === 1 &&
    candidate.ownerDocument?.nodeType === 9 &&
    typeof candidate.getAttribute === 'function' &&
    typeof candidate.matches === 'function' &&
    typeof candidate.getBoundingClientRect === 'function'
  );
}

/**
 * `<lr-intersection-observer>` — observes slotted targets entering or
 * leaving a viewport and emits the native intersection entries without adding
 * layout or requiring consumers to manage observer lifecycle.
 *
 * @customElement lr-intersection-observer
 * @slot - Elements to observe.
 * @event lr-intersect - Emitted once per native entry with `detail: { entry }`.
 * @event lr-intersection - Compatibility batch event emitted once per callback with
 * `detail: { entries }`.
 * @csspart base - The non-layout wrapper around the observed slot.
 * @status stable
 * @since 4.0.0
 */
export class LyraIntersectionObserver extends LyraElement<LyraIntersectionObserverEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ attribute: 'root-margin' }) rootMargin = '0px';
  @property() threshold: number | number[] | string = '0';
  /** Element root or mapped element-ID string. */
  @property() root: Element | string | null = null;
  @property({ attribute: 'intersect-class' }) intersectClass = '';
  @property({ type: Boolean, reflect: true }) once = false;

  private observer?: IntersectionObserver;
  private observerDocument?: Document;
  private observerGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent, a tab/panel re-hosting its
    // children, a virtualized list moving this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no
    // update and no slotchange in between (the assigned-node set is
    // unchanged by a pure reparent) -- so neither updated()'s
    // property-change gate nor a fresh slotchange ever fires to re-arm
    // observation. disconnectedCallback already tore the previous
    // IntersectionObserver down, so resume it here on every reconnect after
    // the very first (that initial case is already covered by the first
    // render's own slotchange).
    if (this.hasUpdated) this.scheduleAfterUpdate(this.observeTargets);
  }

  override disconnectedCallback(): void {
    this.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.disconnect();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Routed through the base class's connection-aware scheduler rather than
    // a bare queueMicrotask: Lit still runs a scheduled update (and this
    // method) even for an element that disconnects before that update's own
    // microtask fires, and a plain queueMicrotask has no way to notice that
    // and would still spin up a new, now-unreachable IntersectionObserver that
    // disconnectedCallback has already run and won't run again to clean up.
    if (
      changed.has('disabled') ||
      changed.has('rootMargin') ||
      changed.has('threshold') ||
      changed.has('root') ||
      changed.has('intersectClass') ||
      changed.has('once')
    ) this.scheduleAfterUpdate(this.observeTargets);
  }

  private onSlotChange = (): void => this.observeTargets();

  private disconnect(): void {
    this.observerGeneration += 1;
    this.observer = disconnectObserver(this.observer);
    this.observerDocument = undefined;
  }

  private observeTargets = (): void => {
    this.disconnect();
    const ownerDocument = this.ownerDocument;
    const IntersectionObserverCtor = ownerDocument.defaultView?.IntersectionObserver;
    if (this.disabled || !this.isConnected || !IntersectionObserverCtor) return;
    const targets = slottedElementTargets(this.renderRoot);
    if (targets.length === 0) return;
    const generation = this.observerGeneration;
    let observer: IntersectionObserver;
    const isCurrentObserver = (): boolean => (
      this.observer === observer &&
      this.observerDocument === ownerDocument &&
      this.observerGeneration === generation &&
      this.isConnected &&
      this.ownerDocument === ownerDocument
    );
    const callback: IntersectionObserverCallback = (entries) => {
      if (!isCurrentObserver()) return;
      const batch = [...entries];
      for (const entry of batch) {
        if (!isCurrentObserver()) return;
        for (const token of this.intersectClass.trim().split(/\s+/).filter(Boolean)) {
          entry.target.classList.toggle(token, entry.isIntersecting);
        }
        this.emit('lr-intersect', { entry });
        // An item listener may synchronously disconnect or adopt the wrapper. Stop the remainder
        // of the native batch instead of unobserving through, or emitting from, a retired owner.
        if (!isCurrentObserver()) return;
        if (this.once && entry.isIntersecting) observer.unobserve(entry.target);
      }
      if (isCurrentObserver()) this.emit('lr-intersection', { entries: batch });
    };
    const thresholdSource = typeof this.threshold === 'string'
      ? this.threshold.trim().split(/\s+/).filter(Boolean).map(Number)
      : Array.isArray(this.threshold)
        ? this.threshold
        : [this.threshold];
    const values = thresholdSource
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
    const threshold = values.length > 0
      ? typeof this.threshold === 'number'
        ? values[0]!
        : values
      : 0;
    const root = typeof this.root === 'string'
      ? this.ownerDocument.getElementById(this.root.trim().replace(/^#/, ''))
      : isElementNode(this.root)
        ? this.root
        : null;
    const options: IntersectionObserverInit = {
      root,
      rootMargin: this.rootMargin,
      threshold,
    };
    try {
      observer = new IntersectionObserverCtor(callback, options);
    } catch {
      // Native parsing owns the root-margin grammar. Invalid public options fall back to the
      // platform defaults rather than rejecting the scheduled update.
      observer = new IntersectionObserverCtor(callback, {
        root: options.root,
        rootMargin: '0px',
        threshold,
      });
    }
    this.observer = observer;
    this.observerDocument = ownerDocument;
    targets.forEach((target) => observer.observe(target));
  };

  override render(): TemplateResult {
    return html`<span part="base"><slot @slotchange=${this.onSlotChange}></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-intersection-observer': LyraIntersectionObserver;
  }
}
