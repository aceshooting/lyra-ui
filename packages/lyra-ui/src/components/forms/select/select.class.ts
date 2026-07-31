import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon, closeIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './select.styles.js';
import { LyraOption } from '../combobox/option.class.js';
import '../combobox/option.class.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';

/** A no-op stand-in for `ElementInternals`, used only when the host environment has no real
 *  implementation of it (e.g. a downstream consumer's Vitest + happy-dom test suite) --
 *  `attachInternals()` is browser-only, and calling it unconditionally in the constructor would
 *  otherwise throw before any test assertion runs, merely from constructing or importing this
 *  component. Every member here is either an inert value or a no-op: native `<form>`
 *  participation is unavailable in that environment, but that's an acceptable degradation rather
 *  than a hard failure -- same fix as `<lr-combobox>`'s/`<lr-model-select>`'s identical
 *  `createInternalsSafely`/`createNoopInternals` pair. */
function createInternalsSafely(host: HTMLElement): ElementInternals {
  if (typeof host.attachInternals !== 'function') return createNoopInternals();
  try {
    return host.attachInternals();
  } catch {
    return createNoopInternals();
  }
}

function createNoopInternals(): ElementInternals {
  return {
    form: null,
    labels: [] as unknown as NodeList,
    validity: {} as ValidityState,
    validationMessage: '',
    willValidate: false,
    setFormValue(): void {},
    setValidity(): void {},
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): boolean {
      return true;
    },
  } as unknown as ElementInternals;
}

export type LyraSelectSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

/** Visual treatment of the trigger surface. `outlined` (the default) is a bordered surface;
 *  `filled` swaps the border for a raised fill; `filled-outlined` keeps both; `accent` paints the
 *  loud brand fill; `plain` drops border and fill entirely. */
export type LyraSelectAppearance = 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain';

/** Renders one selected option's chip in `multiple` mode. Whatever it returns replaces the
 *  built-in `[part='tag']` chip for that option, so a caller that wants the default styling
 *  hooks re-declares `part="tag"` on its own root node. A returned string renders as **text**,
 *  never as markup. */
export type LyraSelectTagRenderer = (option: LyraOption, index: number) => unknown;

export interface LyraSelectEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-clear': CustomEvent<undefined>;
  input: CustomEvent<{ value: string | string[] }>;
  change: CustomEvent<{ value: string | string[] }>;
  'lr-change': CustomEvent<{ value: string | string[] }>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
