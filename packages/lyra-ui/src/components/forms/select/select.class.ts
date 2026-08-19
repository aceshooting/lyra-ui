import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Placement } from '@floating-ui/dom';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import {
  activateOverlay,
  type OverlayHandle,
} from '../../../internal/overlay-manager.js';
import { chevronIcon, closeIcon } from '../../../internal/icons.js';
import {
  AnchoredValidityController,
  VALIDITY_ANCHOR,
} from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './select.styles.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import type { LyraOption } from '../combobox/option.class.js';
import '../combobox/option.class.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { omittedEmptyStringConverter } from '../../../internal/converters.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import {
  isOptionSelectedDirty,
  wasOptionInitiallySelected,
  RESET_OPTION_SELECTED_FROM_OWNER,
  SET_OPTION_SELECTED_FROM_OWNER,
} from '../../../internal/option-selection.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import { tag } from '../../../internal/prefix.js';
import {
  currentValidityValidator,
  type LyraFormValidator,
} from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_select, LYRA_DEFAULT_selectSelectedOverflow, LYRA_DEFAULT_selectValueMissing } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

function isLyraOptionElement(value: unknown): value is LyraOption {
  return isHtmlElement(value) && value.localName === tag('option');
}

/** Renders one selected option's chip in `multiple` mode. Whatever it returns replaces the
 *  built-in `[part='tag']` chip for that option, so a caller that wants the default styling
 *  hooks re-declares `part="tag"` on its own root node. A returned string renders as **text**,
 *  never as markup. */
export type LyraSelectTagRenderer = (
  option: LyraOption,
  index: number
) => unknown;

export interface LyraSelectEventMap {
  'lr-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
  'lr-invalid': CustomEvent<null>;
  'lr-clear': CustomEvent<null>;
  input: InputEvent;
  change: Event;
  'lr-input': CustomEvent<
    LyraEventDetailSnapshot<{ readonly value: string | readonly string[] }>
  >;
  'lr-change': CustomEvent<
    LyraEventDetailSnapshot<{ readonly value: string | readonly string[] }>
  >;
  blur: FocusEvent;
  focus: FocusEvent;
}
/**
 * `<lr-select>` — a plain closed-list dropdown: a direct `<lr-*>`
 * counterpart to `<wa-select>`/`<wa-option>`. Trigger is a button (not a text
 * input) -- click/Enter/Space/ArrowDown opens it, there's no typing-to-filter.
 * A printable keypress instead jumps (or, while closed, directly selects) the
 * next option whose label starts with what's been typed, like a native
 * `<select>`'s type-ahead. Closed multiple mode skips selected option occurrences and keeps
 * searching for a later unselected match, including another occurrence of the same value.
 *
 * Options are `<lr-option value>` children, the same element `<lr-combobox>`
 * uses. Unlike `lr-combobox` there is no filter/source/empty-text/max-render
 * surface -- see `<lr-combobox>` for the filterable case.
 *
 * `multiple` turns the committed `value` into a `string[]` and renders one removable chip per
 * selection. The chip row is a sibling overlaid on the real trigger button, never nested inside it,
 * so every remove control is valid independently-focusable interactive content. The trigger keeps
 * one complete visually-hidden joined-value node for assistive technology while the painted
 * built-in chip labels are hidden from it, preventing both truncation and duplicate announcement.
 * Picking a selected row again still toggles it off, Backspace/Delete on the trigger removes the
 * last selection, and `with-clear` removes all of them. `getTag` replaces a built-in chip entirely;
 * `max-options-visible` caps how many render before the rest collapse behind a localized "+N" chip.
 *
 * `with-clear`'s button renders inside the trigger's inline-end padding,
 * outboard of the expand icon, as a sibling of the trigger rather than a child
 * of it -- for the same nesting reason.
 * The trigger and overlaid multi-select tag row accept constrained allocation: long selected
 * labels ellipsize and long chips wrap within a 320px LTR or RTL container instead of widening it.
 *
 * Reuses `lr-combobox`'s popup positioning (`internal/positioner.js`) and
 * click-outside/Escape/Home/End/Arrow-key listbox navigation patterns,
 * adapted to a trigger button that keeps DOM focus throughout (the listbox's
 * "active" row is conveyed via `aria-activedescendant`, never actual focus),
 * matching the WAI-ARIA "select-only combobox" pattern.
 *
 * When `autoCommitSingleOption` is set and exactly one option is available
 * (neither disabled nor inert, including through an inert ancestor), the popup never
 * opens at all: a click, Enter, Space, ArrowDown, or ArrowUp on the trigger
 * commits that sole option directly, and the trigger renders as a plain
 * `role="button"` with no chevron/`aria-haspopup`/`aria-expanded` rather than
 * a combobox with a permanently inert popup state — opening a one-row list to
 * pick the only available choice is pure friction with no real decision
 * behind it. This never changes `value`/validity defaults on its own — an
 * unselected single-option select stays unselected (and a `required` one
 * stays invalid) exactly like the multi-option case, until the trigger is
 * actually activated. `autoCommitSingleOption` defaults to `false`: by
 * default a select always renders the normal combobox/listbox/chevron
 * trigger no matter how many options are enabled, matching pre-1.3.0
 * behavior — opt in explicitly if a narrowing-to-one option list should
 * auto-commit.
 *
 * Deliberately does **not** perform implicit form submission on Enter (unlike `<lr-input>`/
 * `<lr-combobox>`/`<lr-date-input>`, which route through `internal/submit-on-enter.ts`): the
 * trigger is a `role="combobox"` button where Enter opens the listbox and, once open, commits the
 * active option — the ARIA combobox behavior its upstream counterpart follows. Submitting there
 * would shadow the only keyboard way to open the list.
 *
 * While the listbox is open, live option collection changes preserve the keyboard-active option
 * by element identity across reorders. If that option is removed or becomes unavailable, the
 * nearest available survivor takes over (preferring the following row on a tie); an empty
 * available collection clears `aria-activedescendant` instead of retaining an invalid index.
 *
 * @customElement lr-select
 * @slot - `<lr-option>` elements.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot help-text - Shoelace alias for `hint`.
 * @slot error - Custom error content.
 * @slot start - Decorative adornment at the inline-start of the trigger row, before the
 *   selected-value label. Its wrapper is always `aria-hidden` and inert because it lives inside
 *   the native trigger button; interactive content supplied here remains deliberately unavailable.
 * @slot end - Decorative adornment after the selected-value label and before the expand icon.
 *   Its wrapper has the same enforced inert/`aria-hidden` contract as `start`.
 * @slot prefix - Shoelace alias for `start`.
 * @slot suffix - Shoelace alias for `end`.
 * @slot clear-icon - Replaces the built-in clear glyph.
 * @slot expand-icon - Replaces the built-in expand glyph.
 * @event {Event} change - Fired when the selection changed, mirroring native
 *   `<select>`'s own event name. Read the new selection from `value`.
 * @event {InputEvent} input - Fired alongside `change` on every
 *   selection change (native `<select>` doesn't meaningfully distinguish the two either).
 * @event lr-input - Prefixed compatibility alias for `input`; `detail: { value }`.
 * @event {CustomEvent<LyraEventDetailSnapshot<{ readonly value: string | readonly string[] }>>} lr-change - Prefixed compatibility alias
 *   fired after `input` and `change` on the same selection change, mirroring `<lr-checkbox>`'s
 *   `lr-change`. Not fired for a programmatic `value` assignment.
 * @event lr-clear - The `with-clear` button emptied the selection, fired after the
 *   `input`/`lr-input`/`change`/`lr-change` sequence. Never fired when there was nothing to clear.
 * @event lr-show - The listbox is about to open, however `open` became true. Cancelable —
 *   `preventDefault()` leaves it closed and the reflected attribute untouched.
 * @event lr-hide - The listbox is about to close, however `open` became false. Conditionally
 *   cancelable: connected transitions can be vetoed on the same terms as `lr-show`; an
 *   already-removed element closing on disconnect cannot honour a veto. Disabling the control,
 *   directly or through a fieldset, force-closes it without this vetoable lifecycle because a
 *   disabled control cannot retain an interactive popup.
 * @event lr-after-show - The listbox finished opening and its transition settled.
 * @event lr-after-hide - The listbox finished closing and its transition settled.
 * @event lr-invalid - The select failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @event blur - Re-dispatched from the trigger as a bubbling, composed event.
 * @event focus - Re-dispatched from the trigger as a bubbling, composed event.
 * @cssstate required - Matches while `required` is set. Style with `lr-select:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted: picking an option, a
 * blur, or a `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required select is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @cssstate blank - Matches while no option is selected.
 * @csspart form-control - The outer wrapper around label, trigger, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart label - Wrapper around the visible label content.
 * @csspart form-control-input - Compatibility name for the control wrapper.
 * @csspart combobox - Compatibility name for the control wrapper.
 * @csspart trigger - The trigger button (positioning anchor).
 * @csspart display-input - The selected-value/placeholder display inside the trigger. In populated
 *   multiple mode it is visually hidden but exposes every selected label to assistive technology.
 * @csspart start - Inert, decorative wrapper around the `start` adornment slot; `hidden` while
 *   nothing is slotted.
 * @csspart end - Inert, decorative wrapper around the `end` adornment slot; `hidden` while nothing
 *   is slotted.
 * @csspart prefix - Shoelace compatibility part on the `prefix` slot.
 * @csspart suffix - Shoelace compatibility part on the `suffix` slot.
 * @csspart tags - The `multiple`-mode chip row, rendered as a sibling overlaid on the trigger.
 * @csspart tag - One selected-value chip. The "+N" overflow chip carries both `tag` and
 *   `tag-overflow`, so `::part(tag)` styles every chip and `::part(tag-overflow)` only that one --
 *   state after `::part()` never matches, so it is encoded in the part name instead.
 * @csspart tag-label - A chip's ellipsis-safe label.
 * @csspart tag__base - Compatibility name on a built-in selected-value chip.
 * @csspart tag__content - Compatibility name around a built-in chip's visible label.
 * @csspart tag__remove-button - A built-in chip's remove button.
 * @csspart tag__remove-button__base - Compatibility name on the same remove button.
 * @csspart tag-overflow - The "+N" chip standing in for the selections past `max-options-visible`.
 * @csspart clear-button - The `with-clear` button.
 * @csspart listbox - The managed nonmodal options popover; its stack depth comes from
 *   `--lr-overlay-stack-index` with `--lr-layer-dropdown` as the standalone fallback.
 * @csspart group-label - An option group's heading row, referenced by the enclosing `role="group"`.
 * @csspart option - An option row.
 * @csspart option-dot - An option row's leading status dot (when `dot-color` is set).
 * @csspart option-label - An option row's label/sub wrapper.
 * @csspart option-sub - An option row's secondary line (when `sub` is set).
 * @csspart expand-icon - The dropdown indicator.
 * @csspart error - The error message.
 * @csspart hint - The hint message.
 * @csspart form-control-help-text - Shoelace compatibility name for the hint message.
 * @cssprop --lr-select-expand-size - Decorative expand-icon box size, scaled by `size`. The one
 *   piece of this component's geometry the shared ladder does not own: it sizes a glyph, not the
 *   control row.
 * @cssprop --lr-select-gap - Gap between the trigger's start adornment, label, end adornment, and
 *   expand icon. Doesn't vary by `size`.
 * @cssprop [--lr-select-radius=var(--lr-form-control-radius)] - Trigger corner radius, from the
 *   active `size` tier of the shared form-control ladder (the two tightest tiers take a smaller
 *   radius).
 * @cssprop --lr-select-trigger-padding - Trigger padding shorthand. Defaults to the active `size`
 *   tier's `var(--lr-form-control-padding-block) var(--lr-form-control-padding-inline)` from the
 *   shared ladder.
 * @cssprop [--lr-select-trigger-min-height=var(--lr-form-control-height)] - Trigger block-size
 *   floor, from the active `size` tier of the shared ladder, and live at every tier including the
 *   default `m` -- so a select is exactly as tall as an `<lr-button>`/`<lr-input>` of that tier.
 * @cssprop [--lr-select-font-size=var(--lr-form-control-font-size)] - Trigger font size, from the
 *   active `size` tier.
 * @cssprop --lr-select-tag-padding - Padding inside a `multiple`-mode chip. Doesn't vary by `size`.
 * @cssprop --lr-select-tag-font-size - Chip text size. Doesn't vary by `size`.
 * @cssprop [--tag-max-size=var(--lr-size-12rem)] - Maximum inline size of one selected-value tag.
 * @cssprop [--show-duration=var(--lr-transition-fast)] - Listbox enter-transition timing.
 * @cssprop [--hide-duration=var(--lr-transition-fast)] - Listbox exit-transition timing.
 * @cssprop [--lr-select-trigger-hover-bg=var(--lr-color-brand-quiet)] - Trigger background while
 * hovered. Accent appearance keeps its louder mixed fallback when this hook is unset.
 * @cssprop [--lr-select-trigger-active-bg=color-mix(...)] - Trigger background while pressed.
 * @cssprop [--lr-select-open-border-color=var(--lr-color-brand)] - Trigger border while the
 * listbox is open.
 * @cssprop [--lr-select-option-active-bg=var(--lr-color-brand-quiet)] - Background of the
 *   hovered/keyboard-active option row. Not declared on `:host`, so a value set on any ancestor
 *   is never shadowed -- retheme just this row state without hijacking the shared
 *   `--lr-color-brand-quiet` token used by every other component's own hover/active state.
 * @cssprop [--lr-select-option-selected-bg=transparent] - Background of the currently-selected
 *   option row. Not declared on `:host`; retheme just the selected row without hijacking
 *   `--lr-color-brand`.
 * @cssprop [--lr-select-option-selected-border=var(--lr-color-brand)] - Border color of the
 *   selected option row.
 * @cssprop [--lr-select-option-selected-color=var(--lr-color-brand)] - Text color of the selected
 *   option row.
 * @cssprop [--lr-select-option-selected-font-weight=var(--lr-font-weight-semibold)] - Font weight
 *   of the selected option row.
 * @cssprop --lr-select-trigger-height - Exact trigger height. Unset by default, which leaves
 *   `--lr-select-trigger-min-height` as a floor only; set it to a length to both floor and cap the
 *   trigger (e.g. to pixel-match a sibling field in the same toolbar row). Because it is never
 *   declared by the component itself, it can be set from an ancestor or an outer-tree rule as well
 *   as inline on the element.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 * `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 * other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 * themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * required marker.
 * @status stable
 * @since 4.0.0
 */
