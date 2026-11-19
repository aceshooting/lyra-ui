import { OwnedMutationObserver } from '../../../internal/owned-observer.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { PropertyValues, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './intersection-observer.styles.js';
import { ownerObserverConstructor, SlottedObserverController } from '../../../internal/slotted-observer.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
  readOwnArrayLength,
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
    const length = readOwnArrayLength(value);
    if (length === undefined) return 0;
    const values: number[] = [];
    for (let index = 0; index < Math.min(length, MAX_OBSERVER_OPTION_VALUES); index += 1) {
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
 * @event lr-intersect - Emitted once per accepted native entry with `detail: { entry }`.
 * @event lr-intersection - Compatibility batch event emitted once per callback with
 * frozen `detail: { entries: readonly IntersectionObserverEntry[] }`; the detached bounded
 * sequence retains native entry identities.
 * @csspart base - The non-layout wrapper around the observed slot.
 * @status stable
 * @since 4.0.0
 */
export class LyraIntersectionObserver extends LyraElement<LyraIntersectionObserverEventMap> {
  static override styles = [LyraElement.styles, styles];
  protected static override collectionSupport = collectionSupport;

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-intersection',
  ]);

  protected static override readonly identityEventDetailCollectionItems =
    Object.freeze({ 'lr-intersection': Object.freeze(['entries']) });

  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ attribute: 'root-margin' }) rootMargin = '0px';
  @property({
    hasChanged: (value, old) => JSON.stringify(normalizedThreshold(value)) !== JSON.stringify(normalizedThreshold(old)),
  })
  threshold: number | number[] | string = '0';
  /** Element root or mapped element-ID string, resolved in the host's tree before the document. */
  @property() root: Element | string | null = null;
  @property({ attribute: 'intersect-class' }) intersectClass = '';
  /** Stops observing each target after its first intersection. Later entries for that target are
   * ignored even within the same batch. Consumed targets stay consumed across observer rebuilds
   * and reconnects; setting `once` to false resets them. */
  @property({ type: Boolean, reflect: true }) once = false;

  private readonly pendingRoot = new OwnedMutationObserver(this, () => {
    if (this.resolveRoot()) this.slotted.rebuild();
  });

  private resolveRoot(): Element | null {
    const value = this.root;
    if (typeof value !== 'string') return isElementNode(value) ? value : null;
    const id = value.trim().replace(/^#/, '');
    return (this.getRootNode() as Document | ShadowRoot).getElementById?.(id) ?? this.ownerDocument.getElementById(id);
  }

  private onceIntersectedTargets = new WeakSet<Element>();
  private appliedClasses = new Map<Element, Set<string>>();

  /** Removes intersect-class tokens this element applied that the current options no longer ask for. */
  private pruneAppliedClasses(keep: readonly string[]): void {
    for (const [target, tokens] of this.appliedClasses) {
      for (const token of tokens) {
        if (keep.includes(token)) continue;
        try {
          target.classList.remove(token);
        } catch {
          // A custom element's class-list boundary cannot block the remaining cleanup.
        }
        tokens.delete(token);
      }
      if (tokens.size === 0) this.appliedClasses.delete(target);
    }
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.slotted.retire();
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
    ) this.slotted.schedule();
  }

  private readonly slotted: SlottedObserverController<IntersectionObserver> = new SlottedObserverController(this, {
    schedule: (rebuild) => this.scheduleAfterUpdate(rebuild),
    retired: () => this.pendingRoot.clear(),
    configure: (ownerDocument) => {
      const IntersectionObserverCtor = ownerObserverConstructor(ownerDocument, 'IntersectionObserver');
      const disabled = this.disabled === true;
      const once = this.once === true;
      const rootMarginValue = this.rootMargin;
      const rootMargin = typeof rootMarginValue === 'string' ? rootMarginValue : '0px';
      const threshold = normalizedThreshold(this.threshold);
      const classValue = this.intersectClass;
      const classes = typeof classValue === 'string'
        ? Object.freeze(classValue.trim().split(/\s+/).filter(Boolean))
        : Object.freeze([]);
      this.pruneAppliedClasses(disabled ? [] : classes);
      if (disabled || !IntersectionObserverCtor) return undefined;
      let root: Element | null = null;
      return {
        ready: () => {
          root = this.resolveRoot();
          if (root || typeof this.root !== 'string' || !this.root.trim()) return true;
          const options = { subtree: true, childList: true, attributes: true, attributeFilter: ['id'] };
          const tree = this.getRootNode();
          this.pendingRoot.observe(tree, options);
          if (tree !== ownerDocument) this.pendingRoot.observe(ownerDocument, options);
          return false;
        },
        accept: (target) => !once || !this.onceIntersectedTargets.has(target),
        create: (session) => {
          let observer: IntersectionObserver;
          const callback: IntersectionObserverCallback = (entries) => {
            if (!session.current()) return;
            const delivered: IntersectionObserverEntry[] = [];
            for (const { entry, target, isIntersecting } of observerEntries(entries)) {
              if (!session.current()) return;
              if (once && this.onceIntersectedTargets.has(target)) continue;
              if (once && isIntersecting) this.onceIntersectedTargets.add(target);
              for (const token of classes) {
                try {
                  target.classList.toggle(token, isIntersecting);
                  const applied = this.appliedClasses.get(target) ?? new Set<string>();
                  if (isIntersecting) applied.add(token);
                  else applied.delete(token);
                  if (applied.size > 0) this.appliedClasses.set(target, applied);
                  else this.appliedClasses.delete(target);
                } catch {
                  // A custom element's class-list boundary cannot prevent later entries from emitting.
                }
              }
              delivered.push(entry);
              this.emit('lr-intersect', { entry });
              // An item listener may synchronously disconnect or adopt the wrapper. Stop the remainder
              // of the native batch instead of unobserving through, or emitting from, a retired owner.
              if (!session.current()) return;
              if (once && isIntersecting) {
                try {
                  observer.unobserve(target);
                } catch {
                  // A failed native cleanup is contained by the next observer rebuild/disconnect.
                }
              }
            }
            if (delivered.length && session.current()) this.emit('lr-intersection', { entries: delivered });
          };
          try {
            observer = new IntersectionObserverCtor(callback, { root, rootMargin, threshold });
          } catch {
            // Native parsing owns the root-margin grammar. A hostile constructor or invalid public
            // options leave this update inert instead of escaping the component boundary.
            observer = new IntersectionObserverCtor(callback, { root: null, rootMargin: '0px', threshold: 0 });
          }
          return observer;
        },
        observe: (observer, target) => observer.observe(target),
      };
    },
  });

  override render(): TemplateResult {
    return this.slotted.renderSlot();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-intersection-observer': LyraIntersectionObserver;
  }
}
