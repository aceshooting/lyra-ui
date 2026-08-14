import { LitElement, type CSSResultGroup, type PropertyDeclaration } from 'lit';
import { property } from 'lit/decorators.js';
import { captureFormInternals, ExternalLabelController } from './form-control-labels.js';
import { tokens } from './tokens.styles.js';
import { palette } from './tokens/palette.styles.js';
import { resolveIntlLocale } from './intl-cache.js';
import {
  observeInheritedContext,
  recordInheritedDirectionRead,
  recordInheritedLocaleRead,
} from './inherited-context-observer.js';
import {
  canonicalizeLyraLocale,
  enableLyraLocaleCache,
  invalidateLyraLocaleCache,
  peekLyraLocale,
  resolveLyraDirection,
  resolveLyraString,
  resolveLyraLocale,
  snapshotLyraLocaleStrings,
  subscribeLyraLocaleForHost,
} from './localization-runtime.js';
import type { LyraLocaleStrings } from './localization.js';

export interface LyraEmitOptions {
  /** Set only for events whose listener may veto an operation before it runs. */
  cancelable?: boolean;
}

export type LyraEventMap = Record<string, Event>;

/**
 * The trailing `emit()` arguments for one entry of a component's event map.
 *
 * The map entry is the single source of truth: `CustomEvent<{ id: string }>` makes `detail`
 * **required** and typed, while `CustomEvent<undefined>` (or a `void`/optional detail) makes it
 * omittable. Entries that are not `CustomEvent` at all — the native re-emits some components list
 * as `input: Event` / `load: Event` — keep the permissive shape, since there is no declared detail
 * to check against.
 *
 * The tuple wrappers (`[Events[K]] extends [CustomEvent<…>]`) stop the conditional from
 * distributing over a union-typed map entry, which would otherwise turn one required `detail` into
 * a union of argument lists that no call site can satisfy.
 */
export type LyraEmitArgs<Events, K extends keyof Events & string> = [Events[K]] extends [
  CustomEvent<infer Detail>,
]
  ? undefined extends Detail
    ? [detail?: Detail, options?: LyraEmitOptions]
    : [detail: Detail, options?: LyraEmitOptions]
  : [detail?: unknown, options?: LyraEmitOptions];

/** The `CustomEvent` `emit()` returns for one entry of a component's event map. */
export type LyraEmittedEvent<Events, K extends keyof Events & string> = [Events[K]] extends [
  CustomEvent<infer Detail>,
]
  ? CustomEvent<Detail>
  : CustomEvent<unknown>;

/**
 * Internal controller seam for browser-derived state that must not change a hydrating element's
 * first render. A symbol keeps the hook out of the component API while allowing shared reactive
 * controllers to use the same hydration decision as their host.
 */
export const SEED_FIRST_RENDER_STATE = Symbol('lr-seed-first-render-state');
/** Internal query used by slot-presence controllers while SSR light DOM is unknowable. */
export const SLOT_PRESENCE_UNRESOLVED = Symbol('lr-slot-presence-unresolved');

const REACTIVE_HOST_ATTRIBUTES = ['aria-label', 'aria-describedby', 'lang', 'dir'] as const;
const DIRECTION_HOST_ATTRIBUTES = ['class', 'style'] as const;

/**
 * Shared base for every Lyra component. Supplies the design-token layer
 * (`--lr-theme-*` theme-input properties with hardcoded `--lr-*` fallbacks).
 * RTL is handled by components using CSS logical properties rather than a forced `dir`.
 */
export class LyraElement<Events = LyraEventMap> extends LitElement {
  // `palette` before `tokens`: the ramp and the semantic grid are raw inputs, and `tokens` is
  // free to reference them. Both are shared `CSSResult` instances, so adopting them in every
  // component costs one stylesheet in the bundle, not one per component.
  static override styles: CSSResultGroup = [palette, tokens];