/**
 * `<lr-select>` — a plain closed-list dropdown: a direct `<lr-*>`
 * counterpart to `<wa-select>`/`<wa-option>`. Trigger is a button (not a text
 * input) -- click/Enter/Space/ArrowDown opens it, there's no typing-to-filter.
 * A printable keypress instead jumps (or, while closed, directly selects) the
 * next option whose label starts with what's been typed, like a native
 * `<select>`'s type-ahead.
 *
 * Options are `<lr-option value>` children, the same element `<lr-combobox>`
 * uses. Unlike `lr-combobox` there is no filter/source/empty-text/max-render
 * surface -- see `<lr-combobox>` for the filterable case.
 *
 * `multiple` turns the committed `value` into a `string[]` and renders one
 * chip per selection inside the trigger. Because that trigger is a real
 * `<button>`, the chips are deliberately non-interactive: a nested remove
 * button would be invalid interactive-content nesting and unreachable by
 * keyboard or AT anyway, since the outer button intercepts every
 * click/Enter/Space first. Removal instead has three affordances -- pick the
 * selected row again to toggle it off, press Backspace/Delete on the trigger
 * to drop the last selection, or use the `with-clear` button to drop all of
 * them. `getTag` customizes a chip's content under the same
 * non-interactive-content constraint; `max-options-visible` caps how many
 * chips render before the rest collapse behind a localized "+N" chip.
 *
 * `with-clear`'s button renders inside the trigger's inline-end padding,
 * outboard of the expand icon, as a sibling of the trigger rather than a child
 * of it -- for the same nesting reason.
 *
 * Reuses `lr-combobox`'s popup positioning (`internal/positioner.js`) and
 * click-outside/Escape/Home/End/Arrow-key listbox navigation patterns,
 * adapted to a trigger button that keeps DOM focus throughout (the listbox's
 * "active" row is conveyed via `aria-activedescendant`, never actual focus),
 * matching the WAI-ARIA "select-only combobox" pattern.
 *
 * When `autoCommitSingleOption` is set and exactly one option is enabled
 * (regardless of how many disabled ones exist alongside it), the popup never
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
 * @customElement lr-select
 * @slot - `<lr-option>` elements.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @slot start - Adornment at the inline-start of the trigger row, before the selected-value label.
 *   Content should be non-focusable/non-interactive only: the trigger itself renders as a native
 *   `<button>` (`[part="trigger"]`), so a slotted `<button>`/`<a>`/other focusable element here
 *   nests inside it in the flattened (assigned-slot) tree -- invalid interactive-content nesting,
 *   and unreachable by keyboard/AT regardless, since the outer button intercepts every
 *   click/Enter/Space before it can reach a nested control. Note: axe-core does not currently
 *   flag this specific shadow-DOM-composed nesting pattern as a violation (verified empirically
 *   against axe-core 4.12.1) -- the hazard is real but not automatically detectable today.
 * @slot end - Adornment after the selected-value label and before the expand icon. Same
 *   non-focusable/non-interactive-content caveat as `start`.
 * @event {CustomEvent<{ value: string | string[] }>} change - The selection changed. Deliberately
 *   unprefixed, mirroring native `<select>`'s own event name -- contrast `<lr-slider>`, which uses
 *   `lr-input`/`lr-change` for its analogous value-change pair. Which form controls mirror native
 *   unprefixed DOM event names (this one, matching `<select>`) versus which use the `lr-` prefix
 *   (`<lr-slider>`, matching `<input type="range">` via a custom name) is a deliberate per-control
 *   choice, not an incidental divergence. `detail: { value }` carries the new committed selection:
 *   a string in single mode, a `string[]` in `multiple` mode.
 * @event {CustomEvent<{ value: string | string[] }>} input - Fired alongside `change` on every
 *   selection change (native `<select>` doesn't meaningfully distinguish the two either).
 * @event {CustomEvent<{ value: string | string[] }>} lr-change - Prefixed compatibility alias
 *   fired after `input` and `change` on the same selection change, mirroring `<lr-checkbox>`'s
 *   `lr-change`. Not fired for a programmatic `value` assignment.
 * @event lr-clear - The `with-clear` button emptied the selection, fired after the
 *   `input`/`change`/`lr-change` trio. Never fired when there was nothing to clear.
 * @event lr-show - The listbox opened.
 * @event lr-hide - The listbox closed.
 * @event blur - Re-dispatched from the trigger as a bubbling, composed event.
 * @event focus - Re-dispatched from the trigger as a bubbling, composed event.
 * @csspart form-control - The outer wrapper around label, trigger, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart trigger - The trigger button (positioning anchor).
 * @csspart start - Wrapper around the `start` adornment slot; `hidden` while nothing is slotted.
 * @csspart end - Wrapper around the `end` adornment slot; `hidden` while nothing is slotted.
 * @csspart tags - The `multiple`-mode chip row inside the trigger.
 * @csspart tag - One selected-value chip. The "+N" overflow chip carries both `tag` and
 *   `tag-overflow`, so `::part(tag)` styles every chip and `::part(tag-overflow)` only that one --
 *   state after `::part()` never matches, so it is encoded in the part name instead.
 * @csspart tag-label - A chip's ellipsis-safe label.
 * @csspart tag-overflow - The "+N" chip standing in for the selections past `max-options-visible`.
 * @csspart clear-button - The `with-clear` button.
 * @csspart listbox - The options popover.
 * @csspart group-label - An option group's heading row (shown when any option declares a `group`).
 * @csspart option - An option row.
 * @csspart option-dot - An option row's leading status dot (when `dot-color` is set).
 * @csspart option-label - An option row's label/sub wrapper.
 * @csspart option-sub - An option row's secondary line (when `sub` is set).
 * @csspart expand-icon - The dropdown indicator.
 * @csspart error - The error message.
 * @csspart hint - The hint message.
 * @cssprop --lr-select-expand-size - Decorative expand-icon box size, scaled by `size`.
 * @cssprop --lr-select-gap - Gap between the trigger's start adornment, label, end adornment, and
 *   expand icon. Doesn't vary by `size`.
 * @cssprop --lr-select-radius - Trigger corner radius. Doesn't vary by `size`.
 * @cssprop --lr-select-trigger-padding - Trigger padding shorthand, scaled by `size`.
 * @cssprop --lr-select-trigger-min-height - Trigger block-size floor, scaled by `size`, and live
 *   at every tier including the default `m` (`2.5rem`, matching `<lr-input>`/`<lr-combobox>` at
 *   that tier).
 * @cssprop --lr-select-font-size - Trigger font size, scaled by `size`.
 * @cssprop --lr-select-tag-padding - Padding inside a `multiple`-mode chip. Doesn't vary by `size`.
 * @cssprop --lr-select-tag-font-size - Chip text size. Doesn't vary by `size`.
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
 */
