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

const FORWARDED_HOST_ARIA_ATTRIBUTES = ['aria-label', 'aria-describedby'] as const;

/**
 * Shared base for every Lyra component. Supplies the design-token layer
 * (`--lr-theme-*` theme-input properties with hardcoded `--lr-*` fallbacks).
 * RTL is handled by components using CSS logical properties rather than a forced `dir`.
 */
export class LyraElement<Events = LyraEventMap> extends LitElement {
  static override styles: CSSResultGroup = [tokens];

  /**
   * Components commonly forward these global host attributes to the element
   * that owns the internal role. They are not reactive Lit properties, so
   * observe them centrally to keep post-render attribute changes in sync.
   */
  static override get observedAttributes(): string[] {
    return [...new Set([...super.observedAttributes, ...FORWARDED_HOST_ARIA_ATTRIBUTES])];
  }

  /** Optional locale override. Otherwise the nearest `locale`/`lang` ancestor is used. */
  @property({ reflect: true }) locale = '';

  /** Per-instance message overrides, useful for application-specific wording. */
  @property({ attribute: false }) strings: LyraLocaleStrings = {};

  private stopLocaleSubscription?: () => void;
  private pendingLoadController?: AbortController;
  private loadSchedulePending = false;
  private deferredLoad?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnected element may sit under a different `lang`/`dir` ancestor,
    // and Lit schedules no update for a pure DOM move — the memo from the
    // previous tree must not carry over.
    enableLyraLocaleCache(this);
    invalidateLyraLocaleCache(this);
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
      FORWARDED_HOST_ARIA_ATTRIBUTES.includes(name as (typeof FORWARDED_HOST_ARIA_ATTRIBUTES)[number])
    ) {
      this.requestUpdate();
    }
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
