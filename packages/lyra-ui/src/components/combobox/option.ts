import { html, css, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';

/**
 * `<lyra-option>` — a selectable option for `<lyra-combobox>`.
 * Mirrors `<wa-option>`. Acts as the data source; the combobox renders the
 * interactive rows in its own shadow root and filters/caps them.
 *
 * The label is the element's text content (or an explicit `label` attribute).
 *
 * @customElement lyra-option
 */
export class LyraOption extends LyraElement {
  static styles = [
    LyraElement.styles,
    css`
      :host {
        display: none;
      }
    `,
  ];

  /** The selection key submitted with the form. */
  @property() value = '';

  /** Disable selecting this option. */
  @property({ type: Boolean }) disabled = false;

  /** Whether this option is currently selected (reflected by the combobox). */
  @property({ type: Boolean, reflect: true }) selected = false;

  /** Optional section header this option belongs under. */
  @property() group = '';

  /** Extra text the filter should match beyond the label. */
  @property({ attribute: 'search-text' }) searchText = '';

  /** Optional secondary line rendered under the label (e.g. a status/date summary). */
  @property() sub = '';

  /** Optional color for a small leading status dot (any valid CSS color). */
  @property({ attribute: 'dot-color' }) dotColor = '';

  /** Resolved label: explicit non-empty `label` attribute wins, else trimmed text content. */
  get label(): string {
    const attr = this.getAttribute('label');
    return (attr ? attr : (this.textContent ?? '')).trim();
  }

  render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

defineElement('option', LyraOption);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-option': LyraOption;
  }
}