export class LyraSelect extends LyraElement<LyraSelectEventMap> {
  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];

  static override properties = {
    multiple: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: { reflect: true, noAccessor: true },
    maxOptionsVisible: { type: Number, attribute: 'max-options-visible', noAccessor: true },
  };

  @property() placeholder = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Visual size — same `2xs`–`xl` scale as `lr-input`/`lr-combobox`/`lr-locale-picker`'s own `size`. */
  @property({ reflect: true }) size: LyraSelectSize = 'm';
  /** Visual treatment of the trigger surface. */
  @property({ reflect: true }) appearance: LyraSelectAppearance = 'outlined';
  /** Fully-rounded trigger corners. Retunes `--lr-select-radius`, so a consumer override of that
   *  property still wins. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Preferred listbox placement. `flip`/`shift` may still override it to keep the popup in view,
   *  and the `left`/`right` component is swapped under RTL. */
  @property({ reflect: true }) placement: Placement = 'bottom-start';
  /** Show a button that empties the selection while there is anything selected. */
  @property({ type: Boolean, reflect: true, attribute: 'with-clear' }) withClear = false;
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
  @property({ type: Boolean, attribute: 'auto-commit-single-option' }) autoCommitSingleOption = false;

  @state() private activeIndex = -1;
  @state() private options: LyraOption[] = [];
  // Set on the trigger button's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;
  // `[part]:empty` never matches -- the part always contains a literal
  // `<slot>` child element regardless of assigned content -- so real
  // emptiness is tracked in JS instead (same fix as lr-combobox's
  // hasHintSlot/hasErrorSlot/hasLabelSlot) and reflected via `hidden`.
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  @state() private hasStartSlot = false;
  @state() private hasEndSlot = false;
  @query('[part="trigger"]') private triggerElement?: HTMLButtonElement;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  // Tracked separately from the consumer's own `disabled` -- a native
  // `<input>`'s own `disabled` IDL property/attribute is never mutated by
  // fieldset cascading, so a consumer's explicit `disabled` must survive the
  // fieldset re-enabling (see `formDisabledCallback` below).
  private _fieldsetDisabled = false;
  private listId = nextId('select-list');
  private triggerId = nextId('select-trigger');
  private cleanup?: () => void;
  private _isFirstUpdate = true;
  // The committed selection, always an array -- capped to one entry outside
  // `multiple` mode, where `value`'s getter unwraps it back to a plain string.
  private _selected: string[] = [];
  // Public values are not required to be unique. Keep the selected options'
  // element identity separately so two same-valued rows never both become
  // selected and a click on the later occurrence cannot route to the first.
  private selectedOptions: LyraOption[] = [];
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
  // A restored value must win over declarative selected markup collected by
  // the first asynchronous slotchange. Cleared by the next ordinary value write.
  private _restoredStateActive = false;
  // Standard listbox type-ahead: printable keystrokes accumulate into this
  // buffer and reset ~500ms after the last one, so "b" then "a" narrows to
  // "ba" instead of restarting the search on every keystroke.
  private typeAheadBuffer = '';
  private typeAheadTimer?: ReturnType<typeof setTimeout>;

  /** Focus the internal select trigger. */
  override focus(options?: FocusOptions): void {
    this.triggerElement?.focus(options);
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
    this.triggerElement?.click();
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
    this.internals = createInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    this.syncFormValue();
  }

  get form(): HTMLFormElement | null {
    return this.internals.form;
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
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    // `hasUpdated` flips to `true` before `updated()` even sees its first
    // call, so it can't distinguish "just mounted" from "just changed" there
    // -- capture that distinction here, while it's still reliable, for
    // `updated()`'s `open`-handling below to consult.
    this._isFirstUpdate = !this.hasUpdated;
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasStartSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'start');
      this.hasEndSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'end');
    }
  }

  get name(): string {
    return this._name;
  }
  set name(next: string) {
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
   *  becomes a `string[]`) and the submitted form entry, so it is normally set once declaratively. */
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
      this.setSelection(this._selected.slice(0, 1), this.selectedOptions.slice(0, 1));
    } else {
      this.syncFormValue();
    }
    this.requestUpdate('multiple', old);
  }

  /** Maximum number of selected-value chips shown before the rest collapse behind a localized
   *  "+N" chip (`multiple` only). `0` removes the cap. Sanitized to a finite, non-negative
   *  integer, falling back to `3`. */
  get maxOptionsVisible(): number {
    return this._maxOptionsVisible;
  }
  set maxOptionsVisible(next: number) {
    const old = this._maxOptionsVisible;
    this._maxOptionsVisible = finiteCount(next, 3);
    this.requestUpdate('maxOptionsVisible', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.hide();
    this.requestUpdate('disabled', old);
  }

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
    return this.multiple ? [...this._selected] : (this._selected[0] ?? '');
  }
  set value(next: string | string[]) {
    this._restoredStateActive = false;
    const values = (Array.isArray(next) ? next : next ? [next] : []).filter(
      (value): value is string => typeof value === 'string',
    );
    this.setSelection(
      values,
      values.map((value) => this.options.find((option) => option.value === value)),
    );
  }

  /**
   * The single write path for the committed selection. `preferred` carries the exact
   * `<lr-option>` occurrences a caller already resolved (a click routes to the row that was
   * actually pressed, not to the first row sharing its value); anything missing is resolved by
   * value against the current option list.
   */
  private setSelection(next: string[], preferred: Array<LyraOption | undefined> = []): void {
    const values = this.multiple ? [...new Set(next)] : next.slice(0, 1);
    const previousValues = this._selected;
    const previousOptions = this.selectedOptions;
    const old = this.multiple ? [...previousValues] : (previousValues[0] ?? '');
    this._selected = values;
    this.selectedOptions = this.resolveOccurrences(values, preferred);
    this.syncFormValue();
    this.reflectSelected();
    this.updateValidity();
    this.requestUpdate('value', old);
    // A different occurrence can carry the same public value. Lit's normal
    // value change detection is intentionally silent for same-string writes,
    // so schedule the occurrence-only render explicitly.
    const sameValues =
      previousValues.length === values.length && previousValues.every((value, i) => value === values[i]);
    const sameOptions =
      previousOptions.length === this.selectedOptions.length &&
      previousOptions.every((option, i) => option === this.selectedOptions[i]);
    if (sameValues && !sameOptions) this.requestUpdate();
  }

  /** Maps each selected value onto one live `<lr-option>`, honouring a caller-supplied
   *  occurrence when it is still slotted and never handing the same element to two values. */
  private resolveOccurrences(
    values: string[],
    preferred: Array<LyraOption | undefined> = [],
  ): LyraOption[] {
    const claimed = new Set<LyraOption>();
    const resolved: LyraOption[] = [];
    values.forEach((value, index) => {
      const hint = preferred[index];
      const match =
        hint && hint.value === value && this.options.includes(hint) && !claimed.has(hint)
          ? hint
          : this.options.find((option) => option.value === value && !claimed.has(option));
      if (!match) return;
      claimed.add(match);
      resolved.push(match);
    });
    return resolved;
  }

  private updateValidity(): void {
    if (this.required && this._selected.length === 0) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('selectValueMissing'));
    } else {
      this.validityController.setValidity({});
    }
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
    this._restoredStateActive = false;
    this.setSelection([...this._defaultSelected], [...this._defaultSelectedOptions]);
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    // Single-select persists the submitted string itself; `multiple` persists a JSON array,
    // since its own form value is a FormData whose entries the platform never hands back here.
    if (!this.multiple) {
      this.value = typeof state === 'string' ? state : '';
    } else {
      let restored: string[] = [];
      if (typeof state === 'string') {
        try {
          const parsed: unknown = JSON.parse(state);
          if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) restored = parsed;
        } catch {
          // Malformed persisted state restores an empty selection.
        }
      }
      this.value = restored;
    }
    this._restoredStateActive = true;
  }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.hide();
    this.requestUpdate();
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    clearTimeout(this.typeAheadTimer);
    this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // `true` across the disconnect/reconnect and `changed.has('open')` never
    // fires again, leaving the listbox rendered open with no positioning and
    // no outside-click listener.
    this.open = false;
  }

  private collectOptions = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    const previous = new Set(this.options);
    this.options = slot
      .assignedElements({ flatten: true })
      .filter((el): el is LyraOption => el instanceof LyraOption);
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      // Seed the initial selection -- and the reset default -- from
      // declarative `<lr-option selected>` markup, mirroring native
      // `<select><option selected>`. Only the *first* declared-selected
      // option matters outside `multiple` mode when several declare it,
      // mirroring lr-combobox's single-mode behavior. This is the only place
      // `_defaultSelected` is set; picking an option later (the `value`
      // setter) never redefines the reset default.
      const allDeclared = this.options.filter((option) => option.selected);
      const declared = this.multiple ? allDeclared : allDeclared.slice(0, 1);
      this._defaultSelected = declared.map((option) => option.value);
      this._defaultSelectedOptions = [...declared];
      if (declared.length > 0 && !this._restoredStateActive) {
        this.setSelection([...this._defaultSelected], [...this._defaultSelectedOptions]);
        return; // setSelection() already called reflectSelected()
      }
    } else {
      // Options slotted in after the first pass (e.g. a lazily-populated
      // list appended post-connect) still declare selection the same way a
      // native `<select><option selected>` would -- seed the newest one
      // (all of them, in `multiple` mode) into the live selection instead of
      // letting reflectSelected() below strip the `selected` attribute back off.
      const newlySelected = this.options.filter((o) => !previous.has(o) && o.selected);
      if (newlySelected.length > 0 && !this._restoredStateActive) {
        const added = this.multiple ? newlySelected : newlySelected.slice(-1);
        const occurrences = this.multiple ? [...this.selectedOptions, ...added] : added;
        this.setSelection(
          occurrences.map((option) => option.value),
          occurrences,
        );
        return; // setSelection() already called reflectSelected()
      }
    }
    this.reflectSelected();
  };

  private reflectSelected(): void {
    // Re-resolve first: an option list that changed under us (slotchange, a removed row) can
    // leave a stale element behind, and the light-DOM `selected` reflection below has to follow
    // whatever is actually slotted now.
    this.selectedOptions = this.resolveOccurrences(this._selected, this.selectedOptions);
    const chosen = new Set(this.selectedOptions);
    for (const option of this.options) option.selected = chosen.has(option);
  }

  /** The label to show for one committed value: the selected occurrence's own label, else any
   *  option sharing that value, else the raw value (a programmatic write with no matching row). */
  private labelFor(value: string): string {
    return (
      this.selectedOptions.find((option) => option.value === value)?.label ??
      this.options.find((option) => option.value === value)?.label ??
      value
    );
  }

  /**
   * The sole navigable (non-disabled) option, when `autoCommitSingleOption` is set and
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
    const navigable = this.options.filter((o) => !o.disabled);
    return navigable.length === 1 ? navigable[0] : undefined;
  }

  // Fired by `option.ts`'s `lr-option-change` (a MutationObserver on the
  // option's own light-DOM content/attributes) when an already-slotted
  // `<lr-option>` mutates its own data in place -- `collectOptions()` only
  // re-runs on `slotchange`, which never fires for such a mutation, so
  // without this the rendered listbox row would go stale. Reassigning (not
  // mutating) `options` gives Lit a new array reference to diff against.
  private onOptionChange = (): void => {
    this.options = [...this.options];
  };

  private show(): void {
    if (this.open || this.effectiveDisabled) return;
    this.open = true;
  }
  private hide(): void {
    if (!this.open) return;
    this.open = false;
    this.activeIndex = -1;
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    if (changed.has('open')) {
      this.cleanup?.();
      this.cleanup = undefined;
      // All `open`-driven side effects (positioning, the click-outside
      // listener, and the lr-show/lr-hide events) live here rather than
      // in show()/hide() so they fire however `open` became true -- via
      // show()/hide()'s own user-interaction paths, or a consumer/test
      // setting `el.open` directly, which bypasses both entirely.
      if (this.open) {
        this.ownerDocument.addEventListener('pointerdown', this.onDocPointer);
        // Don't announce a "show" transition for markup that's simply
        // rendering open for the first time (e.g. `<lr-select open>`) --
        // only for an actual closed-to-open transition.
        if (!this._isFirstUpdate) this.emit('lr-show');
        const anchor = this.renderRoot.querySelector('[part="trigger"]') as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        // Floating UI positions purely by physical sides, so a left/right placement has to be
        // resolved against the effective direction before it is handed over.
        if (anchor && listbox) {
          this.cleanup = place(anchor, listbox, { placement: rtlAwarePlacement(this.placement, this) });
        }
      } else {
        this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
        if (!this._isFirstUpdate) this.emit('lr-hide');
      }
    }
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  /** Dispatches the value-change trio. `input`/`change` stay deliberately unprefixed -- this
   *  control is a direct `<select>` counterpart, so its value-change events keep `<select>`'s own
   *  naming instead of the `lr-` prefix `<lr-slider>` uses for its analogous rename. See the class
   *  doc's `change` entry for the full rule. `lr-change` is an additional prefixed alias (matching
   *  `<lr-checkbox>`), so a consumer can subscribe to a namespaced event. All three carry
   *  `detail: { value }`. */
  private emitValueEvents(): void {
    this.emit('input', { value: this.value });
    this.emit('change', { value: this.value });
    this.emit('lr-change', { value: this.value });
  }

  private selectOption(option: LyraOption): void {
    if (this.effectiveDisabled || option.disabled) return;
    this._restoredStateActive = false;
    if (this.multiple) {
      // Picking a selected row again toggles it back off, the standard multi-select listbox
      // contract -- and the listbox stays open, since one pick is rarely the whole intent.
      const selected = this._selected.includes(option.value);
      const occurrences = selected
        ? this.selectedOptions.filter((candidate) => candidate.value !== option.value)
        : [...this.selectedOptions, option];
      const values = selected
        ? this._selected.filter((value) => value !== option.value)
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
    const changed = option !== this.selectedOptions[0] || option.value !== this._selected[0];
    this.setSelection([option.value], [option]);
    this.hide();
    if (changed) this.emitValueEvents();
  }

  /** Drops one committed value, for the trigger's Backspace/Delete shortcut. */
  private removeValue(value: string): void {
    if (this.effectiveDisabled || !this._selected.includes(value)) return;
    this._restoredStateActive = false;
    this.setSelection(
      this._selected.filter((candidate) => candidate !== value),
      this.selectedOptions.filter((option) => option.value !== value),
    );
    this.emitValueEvents();
  }

  /** Empties the selection from the `with-clear` button. Silent when there was nothing to
   *  clear, so `lr-clear` never announces a no-op. */
  private clear(): void {
    if (this.effectiveDisabled || this._selected.length === 0) return;
    this._restoredStateActive = false;
    this.setSelection([], []);
    this.emitValueEvents();
    this.emit('lr-clear');
  }

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    if (this.onlyOption) return this.selectOption(this.onlyOption);
    this.open ? this.hide() : this.show();
  };

  private onTriggerBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    this.touched = true;
    // A mouse click outside the element is already handled by
    // onDocPointer/hide(), but that leaves keyboard users with no way to
    // dismiss the listbox short of Escape -- tabbing focus away from the
    // trigger should close it too, the same as lr-combobox's input blur.
    this.hide();
    this.emit('blur');
  };

  private onTriggerFocus = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('focus');
  };

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onStartSlotChange = (e: Event): void => {
    this.hasStartSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onEndSlotChange = (e: Event): void => {
    this.hasEndSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /**
   * Standard listbox type-ahead: moves to the next non-disabled option whose
   * label starts with the accumulated buffer, cycling from just after the
   * "current" option (the active row while open, the selected value while
   * closed). While open this only moves `activeIndex` (a highlight, matching
   * Arrow-key nav -- Enter/click still commits it); while closed there's no
   * highlight to show, so it commits immediately, matching a native
   * `<select>`'s closed-state type-ahead.
   */
  private typeAhead(char: string): void {
    clearTimeout(this.typeAheadTimer);
    this.typeAheadBuffer += char.toLocaleLowerCase(this.effectiveLocale);
    this.typeAheadTimer = setTimeout(() => {
      this.typeAheadBuffer = '';
    }, 500);

    const navigable = this.options.filter((o) => !o.disabled);
    if (!navigable.length) return;
    const currentOption = this.open
      ? navigable[this.activeIndex]
      : this.selectedOptions[this.selectedOptions.length - 1];
    const currentIndex = navigable.indexOf(currentOption as LyraOption);
    const n = navigable.length;
    for (let step = 1; step <= n; step++) {
      const idx = (currentIndex + step + n) % n;
      const candidate = navigable[idx];
      if (candidate === undefined) continue;
      if (candidate.label.toLocaleLowerCase(this.effectiveLocale).startsWith(this.typeAheadBuffer)) {
        if (this.open) {
          this.activeIndex = idx;
        } else if (!(this.multiple && this._selected.includes(candidate.value))) {
          // A closed multi-select commits the match the same way, except when it is already
          // selected: typing a label to *find* an option must never silently deselect it.
          this.selectOption(candidate);
        }
        return;
      }
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.options.filter((o) => !o.disabled);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (this.onlyOption) return this.selectOption(this.onlyOption);
        if (!this.open) return this.show();
        this.activeIndex = Math.min(navigable.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.onlyOption) return this.selectOption(this.onlyOption);
        if (!this.open) return this.show();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
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
            this.hide();
          }
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = 0;
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = navigable.length - 1;
        }
        break;
      case 'Backspace':
      case 'Delete':
        // The chips inside the trigger cannot carry their own remove buttons (see the class
        // doc), so this is the keyboard removal affordance, mirroring `<lr-combobox>`'s.
        if (this.multiple && this._selected.length > 0) {
          e.preventDefault();
          this.removeValue(this._selected[this._selected.length - 1]!);
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
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };

  private onListboxClick = (e: MouseEvent): void => {
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const index = Number(optionEl?.dataset['index']);
    if (!Number.isInteger(index)) return;
    const option = this.options[index];
    if (option) this.selectOption(option);
  };

  private renderRows(options: LyraOption[], activeId: string): TemplateResult[] {
    const out: TemplateResult[] = [];
    const chosen = new Set(this.selectedOptions);
    let currentGroup: string | undefined;
    options.forEach((o, i) => {
      if (o.group !== currentGroup) {
        currentGroup = o.group;
        if (currentGroup) out.push(html`<div class="group-label" part="group-label">${currentGroup}</div>`);
      }
      const id = `${this.listId}-opt-${i}`;
      const selected = chosen.has(o);
      out.push(
        html`<div
          part="option"
          id=${id}
          role="option"
          data-index=${i}
          data-value=${o.value}
          aria-selected=${selected ? 'true' : 'false'}
          aria-disabled=${o.disabled ? 'true' : 'false'}
          ?data-active=${id === activeId}
        >
          ${o.dotColor
            ? html`<span
                part="option-dot"
                style=${styleMap({ background: sanitizeCssColor(o.dotColor) ?? 'transparent' })}
              ></span>`
            : ''}
          <span part="option-label">
            <span>${o.label}</span>
            ${o.sub ? html`<span part="option-sub">${o.sub}</span>` : ''}
          </span>
        </div>`,
      );
    });
    return out;
  }

  /** One selected value's chip. `getTag` replaces the whole built-in chip so a consumer owns the
   *  markup (and re-declares `part="tag"` if it wants the default styling hooks); a returned
   *  string lands in a Lit child position and therefore renders as text, never as markup. */
  private renderTag(value: string, index: number): unknown {
    const option =
      this.selectedOptions.find((candidate) => candidate.value === value) ??
      this.options.find((candidate) => candidate.value === value);
    if (this.getTag && option) return this.getTag(option, index);
    return html`<span part="tag"><span part="tag-label">${this.labelFor(value)}</span></span>`;
  }

  override render(): TemplateResult {
    const options = this.options;
    const navigable = options.filter((o) => !o.disabled);
    const active = this.activeIndex >= 0 ? navigable[this.activeIndex] : undefined;
    const activeId = active ? `${this.listId}-opt-${options.indexOf(active)}` : '';
    const selectedLabel = this._selected.length > 0 ? this.labelFor(this._selected[0]!) : '';
    const hasValue = this._selected.length > 0;
    // `0` removes the cap entirely, matching the upstream contract this mirrors.
    const shownValues =
      this.maxOptionsVisible > 0 ? this._selected.slice(0, this.maxOptionsVisible) : this._selected;
    const overflow = this._selected.length - shownValues.length;
    const showClear = this.withClear && hasValue;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const describedBy = [hasError ? 'select-error' : '', hasHint ? 'select-hint' : ''].filter(Boolean).join(' ');
    // A single navigable option has no popup to expand into -- when opted in via
    // autoCommitSingleOption, the trigger commits it directly on activation (see
    // onTriggerClick/onKeyDown) instead of opening the listbox, so it's exposed as a plain
    // button rather than a combobox with a permanently-closed popup: no aria-haspopup/
    // aria-expanded/aria-controls/aria-activedescendant (all meaningless without a popup that
    // can ever appear) and no chevron. Without the opt-in (the default), this is always
    // `false` and the normal combobox/listbox/chevron trigger renders regardless of option count.
    const isSingleOption = this.autoCommitSingleOption && navigable.length === 1;

    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.triggerId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <div class="control" ?data-clearable=${showClear}>
          <button
            id=${this.triggerId}
            part="trigger"
            type="button"
            role=${isSingleOption ? 'button' : 'combobox'}
            aria-haspopup=${isSingleOption ? nothing : 'listbox'}
            aria-expanded=${isSingleOption ? nothing : this.open ? 'true' : 'false'}
            aria-controls=${isSingleOption ? nothing : this.listId}
            aria-activedescendant=${isSingleOption ? nothing : activeId}
            aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || this.localize('select'))}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            ?disabled=${this.effectiveDisabled}
            @click=${this.onTriggerClick}
            @keydown=${this.onKeyDown}
            @focus=${this.onTriggerFocus}
            @blur=${this.onTriggerBlur}
          >
            <span part="start" ?hidden=${!this.hasStartSlot}>
              <slot name="start" @slotchange=${this.onStartSlotChange}></slot>
            </span>
            ${this.multiple && hasValue
              ? html`<span part="tags"
                  >${shownValues.map((value, index) => this.renderTag(value, index))}${overflow > 0
                    ? html`<span part="tag tag-overflow"
                        >${this.localize('selectSelectedOverflow', undefined, {
                          n: getNumberFormat(this.effectiveLocale).format(overflow),
                        })}</span
                      >`
                    : ''}</span
                >`
              : html`<span class="trigger-label" ?data-placeholder=${!hasValue}
                  >${hasValue && !this.multiple ? selectedLabel : this.placeholder}</span
                >`}
            <span part="end" ?hidden=${!this.hasEndSlot}>
              <slot name="end" @slotchange=${this.onEndSlotChange}></slot>
            </span>
            ${isSingleOption ? nothing : html`<span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>`}
          </button>
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
                ${closeIcon()}
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
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="select-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
      <slot @slotchange=${this.collectOptions} @lr-option-change=${this.onOptionChange} hidden></slot>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-select': LyraSelect;
  }
}
