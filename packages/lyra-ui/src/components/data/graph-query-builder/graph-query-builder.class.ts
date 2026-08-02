import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { closeIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { nextId } from '../../../internal/a11y.js';
import { styles } from './graph-query-builder.styles.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import '../../forms/select/select.class.js';
import '../../forms/combobox/option.class.js';
import '../../forms/input/input.class.js';
import '../../overlays/chip/chip.class.js';
import '../../overlays/chip/chip-group.class.js';
import {
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';

/** Traversal direction relative to the matched node(s): `'out'` (outgoing edges), `'in'`
 *  (incoming edges), or `'both'`. */
export type GraphQueryDirection = 'out' | 'in' | 'both';

/** One pickable relationship or node type, as offered to this component's type pickers via
 *  `relationshipTypeOptions`/`nodeTypeOptions`. */
export interface GraphQueryTypeOption {
  value: string;
  /** Display label. Falls back to `value` when omitted. */
  label?: string;
}

/**
 * The serializable query model this component builds and edits -- a single typed relationship/
 * path filter over a knowledge graph, suitable for handing directly to a GraphRAG retrieval or
 * traversal backend. `startId`/`endId` anchor the path (`endId` left empty means "any reachable
 * node" rather than a specific target); `relationshipTypes`/`nodeTypes` constrain which edges/
 * nodes the traversal may pass through (empty arrays mean "any type"); `direction` constrains
 * edge traversal direction; `minHops`/`maxHops` bound the path length, mirroring a graph query
 * language's variable-length path syntax (e.g. Cypher's `-[:REL*1..3]->`).
 *
 * This is deliberately a **flat** shape, not a nested boolean filter tree: a GraphRAG relationship
 * -path query composes by union ("traverse `worksFor` OR `foundedBy`, through `Person` or
 * `Organization` nodes, 1 to 3 hops out from this entity") rather than by nested AND/OR groups --
 * every array field here is implicitly OR'd, and there is exactly one path per query. A branching
 * multi-path/subgraph-pattern query is a different, considerably heavier feature and out of scope.
 */
export interface GraphQuery {
  /** The anchor entity id the traversal starts from. Required for the query to be valid/runnable
   *  -- see `checkValidity()`. */
  startId: string;
  /** An optional specific target entity id ("find a path to this node"). Empty means any
   *  reachable node satisfying the other filters. */
  endId: string;
  /** Relationship (edge) type values to traverse. Empty means any relationship type. */
  relationshipTypes: string[];
  /** Node type values the traversal may pass through. Empty means any node type. */
  nodeTypes: string[];
  direction: GraphQueryDirection;
  /** Minimum path length, inclusive. */
  minHops: number;
  /** Maximum path length, inclusive. Must be `>= minHops` -- see `checkValidity()`. */
  maxHops: number;
}

/** One named, host-persisted query. `id` is assigned by the host (e.g. on `lr-query-save`) --
 *  this component never generates ids itself, the same controlled-list convention every other
 *  Lyra component with a host-owned collection follows. */
export interface GraphQuerySavedItem {
  id: string;
  name: string;
  query: GraphQuery;
}

const EMPTY_VALUE: GraphQuery = {
  startId: '',
  endId: '',
  relationshipTypes: [],
  nodeTypes: [],
  direction: 'both',
  minHops: 1,
  maxHops: 1,
};
const EMPTY_OPTIONS: GraphQueryTypeOption[] = [];
const EMPTY_SAVED: GraphQuerySavedItem[] = [];

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))];
}

function normalizeGraphQuery(value: unknown): GraphQuery {
  const record =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const direction = record['direction'];
  return {
    startId: typeof record['startId'] === 'string' ? record['startId'] : '',
    endId: typeof record['endId'] === 'string' ? record['endId'] : '',
    relationshipTypes: stringArray(record['relationshipTypes']),
    nodeTypes: stringArray(record['nodeTypes']),
    direction: direction === 'out' || direction === 'in' || direction === 'both' ? direction : 'both',
    minHops: finiteInteger(
      typeof record['minHops'] === 'number' ? record['minHops'] : EMPTY_VALUE.minHops,
      EMPTY_VALUE.minHops,
      1,
      20,
    ),
    maxHops: finiteInteger(
      typeof record['maxHops'] === 'number' ? record['maxHops'] : EMPTY_VALUE.maxHops,
      EMPTY_VALUE.maxHops,
      1,
      20,
    ),
  };
}

