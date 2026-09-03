import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './intersection-observer.styles.js';
import { disconnectObserver, slottedElementTargets } from '../../../internal/slotted-observer.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';

const MAX_OBSERVER_OPTION_VALUES = 10_000;

export interface LyraIntersectionObserverEventMap {
  'lr-intersection': CustomEvent<
    Readonly<{ entries: readonly IntersectionObserverEntry[] }>
  >;
  'lr-intersect': CustomEvent<{ entry: IntersectionObserverEntry }>;
}

function isElementNode(value: unknown): value is Element {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  try {
    if (typeof Element === 'undefined') return false;
    // A native Element method brand-checks its receiver across realms without reading arbitrary
    // lookalike properties (which could be accessor-backed or proxy-trapped).
    Element.prototype.getAttribute.call(value, 'data-lr-brand-probe');
    return true;
  } catch {
    return false;
  }
}

function normalizedThreshold(value: unknown): number | number[] {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
  if (typeof value === 'string') {
    const values = value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter((candidate) => Number.isFinite(candidate) && candidate >= 0 && candidate <= 1);
    return values.length > 0 ? values : 0;
  }
  try {
    if (!Array.isArray(value)) return 0;
    const length = getOwnDataDescriptor(value, 'length');
    if (
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0
    )
      return 0;
    const values: number[] = [];
    for (let index = 0; index < Math.min(length.value, MAX_OBSERVER_OPTION_VALUES); index += 1) {
      const entry = getOwnDataDescriptor(value, String(index));
      if (
        entry === MISSING_OWN_DATA_DESCRIPTOR ||
        entry === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof entry.value !== 'number' ||
        !Number.isFinite(entry.value) ||
        entry.value < 0 ||
        entry.value > 1
      )
        continue;
      values.push(entry.value);
    }
    return values.length > 0 ? values : 0;
  } catch {
    return 0;
  }
}

