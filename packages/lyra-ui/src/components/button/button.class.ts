import { html, nothing, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { spinnerIcon } from '../../internal/icons.js';
import { styles } from './button.styles.js';

export type ButtonVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export type ButtonAppearance = 'accent' | 'filled' | 'outlined' | 'plain';
export type ButtonSize = 'xs' | 's' | 'm' | 'l' | 'xl';
export type ButtonType = 'button' | 'submit' | 'reset';

/**
 * `<lyra-button>` — a generic action-button primitive, the `lyra-*` equivalent of a plain
 * `wa-button`. Renders an internal native `<button part="base">` (never a real `<wa-button>` —
 * this library has no runtime dependency on Web Awesome, matching `<lyra-copy-button>`/
 * `<lyra-export-button>`'s own clean-room, API-mirroring approach). `type="submit"`/`type="reset"`
 * are handled by this component itself via the host's own `closest('form')` — a shadow-internal
 * native `<button type="submit">` does not participate in an ancestor light-DOM form's submission
 * on its own, since form-submitter semantics don't cross the shadow boundary.
 *
 * A host `aria-label` is forwarded to the internal button as a literal string (for an icon-only
 * button with no visible label); external `aria-labelledby`/`aria-describedby` idrefs are not
 * copied across the shadow boundary.
 *
 * @customElement lyra-button
 * @slot - Default slot: the button's label content.
 * @slot start - Leading icon/content, rendered before the label.
 * @slot end - Trailing icon/content, rendered after the label.
 * @csspart base - The internal native `<button>`.
 * @csspart label - The default-slot label wrapper.
 * @csspart start - The `start` slot wrapper.
 * @csspart end - The `end` slot wrapper.
 * @csspart spinner - The loading spinner, present only while `loading` is `true`.
 */
export class LyraButton extends LyraElement {
  static styles = [LyraElement.styles, styles];
  // Participates in an ancestor `<form>.elements` the same way `wa-button` does today (via
  // `WebAwesomeFormAssociatedElement`) -- without this, a sibling text field's own Enter-to-submit
  // lookup (`form.elements` scanned for `el.type === 'submit'`) silently fails to find this button.
  // No `FormAssociated` mixin here: that mixin's own `name`/`value`/`required` submission semantics
  // don't apply to a plain action button, and would collide with this class's own `disabled`.
  static formAssociated = true;

  constructor() {
    super();
    this.attachInternals();
  }

  /** Tone vocabulary shared with `<lyra-chip>`/`<lyra-avatar>`'s own `tone` property, named
   *  `variant` here (not `tone`) to mirror `wa-button`'s own attribute name for a mechanical
   *  migration off a plain `wa-button`. */
  @property({ reflect: true }) variant: ButtonVariant = 'neutral';
  /** `'filled'` (the default) reads `--lyra-button-fill`, which for `variant="neutral"` is the
   *  ambient `--lyra-color-surface` -- matching this component's own container, by design, for a
   *  low-emphasis default. `'accent'` is the loud tier equivalent to `wa-button`'s own runtime
   *  default appearance (used whenever a `wa-button` call site sets only `variant`): a solid,
   *  high-contrast fill for every variant, including `neutral` (`--wa-color-neutral-fill-loud`). */
  @property({ reflect: true }) appearance: ButtonAppearance = 'filled';
  @property({ reflect: true }) size: ButtonSize = 'm';
  /** Forwarded to this component's own submit/reset handling — see the class doc comment above
   *  for why this component (not the shadow-internal `<button>`) owns that behavior. */
  @property() type: ButtonType = 'button';
  /** Shows an internal spinner in place of interaction affordance and disables the button, without
   *  clearing `disabled` — a consumer's own `disabled` state and a transient `loading` state are
   *  independent (mirrors `<lyra-export-button>`'s own `loading`/`disabled` pair). */
  @property({ type: Boolean, reflect: true }) loading = false;
  @property({ type: Boolean, reflect: true }) disabled = false;

  @query('button') private buttonEl?: HTMLButtonElement;

  override focus(options?: FocusOptions): void {
    this.buttonEl?.focus(options);
  }

  override blur(): void {
    this.buttonEl?.blur();
  }

  private onClick = (): void => {
    if (this.type === 'submit') {
      this.closest('form')?.requestSubmit();
    } else if (this.type === 'reset') {
      this.closest('form')?.reset();
    }
  };

  render(): TemplateResult {
    const ariaLabel = this.getAttribute('aria-label');
    return html`
      <button
        part="base"
        type="button"
        aria-label=${ariaLabel || nothing}
        aria-busy=${this.loading ? 'true' : 'false'}
        ?disabled=${this.disabled || this.loading}
        @click=${this.onClick}
      >
        <span part="start"><slot name="start"></slot></span>
        <span part="label"><slot></slot></span>
        <span part="end"><slot name="end"></slot></span>
        ${this.loading ? html`<span part="spinner" aria-hidden="true">${spinnerIcon()}</span>` : ''}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-button': LyraButton;
  }
}
