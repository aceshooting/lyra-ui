import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon, spinnerIcon } from '../../../internal/icons.js';
import { safeDownloadHref, safeLinkHref } from '../../../internal/safe-url.js';
import {
  syncAriaControlsElements,
  syncAriaDescribedByElements,
} from '../../../internal/aria-controls.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { variants } from '../../../internal/variants.styles.js';
import type {
  LyraAppearance,
  LyraSize,
  LyraSizeStep,
  LyraVariant,
} from '../../../internal/variants.js';
import { styles } from './button.styles.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';

/** Alias of the library's one semantic-tone vocabulary, kept as an exported name so existing
 *  imports of `ButtonVariant` keep resolving while `internal/variants.ts` holds the only
 *  definition. */
export type ButtonVariant = LyraVariant;
/** The shared appearance vocabulary (`accent`/`filled`/`outlined`/`filled-outlined`/`plain`) plus
 *  this component's two own tiers, `link` and `quiet`. */
export type ButtonAppearance = LyraAppearance | 'link' | 'quiet';
/** Alias of the canonical six-step size ladder. The `size` property itself accepts
 *  {@linkcode LyraSize}, i.e. these steps *and* the `small`/`medium`/`large` spellings. */
export type ButtonSize = LyraSizeStep;
export type ButtonType = 'button' | 'submit' | 'reset';
/** Native `formenctype` vocabulary, applied to the submission this button triggers. */
export type ButtonFormEnctype =
  | 'application/x-www-form-urlencoded'
  | 'multipart/form-data'
  | 'text/plain';
/** Native `formmethod` vocabulary. `'dialog'` closes an ancestor `<dialog>` instead of submitting. */
export type ButtonFormMethod = 'get' | 'post' | 'dialog';

export interface LyraButtonEventMap {
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<undefined>;
  'lr-blur': CustomEvent<undefined>;
}