function observerEntries(entries: readonly IntersectionObserverEntry[]): readonly {
  entry: IntersectionObserverEntry;
  isIntersecting: boolean;
  target: Element;
}[] {
  const projected: { entry: IntersectionObserverEntry; isIntersecting: boolean; target: Element }[] = [];
  try {
    for (const entry of entries) {
      try {
        const target = entry.target;
        if (!isElementNode(target)) continue;
        projected.push({ entry, target, isIntersecting: entry.isIntersecting === true });
      } catch {
        // A malformed callback entry must not strand later native entries.
      }
    }
  } catch {
    return Object.freeze(projected);
  }
  return Object.freeze(projected);
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
 * frozen `detail: { entries: readonly IntersectionObserverEntry[] }`; the detached bounded
 * sequence retains native entry identities.
 * @csspart base - The non-layout wrapper around the observed slot.
 * @status stable
 * @since 4.0.0
 */
export class LyraIntersectionObserver extends LyraElement<LyraIntersectionObserverEventMap> {
  static override styles = [LyraElement.styles, styles];

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-intersection',
  ]);

  protected static override readonly identityEventDetailCollectionItems =
    Object.freeze({ 'lr-intersection': Object.freeze(['entries']) });

  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ attribute: 'root-margin' }) rootMargin = '0px';
  @property() threshold: number | number[] | string = '0';
  /** Element root or mapped element-ID string. */
  @property() root: Element | string | null = null;
  @property({ attribute: 'intersect-class' }) intersectClass = '';
  /** Stops observing each target after its first intersection. Consumed targets stay consumed
   * across option-driven observer rebuilds and reconnects; setting `once` to false resets them. */
  @property({ type: Boolean, reflect: true }) once = false;

  private observer?: IntersectionObserver;
  private observerDocument?: Document;
  private observerGeneration = 0;
  private onceIntersectedTargets = new WeakSet<Element>();

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
    if (changed.has('once') && this.once !== true) {
      // Turning the one-shot behavior off is the explicit reset boundary. Observer option
      // rebuilds and disconnect/reconnect cycles must otherwise retain consumed targets.
      this.onceIntersectedTargets = new WeakSet<Element>();
    }
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
    const observer = this.observer;
    // Clear the ownership fields before crossing a consumer-controlled observer boundary. A
    // malformed implementation can throw while resolving or invoking disconnect(), but it must
    // not retain a current observer through a later rebuild or reconnect.
    this.observer = undefined;
    this.observerDocument = undefined;
    try {
      disconnectObserver(observer);
    } catch {
      // Observer implementations are optional capabilities; teardown failures fail closed.
    }
  }

  private observeTargets = (): void => {
    this.disconnect();
    const ownerDocument = this.ownerDocument;
    let IntersectionObserverCtor: typeof IntersectionObserver | undefined;
    try {
      IntersectionObserverCtor = ownerDocument.defaultView?.IntersectionObserver;
    } catch {
      // A configurable owner-window capability getter is also part of the optional boundary.
      return;
    }
    const disabled = this.disabled === true;
    const once = this.once === true;
    const rootMarginValue = this.rootMargin;
    const rootMargin = typeof rootMarginValue === 'string' ? rootMarginValue : '0px';
    const threshold = normalizedThreshold(this.threshold);
    const classValue = this.intersectClass;
    const classes = typeof classValue === 'string'
      ? Object.freeze(classValue.trim().split(/\s+/).filter(Boolean))
      : Object.freeze([]);
    const rootValue = this.root;
    const root = typeof rootValue === 'string'
      ? ownerDocument.getElementById(rootValue.trim().replace(/^#/, ''))
      : isElementNode(rootValue)
        ? rootValue
        : null;
    if (disabled || !this.isConnected || !IntersectionObserverCtor) return;
    let targets: Element[];
    try {
      targets = slottedElementTargets(this.renderRoot).filter(
        (target) => !once || !this.onceIntersectedTargets.has(target),
      );
    } catch {
      return;
    }
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
      const batch = observerEntries(entries).filter(
        ({ target }) => !once || !this.onceIntersectedTargets.has(target),
      );
      if (batch.length === 0) return;
      for (const { entry, target, isIntersecting } of batch) {
        if (!isCurrentObserver()) return;
        if (once && isIntersecting) this.onceIntersectedTargets.add(target);
        for (const token of classes) {
          try {
            target.classList.toggle(token, isIntersecting);
          } catch {
            // A custom element's class-list boundary cannot prevent later entries from emitting.
          }
        }
        this.emit('lr-intersect', { entry });
        // An item listener may synchronously disconnect or adopt the wrapper. Stop the remainder
        // of the native batch instead of unobserving through, or emitting from, a retired owner.
        if (!isCurrentObserver()) return;
        if (once && isIntersecting) {
          try {
            observer.unobserve(target);
          } catch {
            // A failed native cleanup is contained by the next observer rebuild/disconnect.
          }
        }
      }
      if (isCurrentObserver()) this.emit('lr-intersection', { entries: batch.map(({ entry }) => entry) });
    };
    const options: IntersectionObserverInit = {
      root,
      rootMargin,
      threshold,
    };
    try {
      observer = new IntersectionObserverCtor(callback, options);
    } catch {
      try {
        // Native parsing owns the root-margin grammar. A hostile constructor or invalid public
        // options leave this update inert instead of escaping the component boundary.
        observer = new IntersectionObserverCtor(callback, {
          root: null,
          rootMargin: '0px',
          threshold: 0,
        });
      } catch {
        return;
      }
    }
    this.observer = observer;
    this.observerDocument = ownerDocument;
    let observed = false;
    for (const target of targets) {
      try {
        observer.observe(target);
        observed = true;
      } catch {
        // A single custom/native target can reject observation without affecting later targets.
      }
    }
    if (!observed) this.disconnect();
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
