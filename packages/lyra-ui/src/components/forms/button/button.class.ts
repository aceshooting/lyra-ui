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
  LyraVariant,
} from '../../../internal/variants.js';
import { styles } from './button.styles.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import {
  AnchoredValidityController,
  VALIDITY_ANCHOR,
} from '../../../internal/anchored-validity.js';
import { setCustomState } from '../../../internal/custom-states.js';
import {
  EXTERNAL_LABEL_ACTIVATION,
  type ExternalLabelActivation,
} from '../../../internal/form-control-labels.js';
import { omittedEmptyStringConverter } from '../../../internal/converters.js';
import {
  currentValidityValidator,
  type LyraFormValidator,
} from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Alias of the library's one semantic-tone vocabulary, kept as an exported name so existing
 *  imports of `ButtonVariant` keep resolving while `internal/variants.ts` holds the only
 *  definition. */
export type ButtonVariant = LyraVariant | 'default' | 'primary' | 'text';
/** The shared appearance vocabulary (`accent`/`filled`/`outlined`/`filled-outlined`/`plain`) plus
 *  this component's two own tiers, `link` and `quiet`. */
export type ButtonAppearance = LyraAppearance | 'link' | 'quiet';
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
  'lr-focus': CustomEvent<null>;
  'lr-blur': CustomEvent<null>;
  'lr-invalid': CustomEvent<null>;
}

/**
 * `<lr-button>` — a generic action-button primitive. Renders an internal native
 * `<button part="base">`. `type="submit"`/`type="reset"`
 * are handled by this component itself via the host's associated form — a shadow-internal
 * native `<button type="submit">` does not participate in an ancestor light-DOM form's submission
 * on its own, since form-submitter semantics don't cross the shadow boundary.
 * Submit and reset remain default actions of the composed native `click`: any listener on that
 * click path can call `preventDefault()` to veto them, while stopping propagation alone does not.
 * Form-level `submit`/`reset` cancellation remains a separate, later veto point.
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
 * `aria-disabled` on a still-navigable link). It also dims to `--lr-opacity-disabled` with a
 * `not-allowed` cursor and drops its hover/press feedback, exactly as the native `<button>` path
 * does — an `<a>` can never match the `:disabled` pseudo-class, so that arm of the disabled
 * styling is keyed off `aria-disabled` instead. An unsafe/unparseable `href` falls back to the
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
 * Circle and automatically detected icon-only buttons keep the shared
 * `--lr-icon-button-size` minimum target in every `size` tier; the tier still scales their glyph
 * and chrome, but cannot collapse the clickable box below that floor.
 * In a constrained row the default-slot label ellipsizes, while each `start`/`end` adornment is
 * capped at 40% of the control so unbroken consumer content cannot force the button wider.
 *
 * @customElement lr-button
 * @event focus - Native focus relayed once from the internal button or anchor.
 * @event blur - Native blur relayed once from the internal button or anchor.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-invalid - The button failed a validity check. Cancelable; preventing it also prevents
 *   the native `invalid` event's default validation UI.
 * @slot - Default slot: the button's label content.
 * @slot start - Leading icon/content, rendered before the label.
 * @slot prefix - Shoelace alias for `start`, rendered through the same wrapper.
 * @slot end - Trailing icon/content, rendered after the label.
 * @slot suffix - Shoelace alias for `end`, rendered through the same wrapper.
 * @attr form - ID of an external form owner. The `form` property still reads as the resolved form.
 * @attr rel - Independently settable author relationship tokens (no default). `opener` is always
 *   stripped, and any `target` force-adds the non-removable `noopener noreferrer` guard.
 * @csspart base - Compatibility name for the internal control; use `button`.
 * @csspart button - The internal native `<button>` (or an `<a>` for a safe link). It is the same
 *   node as `base`. Circle and icon-only states retain the shared minimum icon-button target.
 * @csspart label - The default-slot label wrapper.
 * @csspart start - The `start` slot wrapper.
 * @csspart prefix - Shoelace alias for `start`; both names are on the same wrapper.
 * @csspart end - The `end` slot wrapper.
 * @csspart suffix - Shoelace alias for `end`; both names are on the same wrapper.
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
 * ignores it (it renders with zero radius). `pill` changes the private default to
 * `--lr-radius-pill`; an inherited or direct `--lr-button-radius` still wins.
 * @cssprop [--lr-button-caret-size=var(--lr-size-0-75em)] - Font size of the `with-caret` chevron,
 * i.e. its rendered glyph box. Relative to the button's own font size, so it follows every `size`
 * tier without a per-tier rule.
 * @cssprop --lr-button-shadow - Box shadow of the internal button. **Undeclared by default**, so
 * `box-shadow` falls back to `none` — byte-identical to before this property existed. Set it (e.g.
 * an elevated/floating action button) without a `::part(base)` rule.
 * @cssstate disabled - The button is disabled directly, by a fieldset, or by `loading`.
 * @cssstate icon-button - The default slot contains one icon-like element and no text.
 * @cssstate link - A safe `href` currently renders the native anchor mode.
 * @cssstate loading - The button is showing its loading spinner.
 * @status stable
 * @since 4.0.0
 */