export class LyraSelect extends LyraElement<LyraSelectEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    select: LYRA_DEFAULT_select,
    selectSelectedOverflow: LYRA_DEFAULT_selectSelectedOverflow,
    selectValueMissing: LYRA_DEFAULT_selectValueMissing,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-input',
    'lr-change',
  ]);

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraSelect>[] {
    return [
      currentValidityValidator('required', 'disabled', 'value', 'multiple'),
    ];
  }
  static formAssociated = true;
  // `sizes` is the library's one form-control ladder, pulled in ahead of this component's own
  // sheet so every `--lr-select-*` geometry knob points at the active tier's value -- and so both
  // spellings of every tier (`s` and `small`, ...) work with no per-component rule.
  static override styles = [LyraElement.styles, sizes, styles, srOnly];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    multiple: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: {
      reflect: true,
      noAccessor: true,
      converter: omittedEmptyStringConverter,
    },
    maxOptionsVisible: {
      type: Number,
      attribute: 'max-options-visible',
      noAccessor: true,
    },
    defaultValue: { attribute: 'default-value', noAccessor: true },
  };

  @property() placeholder = '';
  /** Visible label. A host `aria-label` wins on the internal trigger by attribute presence,
   * including an explicitly empty value that suppresses this label's naming fallback. */
  @property() label = '';
  @property() hint = '';
  /** Shoelace alias for {@link hint}. `hint` wins when both are present. */
  @property({ attribute: 'help-text' }) helpText = '';
  /** SSR slot-presence hints for pre-hydration form chrome. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  @property({ attribute: 'error-text' }) errorText = '';
  /** Forwarded to the internal trigger button. */
  @property({ type: Boolean }) override autofocus = false;
  /** Forwarded to the internal trigger button. */
  @property() override title = '';
  private _open = false;
  /** Whether the listbox is open. Disabled controls synchronously normalize every opening write
   *  back to `false`, including reflected-attribute writes. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const requested = Boolean(next);
    const normalized = requested && !this.effectiveDisabled;
    if (normalized === this._open) {
      // A reflected `open` attribute written while disabled must not remain as a CSS-only open
      // state after the property correctly rejected it.
      if (requested !== normalized && this.hasAttribute('open'))
        this.removeAttribute('open');
      return;
    }
    this.applyOpenState(normalized);
  }
  /** Visual size on the library's one control ladder — shared with `lr-button`/`lr-input`/
   *  `lr-combobox`/`lr-locale-picker`, so same-tier controls line up in a toolbar row. Accepts both
   *  the canonical `'2xs'`–`'xl'` steps and Web Awesome's/Shoelace's `'small'`/`'medium'`/`'large'`
   *  spellings of `s`/`m`/`l`; the two render identically. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Visual treatment of the trigger surface. */
  @property({ reflect: true }) appearance: LyraAppearance = 'outlined';
  /** Fully-rounded trigger corners. Changes the private radius default to `--lr-radius-pill`, so
   *  an inherited or direct `--lr-select-radius` remains authoritative. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Preferred listbox placement. `flip`/`shift` may still override it to keep the popup in view,
   *  and the `left`/`right` component is swapped under RTL. Changes reposition an already-open
   *  listbox without closing it or changing overlay stack ownership. */
  @property({ reflect: true }) placement: Placement = 'bottom';
  /** Uses fixed positioning when true; the mapped default (`false`) positions against the nearest
   * containing block with Floating UI's absolute strategy. Changes apply live while open. */
  @property({ type: Boolean, reflect: true }) hoist = false;
  /** Shoelace boolean alias for the filled appearance. */
  @property({ type: Boolean, reflect: true }) filled = false;
  /** Show a button that empties the selection while there is anything selected. */
  @property({ type: Boolean, reflect: true, attribute: 'with-clear' })
  withClear = false;
  /** Shoelace's spelling of {@link withClear}, accepted so a mechanical `sl-` → `lr-` rename does
   *  not silently drop the clear button. Prefer `with-clear` in new code. */
  @property({ type: Boolean }) clearable = false;
  /** Renders a selected option's chip in `multiple` mode; see `LyraSelectTagRenderer`. */
  @property({ attribute: false }) getTag?: LyraSelectTagRenderer;
  /**
   * Opt-in: when `true` and exactly one `<lr-option>` is enabled, the
   * trigger commits that option directly (click/Enter/Space/ArrowDown/
   * ArrowUp) instead of opening the listbox, and renders as a plain
   * `role="button"` with no chevron. Defaults to `false`, which always
   * renders the normal combobox/listbox/chevron trigger regardless of how
   * many options are enabled — the pre-1.3.0 behavior. See the class doc
   * above and `onlyOption` below for the full rationale.
   */
  @property({ type: Boolean, attribute: 'auto-commit-single-option' })
  autoCommitSingleOption = false;

  @state() private activeIndex = -1;
  /** Stable identity behind `activeIndex`, retained across collection reorder/removal and option
   *  availability changes so the numeric index never silently points at a different row. */
  private activeOption?: LyraOption;
  @state() private options: LyraOption[] = [];
  // Set on the trigger button's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;
  /** Whether the user has acted on this control yet, which is what gates the `user-valid`/
   *  `user-invalid` custom states. Deliberately separate from `touched` (which drives the visible
   *  `data-invalid`/`aria-invalid` pair and is set on blur alone): picking an option is an
   *  interaction the instant it happens, and `reportValidity()` — what a submit attempt runs —
   *  counts as one too, exactly as it does for native `:user-invalid`. Not `@state`: nothing in
   *  `render()` reads it. */
  private hasInteracted = false;
  // `[part]:empty` never matches because the literal `<slot>` child itself counts as content.
  // The shared controller seeds light DOM synchronously and delegates every named slot through one
  // listener, while the option collection below keeps its specialized identity-aware handler.
  private readonly slotPresence = new SlotPresenceController(this);
  @query('[part="trigger"]') private triggerElement?: HTMLButtonElement;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`.
   * @default null */
  declare customError: string | null;
  // Tracked separately from the consumer's own `disabled` -- a native
  // `<input>`'s own `disabled` IDL property/attribute is never mutated by
  // fieldset cascading, so a consumer's explicit `disabled` must survive the
  // fieldset re-enabling (see `formDisabledCallback` below).
  private _fieldsetDisabled = false;
  private listId = nextId('select-list');
  private triggerId = nextId('select-trigger');
  private valueTextId = nextId('select-value');
  private cleanup?: () => void;
  private overlayHandle?: OverlayHandle;
  private restoreFocusOnClose = true;
  private positionedDirection?: 'ltr' | 'rtl';
  private pointerListenerDocument?: Document;
  private pointerListener?: (event: PointerEvent) => void;
  private _isFirstUpdate = true;
  private openVetoed = false;
  // A disable-forced close has no vetoable lifecycle, but that suppression belongs only to the
  // exact `open` write that enforced the policy. A later enable + show in the same Lit batch is a
  // new transition and must still emit/settle normally.
  private openStateGeneration = 0;
  private pendingOpenTransitionStart?: boolean;
  private suppressedOpenLifecycleGeneration?: number;
  private transitionToken = 0;
  private transitionWaiters = new Map<
    'lr-after-show' | 'lr-after-hide',
    Set<() => void>
  >();
  // The committed selection, always an array -- capped to one entry outside
  // `multiple` mode, where `value`'s getter unwraps it back to a plain string.
  private _selected: string[] = [];
  // Public values are not required to be unique. Keep the selected options'
  // element identity separately so two same-valued rows never both become
  // selected and a click on the later occurrence cannot route to the first.
  private _selectedOptions: LyraOption[] = [];
  private _multiple = false;
  private _disabled = false;
  private _required = false;
  // What `form.reset()` restores to. Captured exactly once, from whatever
  // `<lr-option selected>` markup was present the first time slotted
  // options are collected (mirrors native `<select><option selected>`) --
  // never from the `value` setter, so a user picking an option (even the
  // very first pick on an initially-unselected select) can't itself become
  // the reset default. See lr-combobox's identical `_defaultSelected`.
  private _defaultSelected: string[] = [];
  private _defaultSelectedOptions: LyraOption[] = [];
  private _defaultCaptured = false;
  private _valueDirty = false;
  // A restored value must win over declarative selected markup collected by
  // the first asynchronous slotchange. Cleared by the next ordinary value write.
  private _restoredStateActive = false;
  // Standard listbox type-ahead: printable keystrokes accumulate into this
  // buffer and reset ~500ms after the last one, so "b" then "a" narrows to
  // "ba" instead of restarting the search on every keystroke.
  private typeAheadBuffer = '';
  private typeAheadTimer?: number;
  private typeAheadTimerWindow?: Window;
  private typeAheadTimerGeneration = 0;

  /** Focus the internal select trigger. */
  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this.triggerElement?.focus(options);
  }

  /** Blur the internal select trigger. */
  override blur(): void {
    this.triggerElement?.blur();
  }

  /** Activates the internal trigger button -- `HTMLElement.prototype.click()` on a custom
   *  element with no native click semantics of its own is otherwise a no-op, so a generic
   *  form-submit helper or automation script calling `.click()` on the host would silently do
   *  nothing without this forwarding override. Mirrors `<lr-button>`'s identical `click()`. */
  override click(): void {
    if (!this.effectiveDisabled) this.triggerElement?.click();
  }

  // Hand-written accessor (mirrors the `value` accessor below, and the
  // `FormAssociated.name` in `../../internal/form-associated.ts`): a
  // form-associated custom element's submitted entry name is resolved by the
  // browser from the live `name` *content attribute*, read synchronously at
  // FormData-construction/submit time (see `syncFormValue()` below) -- Lit's
  // async (microtask-deferred) `reflect: true` alone would leave a
  // property-only assignment like `el.name = 'b'` invisible to a same-tick
  // `new FormData(form)`/submit, so the attribute write happens here instead.
  private _name = '';
  // `noAccessor` hand-rolled accessor (mirrors `name`/`multiple` above): the cap feeds a
  // `slice()` on every render, so a NaN/negative value must never reach it -- sanitized
  // synchronously here via `finiteCount` rather than left for Lit's default async field setter
  // to hand through unchecked.
  private _maxOptionsVisible = 3;

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
    installCustomErrorProperty(
      this,
      () => this.validityController.customValidityMessage
    );
    this.syncFormValue();
  }

  /** Browser-resolved form owner. Assigning a form id string or form element updates the `form`
   * content attribute while reads remain element-valued.
   * @attr form ID of an external form owner.
   * @default null */
  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  /** Returns the browser-resolved form owner, including an external owner selected by `form`. */
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

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="trigger"]') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    if (this.hasUpdated && this.open)
      queueMicrotask(() => this.reconnectOpenPopup());
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    // `hasUpdated` flips to `true` before `updated()` even sees its first
    // call, so it can't distinguish "just mounted" from "just changed" there
    // -- capture that distinction here, while it's still reliable, for
    // `updated()`'s `open`-handling below to consult.
    this._isFirstUpdate = !this.hasUpdated;
    this.announceOpenTransition(changed);
    if (changed.has('open') && !this.open && !this.openVetoed) {
      // The veto has already run synchronously. Clear only for an accepted close, so a vetoed
      // listbox retains its active descendant for assistive technology and Enter.
      this.setActiveIndex(-1);
    }
  }

  private applyOpenState(next: boolean): void {
    const old = this._open;
    if (this.pendingOpenTransitionStart === undefined)
      this.pendingOpenTransitionStart = old;
    this.openStateGeneration++;
    this._open = next;
    this.requestUpdate('open', old);
  }

  /** Enforces a platform policy close without exposing an author veto point. A disabled form
   * control cannot keep an interactive popup open even when an ordinary `lr-hide` listener would
   * cancel a user-requested close. */
  private forceCloseOpenState(): void {
    // A normal close may already have changed `_open` in this task while its willUpdate veto point
    // is still pending. Suppress that exact transition as well, but do not leave a sticky flag on a
    // control that was already settled closed: it could be re-enabled and shown before this batch
    // renders.
    const isClosing = this._open || this.pendingOpenTransitionStart === true;
    this.transitionToken++;
    this.resolveTransitionWaiters('lr-after-show');
    this.resolveTransitionWaiters('lr-after-hide');
    if (!this._open) {
      if (isClosing)
        this.suppressedOpenLifecycleGeneration = this.openStateGeneration;
      if (this.hasAttribute('open')) this.removeAttribute('open');
      return;
    }
    this.applyOpenState(false);
    this.suppressedOpenLifecycleGeneration = this.openStateGeneration;
  }

  /**
   * Emits the cancelable `lr-show`/`lr-hide` veto point for this update's `open` transition.
   *
   * It lives here rather than in `updated()` because a veto has to be answered *before* anything
   * observable happens: `willUpdate()` still runs ahead of render and attribute reflection, so
   * restoring `open` here leaves the listbox, the reflected attribute and the property agreeing
   * with each other without a visible open-then-close flash. Keeping it on the `open` transition
   * (rather than inside `show()`/`hide()`) preserves the existing rule that the lifecycle fires
   * however `open` changed, including a direct `el.open = true` that bypasses both methods.
   */
  private announceOpenTransition(changed: PropertyValues): void {
    this.openVetoed = false;
    if (
      !changed.has('open') ||
      this._isFirstUpdate ||
      this.suppressedOpenLifecycleGeneration === this.openStateGeneration
    ) {
      return;
    }
    const name = this.open ? 'lr-show' : 'lr-hide';
    // Removal cannot be vetoed -- the element is already gone -- so the disconnect-driven close
    // is announced without offering a veto nobody could honour.
    if (!this.isConnected) {
      this.emit('lr-hide');
      return;
    }
    if (!this.emit(name, null, { cancelable: true }).defaultPrevented) return;
    this.openVetoed = true;
    this.open = !this.open;
    // `show()`/`hide()` already registered a waiter for the transition this veto just cancelled;
    // without resolving it their returned promise would never settle.
    this.resolveTransitionWaiters(
      this.open ? 'lr-after-hide' : 'lr-after-show'
    );
  }

  /** Submission name.
   * @default '' */
  get name(): string {
    return this._name;
  }
  set name(next: string | null) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    // A `multiple` select submits a FormData whose keys are baked in at write time, so the
    // submitted entry has to be rebuilt whenever the name changes -- synchronously, for the same
    // same-tick-submit reason the attribute is written here rather than reflected by Lit.
    this.syncFormValue();
    this.requestUpdate('name', old);
  }

  /** Whether several options can be selected at once. Flipping it re-shapes `value` (a string
   *  becomes a `string[]`) and the submitted form entry, so it is normally set once declaratively.
   *  @default false */
  get multiple(): boolean {
    return this._multiple;
  }
  set multiple(next: boolean) {
    const old = this._multiple;
    this._multiple = Boolean(next);
    this.toggleAttribute('multiple', this._multiple);
    // Leaving `multiple` collapses the selection to its first entry, so the single-mode
    // string value and the submitted entry can never disagree with what the trigger shows.
    if (!this._multiple && this._selected.length > 1) {
      this.setSelection(
        this._selected.slice(0, 1),
        this._selectedOptions.slice(0, 1)
      );
    } else {
      this.syncFormValue();
    }
    this.requestUpdate('multiple', old);
  }

  /** Maximum number of selected-value chips shown before the rest collapse behind a localized
   *  "+N" chip (`multiple` only). `0` removes the cap. Sanitized to a finite, non-negative
   *  integer, falling back to `3`.
   *  @default 3 */
  get maxOptionsVisible(): number {
    return this._maxOptionsVisible;
  }
  set maxOptionsVisible(next: number) {
    const old = this._maxOptionsVisible;
    this._maxOptionsVisible = finiteCount(next, 3);
    this.requestUpdate('maxOptionsVisible', old);
  }

  /** Whether user interaction and form participation are disabled.
   * @default false */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.forceCloseOpenState();
    // Disabling bars constraint validation, so the violation itself is recomputed here -- not just
    // the states republished.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  /** Whether at least one selected option is required for validity.
   * @default false */
  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }

  /** The selected value: a single string outside `multiple` mode (empty when nothing is
   *  selected), a `string[]` inside it. */
  get value(): string | string[] {
    return this.multiple ? [...this._selected] : this._selected[0] ?? '';
  }
  set value(next: string | string[]) {
    this._restoredStateActive = false;
    this._valueDirty = true;
    const values = (Array.isArray(next) ? next : next ? [next] : []).filter(
      (value): value is string => typeof value === 'string'
    );
    this.setSelection(
      values,
      values.map((value) =>
        this.options.find((option) => option.value === value)
      )
    );
  }

  /** Reset value, matching the mapped native-like select contract. The `default-value` attribute
   * supplies the single-mode string form; property writes may use a string array in `multiple`
   * mode. Changing the default updates the live value only while it is still pristine.
   * @default '' */
  get defaultValue(): string | string[] {
    return this.multiple
      ? [...this._defaultSelected]
      : this._defaultSelected[0] ?? '';
  }
  set defaultValue(next: string | string[]) {
    const old = this.multiple
      ? [...this._defaultSelected]
      : this._defaultSelected[0] ?? '';
    const values = (Array.isArray(next) ? next : next ? [next] : []).filter(
      (value): value is string => typeof value === 'string'
    );
    this._defaultSelected = this.multiple ? [...values] : values.slice(0, 1);
    this._defaultSelectedOptions = this.resolveOccurrences(
      this._defaultSelected
    );
    if (!this._valueDirty && !this._restoredStateActive) {
      this.setSelection(
        [...this._defaultSelected],
        [...this._defaultSelectedOptions]
      );
    }
    this.requestUpdate('defaultValue', old);
  }

  /** Live selected option occurrences. Writes commit the referenced live options through the
   * same event-silent path as a `value` assignment; foreign/detached options are ignored and
   * single mode keeps only the first occurrence. Reads return a fresh snapshot, so mutating the
   * returned array never mutates the control's identity bookkeeping.
   * @default [] */
  get selectedOptions(): LyraOption[] {
    return [...this._selectedOptions];
  }
  set selectedOptions(next: LyraOption[]) {
    this._restoredStateActive = false;
    this._valueDirty = true;
    const candidates = Array.isArray(next) ? next : [];
    const live = candidates.filter(
      (option, index): option is LyraOption =>
        isLyraOptionElement(option) &&
        this.contains(option) &&
        this.options.includes(option) &&
        candidates.indexOf(option) === index
    );
    const selected = this.multiple ? live : live.slice(0, 1);
    this.setSelection(
      selected.map((option) => option.value),
      selected
    );
  }

  /**
   * The single write path for the committed selection. `preferred` carries the exact
   * `<lr-option>` occurrences a caller already resolved (a click routes to the row that was
   * actually pressed, not to the first row sharing its value); anything missing is resolved by
   * value against the current option list.
   */
  private setSelection(
    next: string[],
    preferred: Array<LyraOption | undefined> = []
  ): void {
    // Multiple-selection identity is occurrence-based. Preserve duplicate strings so two distinct
    // same-valued options survive through value, tags, restoration and FormData.
    const values = this.multiple ? [...next] : next.slice(0, 1);
    const previousValues = this._selected;
    const previousOptions = this._selectedOptions;
    const old = this.multiple ? [...previousValues] : previousValues[0] ?? '';
    this._selected = values;
    this._selectedOptions = this.resolveOccurrences(values, preferred);
    this.syncFormValue();
    this.reflectSelected();
    this.updateValidity();
    this.requestUpdate('value', old);
    // A different occurrence can carry the same public value. Lit's normal
    // value change detection is intentionally silent for same-string writes,
    // so schedule the occurrence-only render explicitly.
    const sameValues =
      previousValues.length === values.length &&
      previousValues.every((value, i) => value === values[i]);
    const sameOptions =
      previousOptions.length === this._selectedOptions.length &&
      previousOptions.every((option, i) => option === this._selectedOptions[i]);
    if (sameValues && !sameOptions) this.requestUpdate();
  }

  /** Maps each selected value onto one live `<lr-option>`, honouring a caller-supplied
   *  occurrence when it is still slotted and never handing the same element to two values. */
  private resolveOccurrences(
    values: string[],
    preferred: Array<LyraOption | undefined> = []
  ): LyraOption[] {
    const claimed = new Set<LyraOption>();
    const resolved: LyraOption[] = [];
    values.forEach((value, index) => {
      const hint = preferred[index];
      const match =
        hint &&
        hint.value === value &&
        this.options.includes(hint) &&
        !claimed.has(hint)
          ? hint
          : this.options.find(
              (option) => option.value === value && !claimed.has(option)
            );
      if (!match) return;
      claimed.add(match);
      resolved.push(match);
    });
    return resolved;
  }

  /** Shared with every other form control: disabled (own or fieldset-cascaded) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      // A barred control reports no violation at all, exactly like a native disabled `<select>` --
      // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required
      // selects, and with it the documented `:state(user-invalid)` error styling.
      this.validityController.setValidity({});
    } else if (this.required && this._selected.length === 0) {
      this.validityController.setValidity(
        { valueMissing: true },
        this.localize('selectValueMissing')
      );
    } else {
      this.validityController.setValidity({});
    }
    this.reflectValidityStates();
  }

  /** Republishes the six validity custom states (`required`/`optional`, `valid`/`invalid`,
   *  `user-valid`/`user-invalid`) from whatever `ElementInternals` currently holds. Called from
   *  every path that can move either validity or the interaction flag. */
  private reflectValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.hasInteracted,
      barred: this.barredFromValidation,
    });
    if (this._selected.length === 0) this.internals.states?.add('blank');
    else this.internals.states?.delete('blank');
  }

  private syncFormValue(): void {
    if (!this.multiple) {
      // One argument, so the restorable state stays the submitted string itself -- what
      // `formStateRestoreCallback` below reads back for a single-select.
      this.internals.setFormValue(this._selected[0] ?? '');
      return;
    }
    // A FormData form value submits under the keys baked into the FormData itself, bypassing the
    // element's own `name` the way a plain string value would use it -- so an unnamed multi-select
    // must contribute nothing (matching a nameless native `<select multiple>`) rather than
    // inventing a shared key that would merge with any other unnamed select in the same form.
    const state = JSON.stringify(this._selected);
    if (!this.name) {
      this.internals.setFormValue(null, state);
      return;
    }
    const data = new FormData();
    for (const value of this._selected) data.append(this.name, value);
    this.internals.setFormValue(data, state);
  }

  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  formResetCallback(): void {
    this.touched = false;
    this.hasInteracted = false;
    this._restoredStateActive = false;
    this._valueDirty = false;
    const resetOptions =
      this._defaultSelectedOptions.length > 0
        ? this._defaultSelectedOptions
        : this.options.filter((option) => wasOptionInitiallySelected(option));
    if (this._defaultSelectedOptions.length === 0 && resetOptions.length > 0) {
      this._defaultSelectedOptions = [...resetOptions];
      this._defaultSelected = resetOptions.map((option) => option.value);
    }
    const defaults = new Set(resetOptions);
    for (const option of this.options) {
      option[RESET_OPTION_SELECTED_FROM_OWNER](defaults.has(option));
    }
    this.setSelection(
      [...this._defaultSelected],
      [...this._defaultSelectedOptions]
    );
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    // Single-select persists the submitted string itself; `multiple` persists a JSON array,
    // since its own form value is a FormData whose entries the platform never hands back here.
    if (!this.multiple) {
      this.value = typeof state === 'string' ? state : '';
    } else {
      let restored: string[] = [];
      if (typeof state === 'string') {
        try {
          const parsed: unknown = JSON.parse(state);
          if (
            Array.isArray(parsed) &&
            parsed.every((entry) => typeof entry === 'string')
          )
            restored = parsed;
        } catch {
          // Malformed persisted state restores an empty selection.
        }
      }
      this.value = restored;
    }
    this._restoredStateActive = true;
    this._valueDirty = true;
  }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.forceCloseOpenState();
    this.updateValidity();
    this.requestUpdate();
  }
  checkValidity(): boolean {
    this.updateValidity();
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    this.updateValidity();
    // A submit attempt runs this, and native `:user-invalid` starts matching at exactly that
    // point, so it counts as interaction for the `user-*` custom states. `checkValidity()`
    // deliberately does not: it is the silent query.
    this.hasInteracted = true;
    this.reflectValidityStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a rejection no
   * client-side constraint can express ("that option is no longer available"). A non-empty
   * `message` raises `customError` and becomes `validationMessage`, so the control fails
   * `checkValidity()`, blocks submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * `required` select with nothing chosen stays `valueMissing`. The custom error also survives
   * every intrinsic recomputation in between (each selection/`required` change re-runs
   * `updateValidity()`) and a `form.reset()` — matching a native control, where only another
   * `setCustomValidity('')` clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.reflectValidityStates();
  }

  /** Clears consumer-supplied validity and restores the current required/selection constraint. */
  resetValidity(): void {
    this.setCustomValidity('');
  }

  override disconnectedCallback(): void {
    this.transitionToken++;
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.positionedDirection = undefined;
    this.clearTypeAheadTimer();
    this.typeAheadBuffer = '';
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindDocumentPointer();
    this.resolveTransitionWaiters('lr-after-show');
    this.resolveTransitionWaiters('lr-after-hide');
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // `true` across the disconnect/reconnect and `changed.has('open')` never
    // fires again, leaving the listbox rendered open with no positioning and
    // no outside-click listener.
    this.open = false;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.positionedDirection = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindDocumentPointer();
    this.clearTypeAheadTimer();
    queueMicrotask(() => this.reconnectOpenPopup());
  }

  private collectOptions = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    const previous = new Set(this.options);
    const previousActive = this.activeOption;
    const previousActiveRawIndex = previousActive
      ? this.options.indexOf(previousActive)
      : this.activeIndex;
    this.options = slot
      .assignedElements({ flatten: true })
      .filter(isLyraOptionElement);
    this.reconcileActiveOption(previousActive, previousActiveRawIndex);
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      // Seed the initial selection -- and the reset default -- from
      // declarative `<lr-option selected>` markup, mirroring native
      // `<select><option selected>`. Only the *first* declared-selected
      // option matters outside `multiple` mode when several declare it,
      // mirroring lr-combobox's single-mode behavior. This is the only place
      // `_defaultSelected` is set; picking an option later (the `value`
      // setter) never redefines the reset default.
      const hasDefaultValue = this.hasAttribute('default-value');
      const allDefaults = this.options.filter(
        (option) => option.defaultSelected
      );
      const defaults = this.multiple ? allDefaults : allDefaults.slice(0, 1);
      const allLive = this.options.filter((option) => option.selected);
      const live = this.multiple ? allLive : allLive.slice(0, 1);
      const initialLive = this.options.filter((option) =>
        wasOptionInitiallySelected(option)
      );
      const optionDirty = this.options.some((option) =>
        isOptionSelectedDirty(option)
      );
      const dirtySelected = this.options.filter(
        (option) => isOptionSelectedDirty(option) && option.selected
      );
      if (!hasDefaultValue) {
        const resetOptions =
          defaults.length > 0
            ? defaults
            : initialLive.length > 0
            ? initialLive
            : live;
        this._defaultSelected = resetOptions.map((option) => option.value);
        this._defaultSelectedOptions = [...resetOptions];
      } else {
        this._defaultSelectedOptions = this.resolveOccurrences(
          this._defaultSelected
        );
      }
      const fromDefaults = hasDefaultValue || defaults.length > 0;
      const initial = optionDirty
        ? this.multiple
          ? allLive
          : dirtySelected.slice(-1)[0]
          ? dirtySelected.slice(-1)
          : live
        : hasDefaultValue
        ? this._defaultSelectedOptions
        : fromDefaults
        ? defaults
        : live;
      if (
        initial.length > 0 &&
        !this._restoredStateActive &&
        !this._valueDirty
      ) {
        if (!fromDefaults || optionDirty) this._valueDirty = true;
        this.setSelection(
          initial.map((option) => option.value),
          [...initial]
        );
        return; // setSelection() already called reflectSelected()
      }
      if (optionDirty) this._valueDirty = true;
      if (hasDefaultValue && !this._valueDirty && !this._restoredStateActive) {
        this.setSelection(
          [...this._defaultSelected],
          [...this._defaultSelectedOptions]
        );
        return;
      }
    } else {
      // Options slotted in after the first pass (e.g. a lazily-populated
      // list appended post-connect) still declare selection the same way a
      // native `<select><option selected>` would -- seed the newest one
      // (all of them, in `multiple` mode) into the live selection instead of
      // letting reflectSelected() below strip the `selected` attribute back off.
      const newDefaults = this.options.filter(
        (option) => !previous.has(option) && option.defaultSelected
      );
      const newLive = this.options.filter(
        (option) =>
          !previous.has(option) && option.selected && !option.defaultSelected
      );
      this.refreshOptionDefaults();
      const eligible = [
        ...(!this._restoredStateActive && !this._valueDirty ? newDefaults : []),
        ...(!this._restoredStateActive ? newLive : []),
      ];
      if (eligible.length > 0) {
        const added = this.multiple ? eligible : eligible.slice(-1);
        const occurrences = this.multiple
          ? [...new Set([...this._selectedOptions, ...added])]
          : added;
        if (newLive.length > 0) this._valueDirty = true;
        this.setSelection(
          occurrences.map((option) => option.value),
          occurrences
        );
        return; // setSelection() already called reflectSelected()
      }
    }
    this.reflectSelected();
  };

  private refreshOptionDefaults(): void {
    if (this.hasAttribute('default-value')) return;
    const declared = this.options.filter((option) => option.defaultSelected);
    const defaults = this.multiple ? declared : declared.slice(0, 1);
    this._defaultSelected = defaults.map((option) => option.value);
    this._defaultSelectedOptions = [...defaults];
    if (!this._valueDirty && !this._restoredStateActive) {
      this.setSelection(
        [...this._defaultSelected],
        [...this._defaultSelectedOptions]
      );
    }
  }

  private reflectSelected(): void {
    // Re-resolve first: an option list that changed under us (slotchange, a removed row) can
    // leave a stale element behind, and the light-DOM `selected` reflection below has to follow
    // whatever is actually slotted now.
    this._selectedOptions = this.resolveOccurrences(
      this._selected,
      this._selectedOptions
    );
    const chosen = new Set(this._selectedOptions);
    for (const option of this.options) {
      option[SET_OPTION_SELECTED_FROM_OWNER](chosen.has(option));
    }
  }

  /** The label to show for one committed value: the selected occurrence's own label, else any
   *  option sharing that value, else the raw value (a programmatic write with no matching row). */
  private labelFor(value: string, occurrenceIndex = 0): string {
    return (
      (this._selectedOptions[occurrenceIndex]?.value === value
        ? this._selectedOptions[occurrenceIndex]?.label
        : undefined) ??
      this._selectedOptions.find((option) => option.value === value)?.label ??
      this.options.find((option) => option.value === value)?.label ??
      value
    );
  }

  /**
   * The sole available option, when `autoCommitSingleOption` is set and
   * there's exactly one. Opening a one-row popup to pick the only available choice is pure
   * friction with no real decision behind it, so an opted-in single-option select skips the
   * popup entirely -- see `onTriggerClick`/`onKeyDown`, which commit this option directly on
   * activation instead of opening the listbox, and `render()`, which drops the popup-trigger
   * ARIA semantics (`role="combobox"`, `aria-haspopup`, `aria-expanded`, the chevron) in favor
   * of a plain button's, since no popup can ever appear while this getter returns a value.
   * Returns `undefined` whenever `autoCommitSingleOption` is `false` (the default), regardless
   * of option count, so the normal combobox trigger renders unconditionally. Does not affect
   * `value`/validity defaults in any way -- an unselected single-option select stays unselected
   * until the trigger is actually activated, exactly like the multi-option case.
   */
  private get onlyOption(): LyraOption | undefined {
    if (!this.autoCommitSingleOption) return undefined;
    const navigable = this.navigableOptions();
    return navigable.length === 1 ? navigable[0] : undefined;
  }

  /**
   * The options arrow keys, type-ahead and the active-descendant index may land on. `inert` counts
   * alongside `disabled` for the same reason it does in `<lr-menu>`'s `isNavigable()`: an inert
   * element refuses interaction outright, so an active index pointing at one describes a row the
   * user can neither reach nor commit. `closest('[inert]')` covers an inert ancestor, which inerts
   * the option just as completely as the attribute on the option itself. The severity is lower here
   * than in a menu -- this listbox keeps DOM focus on the trigger and moves only
   * `aria-activedescendant` -- but the predicate has to agree across all four call sites or the
   * rendered `data-active` row and the committed option can disagree.
   */
  private isOptionAvailable(option: LyraOption): boolean {
    return !option.disabled && !option.inert && !option.closest('[inert]');
  }

  private navigableOptions(options: LyraOption[] = this.options): LyraOption[] {
    return options.filter((option) => this.isOptionAvailable(option));
  }

  /** Updates the numeric active-descendant cursor and its stable option identity together. */
  private setActiveIndex(
    next: number,
    navigable: LyraOption[] = this.navigableOptions()
  ): void {
    if (next < 0 || navigable.length === 0) {
      this.activeIndex = -1;
      this.activeOption = undefined;
      return;
    }
    const index = Math.min(next, navigable.length - 1);
    this.activeIndex = index;
    this.activeOption = navigable[index];
  }

  /** Keeps the active option by identity when possible. If it disappeared or became unavailable,
   *  choose the nearest navigable row around its former raw collection position, preferring the
   *  following row on an equal-distance tie, then fall back to no active descendant. */
  private reconcileActiveOption(
    previousActive: LyraOption | undefined,
    previousRawIndex: number
  ): void {
    if (!previousActive && this.activeIndex < 0) return;
    const navigable = this.navigableOptions();
    if (previousActive) {
      const preservedIndex = navigable.indexOf(previousActive);
      if (preservedIndex >= 0) {
        this.setActiveIndex(preservedIndex, navigable);
        return;
      }
    }
    if (navigable.length === 0) {
      this.setActiveIndex(-1, navigable);
      return;
    }
    const pivot = Math.max(0, previousRawIndex);
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestRawIndex = -1;
    navigable.forEach((option, index) => {
      const rawIndex = this.options.indexOf(option);
      const distance = Math.abs(rawIndex - pivot);
      if (
        distance < nearestDistance ||
        (distance === nearestDistance &&
          rawIndex >= pivot &&
          nearestRawIndex < pivot)
      ) {
        nearestIndex = index;
        nearestDistance = distance;
        nearestRawIndex = rawIndex;
      }
    });
    this.setActiveIndex(nearestIndex, navigable);
  }

  // Fired by `option.ts`'s `lr-option-change` (a MutationObserver on the
  // option's own light-DOM content/attributes) when an already-slotted
  // `<lr-option>` mutates its own data in place -- `collectOptions()` only
  // re-runs on `slotchange`, which never fires for such a mutation, so
  // without this the rendered listbox row would go stale. Reassigning (not
  // mutating) `options` gives Lit a new array reference to diff against.
  //
  // The notification is sealed here rather than allowed to keep bubbling: it
  // is a private child-to-parent refresh signal, not part of this component's
  // event contract, and it carries the *option's* target/detail rather than
  // the select's. Left uncontained it escapes the host and reaches consumer
  // code as an undocumented, undiscoverable event; a consumer who needs to
  // know the value moved already has `lr-change`/`lr-input`. A listener bound
  // directly to the `<lr-option>` still sees it -- the option is the event
  // target, and the target's own listeners run before this slot listener.
  private onOptionChange = (e: Event): void => {
    e.stopPropagation();
    const previousActive = this.activeOption;
    const previousActiveRawIndex = previousActive
      ? this.options.indexOf(previousActive)
      : this.activeIndex;
    queueMicrotask(() => {
      this.refreshOptionDefaults();
      this.reflectSelected();
      this.options = [...this.options];
      this.reconcileActiveOption(previousActive, previousActiveRawIndex);
    });
  };

  /** Opens the listbox and resolves after `lr-after-show`. */
  show(): Promise<void> {
    if (this.open || this.effectiveDisabled) return Promise.resolve();
    this.resolveTransitionWaiters('lr-after-hide');
    const settled = this.waitForTransition('lr-after-show');
    this.open = true;
    return settled;
  }
  /** Closes the listbox and resolves after `lr-after-hide`. */
  hide(): Promise<void> {
    if (!this.open) return Promise.resolve();
    this.resolveTransitionWaiters('lr-after-show');
    const settled = this.waitForTransition('lr-after-hide');
    this.open = false;
    return settled;
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (e.composedPath().includes(this)) return;
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.dismissBackdrop();
      return;
    }
    this.restoreFocusOnClose = false;
    void this.hide();
  };

  private positionListbox(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.positionedDirection = this.effectiveDirection;
    const anchor = this.renderRoot.querySelector(
      '[part="trigger"]'
    ) as HTMLElement | null;
    const listbox = this.renderRoot.querySelector(
      '[part="listbox"]'
    ) as HTMLElement | null;
    if (!anchor || !listbox) return;
    this.cleanup = place(anchor, listbox, {
      placement: rtlAwarePlacement(this.placement, this),
      strategy: this.hoist ? 'fixed' : 'absolute',
    });
  }

  private activateListboxOverlay(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.restoreFocusOnClose = true;
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () =>
        this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null,
      onEscape: () => void this.hide(),
      onBackdrop: () => {
        this.restoreFocusOnClose = false;
        void this.hide();
      },
      restoreFocusTo: this.triggerElement ?? null,
      modal: false,
      trapFocus: false,
    });
    this.bindDocumentPointer();
    this.positionListbox();
  }

  private teardownListboxOverlay(
    restoreFocus = this.restoreFocusOnClose
  ): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.positionedDirection = undefined;
    this.overlayHandle?.deactivate({ restoreFocus });
    this.overlayHandle = undefined;
    this.unbindDocumentPointer();
    this.restoreFocusOnClose = true;
  }

  private bindDocumentPointer(): void {
    if (!this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    if (this.pointerListenerDocument === ownerDocument && this.pointerListener)
      return;
    this.unbindDocumentPointer();
    const listener = (event: PointerEvent): void => {
      if (
        this.pointerListener !== listener ||
        this.pointerListenerDocument !== ownerDocument ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.onDocPointer(event);
    };
    this.pointerListenerDocument = ownerDocument;
    this.pointerListener = listener;
    ownerDocument.addEventListener('pointerdown', listener, true);
  }

  private unbindDocumentPointer(): void {
    if (this.pointerListenerDocument && this.pointerListener) {
      this.pointerListenerDocument.removeEventListener(
        'pointerdown',
        this.pointerListener,
        true
      );
    }
    this.pointerListenerDocument = undefined;
    this.pointerListener = undefined;
  }

  private reconnectOpenPopup(): void {
    if (!this.isConnected || !this.open) return;
    this.activateListboxOverlay();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    const suppressOpenLifecycle =
      changed.has('open') &&
      this.suppressedOpenLifecycleGeneration === this.openStateGeneration;
    const shouldRefreshPosition =
      this.open &&
      this.isConnected &&
      (changed.has('placement') ||
        changed.has('hoist') ||
        this.positionedDirection !== this.effectiveDirection);
    // A vetoed transition already put `open` back during willUpdate(), so `changed` still names it
    // while nothing about the state actually moved: tearing down and rebuilding the popup
    // machinery here would undo the veto it was meant to honour.
    if (changed.has('open') && !this.openVetoed) {
      // All `open`-driven side effects (positioning and the click-outside listener) live here
      // rather than in show()/hide() so they run however `open` became true -- via
      // show()/hide()'s own user-interaction paths, or a consumer/test
      // setting `el.open` directly, which bypasses both entirely. The lr-show/lr-hide veto point
      // itself runs one step earlier, in willUpdate().
      if (this.open && this.isConnected) {
        this.activateListboxOverlay();
        // Don't settle a "show" transition for markup that's simply
        // rendering open for the first time (e.g. `<lr-select open>`) --
        // only for an actual closed-to-open transition.
        if (!this._isFirstUpdate && !suppressOpenLifecycle) {
          void this.settleTransition('lr-after-show');
        }
      } else if (!this.open) {
        this.teardownListboxOverlay();
        if (!this._isFirstUpdate && !suppressOpenLifecycle) {
          void this.settleTransition('lr-after-hide');
        }
      } else {
        this.teardownListboxOverlay(false);
      }
    } else if (changed.has('open') && this.openVetoed) {
      this.restoreFocusOnClose = true;
      if (shouldRefreshPosition) this.positionListbox();
    } else if (shouldRefreshPosition) {
      // Live positioning-option changes update the existing overlay entry in place. Re-registering
      // it would incorrectly promote the select to the top of the stack and refire lifecycle.
      this.positionListbox();
    }
    if (
      changed.has('touched') ||
      changed.has('required') ||
      changed.has('value')
    ) {
      this.toggleAttribute(
        'data-invalid',
        this.touched && !this.internals.validity.valid
      );
    }
    if (changed.has('open')) {
      this.pendingOpenTransitionStart = undefined;
      this.suppressedOpenLifecycleGeneration = undefined;
    }
  }

  private async settleTransition(
    event: 'lr-after-show' | 'lr-after-hide'
  ): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    if (this.isConnected) {
      const view = this.ownerDocument.defaultView;
      if (view)
        await new Promise<void>((resolve) =>
          view.requestAnimationFrame(() => resolve())
        );
      if (this.transitionToken !== token) return;
      const listbox = this.renderRoot.querySelector('[part="listbox"]');
      const animations = listbox?.getAnimations({ subtree: true }) ?? [];
      await Promise.all(
        animations.map((animation) => animation.finished.catch(() => undefined))
      );
      if (this.transitionToken !== token) return;
    }
    this.emit(event);
    this.resolveTransitionWaiters(event);
  }

  private waitForTransition(
    event: 'lr-after-show' | 'lr-after-hide'
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const waiters =
        this.transitionWaiters.get(event) ?? new Set<() => void>();
      waiters.add(resolve);
      this.transitionWaiters.set(event, waiters);
    });
  }

  private resolveTransitionWaiters(
    event: 'lr-after-show' | 'lr-after-hide'
  ): void {
    const waiters = this.transitionWaiters.get(event);
    if (!waiters) return;
    this.transitionWaiters.delete(event);
    for (const resolve of waiters) resolve();
  }

  /** Dispatches the native value-change pair and prefixed aliases. `input`/`change` stay deliberately unprefixed -- this
   *  control is a direct `<select>` counterpart, so its value-change events keep `<select>`'s own
   *  naming instead of the `lr-` prefix `<lr-slider>` uses for its analogous rename. See the class
   *  doc's `change` entry for the full rule. The prefixed aliases carry `detail: { value }`. */
  private emitValueEvents(): void {
    dispatchNativeInputEvent(this);
    this.emit('lr-input', { value: this.value });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value: this.value });
  }

  private selectOption(option: LyraOption): void {
    if (this.effectiveDisabled || !this.isOptionAvailable(option)) return;
    this.hasInteracted = true;
    this._restoredStateActive = false;
    this._valueDirty = true;
    if (this.multiple) {
      // Picking a selected row again toggles it back off, the standard multi-select listbox
      // contract -- and the listbox stays open, since one pick is rarely the whole intent.
      const selectedIndex = this._selectedOptions.indexOf(option);
      const selected = selectedIndex >= 0;
      const occurrences = selected
        ? this._selectedOptions.filter((_, index) => index !== selectedIndex)
        : [...this._selectedOptions, option];
      const values = selected
        ? this._selected.filter((_, index) => index !== selectedIndex)
        : [...this._selected, option.value];
      this.setSelection(values, occurrences);
      this.emitValueEvents();
      return;
    }
    // Reopening the listbox (or, on a single-option select, simply
    // reactivating the trigger) and landing back on the already-selected
    // row is not a selection change -- `change`/`input` are documented as
    // firing when "the selection changed", so only emit them when the
    // value actually moves, matching a native <select> (which never fires
    // `change` for re-picking the currently-selected <option>).
    const changed =
      option !== this._selectedOptions[0] || option.value !== this._selected[0];
    this.setSelection([option.value], [option]);
    void this.hide();
    if (changed) this.emitValueEvents();
  }

  /** Removes one occurrence, rather than collapsing every row sharing its public string value. */
  private removeValueAt(index: number): void {
    if (this.effectiveDisabled || index < 0 || index >= this._selected.length)
      return;
    this._restoredStateActive = false;
    this._valueDirty = true;
    this.setSelection(
      this._selected.filter((_, candidateIndex) => candidateIndex !== index),
      this._selectedOptions.filter(
        (_, candidateIndex) => candidateIndex !== index
      )
    );
    this.emitValueEvents();
  }

  /** Empties the selection from the `with-clear` button. Silent when there was nothing to
   *  clear, so `lr-clear` never announces a no-op. */
  private clear(): void {
    if (this.effectiveDisabled || this._selected.length === 0) return;
    this._restoredStateActive = false;
    this._valueDirty = true;
    this.setSelection([], []);
    this.emitValueEvents();
    this.emit('lr-clear');
  }

  private removeTag(value: string, index: number, event: Event): void {
    event.stopPropagation();
    if (this._selected[index] !== value) return;
    this.removeValueAt(index);
    void this.updateComplete.then(() => {
      const buttons = [
        ...this.renderRoot.querySelectorAll<HTMLButtonElement>(
          '[part~="tag__remove-button"]'
        ),
      ];
      (
        buttons[Math.min(index, buttons.length - 1)] ?? this.triggerElement
      )?.focus();
    });
  }

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    if (this.onlyOption) return this.selectOption(this.onlyOption);
    if (this.open) void this.hide();
    else void this.show();
  };

  private onTriggerBlur = (event: FocusEvent): void => {
    // A disable-forced blur (the platform blurring a focused native control the instant it
    // becomes disabled -- plain HTML behavior, not specific to custom elements) is not a real
    // user interaction and must not mark the field touched: depending on exact timing, doing so
    // could reenter an in-flight Lit update and trip Lit's dev-mode "scheduled an update after an
    // update completed" warning. This is the same fix as `<lr-input>`'s `onBlur`.
    if (!this.effectiveDisabled) {
      this.touched = true;
      this.hasInteracted = true;
      this.reflectValidityStates();
    }
    // A mouse click outside the element is already handled by
    // onDocPointer/hide(), but that leaves keyboard users with no way to
    // dismiss the listbox short of Escape -- tabbing focus away from the
    // trigger should close it too, the same as lr-combobox's input blur. Native focus traversal is
    // already moving to the user's chosen next stop, so this close must not ask the overlay manager
    // to restore focus back into the select and undo that Tab/Shift+Tab movement.
    if (this.open) this.restoreFocusOnClose = false;
    void this.hide();
    relayNativeEvent(this, event);
  };

  private onTriggerFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  /**
   * Standard listbox type-ahead: moves to the next available option whose
   * label starts with the accumulated buffer, cycling from just after the
   * "current" option (the active row while open, the selected value while
   * closed). While open this only moves `activeIndex` (a highlight, matching
   * Arrow-key nav -- Enter/click still commits it); while closed there's no
   * highlight to show, so it commits immediately, matching a native
   * `<select>`'s closed-state type-ahead.
   */
  private typeAhead(char: string): void {
    this.clearTypeAheadTimer();
    this.typeAheadBuffer += char.toLocaleLowerCase(this.effectiveLocale);
    const ownerWindow = this.ownerDocument.defaultView;
    if (this.isConnected && ownerWindow) {
      const generation = this.typeAheadTimerGeneration;
      this.typeAheadTimerWindow = ownerWindow;
      this.typeAheadTimer = ownerWindow.setTimeout(() => {
        if (
          this.typeAheadTimerGeneration !== generation ||
          !this.isConnected ||
          this.ownerDocument.defaultView !== ownerWindow
        ) {
          return;
        }
        this.typeAheadTimer = undefined;
        this.typeAheadTimerWindow = undefined;
        this.typeAheadBuffer = '';
      }, 500);
    }

    const navigable = this.navigableOptions();
    if (!navigable.length) return;
    const currentOption = this.open
      ? navigable[this.activeIndex]
      : this._selectedOptions[this._selectedOptions.length - 1];
    const currentIndex = navigable.indexOf(currentOption as LyraOption);
    const n = navigable.length;
    for (let step = 1; step <= n; step++) {
      const idx = (currentIndex + step + n) % n;
      const candidate = navigable[idx];
      if (candidate === undefined) continue;
      if (
        candidate.label
          .toLocaleLowerCase(this.effectiveLocale)
          .startsWith(this.typeAheadBuffer)
      ) {
        if (this.open) {
          this.setActiveIndex(idx, navigable);
          return;
        }
        if (this.multiple && this._selectedOptions.includes(candidate)) {
          // A closed multi-select must not toggle an already-selected occurrence off. Keep the
          // bounded circular search moving so a later unselected match -- including another row
          // with the same public value -- remains reachable.
          continue;
        }
        this.selectOption(candidate);
        return;
      }
    }
  }

  private clearTypeAheadTimer(): void {
    this.typeAheadTimerGeneration += 1;
    if (this.typeAheadTimer !== undefined) {
      this.typeAheadTimerWindow?.clearTimeout(this.typeAheadTimer);
    }
    this.typeAheadTimer = undefined;
    this.typeAheadTimerWindow = undefined;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.navigableOptions();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (this.onlyOption) return this.selectOption(this.onlyOption);
        if (!this.open) {
          void this.show();
          return;
        }
        this.setActiveIndex(
          Math.min(navigable.length - 1, this.activeIndex + 1),
          navigable
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.onlyOption) return this.selectOption(this.onlyOption);
        if (!this.open) {
          void this.show();
          return;
        }
        this.setActiveIndex(Math.max(0, this.activeIndex - 1), navigable);
        break;
      case 'Enter':
      case ' ':
        // When closed, let the button's native Enter/Space activation fire
        // its own `click` handler (onTriggerClick) to open -- only intercept
        // here to commit/dismiss while already open, so that synthesized
        // click doesn't also re-toggle it shut.
        if (this.open) {
          e.preventDefault();
          const active = navigable[this.activeIndex];
          if (this.activeIndex >= 0 && active) {
            this.selectOption(active);
          } else {
            void this.hide();
          }
        }
        break;
      case 'Escape':
        if (
          this.open &&
          (!this.overlayHandle?.isActive() || this.overlayHandle.isTopmost())
        ) {
          e.preventDefault();
          void this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.setActiveIndex(0, navigable);
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.setActiveIndex(navigable.length - 1, navigable);
        }
        break;
      case 'Backspace':
      case 'Delete':
        // The trigger keeps the native select-style Backspace/Delete shortcut even though the
        // sibling tag row now also provides independently-focusable remove buttons.
        if (this.multiple && this._selected.length > 0) {
          e.preventDefault();
          this.removeValueAt(this._selected.length - 1);
        }
        break;
      default:
        if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
          this.typeAhead(e.key);
        }
        break;
    }
  };

  // Delegated onto [part="listbox"] (see render()) rather than one closure
  // pair allocated per option per render -- resolves the target row via
  // closest('[part="option"]') + a data-value lookup, mirroring lr-combobox.
  private onListboxMouseDown = (e: MouseEvent): void => {
    // Keep focus on the trigger for every listbox surface, including group headings, padding and
    // scrollbar space. The delegated click path still commits only a real option.
    e.preventDefault();
  };

  private onListboxClick = (e: MouseEvent): void => {
    const optionEl = (e.target as HTMLElement).closest(
      '[part="option"]'
    ) as HTMLElement | null;
    const index = Number(optionEl?.dataset['index']);
    if (!Number.isInteger(index)) return;
    const option = this.options[index];
    if (option) this.selectOption(option);
  };

  private renderRows(
    options: LyraOption[],
    activeId: string
  ): TemplateResult[] {
    const out: TemplateResult[] = [];
    const chosen = new Set(this._selectedOptions);
    let currentGroup: string | undefined;
    let groupRows: TemplateResult[] = [];
    let groupIndex = 0;
    const flushGroup = (): void => {
      if (groupRows.length === 0) return;
      if (currentGroup) {
        const labelId = `${this.listId}-group-${groupIndex++}`;
        out.push(html`<div role="group" aria-labelledby=${labelId}>
          <div id=${labelId} class="group-label" part="group-label">${currentGroup}</div>
          ${groupRows}
        </div>`);
      } else {
        out.push(...groupRows);
      }
      groupRows = [];
    };
    options.forEach((o, i) => {
      if (o.group !== currentGroup) {
        flushGroup();
        currentGroup = o.group;
      }
      const id = `${this.listId}-opt-${i}`;
      const selected = chosen.has(o);
      groupRows.push(
        html`<div
          part="option"
          id=${id}
          role="option"
          data-index=${i}
          data-value=${o.value}
          aria-selected=${selected ? 'true' : 'false'}
          aria-disabled=${this.isOptionAvailable(o) ? 'false' : 'true'}
          ?data-active=${id === activeId}
        >
          ${o.dotColor
            ? html`<span
                part="option-dot"
                style=${styleMap({
                  background: sanitizeCssColor(o.dotColor) ?? 'transparent',
                })}
              ></span>`
            : ''}
          <span part="option-label">
            <span>${o.label}</span>
            ${o.sub ? html`<span part="option-sub">${o.sub}</span>` : ''}
          </span>
        </div>`
      );
    });
    flushGroup();
    return out;
  }

  /** One selected value's chip. `getTag` replaces the whole built-in chip so a consumer owns the
   * markup (and re-declares parts/removal behavior if desired); a returned string renders as text,
   * never as markup. Built-in remove buttons are siblings of the trigger, never nested inside it. */
  private renderTag(value: string, index: number): unknown {
    const option =
      (this._selectedOptions[index]?.value === value
        ? this._selectedOptions[index]
        : undefined) ??
      this.options.find((candidate) => candidate.value === value);
    if (this.getTag && option) return this.getTag(option, index);
    const label = this.labelFor(value, index);
    return html`<span part="tag tag__base">
      <span part="tag-label"
        ><span part="tag__content" aria-hidden="true">${label}</span></span
      >
      <button
        part="tag__remove-button tag__remove-button__base"
        type="button"
        ?disabled=${this.effectiveDisabled}
        aria-label=${this.localize('removeWithContext', undefined, { label })}
        @click=${(event: Event) => this.removeTag(value, index, event)}
      >
        ${closeIcon()}
      </button>
    </span>`;
  }

  override render(): TemplateResult {
    const options = this.options;
    const navigable = this.navigableOptions(options);
    const active =
      this.activeIndex >= 0 ? navigable[this.activeIndex] : undefined;
    const activeId = active
      ? `${this.listId}-opt-${options.indexOf(active)}`
      : '';
    const selectedLabel =
      this._selected.length > 0 ? this.labelFor(this._selected[0]!) : '';
    const selectedLabels = this._selected
      .map((value, index) => this.labelFor(value, index))
      .join(', ');
    const hasValue = this._selected.length > 0;
    // `0` removes the cap entirely, matching the upstream contract this mirrors.
    const shownValues =
      this.maxOptionsVisible > 0
        ? this._selected.slice(0, this.maxOptionsVisible)
        : this._selected;
    const overflow = this._selected.length - shownValues.length;
    const showClear = (this.withClear || this.clearable) && hasValue;
    const hasHint =
      this.slotPresence.has('hint') ||
      this.slotPresence.has('help-text') ||
      this.hint.length > 0 ||
      this.helpText.length > 0 ||
      this.withHint;
    const hasError =
      this.slotPresence.has('error') || this.errorText.length > 0;
    const hasLabel =
      this.slotPresence.has('label') || this.label.length > 0 || this.withLabel;
    const describedBy = [
      this.multiple && hasValue ? this.valueTextId : '',
      hasError ? 'select-error' : '',
      hasHint ? 'select-hint' : '',
    ]
      .filter(Boolean)
      .join(' ');
    // A single navigable option has no popup to expand into -- when opted in via
    // autoCommitSingleOption, the trigger commits it directly on activation (see
    // onTriggerClick/onKeyDown) instead of opening the listbox, so it's exposed as a plain
    // button rather than a combobox with a permanently-closed popup: no aria-haspopup/
    // aria-expanded/aria-controls/aria-activedescendant (all meaningless without a popup that
    // can ever appear) and no chevron. Without the opt-in (the default), this is always
    // `false` and the normal combobox/listbox/chevron trigger renders regardless of option count.
    const isSingleOption =
      this.autoCommitSingleOption && navigable.length === 1;

    return html`
      <div part="form-control">
        <label
          part="form-control-label"
          for=${this.triggerId}
          ?hidden=${!hasLabel}
        >
          <span part="label">${this.label}<slot name="label"></slot></span>
        </label>
        <div
          class="control"
          part="combobox form-control-input"
          ?data-clearable=${showClear}
          ?data-multiple=${this.multiple && hasValue}
        >
          <button
            id=${this.triggerId}
            part="trigger"
            type="button"
            title=${this.title || nothing}
            role=${isSingleOption ? 'button' : 'combobox'}
            aria-haspopup=${isSingleOption ? nothing : 'listbox'}
            aria-expanded=${isSingleOption
              ? nothing
              : this.open
              ? 'true'
              : 'false'}
            aria-controls=${isSingleOption ? nothing : this.listId}
            aria-activedescendant=${isSingleOption ? nothing : activeId}
            aria-label=${this.getAttribute('aria-label') ??
            (hasLabel ? nothing : this.placeholder || this.localize('select'))}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid
              ? 'true'
              : 'false'}
            ?disabled=${this.effectiveDisabled}
            ?autofocus=${this.autofocus}
            @click=${this.onTriggerClick}
            @keydown=${this.onKeyDown}
            @focus=${this.onTriggerFocus}
            @blur=${this.onTriggerBlur}
          >
            <span
              part="start"
              aria-hidden="true"
              inert
              ?hidden=${!this.slotPresence.has('start') &&
              !this.slotPresence.has('prefix')}
            >
              <slot name="start"></slot>
              <slot part="prefix" name="prefix"></slot>
            </span>
            <span
              id=${this.valueTextId}
              class=${this.multiple && hasValue
                ? 'trigger-label sr-only'
                : 'trigger-label'}
              part="display-input"
              ?data-placeholder=${!hasValue}
              ?data-multiple-value=${this.multiple && hasValue}
              >${hasValue && !this.multiple
                ? selectedLabel
                : this.multiple && hasValue
                ? selectedLabels
                : this.placeholder}</span
            >
            <span
              part="end"
              aria-hidden="true"
              inert
              ?hidden=${!this.slotPresence.has('end') &&
              !this.slotPresence.has('suffix')}
            >
              <slot name="end"></slot>
              <slot part="suffix" name="suffix"></slot>
            </span>
            ${isSingleOption
              ? nothing
              : html`<span part="expand-icon" aria-hidden="true" inert
                  ><slot name="expand-icon">${chevronIcon()}</slot></span
                >`}
          </button>
          ${this.multiple && hasValue
            ? html`<span part="tags"
                >${shownValues.map((value, index) =>
                  this.renderTag(value, index)
                )}${overflow > 0
                  ? html`<span
                      part="tag tag-overflow tag__base"
                      aria-hidden="true"
                      ><span part="tag__content" aria-hidden="true"
                        >${this.localize('selectSelectedOverflow', undefined, {
                          n: getNumberFormat(this.effectiveLocale).format(
                            overflow
                          ),
                        })}</span
                      ></span
                    >`
                  : ''}</span
              >`
            : nothing}
          ${showClear
            ? html`<button
                part="clear-button"
                type="button"
                ?disabled=${this.effectiveDisabled}
                aria-label=${this.localize('clear')}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this.clear();
                }}
              >
                <span aria-hidden="true" inert
                  ><slot name="clear-icon">${closeIcon()}</slot></span
                >
              </button>`
            : ''}
        </div>
        <div
          part="listbox"
          id=${this.listId}
          role="listbox"
          aria-multiselectable=${this.multiple ? 'true' : 'false'}
          @mousedown=${this.onListboxMouseDown}
          @click=${this.onListboxClick}
        >
          ${this.renderRows(options, activeId)}
        </div>
        <div id="select-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error"></slot>
        </div>
        <div
          id="select-hint"
          part="hint form-control-help-text"
          ?hidden=${!hasHint}
        >
          ${this.hint || this.helpText}<slot name="hint"></slot
          ><slot name="help-text"></slot>
        </div>
      </div>
      <slot
        @slotchange=${this.collectOptions}
        @lr-option-change=${this.onOptionChange}
        hidden
      ></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-select': LyraSelect;
  }
}