/**
 * `<lr-button>` — a generic action-button primitive. Renders an internal native
 * `<button part="base">`. `type="submit"`/`type="reset"`
 * are handled by this component itself via the host's own `closest('form')` — a shadow-internal
 * native `<button type="submit">` does not participate in an ancestor light-DOM form's submission
 * on its own, since form-submitter semantics don't cross the shadow boundary.
 *
 * A submit button that carries `name`/`value` or any of the `form*` submission overrides
 * (`formaction`/`formenctype`/`formmethod`/`formnovalidate`/`formtarget`) submits through a
 * transient native `<button type="submit">` inserted directly after the host, used as
 * `requestSubmit()`'s submitter and removed again in the same synchronous step. That is what makes
 * the name/value pair reach the submitted `FormData` and the overrides reach the real submission:
 * `requestSubmit()` can only take a submitter the form actually owns, and a custom element is never
 * one. While that submitter exists it *is* the form's submitter, so `SubmitEvent.submitter` is the
 * transient native button rather than this host. With none of those properties set, submission
 * stays a plain `requestSubmit()` with a `null` submitter.
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
 * `accessibleLabel` (attribute `aria-label`) is forwarded reactively to the internal button/anchor
 * as a literal string (for an icon-only button with no visible label). Host `aria-describedby`
 * IDREFs are resolved through `ariaDescribedByElements`; external `aria-labelledby` is not copied
 * across the shadow boundary.
 * Host `aria-haspopup` and `aria-expanded` values are likewise forwarded to the internal semantic
 * control. When host `aria-controls` names elements in the host's own root, the controls
 * relationship is resolved onto the internal control through the reflected element-reference API
 * so it remains valid across this component's shadow boundary. Assigning that relationship
 * intentionally clears the serialized `aria-controls` value; read `ariaControlsElements` in a
 * supporting browser. Browsers without that API retain the forwarded string attribute as a
 * best-effort fallback.
 *
 * @customElement lr-button
 * @event focus - Native focus relayed once from the internal button or anchor.
 * @event blur - Native blur relayed once from the internal button or anchor.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @slot - Default slot: the button's label content.
 * @slot start - Leading icon/content, rendered before the label.
 * @slot end - Trailing icon/content, rendered after the label.
 * @csspart base - The internal native `<button>` (or an `<a>` when `href` resolves to a safe link).
 * @csspart label - The default-slot label wrapper.
 * @csspart start - The `start` slot wrapper.
 * @csspart end - The `end` slot wrapper.
 * @csspart caret - The decorative dropdown chevron, present only while `withCaret` is `true`.
 * @csspart spinner - The loading spinner, present only while `loading` is `true`.
 * @cssprop [--lr-button-width=100%] - Inline size of the internal button. The host
 * defaults it to `100%` so the native button follows the host's own width; override to
 * `auto` (or any other value) for a compact inline composition.
 * @cssprop [--lr-button-hover-base=var(--lr-color-surface)] - The colour the hover and press
 * mixes move away from. Each painted appearance re-points it at its own fill
 * (`--lr-button-fill` for `filled`/`filled-outlined`, `--lr-button-accent-fill` for `accent`); the
 * chrome-less tiers (`outlined`, `plain`, `quiet`, `link`) paint nothing, so they mix from the page
 * surface. Set it alongside `--lr-button-outlined-fill` when you tint an outlined button.
 * @cssprop [--lr-button-hover-background=color-mix(in oklab, var(--lr-button-hover-base), var(--lr-color-mix-partner) var(--lr-color-mix-hover))] -
 * Background of a non-disabled button while hovered. Replaced the pre-8.0.0
 * `--lr-button-hover-brightness` multiplier: a `filter` multiplies every channel, so it moved a
 * mid-toned fill but did nothing at all to a pure white or pure black one, and it dimmed the label
 * and icons along with the box.
 * @cssprop [--lr-button-active-background=color-mix(in oklab, var(--lr-button-hover-base), var(--lr-color-mix-partner) var(--lr-color-mix-active))] -
 * Background while a non-disabled button is pressed — the same mix at the stronger
 * `--lr-color-mix-active` share, so the pressed state reads as more than the hover.
 * `appearance="link"` moves its text colour by these two shares instead of taking a background.
 * @cssprop [--lr-button-active-scale=0.9875] - `transform: scale()` factor applied while a
 * non-disabled button is pressed.
 * @cssprop [--lr-button-spinner-duration=var(--lr-transition-ambient)] - Timing of the `loading` spinner.
 * @cssprop [--lr-button-accent=var(--lr-color-fill-loud)] - Text/glyph color for the chrome-less
 * appearances (`outlined`, `plain`, `link`), i.e. the active `variant`'s loud fill used as a
 * foreground. `variant="neutral"` is the one exception: its loud fill is a mid grey picked to carry
 * light text, so borrowing it as text on the page surface would wash out every plain and link
 * button — neutral keeps `--lr-color-text`.
 * @cssprop [--lr-button-fill=var(--lr-color-fill-quiet)] - Background of `appearance="filled"`:
 * the active `variant`'s quiet tint, i.e. a secondary-action fill that is visibly a fill rather
 * than the page surface. Follows `variant` through the shared semantic grid.
 * @cssprop [--lr-button-on-fill=var(--lr-color-on-quiet)] - Text color on top of
 * `--lr-button-fill`, the grid's guaranteed-legible foreground for that tint.
 * @cssprop [--lr-button-accent-fill=var(--lr-color-fill-loud)] - Background of
 * `appearance="accent"` (and its border color): the active `variant`'s loud fill, the one primary
 * action in a view.
 * @cssprop [--lr-button-accent-on-fill=var(--lr-color-on-loud)] - Text color on top of
 * `--lr-button-accent-fill`, the grid's guaranteed-legible foreground for that fill.
 * @cssprop [--lr-button-border=var(--lr-color-border-normal)] - Border color of the internal
 * button, from the active `variant`'s row of the shared semantic grid.
 * @cssprop [--lr-button-outlined-border=var(--lr-color-border-strong)] - Border color of
 * `appearance="outlined"` and `appearance="filled-outlined"`, which overrides `--lr-button-border`.
 * @cssprop [--lr-button-outlined-fill=transparent] - Background of `appearance="outlined"`.
 * Transparent by default; set it to tint the button (e.g. a faint surface wash behind the outline)
 * without a `::part(base)` rule. Like `--lr-button-quiet-*`, it is deliberately *not* swapped per
 * `variant`. The hover and press mixes read `--lr-button-hover-base`, which this tier leaves on the
 * page surface, so set both together when you tint an outlined button.
 * @cssprop [--lr-button-quiet-border=var(--lr-color-border)] - Border color of
 * `appearance="quiet"`.
 * @cssprop [--lr-button-quiet-text=var(--lr-color-text-quiet)] - Text color of
 * `appearance="quiet"`.
 * @cssprop [--lr-button-size-2xs=var(--lr-form-control-height-2xs)] - `min-block-size` at
 * `size="2xs"`. Since 8.0.0 the whole scale comes from the shared form-control ladder
 * (`internal/sizes.styles.ts`), so a button is the same height as an input, select, combobox or
 * date input of the same tier by construction rather than by two lists agreeing.
 * @cssprop [--lr-button-size-xs=var(--lr-form-control-height-xs)] - `min-block-size` at `size="xs"`.
 * @cssprop [--lr-button-size-s=var(--lr-form-control-height-s)] - `min-block-size` at `size="s"`
 * (and at the `size="small"` spelling).
 * @cssprop [--lr-button-size-m=var(--lr-form-control-height-m)] - `min-block-size` at `size="m"`
 * (and at `size="medium"`), the default tier.
 * @cssprop [--lr-button-size-l=var(--lr-form-control-height-l)] - `min-block-size` at `size="l"`
 * (and at `size="large"`).
 * @cssprop [--lr-button-size-xl=var(--lr-form-control-height-xl)] - `min-block-size` at `size="xl"`.
 * @cssprop [--lr-button-padding-block=var(--lr-form-control-padding-block)] - Block padding of the
 * internal button, taken from the active `size` tier of the shared ladder. Override it to retune a
 * tier without a `::part(base)` rule; `appearance="link"` ignores it (it renders with zero padding).
 * @cssprop [--lr-button-padding-inline=var(--lr-form-control-padding-inline)] - Inline padding of
 * the internal button, from the active `size` tier. `appearance="link"` ignores it.
 * @cssprop [--lr-button-font-size=var(--lr-form-control-font-size)] - Font size of the internal
 * button, from the active `size` tier. `appearance="link"` ignores it and inherits the ambient font
 * instead.
 * @cssprop [--lr-button-min-height=var(--lr-form-control-height)] - The active tier's
 * `min-block-size` floor, resolved through that tier's own `--lr-button-size-*` token, and used as
 * the fallback when `--lr-button-height` is unset.
 * @cssprop --lr-button-height - Exact height of the internal button. **Undeclared by default** — so
 * the button keeps the active tier's `min-block-size` floor and an `auto` height, exactly as
 * before. Set it (e.g. to pin the button to a fixed toolbar row) to both floor *and* cap the
 * height. Never declare it as `auto`: a declared value wins over the `var()` fallback arm and would
 * make every tier's floor dead code. `appearance="link"` ignores it.
 * @cssprop [--lr-button-gap=var(--lr-form-control-gap)] - Gap between the icon/label and any
 * slotted content in the internal button. Constant across the ladder's tiers. Override it to retune
 * without a `::part(base)` rule.
 * @cssprop [--lr-button-radius=var(--lr-form-control-radius)] - Corner radius of the internal
 * button, from the active `size` tier of the shared ladder (the two tightest tiers take a smaller
 * radius, since a 6px corner on a 20px-tall control reads as a lozenge). `appearance="link"`
 * ignores it (it renders with zero radius). `pill` re-assigns it to `--lr-radius-pill`.
 * @cssprop [--lr-button-caret-size=var(--lr-size-0-75em)] - Font size of the `with-caret` chevron,
 * i.e. its rendered glyph box. Relative to the button's own font size, so it follows every `size`
 * tier without a per-tier rule.
 * @cssprop --lr-button-shadow - Box shadow of the internal button. **Undeclared by default**, so
 * `box-shadow` falls back to `none` — byte-identical to before this property existed. Set it (e.g.
 * an elevated/floating action button) without a `::part(base)` rule.
 */