export interface LyraGraphQueryBuilderEventMap {
  'lr-invalid': CustomEvent<undefined>;
  'lr-input': CustomEvent<{ value: GraphQuery }>;
  'lr-validity-change': CustomEvent<{ valid: boolean; errors: Record<string, string> }>;
  'lr-query-run': CustomEvent<{ query: GraphQuery }>;
  'lr-query-save': CustomEvent<{ name: string; query: GraphQuery }>;
  'lr-query-load': CustomEvent<{ id: string; query: GraphQuery }>;
  'lr-query-delete': CustomEvent<{ id: string }>;
}

/**
 * `<lr-graph-query-builder>` — an editor for a single typed relationship/path filter
 * (`GraphQuery`) over a knowledge graph: start/end entity anchors, relationship-type and
 * node-type pickers with a removable active-filter chip display, a traversal direction, a
 * min/max hop range, validation, and a host-persisted saved-query list -- a serializable query
 * model for GraphRAG workflows (feed the `value`/`lr-query-run` payload straight to a retrieval
 * or traversal backend).
 *
 * Composes `<lr-select>` for every closed-choice picker (relationship type, node type,
 * direction, hop counts) and `<lr-input>` for the free-text entity ids -- the relationship/
 * node-type pickers are "add" selects: choosing an option appends it to the corresponding
 * array and the picker itself resets to its placeholder, so the *current* selection is shown
 * separately as a row of removable `<lr-chip>`s inside an `<lr-chip-group>` (click a chip's
 * remove button to drop that one type). A type value present in `value` but missing from
 * `relationshipTypeOptions`/`nodeTypeOptions` (e.g. a saved query referencing a type that was
 * since renamed/removed from the picker's own option list) still renders as a chip, labeled with
 * its raw value, rather than being silently dropped.
 *
 * **Query model placement:** `GraphQuery` is kept local to this component rather than promoted
 * to the shared `src/ai/types.ts` surface. Unlike that module's types (`ChatMessage`,
 * `Citation`, `RetrievalQuery`, etc.), which each mirror a shape multiple existing primitives
 * already consume, `GraphQuery` is specific to this component's own editable-filter-set shape
 * (its `minHops`/`maxHops` selects, its "add picker + chip list" editing idiom) -- no other
 * component reads or produces this exact shape today. This mirrors `<lr-rubric-form>`'s
 * `RubricValue`/`RubricKey` and `<lr-tool-param-form>`'s `ToolParamFormSchema`, both also kept
 * local to their own component for the identical reason.
 *
 * **Form association:** every other "structured, non-string value" editor in this package that
 * looks like this one -- `<lr-rubric-form>`, `<lr-tool-param-form>`, `<lr-time-range>` -- attaches
 * `ElementInternals` directly (the `FormAssociated` mixin only fits a plain string value) and
 * treats native `<form>` participation as a nice-to-have layered on top of its primary
 * `value`/`lr-input`/`lr-validity-change` integration contract, not a requirement. This component
 * follows that same established convention: `value` round-trips through `JSON.stringify()` as the
 * submitted form value, and a consumer that never places this inside a `<form>` loses nothing.
 *
 * **Accessible name:** the region (`role="group"`) is named by, in order, a host-level
 * `aria-label` attribute, the `label` property, or the localized `graphQueryBuilderLabel` default
 * -- mirroring `<lr-query-builder>`'s identical `role="group"` region, whose own `aria-label`
 * attribute similarly wins over its internal default.
 *
 * @customElement lr-graph-query-builder
 * @slot actions - Extra host controls rendered in the footer beside the Run button.
 * @slot label - Visible label for the complete form control.
 * @slot hint - Supporting text for the complete form control.
 * @slot error - Error text for the complete form control.
 * @event lr-input - `detail: { value }` — any field changed; the full current query.
 * @event lr-validity-change - `detail: { valid, errors }` — fired only on an actual change.
 * @event lr-query-run - The Run button was activated and `reportValidity()` passed. `detail: { query }`.
 * @event lr-query-save - The Save button was activated with a non-empty name. `detail: { name, query }`
 * — the host is responsible for assigning an id and appending the entry to `savedQueries`.
 * @event lr-query-load - A saved query's Load button was activated (`value` has already been
 * replaced with it by the time this fires). `detail: { id, query }`.
 * @event lr-query-delete - A saved query's delete button was activated. `detail: { id }` — the
 * host is responsible for removing the matching entry from `savedQueries`.
 * @event lr-invalid - The complete query builder failed a validity check.
 * @csspart base - The outer wrapper around every section.
 * @csspart label - Visible label for the complete form control.
 * @csspart hint - Supporting text for the complete form control.
 * @csspart error - Error text for the complete form control.
 * @csspart path-fields - The row wrapping the start/end entity inputs and hop-count selects.
 * @csspart start-input - The start-entity `<lr-input>`.
 * @csspart end-input - The end-entity `<lr-input>`.
 * @csspart min-hops - The minimum-hops `<lr-select>`.
 * @csspart max-hops - The maximum-hops `<lr-select>`.
 * @csspart filter-group - One type-filter section (relationship or node type); rendered twice.
 * @csspart relationship-picker - The "add a relationship type" `<lr-select>`.
 * @csspart relationship-chips - The `<lr-chip-group>` listing currently active relationship types.
 * @csspart node-type-picker - The "add a node type" `<lr-select>`.
 * @csspart node-type-chips - The `<lr-chip-group>` listing currently active node types.
 * @csspart direction - The traversal-direction `<lr-select>`.
 * @csspart footer - The row containing the actions slot and the Run button.
 * @csspart run-button - The Run button.
 * @csspart saved-queries - The wrapper around the save row and the saved-query list.
 * @csspart saved-queries-label - The saved-queries section heading.
 * @csspart save-row - The row containing the save-name input and Save button.
 * @csspart save-name-input - The new-saved-query name `<lr-input>`.
 * @csspart save-button - The Save button.
 * @csspart saved-empty - The message shown when `savedQueries` has no entries.
 * @csspart saved-list - The list of saved queries.
 * @csspart saved-item - One saved query's row.
 * @csspart saved-load-button - A saved query row's Load button.
 * @csspart saved-delete-button - A saved query row's delete button.
 * @cssstate required - Always matches. This control's one constraint is unconditional — a query
 * with no start anchor is not runnable — so it always demands something of the user, which is what
 * `lr-graph-query-builder:state(required)` asks.
 * @cssstate optional - Never matches, for the same reason: the complement of `required`.
 * @cssstate valid - Matches while the query satisfies both constraints (a non-empty `startId` and
 * `minHops <= maxHops`), whether or not the user has touched anything.
 * @cssstate invalid - Matches while it does not — from the very first render, before any
 * interaction, since an empty query has no start anchor.
 * @cssstate user-valid - `valid`, and the user has interacted: an edit to any field, a blur of the
 * start-entity input, or a `reportValidity()` call (which is what the Run button runs).
 * @cssstate user-invalid - `invalid` after that same interaction. A pristine empty query is
 * invalid but deliberately does not match this, so a consumer's `:state(user-invalid)` styling
 * cannot paint the form red before the user has typed anything. A form reset makes it pristine
 * again.
 * @status stable
 * @since 4.1.0
 */
