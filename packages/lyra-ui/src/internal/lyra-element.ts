import { LitElement, type CSSResultGroup, type PropertyDeclaration } from 'lit';
import { property } from 'lit/decorators.js';
import { tokens } from './tokens.styles.js';
import {
  enableLyraLocaleCache,
  invalidateLyraLocaleCache,
  resolveLyraDirection,
  resolveLyraString,
  resolveLyraLocale,
  subscribeLyraLocale,
  type LyraLocaleStrings,
} from './localization.js';

export interface LyraEmitOptions {
  /** Set only for events whose listener may veto an operation before it runs. */
  cancelable?: boolean;
}

export type LyraEventMap = Record<string, Event>;

const REACTIVE_HOST_ATTRIBUTES = ['aria-label', 'aria-describedby', 'lang', 'dir'] as const;
const INHERITED_CONTEXT_ATTRIBUTES = ['locale', 'lang', 'dir'] as const;

function composedParentElement(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root.host : null;
}

/**
 * Shared base for every Lyra component. Supplies the design-token layer
 * (`--lr-theme-*` theme-input properties with hardcoded `--lr-*` fallbacks).
 * RTL is handled by components using CSS logical properties rather than a forced `dir`.
 */
export class LyraElement<Events = LyraEventMap> extends LitElement {
  static override styles: CSSResultGroup = [tokens];

  /**
   * Components commonly forward ARIA host attributes to an internal role and derive localization
   * from `lang`/`dir`. These global attributes are not reactive Lit properties, so observe them
   * centrally to keep post-render attribute changes in sync.
   */
  static override get observedAttributes(): string[] {
    return [...new Set([...super.observedAttributes, ...REACTIVE_HOST_ATTRIBUTES])];
  }

  /** Optional locale override. Otherwise the nearest `locale`/`lang` ancestor is used. */
  @property({ reflect: true }) locale = '';

  /** Per-instance message overrides, useful for application-specific wording. */
  @property({ attribute: false }) strings: LyraLocaleStrings = {};

  private stopLocaleSubscription?: () => void;
  private pendingLoadController?: AbortController;
  private loadSchedulePending = false;
  private deferredLoad?: () => void;
  private inheritedContextObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnected element may sit under a different `lang`/`dir` ancestor,
    // and Lit schedules no update for a pure DOM move — the memo from the
    // previous tree must not carry over.
    enableLyraLocaleCache(this);
    invalidateLyraLocaleCache(this);
    this.observeInheritedContext();
    this.stopLocaleSubscription = subscribeLyraLocale(() => this.requestUpdate());
    const deferred = this.deferredLoad;
    if (deferred) {
      this.deferredLoad = undefined;
      this.scheduleAfterUpdate(deferred);
    }
  }

  override disconnectedCallback(): void {
    this.pendingLoadController?.abort();
    this.pendingLoadController = undefined;
    this.stopLocaleSubscription?.();
    this.stopLocaleSubscription = undefined;
    this.inheritedContextObserver?.disconnect();
    this.inheritedContextObserver = undefined;
    invalidateLyraLocaleCache(this);
    super.disconnectedCallback();
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
    }
  }

  private observeInheritedContext(): void {
    this.inheritedContextObserver?.disconnect();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => this.requestUpdate());
    let ancestor = composedParentElement(this);
    while (ancestor) {
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: [...INHERITED_CONTEXT_ATTRIBUTES],
      });
      ancestor = composedParentElement(ancestor);
    }
    this.inheritedContextObserver = observer;
  }

  /** Starts a component-owned cancellable load and aborts the previous one. */
  protected beginAbortableLoad(): AbortSignal | undefined {
    this.pendingLoadController?.abort();
    if (typeof AbortController === 'undefined') return undefined;
    this.pendingLoadController = new AbortController();
    return this.pendingLoadController.signal;
  }

  /**
   * Runs one coalesced load callback after the current update completes.
   * Lit still runs the update cycle while detached, so a load scheduled then is
   * held and replayed on reconnect rather than dropped.
   */
  protected scheduleAfterUpdate(callback: () => void): void {
    if (this.loadSchedulePending) return;
    this.loadSchedulePending = true;
    queueMicrotask(() => {
      this.loadSchedulePending = false;
      if (this.isConnected) callback();
      else this.deferredLoad = callback;
    });
  }

  /** Resolve a localized message using this component's overrides and locale. */
  protected localize(
    key: string,
    fallback?: string,
    values?: Record<string, string | number>,
  ): string {
    return resolveLyraString(this, key, this.strings, fallback, values);
  }

  /** The effective locale used by this component. */
  protected get effectiveLocale(): string {
    return this.locale || resolveLyraLocale(this);
  }

  /** The effective text direction, including inherited CSS direction. */
  protected get effectiveDirection(): 'ltr' | 'rtl' {
    return resolveLyraDirection(this);
  }

  override addEventListener<K extends keyof Events & string>(
    type: K,
    listener: (this: this, event: Events[K]) => unknown,
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

  /** Dispatch a composed, bubbling custom event; notifications are not veto points by default. */
  protected emit<T = unknown>(name: string, detail?: T, options?: LyraEmitOptions): CustomEvent<T> {
    const event = new CustomEvent<T>(name, {
      detail: detail as T,
      bubbles: true,
      composed: true,
      cancelable: options?.cancelable ?? false,
    });
    this.dispatchEvent(event);
    return event;
  }
}
