import { LitElement, type CSSResultGroup } from 'lit';
import { property } from 'lit/decorators.js';
import { tokens } from './tokens.styles.js';
import {
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

/**
 * Shared base for every Lyra component. Supplies the design-token layer
 * (`--lyra-theme-*` theme-input properties with hardcoded `--lyra-*` fallbacks).
 * RTL is handled by components using CSS logical properties rather than a forced `dir`.
 */
export class LyraElement<Events = LyraEventMap> extends LitElement {
  static styles: CSSResultGroup = [tokens];

  /** Optional locale override. Otherwise the nearest `locale`/`lang` ancestor is used. */
  @property({ reflect: true }) locale = '';

  /** Per-instance message overrides, useful for application-specific wording. */
  @property({ attribute: false }) strings: LyraLocaleStrings = {};

  private stopLocaleSubscription?: () => void;
  private pendingLoadController?: AbortController;
  private loadSchedulePending = false;
  private deferredLoad?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.stopLocaleSubscription = subscribeLyraLocale(() => this.requestUpdate());
    const deferred = this.deferredLoad;
    if (deferred) {
      this.deferredLoad = undefined;
      this.scheduleAfterUpdate(deferred);
    }
  }

  disconnectedCallback(): void {
    this.pendingLoadController?.abort();
    this.pendingLoadController = undefined;
    this.stopLocaleSubscription?.();
    this.stopLocaleSubscription = undefined;
    super.disconnectedCallback();
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

  addEventListener<K extends keyof Events & string>(
    type: K,
    listener: (this: this, event: Events[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: unknown,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener as EventListenerOrEventListenerObject, options);
  }

  removeEventListener<K extends keyof Events & string>(
    type: K,
    listener: (this: this, event: Events[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
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