export class LyraGraphQueryBuilder extends LyraElement<LyraGraphQueryBuilderEventMap> {
  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  /** Pickable relationship types offered by the relationship-type "add" picker. */
  @property({ attribute: false }) relationshipTypeOptions: GraphQueryTypeOption[] = EMPTY_OPTIONS;
  /** Pickable node types offered by the node-type "add" picker. */
  @property({ attribute: false }) nodeTypeOptions: GraphQueryTypeOption[] = EMPTY_OPTIONS;
  /** Host-persisted saved queries. Controlled -- this component never mutates this array itself,
   *  it only emits `lr-query-save`/`lr-query-delete` requests for the host to act on. */
  @property({ attribute: false }) savedQueries: GraphQuerySavedItem[] = EMPTY_SAVED;
  /** Upper bound (inclusive) offered by the minimum/maximum hop selects. Sanitized to a finite
   *  integer in `[1, 20]`, falling back to `6`. */
  @property({ attribute: 'hop-limit', type: Number }) hopLimit = 6;
  /** Accessible name for the whole component; falls back to the localized `graphQueryBuilderLabel`.
   *  A host-level `aria-label` attribute wins over both this property and the localized default --
   *  see the class doc's "Accessible name" note. */
  @property() label = '';
  /** Supporting text rendered below the outer label. */
  @property() hint = '';
  /** Caller-supplied outer error text. Field-level validation remains on the affected controls. */
  @property({ attribute: 'error-text' }) errorText = '';

