import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import { nextId } from '../../../internal/a11y.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { styles } from './rubric-form.styles.js';
import type { LyraSegmentedItem } from '../../layout/segmented/segmented.class.js';
import type { LyraSelect } from '../select/select.class.js';
import '../../layout/segmented/segmented.class.js';
import '../slider/slider.class.js';
import '../select/select.class.js';
import '../combobox/option.class.js';
import '../checkbox/checkbox.class.js';
import '../checkbox-group/checkbox-group.class.js';
import '../textarea/textarea.class.js';
import {
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_noData, LYRA_DEFAULT_rubricSkip, LYRA_DEFAULT_rubricSubmit, LYRA_DEFAULT_rubricSubmitAndNext, LYRA_DEFAULT_unsupportedFieldType } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface RubricKeyOption {
  readonly value: string;
  readonly label?: string;
  readonly description?: string;
}

interface RubricKeyBase {
  readonly key: string;
  readonly label?: string;
  readonly description?: string;
  readonly required?: boolean;
}

export interface ScoreRubricKey extends RubricKeyBase {
  readonly type: 'score';
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface CategoryRubricKey extends RubricKeyBase {
  readonly type: 'category';
  readonly options?: readonly RubricKeyOption[];
  readonly multiple?: boolean;
}

export interface CommentRubricKey extends RubricKeyBase {
  readonly type: 'comment';
  readonly placeholder?: string;
}

/** Discriminated, immutable field schema; each variant exposes only meaningful configuration. */
export type RubricKey = ScoreRubricKey | CategoryRubricKey | CommentRubricKey;
export type RubricValue = Readonly<Record<string, number | string | readonly string[] | undefined>>;

const EMPTY_KEYS: readonly RubricKey[] = [];
const EMPTY_VALUE: RubricValue = {};
const MAX_RUBRIC_COLLECTION_ENTRIES = 10_000;

function cloneRubricValue(value: RubricValue): RubricValue {
  return Object.freeze(
    Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, Array.isArray(entry) ? Object.freeze([...entry]) : entry]),
  )
  );
}

function projectRubricStringArray(value: unknown): readonly string[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const length = getOwnDataDescriptor(value, 'length');
    if (
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0
    )
      return undefined;
    const values: string[] = [];
    for (let index = 0; index < Math.min(length.value, MAX_RUBRIC_COLLECTION_ENTRIES); index += 1) {
      const entry = getOwnDataDescriptor(value, String(index));
      if (entry === MISSING_OWN_DATA_DESCRIPTOR || entry === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
      if (typeof entry.value === 'string') values.push(entry.value);
    }
    return Object.freeze(values);
  } catch {
    return undefined;
  }
}

function projectRubricOptions(value: unknown): readonly RubricKeyOption[] {
  try {
    if (!Array.isArray(value)) return Object.freeze([]);
    const length = getOwnDataDescriptor(value, 'length');
    if (
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0
    )
      return Object.freeze([]);
    const options: RubricKeyOption[] = [];
    for (let index = 0; index < Math.min(length.value, MAX_RUBRIC_COLLECTION_ENTRIES); index += 1) {
      const candidate = getOwnDataDescriptor(value, String(index));
      if (
        candidate === MISSING_OWN_DATA_DESCRIPTOR ||
        candidate === UNSAFE_OWN_DATA_DESCRIPTOR ||
        candidate.value === null ||
        typeof candidate.value !== 'object' ||
        Array.isArray(candidate.value)
      )
        continue;
      const optionValue = getOwnDataDescriptor(candidate.value, 'value');
      const label = getOwnDataDescriptor(candidate.value, 'label');
      const description = getOwnDataDescriptor(candidate.value, 'description');
      if (
        optionValue === MISSING_OWN_DATA_DESCRIPTOR ||
        optionValue === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof optionValue.value !== 'string'
      )
        continue;
      const labelValue = label === MISSING_OWN_DATA_DESCRIPTOR || label === UNSAFE_OWN_DATA_DESCRIPTOR
        ? undefined
        : typeof label.value === 'string'
          ? label.value
          : undefined;
      const descriptionValue = description === MISSING_OWN_DATA_DESCRIPTOR || description === UNSAFE_OWN_DATA_DESCRIPTOR
        ? undefined
        : typeof description.value === 'string'
          ? description.value
          : undefined;
      options.push(Object.freeze({
        value: optionValue.value,
        ...(labelValue === undefined ? {} : { label: labelValue }),
        ...(descriptionValue === undefined ? {} : { description: descriptionValue }),
      }));
    }
    return Object.freeze(options);
  } catch {
    return Object.freeze([]);
  }
}