export class LyraButton extends LyraElement<LyraButtonEventMap> {
  // `sizes` supplies the one form-control ladder (both the `s`/`m`/`l` and the `small`/`medium`/
  // `large` spellings of every tier); `variants` re-points the nine generic colour slots at the
  // active `variant`'s row of the semantic grid. Between them this component needs no per-tier and
  // no per-variant block of its own.
  static override styles = [LyraElement.styles, sizes, variants, styles];
  // A button is form-associated so it is discoverable through form.elements. The generic
  // FormAssociated mixin is intentionally not used: action buttons do not have its value,
  // name, or required semantics. `disabled` is still hardened the same way the mixin-based
  // controls are (synchronous accessor + `formDisabledCallback`), since an ancestor
  // `<fieldset disabled>` must still cascade into this component the same way it would a
  // native `<button>` -- see `effectiveDisabled` below.
  static formAssociated = true;

  static override properties = {
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
  };

  private _fieldsetDisabled = false;
  private _disabled = false;
  private _name = '';
  private hasSyncedDescribedByElements = false;

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  /** Submitted as a `name`/`value` pair with the form data, but only while this button is the
   *  submitter (`type="submit"`, in `<button>` mode). Unnamed (the default), the button contributes
   *  nothing — exactly like a native `<button>` with no `name`. See the class doc comment for how
   *  the pair reaches the submitted `FormData`.
   *
   *  Reflected synchronously on assignment (rather than on Lit's async update cycle) because a
   *  rename must be visible to a `form.requestSubmit()` in the same tick — including this
   *  component's own, when a consumer renames the button from the click handler that submits. */
  get name(): string {
    return this._name;
  }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.requestUpdate('name', old);
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

