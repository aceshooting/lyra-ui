import { LitElement, type CSSResultGroup } from 'lit';
import { tokens } from './tokens.styles.js';

/**
 * Shared base for every Lyra component. Supplies the design-token layer
 * (Web Awesome `--wa-*` tokens with `--lyra-*` fallbacks). RTL is handled by
 * components using CSS logical properties rather than a forced `dir`.
 */
export class LyraElement extends LitElement {
  static styles: CSSResultGroup = [tokens];

  /** Dispatch a composed, bubbling `lyra-*` custom event. */
  protected emit<T = unknown>(name: string, detail?: T): CustomEvent<T> {
    const event = new CustomEvent<T>(name, {
      detail: detail as T,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
    return event;
  }
}