function projectRubricKey(candidate: unknown): RubricKey | undefined {
  try {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;
    const key = getOwnDataDescriptor(candidate, 'key');
    const type = getOwnDataDescriptor(candidate, 'type');
    const label = getOwnDataDescriptor(candidate, 'label');
    const description = getOwnDataDescriptor(candidate, 'description');
    const required = getOwnDataDescriptor(candidate, 'required');
    if (
      key === MISSING_OWN_DATA_DESCRIPTOR ||
      key === UNSAFE_OWN_DATA_DESCRIPTOR ||
      type === UNSAFE_OWN_DATA_DESCRIPTOR ||
      label === UNSAFE_OWN_DATA_DESCRIPTOR ||
      description === UNSAFE_OWN_DATA_DESCRIPTOR ||
      required === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof key.value !== 'string' ||
      key.value.trim().length === 0
    )
      return undefined;
    const typeValue = type === MISSING_OWN_DATA_DESCRIPTOR ? '' : type.value;
    if (typeof typeValue !== 'string') return undefined;
    const labelValue = label === MISSING_OWN_DATA_DESCRIPTOR ? undefined : label.value;
    const descriptionValue = description === MISSING_OWN_DATA_DESCRIPTOR ? undefined : description.value;
    const requiredValue = required === MISSING_OWN_DATA_DESCRIPTOR ? undefined : required.value;
    const common = {
      key: key.value,
      ...(typeof labelValue === 'string' ? { label: labelValue } : {}),
      ...(typeof descriptionValue === 'string' ? { description: descriptionValue } : {}),
      ...(typeof requiredValue === 'boolean' ? { required: requiredValue } : {}),
    };
    if (typeValue === 'score') {
      const min = getOwnDataDescriptor(candidate, 'min');
      const max = getOwnDataDescriptor(candidate, 'max');
      const step = getOwnDataDescriptor(candidate, 'step');
      if (
        min === UNSAFE_OWN_DATA_DESCRIPTOR ||
        max === UNSAFE_OWN_DATA_DESCRIPTOR ||
        step === UNSAFE_OWN_DATA_DESCRIPTOR
      )
        return undefined;
      return Object.freeze({
        ...common,
        type: 'score',
        ...(min !== MISSING_OWN_DATA_DESCRIPTOR && typeof min.value === 'number' ? { min: min.value } : {}),
        ...(max !== MISSING_OWN_DATA_DESCRIPTOR && typeof max.value === 'number' ? { max: max.value } : {}),
        ...(step !== MISSING_OWN_DATA_DESCRIPTOR && typeof step.value === 'number' ? { step: step.value } : {}),
      });
    }
    if (typeValue === 'category') {
      const options = getOwnDataDescriptor(candidate, 'options');
      const multiple = getOwnDataDescriptor(candidate, 'multiple');
      if (options === UNSAFE_OWN_DATA_DESCRIPTOR || multiple === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
      return Object.freeze({
        ...common,
        type: 'category',
        options: options === MISSING_OWN_DATA_DESCRIPTOR ? Object.freeze([]) : projectRubricOptions(options.value),
        ...(multiple !== MISSING_OWN_DATA_DESCRIPTOR && typeof multiple.value === 'boolean'
          ? { multiple: multiple.value }
          : {}),
      });
    }
    if (typeValue === 'comment') {
      const placeholder = getOwnDataDescriptor(candidate, 'placeholder');
      if (placeholder === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
      return Object.freeze({
        ...common,
        type: 'comment',
        ...(placeholder !== MISSING_OWN_DATA_DESCRIPTOR && typeof placeholder.value === 'string'
          ? { placeholder: placeholder.value }
          : {}),
      });
    }
    // Runtime callers can still violate the static discriminant. Preserve one defensive row so
    // the visible unsupported-type fallback and invalid state remain fail-closed.
    return Object.freeze({ ...common, type: typeValue } as unknown as RubricKey);
  } catch {
    return undefined;
  }
}

function normalizeRubricKeys(next: unknown): readonly RubricKey[] {
  try {
    if (!Array.isArray(next)) return EMPTY_KEYS;
    const length = getOwnDataDescriptor(next, 'length');
    if (
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0
    )
      return EMPTY_KEYS;
    const seen = new Set<string>();
    const normalized: RubricKey[] = [];
    for (let index = 0; index < Math.min(length.value, MAX_RUBRIC_COLLECTION_ENTRIES); index += 1) {
      const candidate = getOwnDataDescriptor(next, String(index));
      if (candidate === MISSING_OWN_DATA_DESCRIPTOR || candidate === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
      const key = projectRubricKey(candidate.value);
      if (!key || seen.has(key.key)) continue;
      seen.add(key.key);
      normalized.push(key);
    }
    return Object.freeze(normalized);
  } catch {
    return EMPTY_KEYS;
  }
}

function scoreDomain(key: ScoreRubricKey): { min: number; max: number; step: number;
} {
  const min = Number.isFinite(key.min) ? key.min! : 0;
  const rawMax = Number.isFinite(key.max) ? key.max! : 5;
  const max = Math.max(min, rawMax);
  const step = Number.isFinite(key.step) && key.step! > 0 ? key.step! : 1;
  return { min, max, step };
}

function isSegmentedScoreKey(key: ScoreRubricKey): boolean {
  if (key.step !== undefined && (!Number.isFinite(key.step) || key.step <= 0)) return false;
  if (Number.isFinite(key.min) && Number.isFinite(key.max) && key.max! < key.min!) return false;
  const { min, max, step } = scoreDomain(key);
  if (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(step)) return false;
  const count = (max - min) / step;
  return Number.isInteger(count) && count >= 0 && count <= 10;
}

function canonicalScore(value: unknown, key: ScoreRubricKey): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const { min, max, step } = scoreDomain(key);
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = Math.min(max, Math.max(min, min + Math.round((clamped - min) / step) * step));
  return Number(snapped.toPrecision(15));
}

function normalizeRubricValue(value: unknown, keys: readonly RubricKey[]): RubricValue {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : EMPTY_VALUE;
  const normalized: Record<string, number | string | readonly string[] | undefined> = {};
  for (const key of keys) {
    const descriptor = getOwnDataDescriptor(source, key.key);
    if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
    const hasEntry = descriptor !== MISSING_OWN_DATA_DESCRIPTOR;
    const entry = descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
    if (key.type === 'score') {
      const { min, max } = scoreDomain(key);
      const score = canonicalScore(
        hasEntry ? entry : isSegmentedScoreKey(key) ? undefined : min + (max - min) / 2,
        key,
      );
      if (score !== undefined) normalized[key.key] = score;
    } else if (key.type === 'category') {
      if (!hasEntry) continue;
      const allowed = (key.options ?? []).map((option) => option.value);
      if (key.multiple) {
        const entries = projectRubricStringArray(entry);
        if (!entries) continue;
        const remaining = new Map<string, number>();
        for (const option of allowed) remaining.set(option, (remaining.get(option) ?? 0) + 1);
        const selected: string[] = [];
        for (const candidate of entries) {
          const count = remaining.get(candidate) ?? 0;
          if (count <= 0) continue;
          selected.push(candidate);
          remaining.set(candidate, count - 1);
        }
        normalized[key.key] = selected;
      } else if (typeof entry === 'string' && entry !== '' && allowed.includes(entry)) {
        normalized[key.key] = entry;
      }
    } else if (key.type === 'comment' && hasEntry && typeof entry === 'string') {
      normalized[key.key] = entry;
    }
  }
  return normalized;
}

export interface LyraRubricFormEventMap {
  'lr-invalid': CustomEvent<null>;
  'lr-input': CustomEvent<Readonly<{ value: RubricValue }>>;
  'lr-validity-change': CustomEvent<{
    readonly valid: boolean;
    readonly errors: Readonly<Record<string, string>>;
  }>;
  'lr-submit': CustomEvent<Readonly<{ value: RubricValue; itemId: string }>>;
  'lr-skip': CustomEvent<{ itemId: string }>;
}

/**
 * `<lr-rubric-form>` — a configurable annotation rubric (LangSmith
 * annotation-queue style): score, category, and freeform-comment keys with
 * a submit-and-next flow for working through an eval queue.
 *
 * Each `RubricKey.type` routes to an existing sibling control: `score`
 * renders `<lr-segmented>` when its `[min, max]`/`step` domain has 10 or
 * fewer integer steps, or `<lr-slider>` otherwise; `category` renders
 * `<lr-select>` (single) or `<lr-checkbox-group>` (`multiple`); `comment`
 * renders `<lr-textarea>`. Both score branches format visible numeric labels with the effective
 * locale; segmented item values and submitted rubric values remain stable raw numbers/strings.
 * A key whose `type` is none of the three renders
 * a visible "Unsupported field type" note instead of silently dropping it,
 * and marks the form invalid — the same defensive shape as
 * `<lr-tool-param-form>`'s own unsupported-property fallback.
 * The exported key model is a readonly discriminated union. Live/default/restored values are
 * canonicalized once against that current schema before render, validity, events, or FormData:
 * scores clamp/snap to their domain, categories retain only declared option occurrences,
 * comments require strings, and undeclared fields are discarded. A wide slider score without a
 * supplied default records its rendered, snapped midpoint in both the default and live value;
 * segmented scores remain unselected. `defaultValue` is the explicit reset baseline; reads return
 * defensive snapshots.
 *
 * Optional native `<form>` participation is implemented via `ElementInternals`
 * attached directly (this component's value is a whole object, not a plain
 * string, so the `FormAssociated` string-value mixin doesn't fit) — the same
 * shape `<lr-tool-param-form>` uses. This is a nice-to-have layered on top
 * of the primary integration contract (`value` +
 * `lr-input`/`lr-validity-change`/`lr-submit`/`lr-skip`), not a
 * requirement: a consumer that never puts this inside a `<form>` loses
 * nothing.
 * Aggregate `label`, `hint`, and `errorText` properties have matching slots and
 * same-shadow ARIA links on the outer `base` role="group". A host `aria-label` wins by attribute
 * presence (including an explicitly empty value), while each rubric field keeps its own
 * field-level name. When `errorText` is empty, a consumer `setCustomValidity()` message is rendered
 * in the aggregate error region so a blocking whole-form error is never silent.
 *
 * @customElement lr-rubric-form
 * @slot label - Aggregate rubric label rendered before all fields.
 * @slot hint - Aggregate supporting text rendered after all fields.
 * @slot error - Aggregate validation text; supplements `errorText` or the current custom error.
 * @slot actions - Extra host controls rendered in the footer beside Submit/Skip.
 * @event lr-input - `detail: { value }` — any control changed; the full current value object.
 * @event lr-validity-change - `detail: { valid, errors }` — fired only on an actual change.
 * @event lr-submit - `detail: { value, itemId }` — Submit clicked or Ctrl/Cmd+Enter, after validity passes.
 * @event lr-skip - `detail: { itemId }` — Skip activated (`skippable` only); no validation.
 * @event lr-invalid - The complete rubric form failed a validity check. Cancelable; preventing it
 *   also prevents the native `invalid` event's default validation UI.
 * @csspart base - The outer wrapper around all fields.
 * @csspart form-control - Aggregate form-control wrapper around label, fields, hint, and error.
 * @csspart aggregate-label - Aggregate rubric label; separate from per-field `label` parts.
 * @csspart form-control-label - Shared form-control alias on the aggregate label.
 * @csspart fields - Wrapper around every rubric field or the empty state.
 * @csspart form-control-input - Shared form-control alias on the fields wrapper.
 * @csspart aggregate-hint - Aggregate supporting text; also carries `form-control-help-text`.
 * @csspart form-control-help-text - Shared form-control alias on the aggregate hint.
 * @csspart aggregate-error - Aggregate error text; also carries `form-control-error`.
 * @csspart form-control-error - Shared form-control alias on the aggregate error.
 * @csspart field - One key's wrapper (label + control + description + error).
 * @csspart label - A field's label.
 * @csspart description - A field's helper text.
 * @csspart scale - The rendered score/category/comment control's wrapper.
 * @csspart error - Ordinary field-level validation text composed into its control's accessible
 *   name/description; it is not a live region, avoiding duplicate report-validity announcements.
 * @csspart footer - The row containing the actions slot and Submit/Skip buttons.
 * @csspart submit - The Submit button.
 * @csspart skip - The Skip button (only rendered when `skippable`).
 * @csspart empty - The message shown when `keys` has no entries.
 * @csspart unsupported - The fallback note for a key whose `type` is outside the three supported ones.
 * @cssprop [--lr-rubric-form-submit-bg=var(--lr-color-brand)] - Submit-button background.
 * @cssprop [--lr-rubric-form-submit-border-color=var(--lr-color-brand)] - Submit-button border.
 * @cssprop [--lr-rubric-form-submit-color=var(--lr-color-on-brand)] - Submit-button text color.
 * @cssprop [--lr-rubric-form-submit-hover-bg=color-mix(...)] - Submit background while hovered.
 * @cssprop [--lr-rubric-form-submit-hover-border-color=color-mix(...)] - Submit border while
 * hovered.
 * @cssprop [--lr-rubric-form-submit-active-bg=color-mix(...)] - Submit background while pressed.
 * @cssprop [--lr-rubric-form-submit-active-border-color=color-mix(...)] - Submit border while
 * pressed.
 * @cssprop [--lr-rubric-form-skip-bg=var(--lr-color-surface)] - Skip-button background.
 * @cssprop [--lr-rubric-form-skip-border-color=var(--lr-color-border)] - Skip-button border.
 * @cssprop [--lr-rubric-form-skip-color=var(--lr-color-text)] - Skip-button text color.
 * @cssprop [--lr-rubric-form-skip-hover-bg=var(--lr-color-brand-quiet)] - Skip background while
 * hovered.
 * @cssprop [--lr-rubric-form-skip-active-bg=color-mix(...)] - Skip background while pressed.
 * @cssprop [--lr-form-control-required-content=' *'] - Required-field marker after rubric-owned
 *   score and unsupported-field labels. Set it to `''` to suppress the marker, or to any other
 *   quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 *   independently retunable from field errors.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and marker.
 * @cssstate required - Matches while at least one `RubricKey` is `required` — this control has no
 *   `required` property of its own, so "required" means the rubric cannot be submitted empty.
 * @cssstate optional - Matches while no key is required (the complement of `required`).
 * @cssstate valid - Matches while every required key is answered and no key has an unsupported
 *   `type`.
 * @cssstate invalid - Matches while it does not — including a pristine rubric with unanswered
 *   required keys, exactly like native `:invalid`.
 * @cssstate user-valid - `valid`, but only after the user has interacted (visited a field, or been
 *   through a `reportValidity()`/Submit attempt, which reveals every outstanding error).
 * @cssstate user-invalid - `invalid`, but only after that same interaction — a rubric nobody has
 *   touched yet is invalid without being styled as an error.
 * @status stable
 * @since 4.0.0
 */
export class LyraRubricForm extends LyraElement<LyraRubricFormEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    noData: LYRA_DEFAULT_noData,
    rubricSkip: LYRA_DEFAULT_rubricSkip,
    rubricSubmit: LYRA_DEFAULT_rubricSubmit,
    rubricSubmitAndNext: LYRA_DEFAULT_rubricSubmitAndNext,
    unsupportedFieldType: LYRA_DEFAULT_unsupportedFieldType,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    keys: { attribute: false, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    defaultValue: { attribute: false, noAccessor: true },
    itemId: { attribute: 'item-id', reflect: true, noAccessor: true },
    hasNext: { type: Boolean, attribute: 'has-next', noAccessor: true },
    skippable: { type: Boolean, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  /** Aggregate label for the complete rubric. Rich content can use the matching slot. */
  @property() label = '';
  /** Aggregate supporting text. */
  @property() hint = '';
  /** Aggregate visible error text. A consumer custom-validity message is shown when this is empty. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** SSR label-presence hint; hydrated instances also discover populated slots. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  /** SSR hint-presence hint; hydrated instances also discover populated hint/help-text slots. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;

  @state() private _errors: Record<string, string> = {};
  @state() private touchedFields = new Set<string>();
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private baseId = nextId('rubric-form');
  private aggregateLabelId = `${this.baseId}-label`;
  private aggregateHintId = `${this.baseId}-hint`;
  private aggregateErrorId = `${this.baseId}-error`;
  private _fieldsetDisabled = false;
  private _name = '';
  private _keys: readonly RubricKey[] = EMPTY_KEYS;
  private _value: RubricValue = EMPTY_VALUE;
  private _defaultValue: RubricValue = EMPTY_VALUE;
  private _valueDirty = false;
  private _itemId = '';
  private _hasNext = false;
  private _skippable = false;
  private _disabled = false;
  // Guards lr-validity-change so it only fires on an actual change, not on
  // every render -- `undefined` guarantees the first computed state always
  // "changes" from it, so mounting with an unmet required field still
  // announces `valid:false` once up front.
  private lastValidityKey: string | undefined;
  private pendingFocusFirst = false;

  constructor() {
    super();
    this.internals = this.safeAttachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init));
    this.addEventListener('keydown', this.onFormKeyDown as EventListener);
    this.syncFormState();
  }

  /** `attachInternals()` throws in any environment without a real `ElementInternals`
   *  implementation (e.g. a downstream consumer's happy-dom test suite) -- merely constructing
   *  (or importing) this component must not hard-crash there. Falls back to an inert stand-in:
   *  form participation and validity reporting are unavailable in that environment (there is no
   *  polyfillable substitute), but rendering and every non-form-associated feature keep working.
   *  Mirrors lr-graph-query-builder's identical guard. */
  private safeAttachInternals(): ElementInternals {
    if (typeof (globalThis as { ElementInternals?: unknown }).ElementInternals === 'undefined') {
      return this.inertInternals();
    }
    try {
      return this.attachInternals();
    } catch {
      return this.inertInternals();
    }
  }

  private inertInternals(): ElementInternals {
    return {
      form: null,
      labels: [] as unknown as NodeList,
      validity: {} as ValidityState,
      validationMessage: '',
      willValidate: false,
      setFormValue: () => {},
      setValidity: () => {},
      checkValidity: () => true,
      reportValidity: () => true,
      states: new Set<string>(),
    } as unknown as ElementInternals;
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  getForm(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  /** Delegates straight to `ElementInternals.labels` -- no logic of its own. */
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

  get keys(): readonly RubricKey[] {
    return this._keys;
  }
  set keys(next: readonly RubricKey[]) {
    const old = this._keys;
    this._keys = normalizeRubricKeys(next ?? EMPTY_KEYS);
    const oldDefault = this._defaultValue;
    const oldValue = this._value;
    this._defaultValue = normalizeRubricValue(this._defaultValue, this._keys);
    this._value = this._valueDirty
      ? normalizeRubricValue(this._value, this._keys)
      : cloneRubricValue(this._defaultValue);
    this.syncFormState();
    this.requestUpdate('keys', old);
    this.requestUpdate('defaultValue', oldDefault);
    this.requestUpdate('value', oldValue);
  }

  /** Canonical live structured value. Reads are defensive snapshots; writes are normalized against
   * the current discriminated schema before rendering, validity, events, and form submission. */
  get value(): RubricValue {
    return cloneRubricValue(this._value);
  }
  set value(next: RubricValue) {
    this.setLiveValue(next, true);
  }

  /** Explicit native form-reset baseline. Changing it updates pristine live state only. */
  get defaultValue(): RubricValue {
    return cloneRubricValue(this._defaultValue);
  }
  set defaultValue(next: RubricValue) {
    const old = this._defaultValue;
    this._defaultValue = normalizeRubricValue(next ?? EMPTY_VALUE, this._keys);
    if (!this._valueDirty) this.setLiveValue(this._defaultValue, false);
    this.requestUpdate('defaultValue', old);
  }

  private setLiveValue(next: unknown, dirty: boolean): void {
    const old = this._value;
    this._value = normalizeRubricValue(next ?? EMPTY_VALUE, this._keys);
    this._valueDirty = dirty;
    this.syncFormState();
    this.requestUpdate('value', old);
  }

  get itemId(): string {
    return this._itemId;
  }
  set itemId(next: string) {
    const old = this._itemId;
    this._itemId = next ?? '';
    if (old !== this._itemId) {
      this.touchedFields = new Set();
      this.syncCustomStates();
      // Only steal focus on a genuine item-to-item transition -- `hasUpdated`
      // (inherited from ReactiveElement, and still reliably `false` here: it
      // only flips to `true` inside the first `performUpdate()`, which can't
      // have run yet for a property set during upgrade/initial-template
      // commit) distinguishes that from the component's very first
      // assignment, e.g. a consumer declaring `item-id="..."` directly in
      // markup to use this as a single static form rather than a queue.
      if (this.hasUpdated) this.pendingFocusFirst = true;
    }
    if (this._itemId) this.setAttribute('item-id', this._itemId);
    else this.removeAttribute('item-id');
    this.requestUpdate('itemId', old);
  }

  get hasNext(): boolean {
    return this._hasNext;
  }
  set hasNext(next: boolean) {
    const old = this._hasNext;
    this._hasNext = Boolean(next);
    this.toggleAttribute('has-next', this._hasNext);
    this.requestUpdate('hasNext', old);
  }

  get skippable(): boolean {
    return this._skippable;
  }
  set skippable(next: boolean) {
    const old = this._skippable;
    this._skippable = Boolean(next);
    this.requestUpdate('skippable', old);
  }

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

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    // Disabling bars constraint validation, so the published validity and `:state()` hooks change
    // even though the value did not. The guard covers a setter call that lands before the
    // constructor body under a DOM shim.
    if (this.validityController) this.syncFormState();
    this.requestUpdate('disabled', old);
  }

  /** Whether the form is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /** The current effective validation errors. Intrinsic errors are keyed by their rubric key;
   *  a caller-supplied custom validity message is keyed by the whole-control `base` part. */
  get errors(): Readonly<Record<string, string>> {
    return this.publicValidityErrors();
  }

  private publicValidityErrors(): Readonly<Record<string, string>> {
    const errors: Record<string, string> = { ...this._errors };
    if (this.willValidate && this.validityController.customValidityMessage)
      errors['base'] = this.validationMessage;
    return Object.freeze(errors);
  }

  private publishValiditySnapshot(): void {
    if (!this.isConnected) return;
    const valid = !this.willValidate || this.validity.valid;
    const errors = valid ? Object.freeze({}) : this.publicValidityErrors();
    const key = JSON.stringify({ valid, errors });
    if (key === this.lastValidityKey) return;
    this.lastValidityKey = key;
    this.emit('lr-validity-change', Object.freeze({ valid, errors }));
  }

  private fieldElement(key: string): HTMLElement | null {
    const root = this.renderRoot;
    const ownerCss = this.ownerDocument.defaultView?.CSS;
    if (typeof ownerCss?.escape === 'function') {
      try {
        const candidate = root.querySelector<HTMLElement>(`[part="field"][data-key="${ownerCss.escape(key)}"]`);
        if (candidate?.getAttribute('data-key') === key) return candidate;
      } catch {
        // A partial DOM can expose CSS.escape while rejecting selector construction.
      }
    }
    return (
      Array.from(root.querySelectorAll<HTMLElement>('[part="field"][data-key]')).find(
        (candidate) => candidate.getAttribute('data-key') === key
      ) ?? null
    );
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | undefined {
    const firstInvalidKey = Object.keys(this._errors)[0];
    // `renderRoot` doesn't exist until `connectedCallback()` runs -- a `keys`/`value` assignment
    // committed while this element is still detached (e.g. as part of assembling a template
    // fragment before it's inserted into the document) must not crash here.
    if (!firstInvalidKey || !this.renderRoot) return undefined;
    const field = this.fieldElement(firstInvalidKey);
    return (
      (field?.querySelector('.control') as HTMLElement | null) ?? undefined
    );
  }

  private isSegmentedScore(k: ScoreRubricKey): boolean {
    return isSegmentedScoreKey(k);
  }

  private scoreValues(k: ScoreRubricKey): number[] {
    if (!this.isSegmentedScore(k)) return [];
    const { min, max, step } = scoreDomain(k);
    const count = Math.round((max - min) / step);
    return Array.from({ length: count + 1 }, (_, index) =>
      index === count ? max : min + index * step);
  }

  private computeValidation(): { errors: Record<string, string>; flags: ValidityStateFlags;
  } {
    const errors: Record<string, string> = {};
    const flags: ValidityStateFlags = {};
    for (const k of this._keys) {
      if (k.type !== 'score' && k.type !== 'category' && k.type !== 'comment') {
        const unsupported = k as unknown as { key: string; type: string };
        errors[unsupported.key] = this.localize('unsupportedFieldType', undefined, {
          type: unsupported.type,
        });
        flags.customError = true;
        continue;
      }
      if (!k.required) continue;
      const v = this._value[k.key];
      const present =
        k.type === 'category' && k.multiple ? Array.isArray(v) && v.length > 0 : v !== undefined && v !== '';
      if (!present) {
        errors[k.key] = this.localize('fieldRequired');
        flags.valueMissing = true;
      }
    }
    return { errors, flags };
  }

  private syncFormState(): void {
    const { errors, flags } = this.computeValidation();
    this._errors = errors;
    let formValue: string | null = null;
    try {
      formValue = JSON.stringify(this._value);
    } catch {
      formValue = null;
    }
    this.internals.setFormValue(formValue, formValue);
    if (this.barredFromValidation || Object.keys(flags).length === 0) {
      this.validityController.setValidity({});
    } else {
      const message = Object.values(errors)[0] ?? '';
      this.validityController.setValidity(flags, message);
    }
    this.syncCustomStates();
    this.publishValiditySnapshot();
  }

  /**
   * Shared with every other form control in the library: own `disabled` and a `<fieldset disabled>`
   * ancestor both bar constraint validation, so a barred rubric reports no failure and publishes
   * neither `:state(invalid)` nor `:state(user-invalid)` — see `internal/custom-states.ts`.
   */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  /**
   * Publishes the six validity custom states (`:state(required)`/`optional`, `valid`/`invalid`,
   * `user-valid`/`user-invalid`) through the shared helper in `internal/custom-states.ts` — this
   * component attaches `ElementInternals` directly (its value is a whole object, which the
   * string-value `FormAssociated` mixin cannot carry), so it calls that helper itself rather than
   * inheriting the call.
   *
   * Two mappings are specific to a multi-field rubric. `required` is not a property here but a
   * per-key flag, so the host is `:state(required)` exactly when at least one of its keys is —
   * i.e. when the rubric cannot be submitted empty. And "the user has interacted" is
   * `touchedFields` being non-empty: any field visited, or a `reportValidity()`/submit attempt,
   * which reveals every outstanding error at once.
   */
  private syncCustomStates(): void {
    syncValidityStates(this.internals, {
      required: this._keys.some((key) => Boolean(key.required)),
      hasInteracted: this.touchedFields.size > 0,
      barred: this.barredFromValidation,
    });
  }

  /** Resynchronizes validity without revealing inline errors. */
  checkValidity(): boolean {
    this.syncFormState();
    return this.internals.checkValidity();
  }

  /**
   * Reveals every current field error (as if each field had been visited)
   * and returns overall validity -- the hook Submit calls before acting,
   * mirroring a native `<form>`'s `reportValidity()`.
   */
  reportValidity(): boolean {
    this.syncFormState();
    if (Object.keys(this._errors).length > 0) {
      this.touchedFields = new Set([...this.touchedFields, ...Object.keys(this._errors)]);
      // Re-published after the reveal, not before: `syncFormState()` above ran while the rubric
      // was still pristine, so `user-invalid` would otherwise stay off until the next edit.
      this.syncCustomStates();
    }
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("this item was already annotated by someone else") that no per-key rule can
   * express. A non-empty `message` raises `customError` and becomes `validationMessage`, so the
   * rubric fails `checkValidity()`, blocks form submission, and matches `:state(invalid)`; `''`
   * clears it.
   *
   * Clearing restores the rubric's own computed validity rather than forcing it valid: unanswered
   * required keys (and any key with an unsupported `type`) still hold it invalid. The custom error
   * also survives every intrinsic recomputation in between (each `value`/`keys` write re-runs
   * `syncFormState()`) and a form reset, exactly like a native control — only another
   * `setCustomValidity('')` clears it.
   *
   * The message is form-level and is exposed as `errors.base`, keyed to this control's `base`
   * part. It is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncCustomStates();
    this.publishValiditySnapshot();
    this.requestUpdate();
  }

  formResetCallback(): void {
    this.setLiveValue(this._defaultValue, false);
    // Pristine again, so the `user-*` states stop matching even though a rubric with required keys
    // is immediately invalid once more. Ordered after the `value` write (which runs
    // `syncFormState()`), so the republish below sees the cleared set.
    this.touchedFields = new Set();
    this.syncCustomStates();
  }
  formStateRestoreCallback(state: string | File | FormData | null, _mode?: 'restore' | 'autocomplete'): void {
    let restored: RubricValue = {};
    if (typeof state === 'string') {
      try {
        const parsed: unknown = JSON.parse(state);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) restored = parsed as RubricValue;
      } catch {
        // Invalid persisted state restores the safe empty object.
      }
    }
    this.setLiveValue(restored, true);
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.syncFormState();
    this.requestUpdate();
  }

  private onFormKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.submit();
    }
  };

  private setFieldValue(key: string, val: number | string | string[]): void {
    if (this.effectiveDisabled) return;
    this.value = { ...this._value, [key]: val };
    this.emit('lr-input',
      Object.freeze({ value: cloneRubricValue(this._value) })
    );
  }

  private stopChildEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private onAggregateSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const populated = slot.assignedNodes({ flatten: true }).some(
      (node) => node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()),
    );
    if (slot.name === 'label') this.hasLabelSlot = populated;
    else if (slot.name === 'hint') this.hasHintSlot = populated;
    else if (slot.name === 'error') this.hasErrorSlot = populated;
  };

  private markTouched(key: string): void {
    if (this.effectiveDisabled || this.touchedFields.has(key)) return;
    this.touchedFields = new Set(this.touchedFields).add(key);
    // The first visited field is what turns the `user-*` states on, and it has to happen
    // synchronously — `:state(user-invalid)` must be true the instant that field reports.
    this.syncCustomStates();
  }

  private submit(): void {
    if (this.effectiveDisabled) return;
    if (!this.reportValidity()) return;
    this.emit('lr-submit',
      Object.freeze({ value: cloneRubricValue(this._value), itemId: this.itemId })
    );
  }

  private skip(): void {
    if (this.effectiveDisabled) return;
    this.emit('lr-skip', { itemId: this.itemId });
  }

  private focusFirstControl(): void {
    const firstKey = this._keys[0];
    if (!firstKey) return;
    const field = this.fieldElement(firstKey.key);
    const control = field?.querySelector('.control') as
      | (HTMLElement & { shadowRoot?: ShadowRoot | null }) | null;
    if (!control) return;
    if (firstKey.type === 'score' && this.isSegmentedScore(firstKey)) {
      (control.shadowRoot?.querySelector('[part="segment"][tabindex="0"]') as HTMLElement | null)?.focus();
    } else if (firstKey.type === 'score') {
      (control.shadowRoot?.querySelector('[part="thumb"]') as HTMLElement | null)?.focus();
    } else if (firstKey.type === 'category' && firstKey.multiple) {
      (control.querySelector('lr-checkbox') as HTMLElement | null)?.focus();
    } else {
      control.focus();
    }
  }

  /** Forwards host clicks to the first rendered field, so programmatic and `<label>`-driven
   *  interactions target the active rubric field. */
  override click(): void {
    if (this.effectiveDisabled) return;
    this.focusFirstControl();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.publishValiditySnapshot();
      if (this.pendingFocusFirst) {
      this.pendingFocusFirst = false;
      this.focusFirstControl();
    }
  }

  private renderScoreControl(k: ScoreRubricKey, fieldId: string, current: unknown, hasError: boolean): TemplateResult {
    const { min, max, step } = scoreDomain(k);
    const disabled = this.effectiveDisabled;
    // Slider/segmented own their roles inside their own shadow roots, so the
    // rubric's outer sibling description/error cannot describe those roles
    // through an idref. Include that context in the composed control's own
    // accessible label while retaining the visible outer field chrome.
    const accessibleLabel = [k.label ?? k.key, k.description, hasError ? this._errors[k.key] : undefined]
      .filter((value): value is string => Boolean(value))
      .join('. ');
    if (this.isSegmentedScore(k)) {
      const numberFormat = getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 20 });
      const items: LyraSegmentedItem[] = this.scoreValues(k).map((score) => ({
        value: String(score),
        label: numberFormat.format(score),
        disabled,
      }));
      const value = typeof current === 'number' ? String(current) : '';
      return html`<lr-segmented
        id=${fieldId}
        class="control"
        part="scale"
        size="s"
        .items=${items}
        .value=${value}
        label=${accessibleLabel}
        @lr-input=${this.stopChildEvent}
        @lr-change=${(e: CustomEvent<{ value: string }>) => {
          e.stopPropagation();
          this.setFieldValue(k.key, Number(e.detail.value));
        }}
      ></lr-segmented>`;
    }
    const numeric = typeof current === 'number' ? current : min + (max - min) / 2;
    return html`<lr-slider
      id=${fieldId}
      class="control"
      part="scale"
      min=${min}
      max=${max}
      step=${step}
      show-value
      aria-label=${accessibleLabel}
      .value=${numeric}
      ?disabled=${disabled}
      @input=${this.stopChildEvent}
      @change=${this.stopChildEvent}
      @lr-input=${this.stopChildEvent}
      @lr-change=${(e: CustomEvent<{ value: number }>) => {
        e.stopPropagation();
        this.setFieldValue(k.key, e.detail.value);
      }}
    ></lr-slider>`;
  }

  private renderCategoryControl(k: CategoryRubricKey, fieldId: string, current: unknown, hasError: boolean): TemplateResult {
    const options = k.options ?? [];
    const disabled = this.effectiveDisabled;
    const label = k.label ?? k.key;
    const description = k.description ? html`<span slot="hint" part="description">${k.description}</span>` : nothing;
    const error = hasError ? html`<span slot="error" part="error">${this._errors[k.key]}</span>` : nothing;
    if (k.multiple) {
      const selected: readonly string[] = Array.isArray(current) ? (current as string[])
        : [];
      return html`<lr-checkbox-group
        id=${fieldId}
        class="control"
        part="scale"
        ?disabled=${disabled}
        ?required=${Boolean(k.required)}
        @input=${this.stopChildEvent}
        @change=${this.stopChildEvent}
        @lr-input=${this.stopChildEvent}
        @lr-change=${(e: CustomEvent<{ value: string[] }>) => {
          e.stopPropagation();
          this.setFieldValue(k.key, e.detail.value);
        }}
      >
        <span slot="label" part="label">${label}</span>
        ${description} ${error}
        ${options.map(
          (opt) =>
            html`<lr-checkbox value=${opt.value} ?checked=${selected.includes(opt.value)} ?disabled=${disabled}
              ><span
                >${opt.label ?? opt.value}${opt.description
                  ? html`<small class="option-description">${opt.description}</small>`
                  : nothing}</span
              ></lr-checkbox
            >`
        )}
      </lr-checkbox-group>`;
    }
    const value = typeof current === 'string' ? current : '';
    return html`<lr-select
      id=${fieldId}
      class="control"
      part="scale"
      .value=${value}
      ?disabled=${disabled}
      ?required=${Boolean(k.required)}
      @input=${this.stopChildEvent}
      @change=${(e: Event) => {
        e.stopPropagation();
        this.setFieldValue(k.key, (e.target as LyraSelect).value);
      }}
      @lr-input=${this.stopChildEvent}
      @lr-change=${this.stopChildEvent}
    >
      <span slot="label" part="label">${label}</span>
      ${description} ${error}
      ${options.map(
        (opt) => html`<lr-option value=${opt.value} .sub=${opt.description ?? ''}>${opt.label ?? opt.value}</lr-option>`
      )}
    </lr-select>`;
  }

  private renderCommentControl(k: CommentRubricKey, fieldId: string, current: unknown, hasError: boolean): TemplateResult {
    const value = typeof current === 'string' ? current : '';
    const label = k.label ?? k.key;
    return html`<lr-textarea
      id=${fieldId}
      class="control"
      part="scale"
      placeholder=${k.placeholder ?? ''}
      .value=${value}
      ?disabled=${this.effectiveDisabled}
      ?required=${Boolean(k.required)}
      @input=${this.stopChildEvent}
      @change=${this.stopChildEvent}
      @lr-change=${this.stopChildEvent}
      @lr-input=${(e: CustomEvent<{ value: string }>) => {
        e.stopPropagation();
        this.setFieldValue(k.key, e.detail.value);
      }}
    >
      <span slot="label" part="label">${label}</span>
      ${k.description ? html`<span slot="hint" part="description">${k.description}</span>` : nothing}
      ${hasError ? html`<span slot="error" part="error">${this._errors[k.key]}</span>` : nothing}
    </lr-textarea>`;
  }

  private renderField(k: RubricKey, index: number): TemplateResult {
    const fieldId = `${this.baseId}-f${index}`;
    const required = Boolean(k.required);
    const ownsFieldLabel = k.type !== 'category' && k.type !== 'comment';
    const hasError = this.touchedFields.has(k.key) && Boolean(this._errors[k.key]);
    const errId = hasError ? `${fieldId}-err` : '';
    const label = k.label ?? k.key;
    const current = this._value[k.key];

    let control: TemplateResult;
    if (k.type === 'score') control = this.renderScoreControl(k, fieldId, current, hasError);
    else if (k.type === 'category') control = this.renderCategoryControl(k, fieldId, current, hasError);
    else if (k.type === 'comment') control = this.renderCommentControl(k, fieldId, current, hasError);
    else {
      control = html`<p part="unsupported" id=${fieldId}>${this.localize('unsupportedFieldType', undefined, {
          type: String((k as { type: string }).type),
        })}</p>`;
    }

    return html`
      <div
        part="field"
        data-key=${k.key}
        ?data-required=${ownsFieldLabel && required}
        @focusout=${() => this.markTouched(k.key)}
      >
        ${ownsFieldLabel
          ? html`<label part="label" for=${fieldId}>${label}</label>`
          : nothing}
        ${control} ${k.type === 'score' && k.description ? html`<p part="description">${k.description}</p>` : nothing}
        ${k.type === 'score' && hasError ? html`<p part="error" id=${errId}>${this._errors[k.key]}</p>` : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const hasLabel = this.withLabel || this.hasLabelSlot || this.label.length > 0;
    const hasHint =
      this.withHint ||
      this.hasHintSlot ||
      this.hint.length > 0;
    const aggregateError = this.errorText || this.customError || '';
    const hasError = this.hasErrorSlot || aggregateError.length > 0;
    const hostLabel = this.getAttribute('aria-label');
    const describedBy = [
      hasHint ? this.aggregateHintId : '',
      hasError ? this.aggregateErrorId : '',
    ].filter(Boolean).join(' ');
    return html`
      <div
        part="base"
        role="group"
        aria-label=${hostLabel ?? nothing}
        aria-labelledby=${hostLabel === null && hasLabel ? this.aggregateLabelId : nothing}
        aria-describedby=${describedBy || nothing}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        aria-invalid=${this.internals.validity.valid ? 'false' : 'true'}
      >
        <div part="form-control">
          <div
            id=${this.aggregateLabelId}
            part="aggregate-label form-control-label"
            ?hidden=${!hasLabel}
          >
            ${this.label}<slot name="label" @slotchange=${this.onAggregateSlotChange}></slot>
          </div>
          <div part="fields form-control-input">
            ${this._keys.length === 0
              ? html`<p part="empty">${this.localize('noData')}</p>`
              : repeat(
                  (() => {
                    const occurrences = new Map<string, number>();
                    return this._keys.map((key, index) => {
                      const occurrence = occurrences.get(key.key) ?? 0;
                      occurrences.set(key.key, occurrence + 1);
                      return { key, index, identity: `${key.key}\u0000${occurrence}` };
                    });
                  })(),
                  (entry) => entry.identity,
                  (entry) => this.renderField(entry.key, entry.index),
                )}
          </div>
          <div
            id=${this.aggregateHintId}
            part="aggregate-hint form-control-help-text"
            ?hidden=${!hasHint}
          >
            ${this.hint}<slot name="hint" @slotchange=${this.onAggregateSlotChange}></slot>
          </div>
          <div
            id=${this.aggregateErrorId}
            part="aggregate-error form-control-error"
            ?hidden=${!hasError}
          >
            ${aggregateError}<slot name="error" @slotchange=${this.onAggregateSlotChange}></slot>
          </div>
        </div>
        ${this._keys.length > 0
          ? html`<div part="footer">
              <slot name="actions"></slot>
              ${this._skippable
                ? html`<button part="skip" type="button" ?disabled=${this.effectiveDisabled} @click=${() => this.skip()}>
                    ${this.localize('rubricSkip')}
                  </button>`
                : nothing}
              <button part="submit" type="button" ?disabled=${this.effectiveDisabled} @click=${() => this.submit()}>
                ${this.localize(this._hasNext ? 'rubricSubmitAndNext' : 'rubricSubmit')}
              </button>
            </div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-rubric-form': LyraRubricForm;
  }
}