  /** Accessible name forwarded to the internal native button or anchor. Bound to the host's
   *  `aria-label` content attribute so changing or removing that attribute after mount keeps the
   *  actual focused control synchronized. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property({ attribute: 'aria-haspopup' }) private triggerHasPopup: string | null = null;
  @property({ attribute: 'aria-expanded' }) private triggerExpanded: string | null = null;
  @property({ attribute: 'aria-controls' }) private triggerControls: string | null = null;
  @property({ attribute: 'aria-describedby' }) private triggerDescribedBy: string | null = null;

  /** Semantic tone, from the library's one `variant` vocabulary — the same five values every other
   *  `variant` in the library takes. Selects which row of the semantic colour grid every fill,
   *  border and foreground token below resolves against. */
  @property({ reflect: true }) variant: LyraVariant = 'neutral';
  /** `'accent'` (the default, matching the upstream default) is the loud tier: the active
   *  `variant`'s solid fill with its guaranteed-legible foreground, for the one primary action in a
   *  view. `'filled'` is the same tone one emphasis step down — a quiet tint, for a secondary
   *  action; it is deliberately a real fill rather than the page surface, so the two tiers never
   *  paint the same button. `'outlined'` is a border with no fill, `'plain'` neither.
   *  `'filled-outlined'` is `'filled'` plus `'outlined'`'s border color, for a filled button that
   *  still has to read against a same-toned surface.
   *  `'link'` is zero-chrome inline text — no padding, border, or
   *  min-height, underlined, colored from `--lr-button-accent` (the same token `'plain'` uses)
   *  and inheriting the surrounding font — for a text link that flows inline in a sentence rather
   *  than a button-shaped control. `'quiet'` is a bordered, transparent-until-hover tier for a
   *  toolbar-style icon+label action — its border/text read fixed `--lr-color-border`/`--lr-color-text-quiet`
   *  tokens regardless of `variant`, unlike `'outlined'`'s variant-tinted text, so it stays
   *  visually muted at rest. */
  @property({ reflect: true }) appearance: ButtonAppearance = 'accent';
  /** Visual size on the library's one control ladder. Accepts both the canonical `'2xs'`–`'xl'`
   *  steps and Web Awesome's/Shoelace's `'small'`/`'medium'`/`'large'` spellings of `s`/`m`/`l`, so
   *  a migration is a tag rename with no attribute rewrite; the two spellings render identically.
   *  `'2xs'` is the tightest tier — a sub-`xs` size for dense, toolbar-embedded controls (e.g.
   *  beside a native `<input type="search">` in a compact dialog header). `'m'` (the default) is
   *  the standard size. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Fully rounded ends, for a pill-shaped control. Re-assigns `--lr-button-radius` to
   *  `--lr-radius-pill` rather than declaring a radius on `[part="base"]`, so a consumer's own
   *  `--lr-button-radius` stays the single corner-radius knob. `appearance="link"` still renders
   *  with zero chrome, pill or not. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Renders a decorative trailing chevron (`[part="caret"]`, `aria-hidden`) marking the button as
   *  a dropdown/menu trigger. It carries no accessible name of its own — the button's label already
   *  names the action, and the popup relationship is expressed by a host `aria-haspopup`/
   *  `aria-expanded`, which are forwarded to the internal control. */
  @property({ attribute: 'with-caret', type: Boolean, reflect: true }) withCaret = false;
  /** Forwarded to this component's own submit/reset handling — see the class doc comment above
   *  for why this component (not the shadow-internal `<button>`) owns that behavior. */
  @property() type: ButtonType = 'button';
  /** The value submitted alongside `name`. Meaningful only together with a `name`, matching a
   *  native submit button. */
  @property() value = '';
  /** Overrides the form owner's `action` for the submission this button triggers. Unset by
   *  default, leaving the form's own `action` in place. */
  @property({ attribute: 'formaction' }) formAction?: string;
  /** Overrides the form owner's `enctype` for the submission this button triggers. */
  @property({ attribute: 'formenctype' }) formEnctype?: ButtonFormEnctype;
  /** Overrides the form owner's `method` for the submission this button triggers. */
  @property({ attribute: 'formmethod' }) formMethod?: ButtonFormMethod;
  /** Skips the form owner's constraint validation for the submission this button triggers —
   *  the native `formnovalidate` semantics. Without it an invalid form is reported and not
   *  submitted, exactly as a native submit button behaves. */
  @property({ attribute: 'formnovalidate', type: Boolean }) formNoValidate = false;
  /** Overrides the form owner's `target` for the submission this button triggers. Distinct from
   *  `target`, which is the anchor target used in link mode. */
  @property({ attribute: 'formtarget' }) formTarget?: string;
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
   *  navigation (the anchor has no `@click` handler of its own). Disabled and loading buttons
   *  remain inert in both modes. */
  override click(): void {
    if (this.effectiveDisabled || this.loading) return;
    this.baseEl?.click();
  }

  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled && !this.loading) this.baseEl?.focus(options);
  }

  override blur(): void {
    this.baseEl?.blur();
  }

  private onClick = (): void => {
    if (this.type === 'submit') {
      const form = this.closest('form');
      if (!form) return;
      if (this.hasSubmitterOverrides) this.submitAsNamedSubmitter(form);
      else form.requestSubmit();
    } else if (this.type === 'reset') {
      this.closest('form')?.reset();
    }
  };

  private onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };

  private onBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  /** Whether anything about this button changes the submission itself, rather than merely
   *  triggering it. Only then is the transient native submitter worth creating: with none of these
   *  set, a plain `requestSubmit()` keeps `SubmitEvent.submitter` `null` as before. */
  private get hasSubmitterOverrides(): boolean {
    return Boolean(
      this.name ||
        this.value ||
        this.formAction ||
        this.formEnctype ||
        this.formMethod ||
        this.formNoValidate ||
        this.formTarget,
    );
  }

  /**
   * Submits `form` through a transient native `<button type="submit">` carrying this button's
   * `name`/`value` and `form*` overrides.
   *
   * `requestSubmit(submitter)` refuses any submitter the form doesn't own, and a custom element can
   * never be one, so neither the name/value pair nor the overrides can reach the submission from
   * the host itself — `internals.setFormValue()` wouldn't help either, since a submitter's pair is
   * contributed by the submission algorithm, not by the control's form value. The stand-in is
   * inserted directly after the host so its pair lands in the entry list in the same tree-order
   * position a native submit button would, and removed in a `finally` so a throwing or
   * validation-blocked submission can't leave it behind.
   */
  private submitAsNamedSubmitter(form: HTMLFormElement): void {
    const submitter = document.createElement('button');
    submitter.type = 'submit';
    submitter.hidden = true;
    submitter.tabIndex = -1;
    if (this.name) {
      submitter.name = this.name;
      submitter.value = this.value;
    }
    // Assigned only when set: an empty `formaction` resolves against the document URL, which would
    // silently redirect the submission instead of leaving the form's own action in place.
    if (this.formAction) submitter.formAction = this.formAction;
    if (this.formEnctype) submitter.formEnctype = this.formEnctype;
    if (this.formMethod) submitter.formMethod = this.formMethod;
    if (this.formNoValidate) submitter.formNoValidate = true;
    if (this.formTarget) submitter.formTarget = this.formTarget;

    if (this.parentElement) this.insertAdjacentElement('afterend', submitter);
    else form.append(submitter);
    try {
      form.requestSubmit(submitter);
    } finally {
      submitter.remove();
    }
  }

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

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    syncAriaControlsElements(this, this.baseEl, this.triggerControls);
    this.syncDescribedByElements();
  }

  private syncDescribedByElements(): void {
    if (!this.triggerDescribedBy && !this.hasSyncedDescribedByElements) return;
    this.hasSyncedDescribedByElements = syncAriaDescribedByElements(
      this,
      this.baseEl,
      this.triggerDescribedBy,
    );
  }

  override render(): TemplateResult {
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
      ${this.withCaret ? html`<span part="caret" aria-hidden="true">${chevronIcon()}</span>` : nothing}
      ${this.loading ? html`<span part="spinner" aria-hidden="true">${spinnerIcon()}</span>` : ''}
    `;

    // `download` turns the anchor from a navigation sink into a resource sink, and the two carry
    // different allowlists -- `mailto:` is a legitimate destination but names no retrievable bytes.
    // The condition mirrors the `download=${this.download || nothing}` binding below exactly, so
    // the href is validated against whichever sink the rendered anchor actually is.
    const href = this.download ? safeDownloadHref(this.href) : safeLinkHref(this.href);
    if (href) {
      const disabled = this.effectiveDisabled || this.loading;
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
        aria-label=${this.accessibleLabel || nothing}
        aria-haspopup=${this.triggerHasPopup ?? nothing}
        aria-expanded=${this.triggerExpanded ?? nothing}
        aria-controls=${this.triggerControls || nothing}
        aria-describedby=${this.triggerDescribedBy || nothing}
        aria-disabled=${disabled ? 'true' : nothing}
        aria-busy=${this.loading ? 'true' : 'false'}
        tabindex=${disabled ? '-1' : nothing}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
        >${content}</a
      >`;
    }

    return html`
      <button
        part="base"
        type="button"
        aria-label=${this.accessibleLabel || nothing}
        aria-haspopup=${this.triggerHasPopup ?? nothing}
        aria-expanded=${this.triggerExpanded ?? nothing}
        aria-controls=${this.triggerControls || nothing}
        aria-describedby=${this.triggerDescribedBy || nothing}
        aria-busy=${this.loading ? 'true' : 'false'}
        ?disabled=${this.effectiveDisabled || this.loading}
        @click=${this.onClick}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
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
