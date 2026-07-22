import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { spinnerIcon } from '../../../internal/icons.js';
import { safeDownloadHref, safeLinkHref } from '../../../internal/safe-url.js';
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
 * When `href` is set to a safe link URL (`http:`/`https:`/`blob:`/`mailto:`/relative — see
 * `safeLinkHref`, or `safeDownloadHref` which drops `mailto:` when `download` is set) the root
 * renders as a real `<a part="base" href=…>` instead — for a link styled
 * as a button (e.g. a CTA). Native navigation is then the anchor's own activation, so the
 * submit/reset click handler and `type` (submit/reset) have no effect in that mode. When the
 * button is disabled (its own `disabled` or an ancestor `<fieldset disabled>`) the anchor renders
 * with `aria-disabled="true"` and **no `href`** — an href-less anchor is not focusable or
 * navigable, so a disabled link button genuinely cannot be activated (unlike a bare
 * `aria-disabled` on a still-navigable link). An unsafe/unparseable `href` falls back to the
 * native `<button>`.
 *
 * A host `aria-label` is forwarded to the internal button/anchor as a literal string (for an
 * icon-only button with no visible label); external `aria-labelledby`/`aria-describedby` idrefs
 * are not copied across the shadow boundary.
 *
 * @customElement lr-button
 * @slot - Default slot: the button's label content.
 * @slot start - Leading icon/content, rendered before the label.
 * @slot end - Trailing icon/content, rendered after the label.
 * @csspart base - The internal native `<button>` (or an `<a>` when `href` resolves to a safe link).
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
 * @cssprop [--lr-button-size-s=var(--lr-size-1-875rem)] - `min-block-size` at `size="s"`. Matches
 * `lr-input`/`lr-select`/`lr-combobox`'s own `size="s"` control height.
 * @cssprop [--lr-button-size-m=var(--lr-size-2-5rem)] - `min-block-size` at `size="m"`. Matches
 * `lr-input`/`lr-select`/`lr-combobox`'s own default control height, so a default-size button sitting
 * next to a default-size input/select/combobox in the same row lines up.
 * @cssprop [--lr-button-size-l=var(--lr-size-3rem)] - `min-block-size` at `size="l"`. Matches
 * `lr-input`/`lr-select`/`lr-combobox`'s own `size="l"` control height.
 * @cssprop [--lr-button-size-xl=var(--lr-size-3-5rem)] - `min-block-size` at `size="xl"`. Matches
 * `lr-input`/`lr-select`/`lr-combobox`'s own `size="xl"` control height.
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
 * @cssprop [--lr-button-gap=var(--lr-space-2xs)] - Gap between the icon/label and any slotted
 * content in the internal button. Unlike the size knobs above it does not vary by `size` tier.
 * Override it to retune without a `::part(base)` rule.
 * @cssprop [--lr-button-radius=var(--lr-radius)] - Corner radius of the internal button. Does not
 * vary by `size` tier. `appearance="link"` ignores it (it renders with zero radius).
 */
