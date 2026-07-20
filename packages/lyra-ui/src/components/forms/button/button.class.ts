import { html, nothing, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { spinnerIcon } from '../../../internal/icons.js';
import { styles } from './button.styles.js';

export type ButtonVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export type ButtonAppearance = 'accent' | 'filled' | 'outlined' | 'plain' | 'link' | 'quiet';
export type ButtonSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';
export type ButtonType = 'button' | 'submit' | 'reset';

/**
 * `<lr-button>` — a generic action-button primitive. Renders an internal native
 * `<button part="base">`. `type="submit"`/`type="reset"`
 * are handled by this component itself via the host's own `closest('form')` — a shadow-internal
 * native `<button type="submit">` does not participate in an ancestor light-DOM form's submission
 * on its own, since form-submitter semantics don't cross the shadow boundary.
 *
 * A host `aria-label` is forwarded to the internal button as a literal string (for an icon-only
 * button with no visible label); external `aria-labelledby`/`aria-describedby` idrefs are not
 * copied across the shadow boundary.
 *
 * @customElement lr-button
 * @slot - Default slot: the button's label content.
 * @slot start - Leading icon/content, rendered before the label.
 * @slot end - Trailing icon/content, rendered after the label.
 * @csspart base - The internal native `<button>`.
 * @csspart label - The default-slot label wrapper.
 * @csspart start - The `start` slot wrapper.
 * @csspart end - The `end` slot wrapper.
 * @csspart spinner - The loading spinner, present only while `loading` is `true`.
 * @cssprop [--lr-button-width=100%] - Inline size of the internal button. The host
 * defaults it to `100%` so the native button follows the host's own width; override to
 * `auto` (or any other value) for a compact inline composition.
 * @cssprop [--lr-button-hover-brightness=1.08] - `filter: brightness()` multiplier applied
 * while hovering a non-disabled button.
 * @cssprop [--lr-button-active-scale=0.9875] - `transform: scale()` factor applied while a
 * non-disabled button is pressed.
 * @cssprop [--lr-button-spinner-duration=1s] - Rotation period of the `loading` spinner.
 * @cssprop [--lr-button-accent=var(--lr-color-text)] - Text/glyph color for the chrome-less
 * appearances (`outlined`, `plain`, `link`). Swapped per `variant` to that variant's semantic color.
 * @cssprop [--lr-button-fill=var(--lr-color-surface)] - Background of `appearance="filled"`.
 * Swapped per `variant` to that variant's semantic color.
 * @cssprop [--lr-button-on-fill=var(--lr-color-text)] - Text color on top of `--lr-button-fill`.
 * Swapped per `variant` to that variant's `on-*` color.
 * @cssprop [--lr-button-accent-fill=var(--lr-color-neutral)] - Background of
 * `appearance="accent"` (and its border color). Swapped per `variant` to that variant's semantic color.
 * @cssprop [--lr-button-accent-on-fill=var(--lr-color-on-neutral)] - Text color on top of
 * `--lr-button-accent-fill`. Swapped per `variant` to that variant's `on-*` color.
 * @cssprop [--lr-button-border=var(--lr-color-border)] - Border color of the internal button.
 * Swapped per `variant` to that variant's semantic color.
 * @cssprop [--lr-button-outlined-border=var(--lr-color-border-strong)] - Border color of
 * `appearance="outlined"`, which overrides `--lr-button-border`.
 * @cssprop [--lr-button-outlined-fill=transparent] - Background of `appearance="outlined"`.
 * Transparent by default; set it to tint the button (e.g. a faint surface wash behind the outline)
 * without a `::part(base)` rule. Like `--lr-button-quiet-*`, it is deliberately *not* swapped per
 * `variant`. Note that the `:hover` `filter: brightness()` applies to whatever fill is set, so a
 * tinted outlined button now visibly brightens on hover where a transparent one did not.
 * @cssprop [--lr-button-quiet-border=var(--lr-color-border)] - Border color of
 * `appearance="quiet"`.
 * @cssprop [--lr-button-quiet-text=var(--lr-color-text-quiet)] - Text color of
 * `appearance="quiet"`.
 * @cssprop [--lr-button-size-2xs=var(--lr-size-1-25rem)] - `min-block-size` at `size="2xs"`.
 * @cssprop [--lr-button-size-xs=var(--lr-size-1-5rem)] - `min-block-size` at `size="xs"`.
 * @cssprop [--lr-button-size-s=var(--lr-size-1-75rem)] - `min-block-size` at `size="s"`.
 * @cssprop [--lr-button-size-m=var(--lr-size-2rem)] - `min-block-size` at `size="m"`.
 * @cssprop [--lr-button-size-l=var(--lr-size-2-5rem)] - `min-block-size` at `size="l"`.
 * @cssprop [--lr-button-size-xl=var(--lr-size-3rem)] - `min-block-size` at `size="xl"`.
 * @cssprop [--lr-button-padding-block=var(--lr-space-xs)] - Block padding of the internal button,
 * re-assigned per `size` tier (the default is the `m` tier's value). Override it to retune a tier
 * without a `::part(base)` rule; `appearance="link"` ignores it (it renders with zero padding).
 * @cssprop [--lr-button-padding-inline=var(--lr-space-m)] - Inline padding of the internal button,
 * re-assigned per `size` tier (the default is the `m` tier's value). `appearance="link"` ignores it.
 * @cssprop [--lr-button-font-size=var(--lr-font-size-m)] - Font size of the internal button,
 * re-assigned per `size` tier (the default is the `m` tier's value). `appearance="link"` ignores it
 * and inherits the ambient font instead.
 * @cssprop [--lr-button-min-height=var(--lr-button-size-m)] - The active tier's `min-block-size`
 * floor. Re-assigned per `size` tier to that tier's own `--lr-button-size-*` token, and used as the
 * fallback when `--lr-button-height` is unset.
 * @cssprop --lr-button-height - Exact height of the internal button. **Undeclared by default** — so
 * the button keeps the active tier's `min-block-size` floor and an `auto` height, exactly as
 * before. Set it (e.g. to pin the button to a fixed toolbar row) to both floor *and* cap the
 * height. Never declare it as `auto`: a declared value wins over the `var()` fallback arm and would
 * make every tier's floor dead code. `appearance="link"` ignores it.
 */
export class LyraButton extends LyraElement {
  static styles = [LyraElement.styles, styles];
  // A button is form-associated so it is discoverable through form.elements. The generic
  // FormAssociated mixin is intentionally not used: action buttons do not have its value,
  // name, or required semantics. `disabled` is still hardened the same way the mixin-based
  // controls are (synchronous accessor + `formDisabledCallback`), since an ancestor
  // `<fieldset disabled>` must still cascade into this component the same way it would a
  // native `<button>` -- see `effectiveDisabled` below.
  static formAssociated = true;

  static properties = {
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  private _fieldsetDisabled = false;
  private _disabled = false;

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  /** Whether the button is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this._disabled || this._fieldsetDisabled;
  }

  constructor() {
    super();
    this.attachInternals();
  }

  /** Tone vocabulary shared with `<lr-chip>`/`<lr-avatar>`'s own `tone` property, named
   *  `variant` here (not `tone`) to keep the component's semantic tone vocabulary consistent. */
  @property({ reflect: true }) variant: ButtonVariant = 'neutral';
  /** `'filled'` (the default) reads `--lr-button-fill`, which for `variant="neutral"` is the
   *  ambient `--lr-color-surface` -- matching this component's own container, by design, for a
   *  low-emphasis default. `'accent'` is the loud tier: a solid, high-contrast fill for every
   *  variant, including `neutral`. `'link'` is zero-chrome inline text — no padding, border, or
   *  min-height, underlined, colored from `--lr-button-accent` (the same token `'plain'` uses)
   *  and inheriting the surrounding font — for a text link that flows inline in a sentence rather
   *  than a button-shaped control. `'quiet'` is a bordered, transparent-until-hover tier for a
   *  toolbar-style icon+label action — its border/text read fixed `--lr-color-border`/`--lr-color-text-quiet`
   *  tokens regardless of `variant`, unlike `'outlined'`'s variant-tinted text, so it stays
   *  visually muted at rest. */
  @property({ reflect: true }) appearance: ButtonAppearance = 'filled';
  /** Visual size, `'2xs'`–`'xl'`. `'2xs'` is the tightest tier — a sub-`xs` size for dense,
   *  toolbar-embedded controls (e.g. beside a native `<input type="search">` in a compact dialog
   *  header). `'m'` (the default) is the standard size. */
  @property({ reflect: true }) size: ButtonSize = 'm';
  /** Forwarded to this component's own submit/reset handling — see the class doc comment above
   *  for why this component (not the shadow-internal `<button>`) owns that behavior. */
  @property() type: ButtonType = 'button';
  /** Shows an internal spinner in place of interaction affordance and disables the button, without
   *  clearing `disabled` — a consumer's own `disabled` state and a transient `loading` state are
   *  independent (mirrors `<lr-export-button>`'s own `loading`/`disabled` pair). */
  @property({ type: Boolean, reflect: true }) loading = false;

  @query('button') private buttonEl?: HTMLButtonElement;

  /** Activates the internal native button, including submit/reset behavior. */
  override click(): void {
    this.buttonEl?.click();
  }

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

  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles. Tracked separately
   * from the consumer's own `disabled` (see `effectiveDisabled`) so a consumer's explicit
   * `disabled` survives the fieldset re-enabling instead of being permanently overwritten --
   * mirrors `<lr-checkbox>`'s/`<lr-switch>`'s identical `_fieldsetDisabled` pattern.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.requestUpdate();
  }

  render(): TemplateResult {
    const ariaLabel = this.getAttribute('aria-label');
    return html`
      <button
        part="base"
        type="button"
        aria-label=${ariaLabel || nothing}
        aria-busy=${this.loading ? 'true' : 'false'}
        ?disabled=${this.effectiveDisabled || this.loading}
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
    'lr-button': LyraButton;
  }
}