  @state() private _errors: Record<string, string> = {};
  @state() private touchedFields = new Set<string>();
  @state() private saveName = '';
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;

  private readonly labelId = nextId('graph-query-builder-label');
  private readonly hintId = nextId('graph-query-builder-hint');
  private readonly errorId = nextId('graph-query-builder-error');

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private _fieldsetDisabled = false;
  private _name = '';
  private _value: GraphQuery = EMPTY_VALUE;
  private _disabled = false;
  // Drives the user-valid/user-invalid pair: an empty required query is invalid from the first
  // render, but styling it red before the user has done anything is hostile.
  private hasInteracted = false;
  // Guards lr-validity-change so it only fires on an actual change -- `undefined` guarantees the
  // first computed state always "changes" from it, mirroring lr-rubric-form's identical guard.
  private lastValidityKey: string | undefined;

  constructor() {
    super();
    this.internals = this.safeAttachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, () => this.emit('lr-invalid'));
    this.syncFormState();
  }

  /** `attachInternals()` throws in any environment without a real `ElementInternals`
   *  implementation (e.g. a downstream consumer's happy-dom test suite) -- merely constructing
   *  (or importing) this component must not hard-crash there. Falls back to an inert stand-in:
   *  form participation and validity reporting are unavailable in that environment (there is no
   *  polyfillable substitute), but rendering and every non-form-associated feature keep working. */
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

  get value(): GraphQuery {
    return this._value;
  }
  set value(next: GraphQuery) {
    const old = this._value;
    this._value = normalizeGraphQuery(next);
    this.syncFormState();
    this.requestUpdate('value', old);
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

  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /** The current validation errors, keyed by the csspart name of the field they apply to
   *  (`'start-input'` | `'max-hops'`). Mirrors the last `lr-validity-change` event's `errors`. */
  get errors(): Record<string, string> {
    return { ...this._errors };
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | undefined {
    const firstInvalidPart = Object.keys(this._errors)[0];
    if (!firstInvalidPart || !this.renderRoot) return undefined;
    return (this.renderRoot.querySelector(`[part="${firstInvalidPart}"]`) as HTMLElement | null) ?? undefined;
  }

  private computeValidation(): { errors: Record<string, string>; flags: ValidityStateFlags } {
    const errors: Record<string, string> = {};
    const flags: ValidityStateFlags = {};
    if (!this._value.startId.trim()) {
      errors['start-input'] = this.localize('fieldRequired');
      flags.valueMissing = true;
    }
    if (this._value.minHops > this._value.maxHops) {
      errors['max-hops'] = this.localize('graphQueryHopRangeInvalid');
      flags.rangeUnderflow = true;
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
    this.syncValidityCustomStates();
  }

  /**
   * Shared with every other form control in the library: own `disabled` and a `<fieldset disabled>`
   * ancestor both bar constraint validation, so a barred builder reports no failure and publishes
   * neither `:state(invalid)` nor `:state(user-invalid)` — see `internal/custom-states.ts`.
   */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  /**
   * Republishes the six `:state()` validity hooks — see `internal/custom-states.ts`. Called from
   * `syncFormState()` (so every validity recomputation carries them) and from `markTouched()`, the
   * one interaction that changes the answer without touching validity.
   *
   * `required` is unconditional: this control has no `required` property to key off because its one
   * constraint never lifts — `computeValidation()` always raises `valueMissing` for an empty
   * `startId`, since a path query with no anchor is not runnable.
   */
  private syncValidityCustomStates(): void {
    syncValidityStates(this.internals, {
      required: true,
      hasInteracted: this.hasInteracted,
      barred: this.barredFromValidation,
    });
  }

  /** Resynchronizes validity without revealing inline errors. */
  checkValidity(): boolean {
    this.syncFormState();
    return this.internals.checkValidity();
  }

  /** Reveals every current field error and returns overall validity -- the hook Run calls before
   *  acting, mirroring a native `<form>`'s `reportValidity()`. */
  reportValidity(): boolean {
    // A reportValidity() call is what a submit attempt (here, the Run button) runs, so it counts as
    // interaction for the user-valid/user-invalid pair — set before syncFormState(), which is what
    // republishes them.
    this.hasInteracted = true;
    this.syncFormState();
    if (Object.keys(this._errors).length > 0) {
      this.touchedFields = new Set([...this.touchedFields, ...Object.keys(this._errors)]);
    }
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("no graph is loaded for that tenant") that neither of this control's own two
   * constraints can express. A non-empty `message` raises `customError` and becomes
   * `validationMessage`, so the builder fails `checkValidity()`, blocks submission, and matches
   * `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a query
   * with no `startId` stays `valueMissing`. The custom error also survives every intrinsic
   * recomputation in between (each field edit re-runs `syncFormState()`) and a `form.reset()` —
   * matching a native control, where only another `setCustomValidity('')` clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here. It is
   * whole-control state and deliberately does not land in `errors`, which is keyed by the csspart
   * of the field a message belongs to.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncValidityCustomStates();
  }

  formResetCallback(): void {
    // Cleared before the `value` assignment below, whose setter is what republishes the custom
    // states — a reset control is pristine again, so user-valid/user-invalid must drop off it.
    this.hasInteracted = false;
    this.value = EMPTY_VALUE;
    this.touchedFields = new Set();
    this.saveName = '';
  }
  formStateRestoreCallback(state: string | File | FormData | null, _mode?: 'restore' | 'autocomplete'): void {
    let restored: GraphQuery = EMPTY_VALUE;
    if (typeof state === 'string') {
      try {
        const parsed: unknown = JSON.parse(state);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          restored = normalizeGraphQuery(parsed);
        }
      } catch {
        // Invalid persisted state restores the safe empty value.
      }
    }
    this.value = restored;
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.syncFormState();
    this.requestUpdate();
  }

  private setValue(next: GraphQuery): void {
    if (this.effectiveDisabled) return;
    // Set before the `value` assignment, whose setter republishes the custom states.
    this.hasInteracted = true;
    this.value = next;
    this.emit('lr-input', { value: { ...this._value } });
  }

  private addRelationshipType(type: string): void {
    if (!type || this._value.relationshipTypes.includes(type)) return;
    this.setValue({ ...this._value, relationshipTypes: [...this._value.relationshipTypes, type] });
  }
  private removeRelationshipType(type: string): void {
    this.setValue({ ...this._value, relationshipTypes: this._value.relationshipTypes.filter((t) => t !== type) });
  }
  private addNodeType(type: string): void {
    if (!type || this._value.nodeTypes.includes(type)) return;
    this.setValue({ ...this._value, nodeTypes: [...this._value.nodeTypes, type] });
  }
  private removeNodeType(type: string): void {
    this.setValue({ ...this._value, nodeTypes: this._value.nodeTypes.filter((t) => t !== type) });
  }

  private markTouched(part: string): void {
    // Leaving a field is interaction even if the user changed nothing, so this runs before the
    // early return below — and republishes explicitly, since nothing here touches validity.
    this.hasInteracted = true;
    this.syncValidityCustomStates();
    if (this.touchedFields.has(part)) return;
    this.touchedFields = new Set(this.touchedFields).add(part);
  }

  private runQuery(): void {
    if (this.effectiveDisabled) return;
    if (!this.reportValidity()) return;
    this.emit('lr-query-run', { query: { ...this._value } });
  }

  private saveQuery(): void {
    if (this.effectiveDisabled) return;
    const name = this.saveName.trim();
    if (!name) return;
    this.emit('lr-query-save', { name, query: { ...this._value } });
    this.saveName = '';
  }

  private loadQuery(item: GraphQuerySavedItem): void {
    if (this.effectiveDisabled) return;
    this.setValue({ ...EMPTY_VALUE, ...item.query });
    this.emit('lr-query-load', { id: item.id, query: { ...this._value } });
  }

  private deleteQuery(item: GraphQuerySavedItem): void {
    if (this.effectiveDisabled) return;
    this.emit('lr-query-delete', { id: item.id });
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('value') || changed.has('_errors')) {
      const valid = Object.keys(this._errors).length === 0;
      const key = JSON.stringify({ valid, errors: this._errors });
      if (key !== this.lastValidityKey) {
        this.lastValidityKey = key;
        this.emit('lr-validity-change', { valid, errors: { ...this._errors } });
      }
    }
  }

  private hopOptions(): number[] {
    const limit = finiteInteger(this.hopLimit, 6, 1, 20);
    const options = new Set<number>(Array.from({ length: limit }, (_, i) => i + 1));
    // A caller-supplied value.minHops/maxHops outside [1, hopLimit] (e.g. a saved query loaded via
    // loadSavedQuery()/the value setter, authored against a different hop-limit) is still a valid
    // GraphQuery per normalizeGraphQuery's own [1, 20] clamp -- but without a matching <lr-option>,
    // the hop <lr-select> can't mark anything selected (see select.class.ts's reflectSelected()),
    // desyncing the picker from a value that render() itself is displaying as current. Widening the
    // option set to always include the live value keeps the two in sync.
    options.add(this._value.minHops);
    options.add(this._value.maxHops);
    return [...options].sort((a, b) => a - b);
  }

  private onChromeSlotChange = (event: Event): void => {
    const slot = event.currentTarget as HTMLSlotElement;
    const hasContent = slot.assignedNodes({ flatten: true }).some((node) =>
      node.nodeType === Node.TEXT_NODE ? Boolean(node.textContent?.trim()) : true,
    );
    if (slot.name === 'hint') this.hasHintSlot = hasContent;
    else if (slot.name === 'error') this.hasErrorSlot = hasContent;
  };

  private labelForType(options: GraphQueryTypeOption[], value: string): string {
    return options.find((o) => o.value === value)?.label ?? value;
  }

  private renderTypeFilter(
    kind: 'relationship' | 'node-type',
    options: GraphQueryTypeOption[],
    selected: string[],
    add: (type: string) => void,
    remove: (type: string) => void,
    disabled: boolean,
  ): TemplateResult {
    const pickerPart = kind === 'relationship' ? 'relationship-picker' : 'node-type-picker';
    const chipsPart = kind === 'relationship' ? 'relationship-chips' : 'node-type-chips';
    const pickerLabel =
      kind === 'relationship'
        ? this.localize('graphQueryRelationshipTypeLabel')
        : this.localize('graphQueryNodeTypeLabel');
    const available = options.filter((o) => !selected.includes(o.value));
    return html`
      <div part="filter-group" data-kind=${kind}>
        <lr-select
          part=${pickerPart}
          label=${pickerLabel}
          placeholder=${this.localize('select')}
          .value=${''}
          ?disabled=${disabled}
          @change=${(e: Event) => {
            e.stopPropagation();
            const el = e.target as LyraSelect;
            // `value` widened to `string | string[]` when `<lr-select>` gained `multiple`; this
            // picker is single-select, so take the first entry rather than stringifying an array.
            add(Array.isArray(el.value) ? (el.value[0] ?? '') : el.value);
            el.value = '';
          }}
        >
          ${available.map((o) => html`<lr-option value=${o.value}>${o.label ?? o.value}</lr-option>`)}
        </lr-select>
        <lr-chip-group part=${chipsPart}>
          ${selected.map(
            (t) => html`<lr-chip
              ?removable=${!disabled}
              value=${t}
              @lr-remove=${(event: Event) => {
                event.stopPropagation();
                remove(t);
              }}
              >${this.labelForType(options, t)}</lr-chip
            >`,
          )}
        </lr-chip-group>
      </div>
    `;
  }

  override render(): TemplateResult {
    const disabled = this.effectiveDisabled;
    const hops = this.hopOptions();
    const value = this._value;
    const hasStartError = this.touchedFields.has('start-input') && Boolean(this._errors['start-input']);
    const hasHopError = this.touchedFields.has('max-hops') && Boolean(this._errors['max-hops']);
    const regionLabel = this.getAttribute('aria-label') || this.label || this.localize('graphQueryBuilderLabel');
    const hasHint = this.hasHintSlot || Boolean(this.hint);
    const hasError = this.hasErrorSlot || Boolean(this.errorText);
    const describedBy = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ');
    const hopNumber = getNumberFormat(this.effectiveLocale);

    return html`
      <div
        part="base"
        role="group"
        aria-label=${regionLabel}
        aria-describedby=${describedBy || nothing}
      >
        <div part="label" id=${this.labelId}>
          <slot name="label" @slotchange=${this.onChromeSlotChange}
            >${this.label || this.localize('graphQueryBuilderLabel')}</slot
          >
        </div>
        <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onChromeSlotChange}></slot>
        </div>
        <div part="error" id=${this.errorId} ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onChromeSlotChange}></slot>
        </div>
        <div part="path-fields">
          <lr-input
            part="start-input"
            label=${this.localize('graphQueryStartLabel')}
            .value=${value.startId}
            error-text=${hasStartError ? this._errors['start-input'] : ''}
            ?disabled=${disabled}
            @lr-input=${(e: CustomEvent<{ value: string }>) => {
              e.stopPropagation();
              this.setValue({ ...value, startId: e.detail.value });
            }}
            @blur=${() => this.markTouched('start-input')}
          ></lr-input>
          <lr-input
            part="end-input"
            label=${this.localize('graphQueryEndLabel')}
            .value=${value.endId}
            ?disabled=${disabled}
            @lr-input=${(e: CustomEvent<{ value: string }>) => {
              e.stopPropagation();
              this.setValue({ ...value, endId: e.detail.value });
            }}
          ></lr-input>
          <lr-select
            part="min-hops"
            label=${this.localize('graphQueryMinHopsLabel')}
            .value=${String(value.minHops)}
            ?disabled=${disabled}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.setValue({ ...value, minHops: Number((e.target as LyraSelect).value) });
            }}
          >
            ${hops.map((n) => html`<lr-option value=${String(n)}>${hopNumber.format(n)}</lr-option>`)}
          </lr-select>
          <lr-select
            part="max-hops"
            label=${this.localize('graphQueryMaxHopsLabel')}
            .value=${String(value.maxHops)}
            error-text=${hasHopError ? this._errors['max-hops'] : ''}
            ?disabled=${disabled}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.setValue({ ...value, maxHops: Number((e.target as LyraSelect).value) });
            }}
          >
            ${hops.map((n) => html`<lr-option value=${String(n)}>${hopNumber.format(n)}</lr-option>`)}
          </lr-select>
        </div>

        ${this.renderTypeFilter(
          'relationship',
          this.relationshipTypeOptions,
          value.relationshipTypes,
          (t) => this.addRelationshipType(t),
          (t) => this.removeRelationshipType(t),
          disabled,
        )}
        ${this.renderTypeFilter(
          'node-type',
          this.nodeTypeOptions,
          value.nodeTypes,
          (t) => this.addNodeType(t),
          (t) => this.removeNodeType(t),
          disabled,
        )}

        <lr-select
          part="direction"
          label=${this.localize('graphQueryDirectionLabel')}
          .value=${value.direction}
          ?disabled=${disabled}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.setValue({ ...value, direction: (e.target as LyraSelect).value as GraphQueryDirection });
          }}
        >
          <lr-option value="out">${this.localize('neighborDirectionOut')}</lr-option>
          <lr-option value="in">${this.localize('neighborDirectionIn')}</lr-option>
          <lr-option value="both">${this.localize('neighborDirectionBoth')}</lr-option>
        </lr-select>

        <div part="footer">
          <slot name="actions"></slot>
          <button part="run-button" type="button" ?disabled=${disabled} @click=${() => this.runQuery()}>
            ${this.localize('graphQueryRun')}
          </button>
        </div>

        <div part="saved-queries">
          <h3 part="saved-queries-label">${this.localize('graphQuerySavedQueriesLabel')}</h3>
          <div part="save-row">
            <lr-input
              part="save-name-input"
              label=${this.localize('graphQuerySaveNameLabel')}
              .value=${this.saveName}
              ?disabled=${disabled}
              @lr-input=${(e: CustomEvent<{ value: string }>) => {
                e.stopPropagation();
                this.saveName = e.detail.value;
              }}
            ></lr-input>
            <button
              part="save-button"
              type="button"
              ?disabled=${disabled || !this.saveName.trim()}
              @click=${() => this.saveQuery()}
            >
              ${this.localize('graphQuerySaveButton')}
            </button>
          </div>
          ${this.savedQueries.length === 0
            ? html`<p part="saved-empty">${this.localize('noData')}</p>`
            : html`<ul part="saved-list">
                ${this.savedQueries.map(
                  (item) => html`<li part="saved-item">
                    <button
                      part="saved-load-button"
                      type="button"
                      ?disabled=${disabled}
                      aria-label=${this.localize('graphQueryLoadWithContext', undefined, { name: item.name })}
                      @click=${() => this.loadQuery(item)}
                    >
                      ${item.name}
                    </button>
                    <button
                      part="saved-delete-button"
                      type="button"
                      ?disabled=${disabled}
                      aria-label=${this.localize('graphQueryDeleteWithContext', undefined, { name: item.name })}
                      @click=${() => this.deleteQuery(item)}
                    >
                      ${closeIcon()}
                    </button>
                  </li>`,
                )}
              </ul>`}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-graph-query-builder': LyraGraphQueryBuilder;
  }
}