export class LyraButton extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  // A button is form-associated so it is discoverable through form.elements. The generic
  // FormAssociated mixin is intentionally not used: action buttons do not have its value,
  // name, or required semantics. `disabled` is still hardened the same way the mixin-based
  // controls are (synchronous accessor + `formDisabledCallback`), since an ancestor
  // `<fieldset disabled>` must still cascade into this component the same way it would a
  // native `<button>` -- see `effectiveDisabled` below.
  static formAssociated = true;

  static override properties = {
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
    // `attachInternals()` is browser-only; a downstream consumer's Vitest + happy-dom (or similar)
    // test suite has no implementation of it at all, so calling it unconditionally would throw
    // merely from constructing/importing this component, before any assertion runs. The return
    // value is unused here (this component only needs form-associated *discoverability*, not
    // `ElementInternals`' validity/value APIs), so unlike `<lr-checkbox>`'s/`<lr-checkbox-group>`'s
    // `createInternalsSafely()`/`createNoopInternals()` pair, degrading is just "skip the call" --
    // there is no `this.internals` field whose later use needs a no-op stand-in.
    if (typeof this.attachInternals === 'function') {
      try {
        this.attachInternals();
      } catch {
        // Environment claims support but throws anyway (e.g. a partial polyfill) -- same
        // fail-open degradation as the `typeof` guard above.
      }
    }
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

  /** When set to a safe link URL, the button's root renders as a real `<a href=…>` instead of a
   *  `<button>` — for a link styled as a button (e.g. a CTA). Unset (the default) renders a plain
   *  `<button>`, byte-for-byte as before. Only `http:`/`https:`/`blob:`/`mailto:`/relative URLs are
   *  honored (see `safeLinkHref`); an unsafe/unparseable value falls back to the native `<button>`.
   *  Setting `download` narrows the allowlist to `safeDownloadHref`'s, which drops `mailto:` — a
   *  mail handoff names no retrievable bytes, so it cannot be a download target.
   *  `type` (submit/reset) has no effect while the anchor renders — an anchor has no submit/reset
   *  concept, and native navigation is its own activation. While the button is disabled the anchor
   *  renders with no `href` (see the class doc comment), so a disabled link button cannot navigate. */
  @property() href?: string;
  /** Native anchor `target`, used only while `href` resolves to a link. Setting this to `'_blank'`
   *  (or any other target) automatically derives `rel="noopener noreferrer"` on the rendered anchor
   *  — matching `lr-card`'s/`lr-stat`'s identical pattern; `rel` is never independently settable, to
   *  close the reverse-tabnabbing vector. Ignored in `<button>` mode. */
  @property() target?: string;
  /** Native anchor `download` attribute, used only while `href` resolves to a link. Ignored in
   *  `<button>` mode. */
  @property() download?: string;

  /** Whether the `start`/`end` slots have assigned content. Drives `?hidden` on the adornment
   *  wrappers so an unslotted wrapper collapses to `display: none` instead of contributing a dead
   *  `--lr-button-gap` of inline space (a bare `<slot>` is an element child, so a `:empty` rule
   *  could never match it). Seeded synchronously in `willUpdate` before the first paint, then kept
   *  current by each slot's `slotchange` — mirrors `<lr-input>`'s identical pattern. */
  @state() private hasStartSlot = false;
  @state() private hasEndSlot = false;

  // Matches either root: the native `<button>` (default) or the `<a>` rendered in anchor mode, so
  // `click()`/`focus()`/`blur()` work in both.
  @query('[part="base"]') private baseEl?: HTMLButtonElement | HTMLAnchorElement;

  /** Activates the internal base element. In `<button>` mode this also runs the component's
   *  submit/reset behavior (via the button's own `@click`); in anchor mode it triggers native
   *  navigation (the anchor has no `@click` handler of its own). */
  override click(): void {
    this.baseEl?.click();
  }

  override focus(options?: FocusOptions): void {
    this.baseEl?.focus(options);
  }

  override blur(): void {
    this.baseEl?.blur();
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

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Seed the wrapper-visibility flags from light-DOM children before the first render, so the
    // adornment wrappers start collapsed/expanded correctly rather than flashing full-width for a
    // frame until the first `slotchange` fires. Refreshed thereafter by `onStartSlotChange`/
    // `onEndSlotChange`.
    if (!this.hasUpdated) {
      this.hasStartSlot = Array.from(this.children).some((element) => element.getAttribute('slot') === 'start');
      this.hasEndSlot = Array.from(this.children).some((element) => element.getAttribute('slot') === 'end');
    }
  }

  private onStartSlotChange = (e: Event): void => {
    this.hasStartSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onEndSlotChange = (e: Event): void => {
    this.hasEndSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  override render(): TemplateResult {
    const ariaLabel = this.getAttribute('aria-label');
    // Shared inner content, rendered identically in both roots so the extracted variable produces
    // byte-identical DOM to the previous inline template in `<button>` mode.
    const content = html`
      <span part="start" ?hidden=${!this.hasStartSlot}>
        <slot name="start" @slotchange=${this.onStartSlotChange}></slot>
      </span>
      <span part="label"><slot></slot></span>
      <span part="end" ?hidden=${!this.hasEndSlot}>
        <slot name="end" @slotchange=${this.onEndSlotChange}></slot>
      </span>
      ${this.loading ? html`<span part="spinner" aria-hidden="true">${spinnerIcon()}</span>` : ''}
    `;

    // `download` turns the anchor from a navigation sink into a resource sink, and the two carry
    // different allowlists -- `mailto:` is a legitimate destination but names no retrievable bytes.
    // The condition mirrors the `download=${this.download || nothing}` binding below exactly, so
    // the href is validated against whichever sink the rendered anchor actually is.
    const href = this.download ? safeDownloadHref(this.href) : safeLinkHref(this.href);
    if (href) {
      const disabled = this.effectiveDisabled;
      // Per decision D8: a disabled link button omits `href` entirely. An anchor with no `href` is
      // not focusable or activatable, so the button genuinely cannot navigate -- unlike a bare
      // `aria-disabled` on a still-navigable `<a href>`. `@click`/submit-reset are deliberately
      // absent: native navigation is the anchor's own activation (mirrors `lr-card`).
      return html`<a
        part="base"
        href=${disabled ? nothing : href}
        target=${this.target || nothing}
        rel=${this.target ? 'noopener noreferrer' : nothing}
        download=${this.download || nothing}
        aria-label=${ariaLabel || nothing}
        aria-disabled=${disabled ? 'true' : nothing}
        >${content}</a
      >`;
    }

    return html`
      <button
        part="base"
        type="button"
        aria-label=${ariaLabel || nothing}
        aria-busy=${this.loading ? 'true' : 'false'}
        ?disabled=${this.effectiveDisabled || this.loading}
        @click=${this.onClick}
      >
        ${content}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-button': LyraButton;
  }
}
