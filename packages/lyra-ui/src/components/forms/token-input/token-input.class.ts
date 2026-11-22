import { normalizeLabel } from '../../../internal/accessible-name.js';
import { formControlSupportingState, renderFormControlHintError } from '../../../internal/form-control-template.js';
import { AutocorrectState, installNativeSelectionAccessors, setNativeRangeText, nativeAutocorrectAttribute } from '../../../internal/native-text-control.js';
import { ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
import { FormControlController, reflectFormName } from '../../../internal/form-control-controller.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { isHandledOrComposingKey, shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { LyraFormControlElement } from '../../../internal/form-control-element.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
import { HostDescriptionController } from '../../../internal/aria-controls.js';
import {
  type ComposedFocusRepairSnapshot,
  captureComposedFocusRepair,
  applyComposedFocusRepair,
} from '../../../internal/focus-navigation.js';
import {
  VALIDITY_ANCHOR,
} from '../../../internal/anchored-validity.js';
import { setCustomState, syncValidityStates } from '../../../internal/custom-states.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import { closeIcon } from '../../../internal/icons.js';
import { autocorrectConverter, spellcheckConverter, blankNumberConverter } from '../../../internal/converters.js';
import { submitOnEnter } from '../../../internal/submit-on-enter.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize, LyraLabelDisplay, LyraLabelPlacement } from '../../../internal/variants.js';
import { styles } from './token-input.styles.js';
import {
  createStringArrayFormDataState,
  getFormOwner,
  isBarredFromValidation,
  isLiveDisabled,
  readStringArrayFormDataState,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_selectSelectedOverflow, LYRA_DEFAULT_tokenInputEditWithContext, LYRA_DEFAULT_tokenInputLabel, LYRA_DEFAULT_tokenInputRequired, LYRA_DEFAULT_tokenInputTooFew, LYRA_DEFAULT_tokenInputTooMany } from '../../../internal/default-strings/forms.generated.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_next, LYRA_DEFAULT_previous, LYRA_DEFAULT_removeWithContext } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


installFormControlLabelSupport();

/** Tokens mounted when `max-tokens-visible` is omitted or non-finite. Explicit zero stays unlimited. */
const IMPLICIT_TOKEN_LIMIT = 200;

export interface LyraTokenInputEventMap {
  'lr-invalid': CustomEvent<null>;
  input: InputEvent;
  change: Event;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-input': CustomEvent<Readonly<{ value: readonly string[]; previousValue: readonly string[] }>>;
  'lr-change': CustomEvent<Readonly<{ value: readonly string[]; previousValue: readonly string[] }>>;
  /** Cancelable proposal to add one or more tokens in a single commit. */
  'lr-token-add-request': CustomEvent<Readonly<{ value: string; values: readonly string[] }>>;
  /** Cancelable per-token proposal, emitted before `lr-token-add-request` for each typed or pasted candidate. */
  'lr-create': CustomEvent<Readonly<{ inputValue: string }>>;
  /** The clear button emptied the token list. */
  'lr-clear': CustomEvent<null>;
  /** Cancelable proposal to remove one token. */
  'lr-token-remove-request': CustomEvent<{ value: string; index: number }>;
  /** Cancelable proposal to edit one token in place. */
  'lr-token-edit-request': CustomEvent<{
    value: string;
    previousValue: string;
    index: number;
  }>;
}

/**
 * `delimiter` accepts `null` to mean "never split, and never treat a keystroke as a commit key",
 * which the default string converter can't express: a missing attribute leaves the property at its
 * declared default, and `delimiter=""` would otherwise reach `''.split('')` and explode a draft into
 * individual characters. Both `delimiter="none"` and `delimiter=""` therefore map to `null`;
 * removing the attribute restores the `,` default.
 */
const delimiterConverter = {
  fromAttribute: (value: string | null): string | null => {
    if (value === null) return ',';
    return value === '' || value === 'none' ? null : value;
  },
};

/** Splits `text` on every character of `delimiters`, trimming and dropping empty entries. */
function parseDelimited(text: string, delimiters: string | null): readonly string[] {
  const chars = new Set(delimiters ? [...delimiters] : [',']);
  const parts: string[] = [];
  let current = '';
  for (const char of text) {
    if (chars.has(char)) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  parts.push(current);
  return Object.freeze(parts.map(part => part.trim()).filter(Boolean));
}

/** A finite, non-negative whole-number limit, or `null` when unset or unusable. */
function tokenLimit(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function normalizeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  try {
    const normalized: string[] = [];
    for (const entry of value) {
      if (typeof entry === 'string') normalized.push(entry);
    }
    return Object.freeze(normalized);
  } catch {
    return Object.freeze([]);
  }
}

const stringArrayConverter = {
  fromAttribute: (value: string | null): readonly string[] | null => {
    if (value === null) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      return normalizeStringArray(parsed);
    } catch {
      return [];
    }
  },
  toAttribute: (value: readonly string[] | null): string | null =>
    value == null ? null : JSON.stringify(value),
};

/** `<lr-token-input>` — an editable, form-associated list of removable tokens.
 *
 * Enter commits the typed draft into a token while there is one; with the draft empty it performs
 * the implicit form submission a native text field would (see `internal/submit-on-enter.ts` — the
 * internal input is in a shadow root and has no form owner, so the platform can never do it here).
 * A `delimiter` keystroke stays purely a commit key and never submits. Tab commits a nonempty
 * draft without preventing the key, so native focus traversal still advances.
 * Composing keyboard events, including legacy key code 229, remain with the draft or inline
 * editor without adding, removing, committing or closing tokens.
 * Host-root external descriptions precede local hint/error guidance on the native draft input
 * and follow live source replacement, removal, reconnection and document adoption.
 * Removing label, hint or error-text safely removes the copy without changing native
 * attribute-removal property readback. Editable token labels keep their text vertically centered.
 * `select()`, the selection getters/setters, `setSelectionRange()`, and `setRangeText()` expose the
 * native draft input's editing surface. Range edits synchronize the pending draft without
 * emitting user events, so a later delimiter/Enter/Tab/blur commit consumes the edited text.
 * `focus()` and `click()` are synchronous no-ops under own or fieldset-cascaded disablement,
 * including the same task that begins the disabled transition before Lit updates the draft input.
 * `readonly` keeps the draft input, the remove buttons and (with `editable`) every token label
 * focusable and browseable while blocking every value-committing affordance -- typing a new draft,
 * committing it, removing a token, and opening or committing the inline token editor; selection/
 * copy, form submission/reset, and programmatic writes remain available, mirroring `lr-input`'s
 * `readonly`.
 * If a focused token surface disappears through its own remove action or a controlled
 * `value`/`defaultValue` shrink, focus moves to the nearest surviving equivalent surface, or to
 * the draft input when no token remains. A newer external focus destination always wins.
 * @customElement lr-token-input
 * @slot label - Visible label content.
 * @slot hint - Supporting text.
 * @slot error - Validation message.
 * @slot start - Adornment at the inline-start of the token/input row, before the tokens.
 * @slot end - Adornment at the inline-end of the token/input row, after the draft input.
 * @slot clear-icon - Replaces the built-in glyph of the `with-clear`/`clearable` button.
 * @event input - Native `InputEvent` emitted after a user changes the token list.
 * @event change - Native commit `Event` emitted with `input`.
 * @event lr-input - Lyra input alias; detail is `{ value, previousValue }` with the current and prior token lists.
 * @event lr-change - Lyra commit alias; detail is `{ value, previousValue }` with the current and prior token lists.
 * @event focus - Native `FocusEvent` relayed from the draft input or inline token editor.
 * @event blur - Native `FocusEvent` relayed from the draft input or inline token editor.
 * @event lr-token-add-request - One or more tokens are about to be added in a single commit.
 *   Detail is `{ value, values }`, where `value` is the final added token for compatibility and
 *   `values` is the complete ordered batch. Cancelable -- call `preventDefault()` to veto the add
 *   (e.g. a server-side validation check) and the tokens stay out of `value`; the typed draft text
 *   is left in the input unchanged so the user can correct it, rather than being silently cleared.
 * @event lr-create - One typed or pasted token is about to be created; detail is `{ inputValue }`.
 *   Cancelable -- emitted once per candidate, before `lr-token-add-request`, so a listener can
 *   reject a single token. `preventDefault()` drops that token; when every candidate is rejected
 *   the draft text stays in the input.
 * @event lr-clear - The clear button removed the tokens; fires after `input`/`change`. The button
 *   first proposes each removal through `lr-token-remove-request`, so a vetoed token stays.
 * @event lr-token-remove-request - A token is about to be removed; detail is `{ value, index }`.
 *   Cancelable -- call `preventDefault()` to veto the removal (e.g. pending an async confirmation
 *   or a protected-token check) and the token stays in `value` unchanged.
 * @event lr-token-edit-request - An existing token is about to be edited in place; detail is
 *   `{ value, previousValue, index }`. Not emitted for a reverted, unchanged, emptied, or
 *   duplicate-colliding edit -- those close the editor with no event. Cancelable -- call
 *   `preventDefault()` to veto the edit and the token stays in `value` unchanged; the inline
 *   editor stays open with the user's edited text intact so they can correct it, rather than
 *   closing and discarding it.
 * @event lr-invalid - The token list failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @cssprop --lr-form-control-height - Single-line field height; a start-placed label aligns to the first line of a taller field.
 * @cssprop [--lr-form-control-touch-font-size-min=16px] - Font-size floor of the editable text
 *   surface under a coarse or hover-less pointer, which stops mobile Safari zooming on focus. `0px`
 *   disables it.
 * @cssprop [--lr-form-control-invalid-border-color] - Shared invalid border color, overridden by a component-specific invalid border.
 * @cssprop [--lr-token-input-placeholder-color=var(--lr-color-text-quiet)] - Placeholder text color.
 * @csspart form-control - Outer control wrapper.
 * @cssprop [--lr-form-control-label-font-size=inherit] - Font size of the field label.
 * @cssprop [--lr-form-control-label-font-weight=var(--lr-font-weight-semibold)] - Font weight of the field label.
 * @cssprop [--lr-form-control-label-color=var(--lr-color-text)] - Text color of the field label.
 * @cssprop [--lr-form-control-label-inline-size=30%] - Label column width while
 *   `label-placement="start"`.
 * @cssprop [--lr-form-control-label-gap=var(--lr-space-m)] - Space between the label column and
 *   the field while `label-placement="start"`.
 * @cssprop [--lr-form-control-label-collapse-inline-size=var(--lr-size-20rem)] - Control width
 *   below which `label-placement="start"` returns the label above the field.
 * @csspart form-control-label - Label.
 * @csspart input-wrapper - Token and input row. Also exposed as `tag-input`.
 * @csspart tags - Wrapper around the tokens, laid out with `display: contents` so they remain flex
 *   items of the row; override `display` to box them.
 * @csspart tag-input - Alias of `input-wrapper`.
 * @csspart tag - Alias of `token`.
 * @csspart tag__content - Alias on the token's text (the `token-label` while `editable`).
 * @csspart tag__remove-button - Alias of `remove`.
 * @csspart tag__remove-button__button - Alias of `remove`; the remove button is the native button.
 * @csspart clear-button - The `with-clear`/`clearable` button.
 * @csspart previous-page - Shows the previous window of tokens.
 * @csspart next-page - Shows the next window of tokens.
 * @csspart token-overflow - Count of tokens omitted by `max-tokens-visible`.
 * @csspart token - Individual token.
 * @csspart token-label - The token's text, as the roving-focus edit trigger. Rendered only while
 *   `editable` is set. Effective disablement removes every token label's tabindex, exposes
 *   `aria-disabled="true"`, and retires internal focus; re-enabling restores one roving stop.
 * @csspart token-editor - The inline text field replacing a token's text while it is being edited. Rendered only while `editable` is set and that token is open for editing.
 * @csspart remove - Token remove button.
 * @csspart input - Native text input.
 * @csspart start - Wrapper around the `start` adornment slot; `hidden` while nothing is slotted.
 * @csspart end - Wrapper around the `end` adornment slot; `hidden` while nothing is slotted.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 * @cssprop [--lr-token-input-input-inline-size=var(--lr-size-8rem)] - `flex-basis` of the native text input within the token row.
 * @cssprop [--lr-token-input-min-input-inline-size=var(--lr-size-4rem)] - Inline-size floor of the native text input, so it stays usable once tokens wrap.
 * @cssprop [--lr-token-input-editor-inline-size=var(--lr-size-6rem)] - Inline size of the inline token editor opened by `editable`.
 * @cssprop --lr-token-input-padding - Input-wrapper padding, scaled by `size`.
 * @cssprop --lr-token-input-token-padding - Per-token chip padding, scaled by `size`.
 * @cssprop [--lr-token-input-gap=var(--lr-space-xs)] - Gap between form/row children.
 * @cssprop [--lr-token-input-token-gap=var(--lr-space-2xs)] - Gap inside token chips.
 * @cssprop [--lr-token-input-radius=var(--lr-radius)] - Row/token corner radius. `pill` changes its
 *   private default to `--lr-radius-pill`; an inherited or direct public value still wins.
 * @cssprop [--lr-token-input-token-bg=var(--lr-color-brand-quiet)] - Token chip background.
 * @cssprop [--lr-token-input-token-color=var(--lr-color-text)] - Token chip text color.
 * @cssprop [--lr-token-input-token-radius=var(--lr-radius)] - Token chip corner radius, matching the
 *   `lr-select` and `lr-combobox` chips rather than the field radius (`pill` rounds it fully).
 * @cssprop [--lr-token-input-action-hover-bg=var(--lr-color-brand-quiet)] - Edit/remove hover background.
 * @cssprop [--lr-token-input-edit-hover-bg=var(--lr-token-input-action-hover-bg)] - Editable token
 *   label hover background, independently themeable from the remove action.
 * @cssprop --lr-token-input-edit-active-bg - Editable token label pressed background; defaults to
 *   an active-state mix of `--lr-token-input-edit-hover-bg`.
 * @cssprop [--lr-token-input-remove-hover-bg=var(--lr-token-input-action-hover-bg)] - Remove action
 *   hover background, independently themeable from the editable label.
 * @cssprop --lr-token-input-remove-active-bg - Remove action pressed background; defaults to an
 *   active-state mix of `--lr-token-input-remove-hover-bg`.
 * @cssprop [--lr-token-input-focus-border-color=var(--lr-color-brand)] - Focused row border color.
 * @cssprop [--lr-token-input-invalid-border-color=var(--lr-color-danger)] - Invalid row border color.
 * @cssprop --lr-token-input-font-size - Input-wrapper/token font size, scaled by `size`.
 * @cssprop [--lr-token-input-control-min-height=var(--lr-form-control-height)] - Input-wrapper
 *   block-size floor. Reads the shared form-control height ladder, so retuning
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together.
 * @cssprop --lr-token-input-control-height - Exact input-wrapper height. Unset by default, which
 *   leaves `--lr-token-input-control-min-height` as a floor only; set it to a length to both floor
 *   and cap the row (e.g. to pixel-match a sibling field in the same toolbar row). An uncapped row
 *   grows as tokens wrap; a capped row clips inline overflow and intentionally scrolls in the
 *   block axis so wrapped tokens and their hit-area-floored actions remain reachable. Because it
 *   is never declared by the component itself, it can be set from an ancestor or an outer-tree
 *   rule as well as inline on the element.
 * @cssprop [--lr-token-input-fill=var(--lr-color-surface)] - Resting background of the input row.
 * @cssprop [--lr-token-input-border-color=var(--lr-color-border)] - Resting border color of the
 * input row. The invalid and focused states keep their own hooks and still win over it.
 * @cssprop [--lr-form-control-focus-shadow=none] - The shared field focus halo, painted as a
 * `box-shadow` while this control is focused. One name for every field-shaped control in the
 * library, so a halo is configured once rather than per component. Additive: the focus outline and
 * border cue are the accessibility answer to focus and are never replaced by it.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 * `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 * other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 * themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * required marker.
 * @cssstate blank - Matches while there are no tokens.
 * @cssstate readonly - Matches while `readonly` is set.
 * @cssstate required - Matches while `required` is set.
 * @cssstate optional - Matches while `required` is not set (the complement of `required`).
 * @cssstate valid - Matches while the control satisfies its constraints.
 * @cssstate invalid - Matches while it does not — including a pristine required control with no
 *   tokens yet, exactly like native `:invalid`.
 * @cssstate user-valid - `valid`, but only after the user has interacted: blurred the text
 *   input, `reportValidity()`, or a submission attempt. Not after a silent `checkValidity()`
 *   alone.
 * @cssstate user-invalid - `invalid`, but only after that same interaction — a required control
 *   nobody has touched yet is invalid without being styled as an error.
 * @status stable
 * @since 4.0.0
 */
export class LyraTokenInput extends LyraFormControlElement<LyraTokenInputEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    next: LYRA_DEFAULT_next,
    previous: LYRA_DEFAULT_previous,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    selectSelectedOverflow: LYRA_DEFAULT_selectSelectedOverflow,
    tokenInputEditWithContext: LYRA_DEFAULT_tokenInputEditWithContext,
    tokenInputLabel: LYRA_DEFAULT_tokenInputLabel,
    tokenInputRequired: LYRA_DEFAULT_tokenInputRequired,
    tokenInputTooFew: LYRA_DEFAULT_tokenInputTooFew,
    tokenInputTooMany: LYRA_DEFAULT_tokenInputTooMany,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static {
    installNativeSelectionAccessors(this.prototype, host => host.inputEl, { methods: false });
  }

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    readonly: { type: Boolean, reflect: true, noAccessor: true },
    defaultValue: {
      attribute: 'value',
      reflect: true,
      useDefault: true,
      converter: stringArrayConverter,
      noAccessor: true,
    },
  };

  @property() label = '';
  /**
   * Whether the `label` renders on screen. `hidden` keeps the label as the accessible name but
   * removes it visually (compact toolbars, table cells); hint, error and required semantics are
   * unaffected. Reflected so styles and `[label-display]` selectors match.
   * @attr label-display
   */
  @property({ attribute: 'label-display', reflect: true }) labelDisplay: LyraLabelDisplay = 'visible';
  /**
   * Where the label sits: `top` (default) above the field, or `start` in an inline-start column
   * of `--lr-form-control-label-inline-size`, with hint and error aligned under the field. Below
   * `--lr-form-control-label-collapse-inline-size` the label returns above the field. The label
   * association is unchanged. Reflected so `[label-placement]` selectors match.
   * @attr label-placement
   */
  @property({ attribute: 'label-placement', reflect: true }) labelPlacement: LyraLabelPlacement = 'top';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  /** Placeholder shown in the draft input while it is empty. */
  @property() placeholder = '';
  /** Native autocomplete hint forwarded to both token editors. */
  @property({ useDefault: true }) autocomplete = '';
  /** Native virtual-keyboard mode forwarded to both token editors. */
  @property({ attribute: 'inputmode', useDefault: true }) override inputMode = '';
  /** Native virtual-keyboard Enter hint forwarded to both token editors. */
  @property({ attribute: 'enterkeyhint', useDefault: true }) override enterKeyHint = '';
  /** Forwarded to both native text inputs using the native explicit `"true"`/`"false"`
   *  attribute vocabulary. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to both native text inputs. Empty preserves the browser default. */
  @property() override autocapitalize = '';
  private readonly autocorrectState = new AutocorrectState(this, true);
  /** Native editing-assistance state forwarded to both text inputs. Reads are boolean; writes
   * accept booleans and the native/Shoelace string vocabulary (`off`/`false` disable it).
   * @default true
   */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectState.value;
  }
  override set autocorrect(next: boolean | string) {
    this.autocorrectState.set(next);
  }
  /** Names the wrapper and draft input. An empty attribute suppresses label linkage.
   * Whitespace alone falls back to the visible label, placeholder, or localized name. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with `lr-input`. The Web Awesome /
   *  Shoelace spellings `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a
   *  tag rename with no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Visual treatment of the token row, from the library's shared vocabulary and with the same meanings as
   *  `<lr-input>`'s `appearance`. Each value only swaps the private fill/border pair behind the
   *  public fill and border hooks. */
  @property({ reflect: true }) appearance: LyraAppearance = 'outlined';
  /** Rounds the token row's corners to a full pill, mirroring `lr-input`'s own `pill`. It is a
   *  single override of `--lr-token-input-radius`, which the tokens share with the row, so the
   *  chips round with it. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Allows the same token text to be added more than once; when `false`, a duplicate is rejected. */
  @property({ attribute: 'allow-duplicates', type: Boolean }) allowDuplicates =
    false;
  private _editable = false;
  /** Allow editing an existing token in place: each token becomes a roving tab stop that opens an
   *  inline editor on click, Enter, or F2. Defaults to `false`, in which case the token row renders
   *  exactly as it does without this feature and stays non-focusable. Own or fieldset-cascaded
   *  disablement removes every edit trigger from focus and marks it `aria-disabled="true"`; one
   *  roving stop is restored when the control becomes enabled again. */
  @property({ attribute: 'editable', type: Boolean, reflect: true })
  get editable(): boolean {
    return this._editable;
  }
  set editable(next: boolean) {
    const old = this._editable;
    this._editable = Boolean(next);
    if (!this._editable) this.discardTransientState(false);
    this.requestUpdate('editable', old);
  }
  /** Characters that turn typed text into tokens. Every character is its own delimiter: typing any
   *  of them commits the draft, and a commit or paste splits on all of them, so `";,"` accepts both
   *  semicolons and commas. `null` — from the property, or from `delimiter="none"` / `delimiter=""`
   *  — disables splitting and the delimiter keystroke (Enter, Tab and blur still commit), so a token
   *  may contain any character verbatim. Defaults to `,`. */
  @property({ attribute: 'delimiter', converter: delimiterConverter })
  delimiter: string | null = ',';
  /** Maximum number of tokens. Once reached, typed or pasted text cannot be committed (the draft
   *  stays in the field) until a token is removed; removal, editing and clearing still work. A list
   *  that is longer anyway (a programmatic `value`) reports `rangeOverflow`. Unset or non-finite
   *  means no limit.
   *  @attr max-tags */
  @property({ attribute: 'max-tags', converter: blankNumberConverter(null) }) maxTags: number | null = null;
  /** Minimum number of tokens, enforced only once at least one token exists (an empty optional list
   *  stays valid; use `required` for that). A shorter list reports `rangeUnderflow`. Unset or
   *  non-finite means no minimum.
   *  @attr min-tags */
  @property({ attribute: 'min-tags', converter: blankNumberConverter(null) }) minTags: number | null = null;
  /** Shows a button that removes every token while there is at least one and the control is neither
   *  disabled nor readonly. Same as `clearable`. */
  @property({ type: Boolean, reflect: true, attribute: 'with-clear' }) withClear = false;
  /** Same as {@link withClear}; accepted so either upstream spelling works. */
  @property({ type: Boolean }) clearable = false;
  /** The uncommitted draft text in the input. Assigning it replaces the draft without committing it. */
  @property({ attribute: false })
  get inputValue(): string { return this.draft; }
  set inputValue(next: string) {
    const text = next == null ? '' : String(next);
    this.draft = text;
    if (this.inputEl) this.inputEl.value = text;
  }
  private authoredTokenLimit: number | null = null;
  /** Maximum mounted tokens. Counts truncate at zero or greater. Explicit zero mounts every token.
   * An omitted or non-finite limit uses the default window of 200.
   * @default 200
   */
  @property({ attribute: 'max-tokens-visible', converter: blankNumberConverter(null) })
  get maxTokensVisible(): number { return this.authoredTokenLimit ?? IMPLICIT_TOKEN_LIMIT; }
  set maxTokensVisible(next: number | null) {
    const authored = Number.isFinite(next) ? next : null;
    if (this.authoredTokenLimit === authored) return;
    this.authoredTokenLimit = authored;
    this.requestUpdate();
  }

  private tokenIndices = new WeakMap<Element, number>();
  private tokenElement(index: number): HTMLElement | undefined {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('[part~="token"]')].find(element => this.tokenIndices.get(element) === index);
  }
  private tokenEntriesFor?: readonly string[];
  private tokenEntries: Array<{ token: string; index: number; key: string }> = [];
  private renderedTokenValues: readonly string[] = [];
  private get visibleTokenEntries() {
    if (this.tokenEntriesFor !== this.value) {
      this.tokenEntriesFor = this.value;
      const occurrences = new Map<string, number>();
      this.tokenEntries = this.value.map((token, index) => {
        const count = occurrences.get(token) ?? 0;
        occurrences.set(token, count + 1);
        return { token, index, key: `${token.length}:${token}:${count}` };
      });
    }
    const limit = finiteCount(this.maxTokensVisible);
    if (!limit || this.tokenEntries.length <= limit) return this.tokenEntries;
    const anchor = this.editingIndex >= 0 ? this.editingIndex : this.activeTokenIndex;
    const pageStart = Math.floor(anchor / limit) * limit;
    const start = Math.min(pageStart, this.tokenEntries.length - limit);
    return this.tokenEntries.slice(start, start + limit);
  }

  private onPagePointerDown(event: PointerEvent): void {
    // Let the click settle an active edit once, before transferring focus.
    if (this.editingIndex >= 0) event.preventDefault();
  }

  private pageTokens(button: HTMLButtonElement, direction: -1 | 1): void {
    if (isLiveDisabled(this) || button.getAttribute('aria-disabled') === 'true') return;
    const editing = this.editingIndex >= 0;
    if (editing) {
      this.commitEdit(false);
      if (this.editingIndex >= 0 || !this.isConnected || isLiveDisabled(this)) return;
    }
    const limit = finiteCount(this.maxTokensVisible);
    if (!limit) return;
    const index = (Math.floor(this.activeTokenIndex / limit) + direction) * limit;
    if (index < 0 || index >= this.value.length) return;
    this.rovingIndex = index;
    if (editing) {
      this.tokenFocusRepairPending = undefined;
      button.focus();
    }
  }

  private tokenEventIndex(event: Event): number {
    const token = event.composedPath().find(target => (target as Element).nodeType === 1 && (target as Element).matches('[part~="token"]')) as HTMLElement | undefined;
    return token ? this.tokenIndices.get(token) ?? -1 : -1;
  }
  private onTokenClick = (event: MouseEvent): void => {
    const index = this.tokenEventIndex(event); if (index < 0) return;
    const target = event.composedPath().find(target => (target as Element).nodeType === 1 &&
      (target as Element).matches('[part~="remove"], [part~="token-label"]')) as Element | undefined;
    if (target?.matches('[part~="remove"]')) this.removeToken(index);
    else if (target) this.startEdit(index);
  };
  private onTokenFocus = (event: FocusEvent): void => {
    const index = this.tokenEventIndex(event);
    if (index >= 0 && this.rovingIndex !== index) this.rovingIndex = index;
  };
  private onTokenKey = (event: KeyboardEvent): void => {
    if (!(event.target as Element).matches('[part~="token-label"]')) return;
    const index = this.tokenEventIndex(event); if (index >= 0) this.onTokenKeyDown(event, index);
  };

  @state() private draft = '';
  @state() private touched = false;
  /** Index of the token whose inline editor is open, or `-1` when none is. */
  @state() private editingIndex = -1;
  @state() private editDraft = '';
  /** Roving tab stop of the token row. Read through `activeTokenIndex`, which clamps it against the
   *  current token count so a shrinking list can never leave the row with no tab stop. */
  @state() private rovingIndex = 0;
  private focusEditorPending = false;
  private focusTokenPending = -1;
  private tokenFocusRepairPending?: {
    index: number;
    surface: 'label' | 'remove';
    repair: ComposedFocusRepairSnapshot;
  };
  /** One native blur can be followed by a teardown blur when its commit removes the focused editor. */
  private editorBlurRelayed = false;
  private readonly slotPresence = new SlotPresenceController(this);
  // Selected by id rather than by tag: an open token editor is also an `input`, and it precedes
  // this one in DOM order, so a bare `input` selector would silently retarget `focus()`, `blur()`,
  // and the validity anchor at the editor while a token is being edited.
  @query('#input') private inputEl?: HTMLInputElement;
  private readonly hostDescription = new HostDescriptionController(this, () => this.inputEl ?? null);
  private internals: ElementInternals;
  private validityController: FormControlController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private labelId = nextId('token-input-label');
  private readonly supportingId = nextId('token');
  private _value: readonly string[] = Object.freeze([]);
  private _defaultValue: readonly string[] = Object.freeze([]);
  private _valueDirty = false;
  private settingDefaultValue = false;
  private reflectingDefaultValue = false;
  // Tracked separately from the consumer's own `disabled` -- a fieldset
  // cascade must never mutate that IDL property/attribute itself (mirrors
  // lr-select's/lr-combobox's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern), only the combined getter below.
  private _fieldsetDisabled = false;
  private _name = '';
  private _required = false;
  private _disabled = false;
  private _readonly = false;

  /** Committed tokens; the array is canonical. Assigning a string instead splits it on the
   *  `delimiter` characters (comma when none) into trimmed, non-empty tokens. Reassigning the same
   *  token sequence preserves any inline edit. */
  @property({ attribute: false })
  get value(): readonly string[] {
    return this._value;
  }
  set value(next: readonly string[] | string) {
    const old = this._value;
    if (!this.settingDefaultValue) this._valueDirty = true;
    const normalized = typeof next === 'string' ? parseDelimited(next, this.delimiter) : normalizeStringArray(next);
    if (normalized.length === old.length && normalized.every((token, index) => token === old[index])) return;
    this.captureTokenFocusRepair(normalized);
    if (this.editingIndex >= 0) {
      this.editingIndex = -1;
      this.editDraft = '';
      this.focusEditorPending = false;
    }
    this._value = normalized;
    this.requestUpdate('value', old);
    if (this.internals) this.syncValidity();
  }
  /** Reflected JSON-array reset default; changing it never overwrites a dirty live token list. */
  get defaultValue(): readonly string[] {
    return this._defaultValue;
  }
  set defaultValue(next: readonly string[] | string | null) {
    if (this.reflectingDefaultValue) return;
    const old = this._defaultValue;
    this._defaultValue = typeof next === 'string' ? parseDelimited(next, this.delimiter) : normalizeStringArray(next);
    this.reflectingDefaultValue = true;
    try {
      if (next == null) this.removeAttribute('value');
      else this.setAttribute('value', JSON.stringify(this._defaultValue));
    } finally {
      this.reflectingDefaultValue = false;
    }
    if (!this._valueDirty) this.restoreLiveValueFromDefault();
    this.requestUpdate('defaultValue', old);
  }

  /** The form submission key, reflected synchronously for native form APIs.
   *  This control keys its `FormData` entries directly off `name` (see
   *  `syncValidity()`), so a rename must rebuild that `FormData` in the same
   *  tick -- mirrors `<lr-combobox>`'s identical `name` setter. */
  get name(): string {
    return this._name;
  }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    reflectFormName(this, this._name);
    this.syncValidity();
    this.requestUpdate('name', old);
  }

  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.syncValidity();
    this.requestUpdate('required', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    const wasEffectivelyDisabled = this.effectiveDisabled;
    this._disabled = Boolean(next);
    if (!wasEffectivelyDisabled && this.effectiveDisabled)
      this.retireDisabledInteraction();
    this.toggleAttribute('disabled', this._disabled);
    this._fieldsetDisabled =
      this.validityController?.fieldsetDisabled(this._fieldsetDisabled) ?? this._fieldsetDisabled;
    // Disabling bars constraint validation, so the violation itself is recomputed here rather than
    // left raised on a control the browser will never enforce.
    this.syncValidity();
    this.requestUpdate('disabled', old);
  }

  /** Forwards native read-only behavior to the draft input and the inline token editor, and
   *  blocks every other value-committing affordance (adding, removing, or editing a token) while
   *  leaving the control, its tokens, and its remove buttons focusable and its current value
   *  submitted with the form -- mirroring `lr-input`'s `readonly`. */
  get readonly(): boolean {
    return this._readonly;
  }
  set readonly(next: boolean) {
    const old = this._readonly;
    const nextValue = Boolean(next);
    // Entering readonly discards any uncommitted draft and closes an open inline editor, exactly
    // like disablement retires them -- but without disablement's forced blur, since readonly must
    // leave every existing focus target reachable (unlike `disabled`, it never removes the
    // control from the tab order).
    if (!old && nextValue) this.discardTransientState(true);
    this._readonly = nextValue;
    this.toggleAttribute('readonly', this._readonly);
    // Readonly bars constraint validation exactly like disabled (see `isBarredFromValidation()`),
    // so the violation itself is recomputed here rather than left raised on a control the browser
    // will never enforce.
    this.syncValidity();
    this.requestUpdate('readonly', old);
  }

  constructor() {
    super();
    this.validityController = new FormControlController(this, {
      invalid: (init) => this.emit('lr-invalid', null, init),
      interacted: this.markInteracted,
      customError: () => this.validityController.customValidityMessage,
    });
    this.internals = this.validityController.formInternals;
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.syncValidity();
  }
  override disconnectedCallback(): void {
    this.tokenFocusRepairPending = undefined;
    this.discardTransientState(true);
    super.disconnectedCallback();
  }
  override adoptedCallback(): void {
    super.adoptedCallback();
    this.hostDescription.adopted();
  }
  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    if (this.validityController?.reflectingDisabled) return;
    const wasEffectivelyDisabled = this.effectiveDisabled;
    this._fieldsetDisabled = disabled;
    if (!wasEffectivelyDisabled && this.effectiveDisabled)
      this.retireDisabledInteraction();
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`.
    this.syncValidity();
    this.requestUpdate();
  }
  /**
   * The anchor stays the main text input even while an inline token editor is open: the only
   * constraint this control can fail is `valueMissing`, which requires an empty token list — and an
   * empty list has no token to edit, so the two states are mutually exclusive.
   * @internal
   */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return (
      this.inputEl ??
      this.renderRoot?.querySelector('[part~="input-wrapper"]') ??
      null
    );
  }
  private markInteracted = (): void => {
    if (this.touched) return;
    this.touched = true;
    this.syncValidity();
  };
  checkValidity(): boolean {
    return this.validityController.checkValidity();
  }
  /** Reporting is what a submit attempt does, and a failed submit is precisely when native
   *  `:user-invalid` starts matching — so it counts as interaction, exactly as it does in the
   *  `FormAssociated` mixin. (A submission attempt itself never calls this method -- it drives
   *  `ElementInternals` directly -- which is what `installInteractionOnInvalid()` above covers.) */
  reportValidity(): boolean {
    this.validityController.syncConstraints();
    this.touched = true;
    this.syncValidity();
    return this.internals.reportValidity();
  }
  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a rejection no
   * client-side constraint can express ("that tag is reserved"). A non-empty `message` raises
   * `customError` and becomes `validationMessage`, so the control fails `checkValidity()`, blocks
   * submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * `required` control with no tokens stays `valueMissing`. The custom error also survives every
   * intrinsic recomputation in between (each token add/remove/edit re-runs `syncValidity()`) and a
   * `form.reset()` — matching a native control, where only another `setCustomValidity('')` clears
   * it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    // Republishes `data-invalid` and the six validity custom states from the now-current effective
    // validity. The intrinsic recomputation this also runs is idempotent and, by construction,
    // never touches the custom layer the line above just set.
    this.syncValidity();
  }
  /** Reads both component state and the UA's synchronous fieldset cascade before actions mutate
   * or enter one of this compound control's still-rendered native focus surfaces. */
  override focus(options?: FocusOptions): void {
    if (this.deferFocusUntilRendered(options)) return;
    if (isLiveDisabled(this)) return;
    this.inputEl?.focus(options);
  }
  override blur(): void {
    const active = shadowFocusTarget(this);
    if (active && typeof (active as HTMLElement).blur === 'function') {
      (active as HTMLElement).blur();
    }
  }
  /** Focuses the draft text input, mirroring what a real click on the token row would land on --
   *  `HTMLElement.prototype.click()` is otherwise a no-op on a custom element with no native click
   *  semantics of its own (matches `<lr-combobox>`'s identical override). */
  override click(): void {
    if (isLiveDisabled(this)) return;
    this.inputEl?.focus();
  }
  /** Selects the complete pending draft in the internal native text input. */
  select(): void {
    this.inputEl?.select();
  }
  /** Native draft selection start, or `null` before the internal input renders. */
  declare selectionStart: number | null;
  /** Native draft selection end, or `null` before the internal input renders. */
  declare selectionEnd: number | null;
  /** Native draft selection direction, or `null` before the internal input renders. */
  declare selectionDirection: HTMLInputElement['selectionDirection'];
  /** Passthrough to the native draft input's selection range. */
  setSelectionRange(
    selectionStart: number,
    selectionEnd: number,
    selectionDirection: HTMLInputElement['selectionDirection'] = 'none'
  ): void {
    this.inputEl?.setSelectionRange(
      selectionStart,
      selectionEnd,
      selectionDirection ?? 'none'
    );
  }
  /** Applies a native event-silent range edit and synchronizes the pending draft. */
  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode: SelectionMode = 'preserve'
  ): void {
    const input = this.inputEl;
    if (!input) return;
    setNativeRangeText(input, replacement, start, end, selectMode);
    this.draft = input.value;
  }
  /** Shared with every other form control: disabled (own or fieldset-cascaded) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private syncValidity(): void {
    // A barred control reports no violation at all, exactly like a native disabled input --
    // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required
    // token lists, and with it the documented `:state(user-invalid)` error styling.
    const barred = this.barredFromValidation;
    const count = this.value.length;
    const missing = !barred && this.required && count === 0;
    const min = tokenLimit(this.minTags);
    const max = tokenLimit(this.maxTags);
    const under = !barred && min !== null && count > 0 && count < min;
    const over = !barred && max !== null && count > max;
    this.validityController.setValidity(
      missing || under || over
        ? {
            ...(missing ? { valueMissing: true } : {}),
            ...(under ? { rangeUnderflow: true } : {}),
            ...(over ? { rangeOverflow: true } : {}),
          }
        : {},
      missing
        ? () => this.localize('tokenInputRequired')
        : under
          ? () => this.localize('tokenInputTooFew', undefined, { count: min! })
          : over
            ? () => this.localize('tokenInputTooMany', undefined, { count: max! })
            : ''
    );
    setCustomState(this.internals, 'blank', count === 0);
    setCustomState(this.internals, 'readonly', this.readonly);
    this.toggleAttribute(
      'data-invalid',
      !barred && this.touched && !this.internals.validity.valid
    );
    // The six validity custom states, from the shared helper in `internal/custom-states.ts`. This
    // control drives `ElementInternals` directly rather than through the `FormAssociated` mixin
    // (its value is a `string[]`), so it publishes them itself; `touched` is its own interaction
    // flag, already set on blur, which keeps the `user-*` pair off a pristine control the way
    // native `:user-invalid` does. Every mutation path funnels through here, so this one call
    // covers `value`, `required`, `name`, blur, and `form.reset()`.
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred,
    });
    const data = new FormData();
    if (this.name) this.value.forEach((token) => data.append(this.name, token));
    this.internals.setFormValue(
      this.name ? data : null,
      createStringArrayFormDataState(this.name, this.value)
    );
  }
  private updateValue(next: readonly string[]): void {
    const previousValue = Object.freeze([...this.value]);
    this.value = next;
    this.syncValidity();
    // One frozen snapshot for the gesture, so a listener rewriting `value` between the native and
    // library events cannot make this commit's `lr-input` and `lr-change` disagree.
    const detail: Readonly<{ value: readonly string[]; previousValue: readonly string[] }> =
      Object.freeze({ value: Object.freeze([...this.value]), previousValue });
    dispatchNativeInputEvent(this);
    this.emit('lr-input', detail);
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', detail);
  }
  /** Characters that commit and split the draft; empty while `delimiter` is `null` or empty. */
  private get delimiterChars(): string {
    return typeof this.delimiter === 'string' ? this.delimiter : '';
  }
  /** How many more tokens fit under `max-tags`; `Infinity` while unlimited. */
  private get tokenCapacity(): number {
    const max = tokenLimit(this.maxTags);
    return max === null ? Infinity : Math.max(0, max - this.value.length);
  }
  private addDraft(text: string = this.draft): void {
    if (isLiveDisabled(this) || this.readonly) return;
    const chars = new Set(this.delimiterChars);
    const candidates: string[] = [];
    if (chars.size) {
      let current = '';
      for (const char of text) {
        if (chars.has(char)) {
          candidates.push(current);
          current = '';
        } else current += char;
      }
      candidates.push(current);
    } else candidates.push(text);
    const capacity = this.tokenCapacity;
    const seen = this.allowDuplicates ? null : new Set(this.value);
    let added: string[] = [];
    const overflow: string[] = [];
    for (const candidate of candidates) {
      const token = candidate.trim();
      if (!token || seen?.has(token)) continue;
      if (added.length >= capacity) {
        overflow.push(token);
        continue;
      }
      seen?.add(token);
      added.push(token);
    }
    // At the `max-tags` limit nothing commits and the text stays put for the user to correct.
    if (added.length === 0 && overflow.length > 0) return;
    if (added.length === 0) {
      this.draft = '';
      return;
    }
    // One cancelable proposal per candidate lets a listener reject a single token; the batch
    // request below still sees only the survivors. When every candidate is rejected the draft stays.
    added = added.filter(token => !this.emit('lr-create', { inputValue: token }, { cancelable: true }).defaultPrevented);
    if (added.length === 0) return;
    const next = [...this.value, ...added];
    const before = this.value;
    const detail = Object.freeze({ value: added[added.length - 1]!, values: Object.freeze(added) });
    const request = this.emit('lr-token-add-request', detail, { cancelable: true });
    if (request.defaultPrevented) return;
    // A listener may have written `value` itself (the controlled pattern), disabled the field or
    // detached it; the commit rebuilds from the live list instead of overwriting that write.
    if (!this.isConnected || isLiveDisabled(this) || this.readonly) return;
    if (this.value !== before) {
      const live = [...this.value];
      const liveSeen = this.allowDuplicates ? null : new Set(live);
      const max = tokenLimit(this.maxTags);
      for (const token of added) {
        if (liveSeen?.has(token)) continue;
        if (max !== null && live.length >= max) break;
        liveSeen?.add(token);
        live.push(token);
      }
      this.updateValue(live);
    } else {
      this.updateValue(next);
    }
    this.draft = overflow.join(this.delimiterChars[0] ?? ',');
  }

  /** Splits pasted text on the delimiter characters instead of leaving it as one draft. */
  private onPaste = (event: ClipboardEvent): void => {
    if (isLiveDisabled(this) || this.readonly || !this.delimiterChars) return;
    const pasted = event.clipboardData?.getData('text/plain') ?? '';
    const chars = new Set(this.delimiterChars);
    if (![...pasted].some(char => chars.has(char))) return;
    event.preventDefault();
    const input = event.currentTarget as HTMLInputElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const combined = input.value.slice(0, start) + pasted + input.value.slice(end);
    this.inputValue = combined;
    this.addDraft(combined);
  };

  /** Removes every token the `lr-token-remove-request` listeners do not protect. */
  private clearTokens(): void {
    const input = this.inputEl;
    if (isLiveDisabled(this) || this.readonly || !this.value.length) {
      input?.focus();
      return;
    }
    const before = this.value;
    const kept = before.filter((token, index) =>
      this.emit('lr-token-remove-request', { value: token, index }, { cancelable: true }).defaultPrevented
    );
    if (this.value !== before || !this.isConnected || isLiveDisabled(this) || this.readonly) return;
    if (kept.length < before.length) {
      this.editingIndex = -1;
      this.editDraft = '';
      this.rovingIndex = 0;
      this.inputValue = '';
      this.updateValue(kept);
      this.emit('lr-clear', null);
    }
    this.inputEl?.focus();
  }

  /** Clears lifecycle-only editing state before focus teardown can turn a blur into a commit. */
  private discardTransientState(clearDraft: boolean): void {
    this.editingIndex = -1;
    this.editDraft = '';
    this.focusEditorPending = false;
    this.focusTokenPending = -1;
    if (clearDraft) {
      this.draft = '';
      if (this.inputEl) this.inputEl.value = '';
    }
  }

  /** Retire every focus/edit surface when own or fieldset disablement becomes effective. */
  private retireDisabledInteraction(): void {
    this.tokenFocusRepairPending = undefined;
    this.discardTransientState(true);
    const active = shadowFocusTarget(this);
    if (active && typeof (active as HTMLElement).blur === 'function') {
      (active as HTMLElement).blur();
    }
  }

  /** Capture focus before a controlled shrink removes its shadow descendant. The shared repair
   * guard prevents this deferred move from overriding a newer explicit focus destination. */
  private captureTokenFocusRepair(next: readonly string[]): void {
    this.tokenFocusRepairPending = undefined;
    const active = shadowFocusTarget(this) as HTMLElement | null;
    const token = typeof active?.closest === 'function'
      ? active.closest<HTMLElement>('[part~="token"]')
      : null;
    if (!active || !token) return;
    const index = this.tokenIndices.get(token) ?? -1;
    if (!Number.isInteger(index) || index < 0) return;
    if (next.length >= this.renderedTokenValues.length && next[index] === this.renderedTokenValues[index]) return;
    const repair = captureComposedFocusRepair(this, active);
    if (!repair) return;
    const targetIndex = Math.min(index, Math.max(0, next.length - 1));
    this.rovingIndex = targetIndex;
    this.tokenFocusRepairPending = {
      index: targetIndex,
      surface: active.matches('[part~="remove"]') ? 'remove' : 'label',
      repair,
    };
  }

  private removeToken(index: number): void {
    if (isLiveDisabled(this) || this.readonly) return;
    const removed = this.value[index];
    // The roving/edit index can outlive the token it pointed at, and `lr-token-remove-request`
    // promises a `string` value -- a stale index has nothing to remove rather than a token named `undefined`.
    if (removed === undefined) return;
    const request = this.emit(
      'lr-token-remove-request',
      { value: removed, index },
      { cancelable: true }
    );
    if (request.defaultPrevented) return;
    if (!this.isConnected || isLiveDisabled(this) || this.readonly) return;
    // The listener may have rewritten `value`; remove the token where it now sits, not by a stale index.
    if (this.value[index] !== removed) {
      index = this.value.indexOf(removed);
      if (index < 0) return;
    }
    // Removing a token reindexes every later one, so an editor left open over the old indices would
    // commit against the wrong token.
    if (this.editingIndex >= 0) {
      this.editingIndex = -1;
      this.editDraft = '';
    }
    this.updateValue(this.value.filter((_token, i) => i !== index));
  }
  /**
   * The token row's roving tab stop, clamped to the current token count. Derived rather than
   * stored so a token list that shrinks below the focused index still leaves exactly one tab stop.
   */
  private get activeTokenIndex(): number {
    if (!this.value.length) return -1;
    return Math.min(Math.max(this.rovingIndex, 0), this.value.length - 1);
  }

  /** Open the inline editor for a token, seeded with that token's full current text. */
  private startEdit(index: number): void {
    if (isLiveDisabled(this) || this.readonly || !this.editable) return;
    if (index < 0 || index >= this.value.length) return;
    this.editingIndex = index;
    this.editDraft = this.value[index]!; // safe: index bounds-checked above
    this.rovingIndex = index;
    this.editorBlurRelayed = false;
    this.focusEditorPending = true;
  }

  /** Close the editor discarding its contents, returning focus to the token it was opened from. */
  private cancelEdit(): void {
    if (this.editingIndex < 0) return;
    this.focusTokenPending = this.editingIndex;
    this.editingIndex = -1;
    this.editDraft = '';
  }

  /**
   * Close the editor, applying its contents when they are a usable change. An emptied editor
   * cancels rather than removing the token -- removal stays the explicit job of the remove button
   * -- and an edit colliding with an existing token under `allowDuplicates = false` is discarded,
   * mirroring how `addDraft()` skips a duplicate candidate instead of rejecting the whole entry.
   * None of those "no usable change" cases fire `lr-token-edit-request`, so the editor closes for
   * them unconditionally.
   *
   * A genuine change emits `lr-token-edit-request` as cancelable and checks `defaultPrevented`
   * *before* closing the editor or mutating `value` -- the same emit-then-check-then-mutate shape
   * `removeToken()` uses for `lr-token-remove-request`. A vetoed edit leaves the editor open with the user's
   * edited (uncommitted) text intact, so they can correct it, rather than closing and discarding
   * it. Only past that veto check does the editor close first, so the teardown blur it triggers
   * re-enters this method as a no-op rather than committing (and emitting `change`) a second time.
   */
  private commitEdit(restoreFocus: boolean): void {
    if (isLiveDisabled(this) || this.readonly) {
      this.discardTransientState(false);
      return;
    }
    const index = this.editingIndex;
    if (index < 0) return;
    const previousValue = this.value[index];
    const next = this.editDraft.trim();
    const noUsableChange =
      // Editor state is cleared below even for a stale index; there is simply no previous token to
      // report, and `lr-token-edit-request` promises a `string` `previousValue`.
      previousValue === undefined ||
      !next ||
      next === previousValue ||
      (!this.allowDuplicates &&
        this.value.some((token, i) => i !== index && token === next));
    if (noUsableChange) {
      // Only a keyboard commit pulls focus back to the token: a blur commit means the user already
      // aimed focus somewhere else (the text input, the next token, another control entirely), and
      // stealing it back would fight them.
      if (restoreFocus) this.focusTokenPending = index;
      this.editingIndex = -1;
      this.editDraft = '';
      return;
    }
    const request = this.emit(
      'lr-token-edit-request',
      { value: next, previousValue, index },
      { cancelable: true }
    );
    if (request.defaultPrevented) return;
    // A listener may have rewritten `value`, disabled the field or removed it. Re-read the live
    // state rather than writing the pre-listener index/list over the host's own update.
    const liveIndex =
      this.value[index] === previousValue ? index : this.value.indexOf(previousValue);
    const stillEditable = this.isConnected && !isLiveDisabled(this) && !this.readonly;
    if (restoreFocus && liveIndex >= 0) this.focusTokenPending = liveIndex;
    this.editingIndex = -1;
    this.editDraft = '';
    if (!stillEditable || liveIndex < 0) return;
    this.updateValue(
      this.value.map((token, i) => (i === liveIndex ? next : token))
    );
  }

  private moveRovingFocus(index: number): void {
    if (!this.value.length) return;
    const clamped = Math.min(Math.max(index, 0), this.value.length - 1);
    this.rovingIndex = clamped;
    this.focusTokenPending = clamped;
  }

  private onTokenKeyDown(event: KeyboardEvent, index: number): void {
    if (isLiveDisabled(this) || shouldIgnoreNavigationKey(event)) return;
    // ArrowLeft/ArrowRight mean previous/next *visually*, so they swap under RTL.
    const rtl = this.effectiveDirection === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    // Space activates alongside Enter because the token carries `role="button"`; F2 matches the
    // grid/tree convention for "edit this cell in place".
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'F2') {
      event.preventDefault();
      this.startEdit(index);
    } else if (event.key === forward) {
      event.preventDefault();
      this.moveRovingFocus(index + 1);
    } else if (event.key === backward) {
      event.preventDefault();
      this.moveRovingFocus(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.moveRovingFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.moveRovingFocus(this.value.length - 1);
    }
  }

  private onEditInput = (event: Event): void => {
    event.stopPropagation();
    if (isLiveDisabled(this) || this.readonly) return;
    this.editDraft = (event.target as HTMLInputElement).value;
  };
  private onEditFocus = (event: FocusEvent): void => {
    if (isLiveDisabled(this)) {
      event.stopPropagation();
      return;
    }
    this.editorBlurRelayed = false;
    relayNativeEvent(this, event);
  };
  private onEditKeyDown = (event: KeyboardEvent): void => {
    if (isHandledOrComposingKey(event)) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEdit(true);
    }
    // Escape is consumed rather than left to bubble: an enclosing dialog/popover would otherwise
    // close on the same keystroke that only meant "abandon this token edit".
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelEdit();
    }
  };
  private onEditBlur = (event: FocusEvent): void => {
    if (this.editorBlurRelayed) {
      event.stopPropagation();
      return;
    }
    this.editorBlurRelayed = true;
    event.stopPropagation();
    // A disconnect can synchronously trigger blur just before `disconnectedCallback()` clears the
    // editor. Publish the host blur one microtask later so lifecycle state settles first, while
    // still committing before that public blur for a genuine user focus move.
    queueMicrotask(() => {
      if (!this.isConnected || !this.editable || isLiveDisabled(this)) {
        this.discardTransientState(false);
      } else {
        this.commitEdit(false);
      }
      relayNativeEvent(this, event);
    });
  };

  private onInput = (event: Event): void => {
    event.stopPropagation();
    if (isLiveDisabled(this) || this.readonly) return;
    this.draft = (event.target as HTMLInputElement).value;
  };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (isHandledOrComposingKey(event)) return;
    if (isLiveDisabled(this)) return;
    if (
      event.key === 'Enter' ||
      (event.key.length > 0 && [...this.delimiterChars].includes(event.key))
    ) {
      if (this.draft.trim()) {
        event.preventDefault();
        this.addDraft();
      }
      // No draft to commit, so Enter means what it means in any other text field: implicit
      // submission of the ancestor form. Only Enter -- a delimiter keystroke is this component's
      // own commit key, never a submit key.
      else if (event.key === 'Enter') submitOnEnter(this, event);
    } else if (event.key === 'Tab') {
      if (this.draft.trim()) this.addDraft();
    }
    // An open token editor owns Backspace: the destructive "remove the last token" shortcut must
    // not fire for a keystroke that was aimed at the text being edited.
    else if (
      event.key === 'Backspace' &&
      !event.repeat &&
      !event.altKey && !event.ctrlKey && !event.metaKey &&
      !this.draft &&
      this.value.length &&
      this.editingIndex < 0
    ) {
      this.removeToken(this.value.length - 1);
    }
  };
  // Disabling a focused native control blurs it as plain platform
  // behavior (nothing to do with custom elements) -- that is not a real user interaction, so it
  // must not commit a pending draft or flip `touched`, which could otherwise reenter an in-flight
  // Lit update and trip its dev-mode "scheduled an update after an update completed" warning.
  private onBlur = (event: FocusEvent): void => {
    if (!isLiveDisabled(this)) {
      if (this.draft.trim()) this.addDraft();
      this.touched = true;
    }
    this.syncValidity();
    relayNativeEvent(this, event);
  };
  private onFocus = (event: FocusEvent): void => {
    if (isLiveDisabled(this)) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };
  private stopInternalChange(event: Event): void {
    event.stopPropagation();
  }
  formResetCallback(): void {
    this.restoreLiveValueFromDefault();
    this.discardTransientState(true);
    this.rovingIndex = 0;
    this.touched = false;
    this.syncValidity();
  }
  private restoreLiveValueFromDefault(): void {
    this.settingDefaultValue = true;
    try {
      this.value = [...this._defaultValue];
    } finally {
      this.settingDefaultValue = false;
    }
    this._valueDirty = false;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete'
  ): void {
    this.value = readStringArrayFormDataState(state);
    this.discardTransientState(true);
    this.rovingIndex = 0;
    this.touched = false;
    this.syncValidity();
  }
  /**
   * Focus moves are deferred to here rather than run from the handlers themselves: the editor and
   * the token it replaces only exist after the render that this update produced.
   */
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('minTags') || changed.has('maxTags')) this.syncValidity();
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.focusEditorPending) {
      this.focusEditorPending = false;
      const editor = this.renderRoot?.querySelector(
        '[part="token-editor"]'
      ) as HTMLInputElement | null;
      editor?.focus();
      editor?.select();
    }
    if (this.focusTokenPending >= 0) {
      const index = this.focusTokenPending;
      this.focusTokenPending = -1;
      const label = this.tokenElement(index)?.querySelector<HTMLElement>('[part~="token-label"]');
      label?.focus();
      // WebKit does not consistently scroll a newly programmatically-focused shadow descendant
      // inside this capped block-axis scrollport. Make the keyboard destination explicit while
      // keeping both axes at their nearest positions so the page itself does not jump.
      label?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    const pending = this.tokenFocusRepairPending;
    this.tokenFocusRepairPending = undefined;
    if (pending) {
      const token = this.tokenElement(pending.index);
      const target =
        (pending.surface === 'remove'
          ? token?.querySelector<HTMLElement>('[part~="remove"]')
          : token?.querySelector<HTMLElement>('[part~="token-label"]')) ??
        token?.querySelector<HTMLElement>('[part~="remove"]') ??
        this.inputEl ??
        null;
      if (applyComposedFocusRepair(pending.repair, target)) {
        target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }
  private renderRemoveButton(token: string): TemplateResult {
    return html`<button
      part="remove tag__remove-button tag__remove-button__button"
      type="button"
      aria-label=${this.localize('removeWithContext', undefined, {
        label: token,
      })}
      ?disabled=${this.effectiveDisabled}
      aria-disabled=${this.readonly ? 'true' : nothing}

    >
      ${closeIcon()}
    </button>`;
  }
  private renderEditableToken(token: string, index: number): TemplateResult {
    if (this.editingIndex === index) {
      return html`<span part="token tag" ${ref(element => { if (element) this.tokenIndices.set(element, index); })}
        ><input
          part="token-editor"
          .value=${this.editDraft}
          aria-label=${this.localize('tokenInputEditWithContext', undefined, {
            label: token,
          })}
          ?disabled=${this.effectiveDisabled}
          ?readonly=${this.readonly}
          autocomplete=${this.autocomplete || nothing}
          inputmode=${this.inputMode || nothing}
          enterkeyhint=${this.enterKeyHint || nothing}
          spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${nativeAutocorrectAttribute(this, this.autocorrect)}
          @input=${this.onEditInput}
          @change=${this.stopInternalChange}
          @keydown=${this.onEditKeyDown}
          @focus=${this.onEditFocus}
          @blur=${this.onEditBlur}
        />${this.renderRemoveButton(token)}</span
      >`;
    }
    return html`<span part="token tag" ${ref(element => { if (element) this.tokenIndices.set(element, index); })}
      ><span
        part="token-label tag__content"
        role="button"
        tabindex=${this.effectiveDisabled
          ? nothing
          : index === this.activeTokenIndex
          ? 0
          : -1}
        aria-disabled=${String(this.effectiveDisabled)}
        aria-label=${this.localize('tokenInputEditWithContext', undefined, {
          label: token,
        })}

        >${token}</span
      >${this.renderRemoveButton(token)}</span
    >`;
  }
  override render(): TemplateResult {
    const entries = this.visibleTokenEntries;
    this.renderedTokenValues = this.value;
    const overflow = this.value.length - entries.length;
    const showClear = (this.withClear || this.clearable) && !this.effectiveDisabled && !this.readonly && this.value.length > 0;
    const hasLabel = this.slotPresence.has('label') || Boolean(normalizeLabel(this.label));
    const hostLabel = hostAriaLabel(this);
    const labelledBy = hostLabel === null && hasLabel ? this.labelId : nothing;
    const name = hostLabel ?? (hasLabel ? nothing : normalizeLabel(this.placeholder) ?? this.localize('tokenInputLabel'));
    const supporting = {
      presence: { has: (name: string) => name !== 'help-text' && this.slotPresence.has(name) },
      idPrefix: this.supportingId,
      hint: this.hint,
      errorText: this.errorText,
    };
    const { hasHint, hasError, describedBy } = formControlSupportingState(supporting);
    return html`<div part="form-control">
      <label
        part="form-control-label"
        ?hidden=${!hasLabel}
        for="input"
        id=${this.labelId}
        >${this.label}<slot name="label"></slot
      ></label>
      <div
        part="input-wrapper tag-input"
        @click=${this.onTokenClick}
        @focusin=${this.onTokenFocus}
        @keydown=${this.onTokenKey}
        role="group"
        aria-labelledby=${labelledBy}
        aria-label=${name}
      >
        <span part="start" ?hidden=${!this.slotPresence.has('start')}
          ><slot name="start"></slot
        ></span>
        <span part="tags">${repeat(entries, entry => entry.key, ({ token, index }) =>
          this.editable
            ? this.renderEditableToken(token, index)
            : html`<span part="token tag" ${ref(element => { if (element) this.tokenIndices.set(element, index); })}
                ><span part="tag__content">${token}</span>${this.renderRemoveButton(token)}</span
              >`
        )}</span>
        ${overflow > 0 ? html`
          <span part="token-overflow">${this.localize('selectSelectedOverflow', undefined, { n: getNumberFormat(this.effectiveLocale).format(overflow) })}</span>
          <button part="previous-page" type="button" ?disabled=${this.effectiveDisabled}
            aria-disabled=${String(this.effectiveDisabled || entries[0]!.index === 0)}
            @pointerdown=${this.onPagePointerDown}
            @click=${(event: MouseEvent) => this.pageTokens(event.currentTarget as HTMLButtonElement, -1)}>${this.localize('previous')}</button>
          <button part="next-page" type="button" ?disabled=${this.effectiveDisabled}
            aria-disabled=${String(this.effectiveDisabled || entries[entries.length - 1]!.index === this.value.length - 1)}
            @pointerdown=${this.onPagePointerDown}
            @click=${(event: MouseEvent) => this.pageTokens(event.currentTarget as HTMLButtonElement, 1)}>${this.localize('next')}</button>
        ` : nothing}
        <input
          id="input"
          part="input"
          .value=${this.draft}
          placeholder=${this.placeholder}
          ?disabled=${this.effectiveDisabled}
          ?readonly=${this.readonly}
          autocomplete=${this.autocomplete || nothing}
          inputmode=${this.inputMode || nothing}
          enterkeyhint=${this.enterKeyHint || nothing}
          spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${nativeAutocorrectAttribute(this, this.autocorrect)}
          aria-label=${name}
          aria-labelledby=${labelledBy}
          aria-describedby=${describedBy ?? nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${hasError || (this.touched && !this.internals.validity.valid)
            ? 'true'
            : 'false'}
          @input=${this.onInput}
          @paste=${this.onPaste}
          @change=${this.stopInternalChange}
          @keydown=${this.onKeyDown}
          @blur=${this.onBlur}
          @focus=${this.onFocus}
        />
        ${showClear
          ? html`<button
              part="clear-button"
              type="button"
              aria-label=${this.localize('clear')}
              @mousedown=${(event: MouseEvent) => event.preventDefault()}
              @click=${(event: MouseEvent) => { event.stopPropagation(); this.clearTokens(); }}
            >
              <span aria-hidden="true" inert><slot name="clear-icon">${closeIcon()}</slot></span>
            </button>`
          : nothing}
        <span part="end" ?hidden=${!this.slotPresence.has('end')}
          ><slot name="end"></slot
        ></span>
      </div>
      ${renderFormControlHintError({ ...supporting, hasHint, hasError })}
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lr-token-input': LyraTokenInput;
  }
}