export class LyraButton extends LyraElement<LyraButtonEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> =
    {
      ...super.defaultStrings,
      fieldRequired: LYRA_DEFAULT_fieldRequired,
    };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraButton>[] {
    return [
      currentValidityValidator(
        'required',
        'disabled',
        'loading',
        'href',
        'value'
      ),
    ];
  }
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
    name: {
      reflect: true,
      noAccessor: true,
      converter: omittedEmptyStringConverter,
    },
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
  };

  private _fieldsetDisabled = false;
  private _disabled = false;
  private _name = '';
  private _value = '';
  private _required = false;
  private _variant: LyraVariant = 'neutral';
  private hasSyncedDescribedByElements = false;
  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer validity retained while a non-action mode is barred from validation. */
  private customValidityMessage = '';
  private reflectingCustomError = false;
  /** Consumer-supplied validation message reflected through `custom-error`.
   * @default null */
  declare customError: string | null;

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
    this.updateValidity();
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
  set name(next: string | null) {
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

  /** Browser-resolved form owner; assigning an ID, form element, or `null` updates `form`. */
  @property({ attribute: 'form' })
  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  getForm(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  get labels(): NodeList {
    return this.internals.labels;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }

  constructor() {
    super();
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init)
    );
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(
      this,
      this.internals,
      () => this[VALIDITY_ANCHOR]()
    );
    installCustomErrorProperty(this, () => this.customValidityMessage);
    this.updateValidity();
    this.syncButtonStates();
  }

  /** Accessible name forwarded to the internal native button or anchor. Bound to the host's
   *  `aria-label` content attribute so changing or removing that attribute after mount keeps the
   *  actual focused control synchronized. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property({ attribute: 'aria-haspopup' }) private triggerHasPopup:
    | string
    | null = null;
  @property({ attribute: 'aria-expanded' }) private triggerExpanded:
    | string
    | null = null;
  @property({ attribute: 'aria-controls' }) private triggerControls:
    | string
    | null = null;
  @property({ attribute: 'aria-describedby' }) private triggerDescribedBy:
    | string
    | null = null;

  /** Semantic tone, from the library's one `variant` vocabulary — the same five values every other
   *  `variant` in the library takes. Selects which row of the semantic colour grid every fill,
   *  border and foreground token below resolves against. Shoelace's `default`/`primary` spellings
   *  normalize to `neutral`/`brand`; its `text` spelling normalizes to neutral `appearance="plain"`.
   *  Reads always return the canonical Lyra vocabulary.
   * @default neutral */
  @property({ reflect: true })
  get variant(): ButtonVariant {
    return this._variant;
  }
  set variant(next: ButtonVariant) {
    if (next === 'primary') this._variant = 'brand';
    else if (next === 'default' || next === 'text') this._variant = 'neutral';
    else this._variant = next;
    if (next === 'text') this.appearance = 'plain';
  }
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
  /** Fully rounded ends, for a pill-shaped control. Changes the private radius default to
   *  `--lr-radius-pill` rather than declaring a radius on `[part~="base"]`, so an inherited or
   *  direct `--lr-button-radius` stays authoritative. `appearance="link"` still renders with zero
   *  chrome, pill or not. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Shoelace-compatible circular icon-button treatment. It does not replace `pill`: `circle`
   *  additionally makes the control square and removes label-oriented inline padding. */
  @property({ type: Boolean, reflect: true }) circle = false;
  /** Shoelace-compatible outlined treatment. The canonical `appearance` property remains
   *  untouched so removing `outline` restores the exact Lyra appearance the author selected. */
  @property({ type: Boolean, reflect: true }) outline = false;
  /** Renders a decorative trailing chevron (`[part="caret"]`, `aria-hidden`) marking the button as
   *  a dropdown/menu trigger. It carries no accessible name of its own — the button's label already
   *  names the action, and the popup relationship is expressed by a host `aria-haspopup`/
   *  `aria-expanded`, which are forwarded to the internal control. */
  @property({ attribute: 'with-caret', type: Boolean, reflect: true })
  withCaret = false;
  /** Reflected Shoelace alias for `withCaret`; both attributes reach the same rendered chevron.
   * @default false */
  @property({ type: Boolean, reflect: true })
  get caret(): boolean {
    return this.withCaret;
  }
  set caret(next: boolean) {
    this.withCaret = Boolean(next);
  }
  /** SSR presence hint for the `start` adornment wrapper. Assigned slot content is still detected
   *  automatically, so this is optional in client-rendered markup. */
  @property({ attribute: 'with-start', type: Boolean }) withStart = false;
  /** SSR presence hint for the `end` adornment wrapper. */
  @property({ attribute: 'with-end', type: Boolean }) withEnd = false;
  /** Forwarded to this component's own submit/reset handling — see the class doc comment above
   *  for why this component (not the shadow-internal `<button>`) owns that behavior. */
  @property() type: ButtonType = 'button';
  /** The value submitted alongside `name`. Meaningful only together with a `name`, matching a
   *  native submit button. */
  /**
   * @default ''
   */
  @property({ reflect: true })
  get value(): string {
    return this._value;
  }
  set value(next: string) {
    this._value = next ?? '';
    this.updateValidity();
  }
  /** Whether a non-empty submitter value is required. This adds the Web Awesome form-control
   *  contract without making an ordinary optional action button contribute persistent form data.
   * @default false */
  @property({ type: Boolean, reflect: true })
  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    this._required = Boolean(next);
    this.updateValidity();
  }
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
  @property({ attribute: 'formnovalidate', type: Boolean }) formNoValidate =
    false;
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
  @property({ reflect: true }) href?: string;
  /** Native anchor `target`, used only while `href` resolves to a link. Setting this to `'_blank'`
   *  (or any other target) always contributes `noopener noreferrer` to the rendered anchor's `rel`
   *  — matching `lr-card`'s/`lr-stat`'s identical pattern. Author `rel` tokens are merged rather
   *  than ignored (see `rel`), but the guard is not removable and `opener` is always stripped.
   *  Ignored in `<button>` mode. */
  @property() target?: string;
  /** Author-settable link relationship, merged with a non-negotiable security floor.
   *
   *  Mirrors `wa-button`/`sl-button`'s `rel`, so values the platform defines and upstream consumers
   *  actually use -- `nofollow`, `me`, `license`, `external`, `tag` -- survive a `wa-`/`sl-` -> `lr-`
   *  rename instead of being silently dropped. Two rules are enforced regardless of what an author
   *  writes, which is what keeps this safe to expose:
   *
   *  1. `opener` is always stripped. It is the one token that re-opens the reverse-tabnabbing vector.
   *  2. Whenever `target` is set, `noopener noreferrer` is force-added. A named/new browsing context
   *     always gets the guard, author input or not.
   *
   *  With no `target` there is no new browsing context to protect, so a same-tab link renders exactly
   *  the author's tokens. Deliberately left with NO default: `wa-button` declares none, and defaulting
   *  it (as `sl-button` does) would start suppressing the `Referer` header on every same-tab Lyra
   *  link -- a real behavior change well beyond parity. */
  @property() rel?: string;

  /** Resolved `rel` for the rendered anchor: author tokens minus `opener`, plus the
   *  `noopener noreferrer` guard whenever `target` is set. `undefined` when nothing remains, so the
   *  attribute is omitted rather than rendered empty. */
  private get resolvedRel(): string | undefined {
    const authored = (this.rel ?? '')
      .split(/\s+/)
      .filter((token) => token !== '' && token.toLowerCase() !== 'opener');
    const tokens = new Set(authored);
    if (this.target) {
      tokens.add('noopener');
      tokens.add('noreferrer');
    }
    return tokens.size > 0 ? [...tokens].join(' ') : undefined;
  }
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
  @state() private isIconButton = false;

  // Matches either root: the native `<button>` (default) or the `<a>` rendered in anchor mode, so
  // `click()`/`focus()`/`blur()` work in both.
  @query('[part~="base"]') private baseEl?:
    | HTMLButtonElement
    | HTMLAnchorElement;

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

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.baseEl ?? null;
  }

  /** A native `<button>`'s label activates it, exactly as if the button itself had been clicked —
   *  so an external `<label for>` must run this button's submit/reset behavior once, not merely
   *  move focus to it. The role the internal element exposes cannot say that on its own: the
   *  triggers of `<lr-select>` and `<lr-color-picker>` are `<button>`s too, and opening their
   *  popups from a label click is not native behavior.
   *  @internal */
  [EXTERNAL_LABEL_ACTIVATION](): ExternalLabelActivation {
    return 'activate';
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  /** Sets or clears a consumer-supplied validation error without disturbing `required`. */
  setCustomValidity(message: string): void {
    const old = this.customValidityMessage || null;
    const next = message ?? '';
    this.customValidityMessage = next;
    this.validityController.setCustomValidity(
      this.isValidationBarred ? '' : next
    );
    if (!this.reflectingCustomError) {
      this.reflectingCustomError = true;
      try {
        if (next) this.setAttribute('custom-error', next);
        else this.removeAttribute('custom-error');
      } finally {
        this.reflectingCustomError = false;
      }
    }
    this.requestUpdate('customError', old);
  }

  /** Clears consumer custom validity and republishes the current intrinsic constraint. */
  resetValidity(): void {
    this.customValidityMessage = '';
    this.validityController.setCustomValidity('');
    this.updateValidity();
  }

  /** Restores the submitter value used by session history/autofill without making it a persistent
   *  form-data entry; it is still contributed only while this control is the submitter. */
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    this.value = typeof state === 'string' ? state : '';
  }

  /** Runs the form action after every listener on the composed click path had its veto turn. */
  private runClickDefaultAction(): void {
    if (this.type === 'submit') {
      const form = this.getForm();
      if (!form) return;
      if (this.hasSubmitterOverrides) this.submitAsNamedSubmitter(form);
      else form.requestSubmit();
    } else if (this.type === 'reset') {
      this.getForm()?.reset();
    }
  }

  private onClick = (event: MouseEvent): void => {
    if (this.type !== 'submit' && this.type !== 'reset') return;
    const ownerWindow = this.ownerDocument.defaultView;
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      ownerWindow?.removeEventListener('click', finishAtWindow);
      if (event.defaultPrevented || this.effectiveDisabled || this.loading)
        return;
      this.runClickDefaultAction();
    };
    const finishAtWindow = (candidate: MouseEvent): void => {
      if (candidate === event) finish();
    };

    // Window is the last ordinary target on a composed click path. Installing this listener from
    // the internal target keeps the non-canceled default action synchronous (and therefore keeps
    // click() native-like) while still observing every pre-existing host/document/window listener.
    // stopPropagation()/stopImmediatePropagation() do not cancel native default actions, so a
    // microtask fallback performs the same action when the event never reaches Window.
    ownerWindow?.addEventListener('click', finishAtWindow);
    queueMicrotask(finish);
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
    return (
      Boolean(this.name || this.value || this.formNoValidate) ||
      this.formAction !== undefined ||
      this.formEnctype !== undefined ||
      this.formMethod !== undefined ||
      this.formTarget !== undefined
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
    const submitter = this.ownerDocument.createElement('button');
    submitter.type = 'submit';
    submitter.hidden = true;
    submitter.tabIndex = -1;
    if (this.name) {
      submitter.name = this.name;
      submitter.value = this.value;
    }
    // Presence, not truthiness, is the platform contract. Empty override attributes are meaningful:
    // for example, `formaction=""` resolves against the current document rather than inheriting the
    // form owner's action. Copy raw attributes so native normalization happens on the real submitter.
    if (this.formAction !== undefined)
      submitter.setAttribute('formaction', this.formAction);
    if (this.formEnctype !== undefined)
      submitter.setAttribute('formenctype', this.formEnctype);
    if (this.formMethod !== undefined)
      submitter.setAttribute('formmethod', this.formMethod);
    if (this.formNoValidate) submitter.formNoValidate = true;
    if (this.formTarget !== undefined)
      submitter.setAttribute('formtarget', this.formTarget);

    if (this.parentElement && this.closest('form') === form)
      this.insertAdjacentElement('afterend', submitter);
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
    this.updateValidity();
    this.syncButtonStates();
    this.requestUpdate();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    this.syncButtonStates();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Seed the wrapper-visibility flags from light-DOM children before the first render, so the
    // adornment wrappers start collapsed/expanded correctly rather than flashing full-width for a
    // frame until the first `slotchange` fires. Refreshed thereafter by `onStartSlotChange`/
    // `onEndSlotChange`.
    if (!this.hasUpdated) {
      this.syncAdornmentSlots();
      this.isIconButton = this.hasIconOnlyDefaultContent();
    }
  }

  private syncAdornmentSlots(): void {
    // Nested Lit SSR shims implement the reactive host surface without necessarily exposing the
    // browser's Element.children collection. Treat that pre-hydration shape as empty light DOM;
    // real slotchange reconciliation fills the flags after hydration.
    const collection = (this as unknown as { children?: HTMLCollection })
      .children;
    const children = collection ? Array.from(collection) : [];
    this.hasStartSlot = children.some((element) => {
      const slot = element.getAttribute('slot');
      return slot === 'start' || slot === 'prefix';
    });
    this.hasEndSlot = children.some((element) => {
      const slot = element.getAttribute('slot');
      return slot === 'end' || slot === 'suffix';
    });
  }

  private onStartSlotChange = (): void => {
    this.syncAdornmentSlots();
  };

  private onEndSlotChange = (): void => {
    this.syncAdornmentSlots();
  };

  private hasIconOnlyDefaultContent(): boolean {
    const childElements = (this as unknown as { children?: HTMLCollection })
      .children;
    const elements = (childElements ? Array.from(childElements) : []).filter(
      (element) => !element.getAttribute('slot')
    );
    if (elements.length !== 1) return false;
    const childNodes = (
      this as unknown as { childNodes?: NodeListOf<ChildNode> }
    ).childNodes;
    const directText = (childNodes ? Array.from(childNodes) : [])
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent ?? '')
      .join('')
      .trim();
    return directText === '' && (elements[0]?.textContent ?? '').trim() === '';
  }

  private onDefaultSlotChange = (): void => {
    this.isIconButton = this.hasIconOnlyDefaultContent();
    this.syncButtonStates();
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    syncAriaControlsElements(this, this.baseEl, this.triggerControls);
    this.syncDescribedByElements();
    // Rendering can replace the native button with an anchor, and `loading` disables only the
    // rendered control. Reconcile validation after that mode transition so non-actions never block
    // their form, then restore the retained intrinsic/custom state when button mode returns.
    this.updateValidity();
    this.syncButtonStates();
  }

  private updateValidity(): void {
    if (!this.validityController) return;
    if (this.isValidationBarred) {
      // Retain consumer state in `customValidityMessage` while clearing both controller layers;
      // otherwise its hostUpdated anchor refresh would reapply a barred custom error.
      this.validityController.setCustomValidity('');
      this.validityController.setValidity({});
      return;
    }
    if (this.required && !this.value) {
      this.validityController.setValidity(
        { valueMissing: true },
        this.localize('fieldRequired')
      );
    } else {
      this.validityController.setValidity({});
    }
    this.validityController.setCustomValidity(this.customValidityMessage);
  }

  /** Disabled/loading controls and a link-rendering button are not form actions. */
  private get isValidationBarred(): boolean {
    return (
      this.effectiveDisabled || this.loading || this.baseEl?.localName === 'a'
    );
  }

  private syncButtonStates(): void {
    if (!this.internals) return;
    setCustomState(
      this.internals,
      'disabled',
      this.effectiveDisabled || this.loading
    );
    setCustomState(this.internals, 'icon-button', this.isIconButton);
    setCustomState(this.internals, 'link', this.baseEl?.localName === 'a');
    setCustomState(this.internals, 'loading', this.loading);
  }

  private syncDescribedByElements(): void {
    if (!this.triggerDescribedBy && !this.hasSyncedDescribedByElements) return;
    this.hasSyncedDescribedByElements = syncAriaDescribedByElements(
      this,
      this.baseEl,
      this.triggerDescribedBy
    );
  }

  override render(): TemplateResult {
    // Shared inner content, rendered identically in both roots so the extracted variable produces
    // byte-identical DOM to the previous inline template in `<button>` mode.
    const content = html`
      <span
        part="start prefix"
        ?hidden=${!(this.hasStartSlot || this.withStart)}
      >
        <slot name="start" @slotchange=${this.onStartSlotChange}></slot>
        <slot name="prefix" @slotchange=${this.onStartSlotChange}></slot>
      </span>
      <span part="label"
        ><slot @slotchange=${this.onDefaultSlotChange}></slot
      ></span>
      <span part="end suffix" ?hidden=${!(this.hasEndSlot || this.withEnd)}>
        <slot name="end" @slotchange=${this.onEndSlotChange}></slot>
        <slot name="suffix" @slotchange=${this.onEndSlotChange}></slot>
      </span>
      ${this.withCaret
        ? html`<span part="caret" aria-hidden="true">${chevronIcon()}</span>`
        : nothing}
      ${this.loading
        ? html`<span part="spinner" aria-hidden="true">${spinnerIcon()}</span>`
        : ''}
    `;

    // `download` turns the anchor from a navigation sink into a resource sink, and the two carry
    // different allowlists -- `mailto:` is a legitimate destination but names no retrievable bytes.
    // Presence is deliberate: native `download=""` is meaningful and still selects the stricter
    // resource URL policy even though it supplies no filename.
    const hasDownload = this.download !== undefined;
    const href = hasDownload
      ? safeDownloadHref(this.href)
      : safeLinkHref(this.href);
    if (href) {
      const disabled = this.effectiveDisabled || this.loading;
      // A disabled link button omits `href` entirely. An anchor with no `href` is
      // not focusable or activatable, so the button genuinely cannot navigate -- unlike a bare
      // `aria-disabled` on a still-navigable `<a href>`. `@click`/submit-reset are deliberately
      // absent: native navigation is the anchor's own activation (mirrors `lr-card`).
      return html`<a
        part="base button"
        ?data-icon-button=${this.isIconButton}
        href=${disabled ? nothing : href}
        target=${this.target || nothing}
        rel=${this.resolvedRel ?? nothing}
        download=${hasDownload ? this.download ?? '' : nothing}
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
        part="base button"
        ?data-icon-button=${this.isIconButton}
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