  /** @internal English fallbacks owned by this class hierarchy and generated per component. */
  protected static readonly defaultStrings: Readonly<LyraLocaleStrings> = Object.freeze({});

  /**
   * Components commonly forward ARIA host attributes to an internal role and derive localization
   * from `lang`/`dir`. These global attributes are not reactive Lit properties, so observe them
   * centrally to keep post-render attribute changes in sync.
   */
  static override get observedAttributes(): string[] {
    return [
      ...new Set([...super.observedAttributes, ...REACTIVE_HOST_ATTRIBUTES, ...DIRECTION_HOST_ATTRIBUTES]),
    ];
  }

  /** Optional locale override. Otherwise the nearest `locale`/`lang` ancestor is used. */
  @property({ reflect: true }) locale = '';

  private stringsValue: LyraLocaleStrings = snapshotLyraLocaleStrings({});

  /**
   * Immutable, bounded per-instance message overrides, useful for application-specific wording.
   * Assignment snapshots own data-string/plural entries; malformed/accessor entries are omitted
   * and later caller mutation cannot alter rendered copy without a new assignment.
   */
  @property({ attribute: false })
  get strings(): LyraLocaleStrings {
    return this.stringsValue;
  }
  set strings(value: LyraLocaleStrings) {
    const previous = this.stringsValue;
    this.stringsValue = snapshotLyraLocaleStrings(value);
    this.requestUpdate('strings', previous);
  }

  private stopLocaleSubscription?: () => void;
  private pendingLoadController?: AbortController;
  /** Callbacks scheduled during the current update cycle, keyed so that two callers with
   *  *different* purposes each keep a slot. A single boolean here meant the second caller in a
   *  cycle was silently dropped. */
  private afterUpdateCallbacks?: Map<string, () => void>;
  /** Callbacks that came due while detached, replayed on reconnect. */
  private deferredAfterUpdate?: Map<string, () => void>;
  private stopInheritedContextObservation?: () => void;
  /** `undefined` until the first connect decides it, then true only between that connect and the
   *  first update of an element whose shadow DOM a server already rendered. See
   *  {@link seedFirstRenderState}. */
  private hydratingServerShadow?: boolean;
  /** Browser-only first-render reads coalesced behind one completed hydration update. */
  private deferredFirstRenderSeeds?: Set<() => void>;

  constructor() {
    super();
    // The external-label bridge is a property of being form-associated, not of any one component,
    // so it is installed here rather than repeated in every form-associated control that would
    // otherwise have to remember it (and would each be a silent a11y gap when they did not). It
    // costs one controller on a form-associated element and nothing at all on every other.
    if ((this.constructor as { formAssociated?: boolean }).formAssociated) {
      this.addController(new ExternalLabelController(this));
    }
  }

  /**
   * Records the internals a form-associated component attaches, so shared infrastructure can read
   * the platform-owned form relationships (`labels`, `form`) without every component having to
   * expose its own `internals` field publicly. Components attach through several different
   * spellings — the `FormAssociated` mixin, `attachInternalsSafely()`, a locally copied
   * `safeAttachInternals()` — but all of them bottom out in `host.attachInternals()`, which makes
   * this the one place that sees every case. Behaviour is otherwise unchanged, including the throw
   * a second attachment is required to produce.
   *
   * @internal
   */
  override attachInternals(): ElementInternals {
    const internals = super.attachInternals();
    captureFormInternals(this, internals);
    return internals;
  }

