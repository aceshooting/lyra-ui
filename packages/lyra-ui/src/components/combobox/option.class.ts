import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './option.styles.js';

/**
 * `<lyra-option>` — a selectable option for `<lyra-combobox>`.
 * Mirrors `<wa-option>`. Acts as the data source; the combobox renders the
 * interactive rows in its own shadow root and filters/caps them.
 *
 * The label is the element's text content (or an explicit `label` attribute).
 *
 * @customElement lyra-option
 */
export interface LyraOptionEventMap {
  'lyra-option-change': CustomEvent<undefined>;
}
export class LyraOption extends LyraElement<LyraOptionEventMap> {
  static styles = [LyraElement.styles, styles];

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

  private labelObserver?: MutationObserver;

  connectedCallback(): void {
    super.connectedCallback();
    // `label` is derived from either the `label` attribute or `textContent` --
    // neither is a Lit reactive property, so a direct mutation of either
    // (e.g. `option.textContent = 'New label'`) needs its own observer to
    // notify the parent combobox/select that its cached row data is stale.
    this.labelObserver = new MutationObserver(() => this.emit('lyra-option-change'));
    this.labelObserver.observe(this, {
      attributes: true,
      attributeFilter: ['label'],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
  }

  protected updated(changed: PropertyValues): void {
    // `selected` is deliberately excluded -- the parent combobox/select
    // already sets `selected` itself as *part of* rendering the current
    // selection, so echoing that back as a `lyra-option-change` notification
    // would trigger a redundant re-render on every selection change, rather
    // than signal a genuine "this option's own data changed externally".
    if (
      changed.has('value') ||
      changed.has('disabled') ||
      changed.has('group') ||
      changed.has('searchText') ||
      changed.has('sub') ||
      changed.has('dotColor')
    ) {
      this.emit('lyra-option-change');
    }
  }

  render(): TemplateResult {
    return html`<slot></slot>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-option': LyraOption;
  }
}