  override connectedCallback(): void {
    // Read before `super`, which creates the render root: on the very first connect a shadow root
    // can only already exist because the parser built it from server-rendered declarative markup,
    // which is exactly when the first browser render has to reproduce that markup rather than
    // whatever the browser alone can see.
    this.hydratingServerShadow ??= !this.hasUpdated && this.shadowRoot !== null;
    super.connectedCallback();
    // A reconnected element may sit under a different `lang`/`dir` ancestor,
    // and Lit schedules no update for a pure DOM move — the memo from the
    // previous tree must not carry over.
    enableLyraLocaleCache(this);
    invalidateLyraLocaleCache(this);
    this.stopInheritedContextObservation?.();
    this.stopInheritedContextObservation = observeInheritedContext(this);
    this.stopLocaleSubscription = subscribeLyraLocaleForHost(this, () => this.requestUpdate());
    const deferred = this.deferredAfterUpdate;
    if (deferred) {
      this.deferredAfterUpdate = undefined;
      for (const [key, callback] of deferred) this.scheduleAfterUpdate(callback, key);
    }
  }

  override disconnectedCallback(): void {
    this.pendingLoadController?.abort();
    this.pendingLoadController = undefined;
    this.stopLocaleSubscription?.();
    this.stopLocaleSubscription = undefined;
    this.stopInheritedContextObservation?.();
    this.stopInheritedContextObservation = undefined;
    invalidateLyraLocaleCache(this);
    super.disconnectedCallback();
  }

  /**
   * Shared adoption hook for components that retain owner-realm resources. Subclasses override
   * this callback and call `super.adoptedCallback()` just as they do for connect/disconnect; the
   * base invalidation prevents locale or direction state resolved in the former document from
   * surviving until an unrelated update.
   */
  adoptedCallback(): void {
    invalidateLyraLocaleCache(this);
  }

  /**
   * Every update cycle begins with at least one `requestUpdate()` call, and
   * unlike `willUpdate()` (which subclasses routinely override without a
   * `super` call) it cannot be bypassed — so this is the one reliable seam
   * for dropping the memoized locale/direction. Resolution then happens at
   * most once per update cycle no matter how many times a template loop calls
   * `localize()`/`effectiveLocale`/`effectiveDirection`.
   */
  override requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: PropertyDeclaration): void {
    invalidateLyraLocaleCache(this);
    super.requestUpdate(name, oldValue, options);
  }

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    super.attributeChangedCallback(name, oldValue, value);
    if (
      oldValue !== value &&
      REACTIVE_HOST_ATTRIBUTES.includes(name as (typeof REACTIVE_HOST_ATTRIBUTES)[number])
    ) {
      this.requestUpdate();
    } else if (
      oldValue !== value &&
      DIRECTION_HOST_ATTRIBUTES.includes(name as (typeof DIRECTION_HOST_ATTRIBUTES)[number])
    ) {
      // Host class/style changes are synchronous attribute mutations. Drop the computed-direction
      // memo immediately so keyboard handlers in the same task cannot observe the previous CSS
      // cascade; CSS itself handles the visual update, so no render is required here.
      invalidateLyraLocaleCache(this);
    }
  }

  /**
   * Runs `seed` before the first render — except while hydrating a server-rendered shadow root,
   * where it runs immediately *after* that first render instead.
   *
   * Several components read something only the browser can answer (their own light-DOM children,
   * a browser global such as `EyeDropper`) before their first render, so declaratively slotted
   * content never flashes the fallback for a frame. A server renderer can answer neither: Lit's
   * server DOM hands an element no children, and installs no browser globals. Seeding
   * unconditionally therefore makes the browser's first render disagree with the markup it is
   * supposed to be hydrating, which fails the hydration outright and throws the whole
   * server-rendered subtree away.
   *
   * Deferring by one update keeps both paths honest: a browser-only mount still seeds
   * synchronously (no flash, unchanged behavior), and a hydrating mount reproduces the server's
   * render, then corrects itself on the very next update.
   *
   * Call it from `willUpdate()` or `connectedCallback()`; it is a no-op once the element has
   * updated, so the usual `if (!this.hasUpdated)` guard around the seed is not needed.
   */
  protected seedFirstRenderState(seed: () => void): void {
    if (this.hasUpdated) return;
    this[SEED_FIRST_RENDER_STATE](seed);
  }

  /** @internal */
  [SEED_FIRST_RENDER_STATE](seed: () => void): void {
    if (!this.hydratingServerShadow) {
      seed();
      return;
    }
    const pending = (this.deferredFirstRenderSeeds ??= new Set());
    pending.add(seed);
    if (pending.size > 1) return;
    void this.updateComplete.then(
      () => {
        // Let every observer of the completed hydration update inspect the server-equivalent
        // first render before any browser-only correction schedules Lit's next one. A task (not
        // another promise reaction) is intentional: the SSR hydration client may register its
        // first-update observer only after custom-element definition resolves.
        setTimeout(() => {
          this.hydratingServerShadow = false;
          const seeds = this.deferredFirstRenderSeeds;
          this.deferredFirstRenderSeeds = undefined;
          for (const deferred of seeds ?? []) deferred();
          // Presence-driven renderers deliberately expose their slot wrappers while the server's
          // light-DOM answer is unresolved. Even an actually empty slot therefore needs one
          // corrective render after hydration to collapse that progressive fallback.
          this.requestUpdate();
        }, 0);
      },
      () => {
        // A first update that threw is not a hydration this element can still correct; drop the
        // flag so a later update seeds normally instead of deferring forever.
        this.hydratingServerShadow = false;
        this.deferredFirstRenderSeeds = undefined;
      },
    );
  }

  /**
   * Applies browser-derived state immediately, except during a server-shadow hydration's first
   * update. Unlike {@link seedFirstRenderState}, this remains active after the initial mount and
   * is therefore suitable for `slotchange` and observer callbacks that can arrive while Lit is
   * completing hydration.
   */
  protected updateBrowserDerivedState(update: () => void): void {
    this[SEED_FIRST_RENDER_STATE](update);
  }

  /** Keeps authored slot content visible in SSR/no-JS output until a browser can resolve it. */
  protected renderSlotPresence(present: boolean): boolean {
    return present || this[SLOT_PRESENCE_UNRESOLVED]();
  }

  /** @internal */
  [SLOT_PRESENCE_UNRESOLVED](): boolean {
    return typeof Node === 'undefined' || this.hydratingServerShadow === true;
  }

  /** Starts a component-owned cancellable load and aborts the previous one. */
  protected beginAbortableLoad(): AbortSignal | undefined {
    this.pendingLoadController?.abort();
    this.pendingLoadController = undefined;
    const AbortControllerCtor = this.ownerDocument.defaultView?.AbortController;
    if (!AbortControllerCtor) return undefined;
    this.pendingLoadController = new AbortControllerCtor();
    return this.pendingLoadController.signal;
  }

  /**
   * Runs callbacks once, after the current update completes, coalesced **per `key`**.
   *
   * Repeated schedules under the same key collapse to the first one — that is the whole point for
   * the default `'load'` key, where several property writes in one cycle must produce one fetch
   * rather than one per write. But callers with *different* purposes need their own slot: several
   * viewers schedule a `load()` and a locale-driven search recompute from the same `updated()`,
   * and while this coalesced on a single boolean the second one was silently dropped, leaving
   * search results collated for the previous locale. Pass a distinct `key` for distinct work.
   *
   * Lit still runs the update cycle while detached, so callbacks that come due then are held and
   * replayed on reconnect rather than dropped.
   */
  protected scheduleAfterUpdate(callback: () => void, key = 'load'): void {
    const pending = (this.afterUpdateCallbacks ??= new Map());
    if (pending.has(key)) return;
    pending.set(key, callback);
    // Only the first key of a cycle queues the drain; later keys join the same microtask.
    if (pending.size > 1) return;
    queueMicrotask(() => {
      const due = this.afterUpdateCallbacks;
      this.afterUpdateCallbacks = undefined;
      if (!due) return;
      if (this.isConnected) {
        for (const due_callback of due.values()) due_callback();
        return;
      }
      const held = (this.deferredAfterUpdate ??= new Map());
      for (const [heldKey, heldCallback] of due) if (!held.has(heldKey)) held.set(heldKey, heldCallback);
    });
  }

  /** Resolve a localized message using this component's overrides and locale. */
  protected localize(
    key: string,
    fallback?: string,
    values?: Record<string, string | number>,
  ): string {
    const message = resolveLyraString(
      this,
      key,
      this.strings,
      fallback,
      values,
      (this.constructor as typeof LyraElement).defaultStrings,
    );
    recordInheritedLocaleRead(this, peekLyraLocale(this));
    return message;
  }

  /** The canonical public locale used for message-catalog lookup and propagation to child controls. */
  protected get effectiveMessageLocale(): string {
    if (this.locale) return canonicalizeLyraLocale(this.locale);
    const locale = resolveLyraLocale(this);
    recordInheritedLocaleRead(this, locale);
    return locale;
  }

  /** The canonical, structurally valid locale used for locale-sensitive platform APIs. */
  protected get effectiveLocale(): string {
    return resolveIntlLocale(this.effectiveMessageLocale);
  }

  /** Explicit alias for helpers whose locale role would otherwise be ambiguous. */
  protected get effectiveIntlLocale(): string {
    return this.effectiveLocale;
  }

  /** The effective text direction, including inherited CSS direction. */
  protected get effectiveDirection(): 'ltr' | 'rtl' {
    const direction = resolveLyraDirection(this);
    recordInheritedDirectionRead(this, direction);
    return direction;
  }

  override addEventListener<K extends keyof Events & string>(
    type: K,
    listener: (this: this, event: Events[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: this, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: unknown,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener as EventListenerOrEventListenerObject, options);
  }

  override removeEventListener<K extends keyof Events & string>(
    type: K,
    listener: (this: this, event: Events[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: this, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: unknown,
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(type, listener as EventListenerOrEventListenerObject, options);
  }

  /**
   * Dispatch a composed, bubbling custom event; notifications are not veto points by default.
   *
   * `name` and `detail` are both checked against the component's own `Events` map — the same map
   * that types {@link addEventListener}. A misspelled event name, or a detail whose shape does not
   * match the one the map (and therefore the JSDoc, the manifest and the docs) advertises, is a
   * compile error rather than a silently-dispatched event nobody listens for. Components that do
   * not declare an event map keep the permissive `LyraEventMap` default.
   */
  protected emit<K extends keyof Events & string>(
    name: K,
    ...args: LyraEmitArgs<Events, K>
  ): LyraEmittedEvent<Events, K> {
    const [detail, options] = args as [unknown, LyraEmitOptions | undefined];
    // Events belong to the element's current document realm. This matters after iframe adoption:
    // consumers legitimately use the owner window's constructor for identity checks, and an
    // event created by the embedding window fails that contract even though dispatch succeeds.
    // Inert documents have no `defaultView` but still retain their creator realm. A probe created
    // by that document exposes the correct constructor; the global fallback exists only for
    // incomplete DOM shims whose `createEvent()` is absent or throws.
    const ownerDocument = (this as unknown as { ownerDocument?: Document }).ownerDocument;
    let CustomEventCtor = ownerDocument?.defaultView?.CustomEvent;
    if (!CustomEventCtor && ownerDocument) {
      try {
        const candidate = ownerDocument.createEvent('CustomEvent').constructor;
        if (typeof candidate === 'function') {
          CustomEventCtor = candidate as typeof CustomEvent;
        }
      } catch {
        // Fall through to the compatibility constructor below.
      }
    }
    CustomEventCtor ??= globalThis.CustomEvent;
    const event = new CustomEventCtor(name, {
      detail,
      bubbles: true,
      composed: true,
      cancelable: options?.cancelable ?? false,
    });
    this.dispatchEvent(event);
    return event as LyraEmittedEvent<Events, K>;
  }
}
