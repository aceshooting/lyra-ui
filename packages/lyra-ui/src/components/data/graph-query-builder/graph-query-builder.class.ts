import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import { closeIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { nextId } from '../../../internal/a11y.js';
import { activeElementIn, deepActiveElementIn } from '../../../internal/active-element.js';
import { styles } from './graph-query-builder.styles.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import {
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_graphQueryBuilderLabel, LYRA_DEFAULT_graphQueryDeleteWithContext, LYRA_DEFAULT_graphQueryDirectionLabel, LYRA_DEFAULT_graphQueryEndLabel, LYRA_DEFAULT_graphQueryHopRangeInvalid, LYRA_DEFAULT_graphQueryLoadWithContext, LYRA_DEFAULT_graphQueryMaxHopsLabel, LYRA_DEFAULT_graphQueryMinHopsLabel, LYRA_DEFAULT_graphQueryNodeTypeLabel, LYRA_DEFAULT_graphQueryRelationshipTypeLabel, LYRA_DEFAULT_graphQueryRun, LYRA_DEFAULT_graphQuerySaveButton, LYRA_DEFAULT_graphQuerySaveNameLabel, LYRA_DEFAULT_graphQuerySavedQueriesLabel, LYRA_DEFAULT_graphQueryStartLabel, LYRA_DEFAULT_neighborDirectionBoth, LYRA_DEFAULT_neighborDirectionIn, LYRA_DEFAULT_neighborDirectionOut, LYRA_DEFAULT_noData, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Traversal direction relative to the matched node(s): `'out'` (outgoing edges), `'in'`
 *  (incoming edges), or `'both'`. */
export type GraphQueryDirection = 'out' | 'in' | 'both';

/** One pickable relationship or node type, as offered to this component's type pickers via
 *  `relationshipTypeOptions`/`nodeTypeOptions`. */
export interface GraphQueryTypeOption {
  readonly value: string;
  /** Display label. Falls back to `value` when omitted. */
  readonly label?: string;
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
  readonly startId: string;
  /** An optional specific target entity id ("find a path to this node"). Empty means any
   *  reachable node satisfying the other filters. */
  readonly endId: string;
  /** Relationship (edge) type values to traverse. Empty means any relationship type. */
  readonly relationshipTypes: readonly string[];
  /** Node type values the traversal may pass through. Empty means any node type. */
  readonly nodeTypes: readonly string[];
  readonly direction: GraphQueryDirection;
  /** Minimum path length, inclusive. */
  readonly minHops: number;
  /** Maximum path length, inclusive. Must be `>= minHops` -- see `checkValidity()`. */
  readonly maxHops: number;
}

/** One named, host-persisted query. `id` is assigned by the host (e.g. on `lr-query-save`) --
 *  this component never generates ids itself, the same controlled-list convention every other
 *  Lyra component with a host-owned collection follows. */
export interface GraphQuerySavedItem {
  readonly id: string;
  readonly name: string;
  readonly query: GraphQuery;
}

/** Frozen payload shared by the run request and accepted notification. */
export interface GraphQueryRunDetail {
  readonly query: GraphQuery;
}

/** Frozen payload shared by the save request and accepted notification. */
export interface GraphQuerySaveDetail {
  readonly name: string;
  readonly query: GraphQuery;
}

/** Frozen payload shared by the load request and accepted notification. */
export interface GraphQueryLoadDetail {
  readonly queryId: string;
  readonly query: GraphQuery;
}

/** Frozen payload shared by the delete request and accepted notification. */
export interface GraphQueryDeleteDetail {
  readonly queryId: string;
}

const MAX_TYPES = 500;
const MAX_SAVED_QUERIES = 200;
const MAX_TEXT = 256;
const EMPTY_STRINGS: readonly string[] = Object.freeze([]);
const EMPTY_VALUE: GraphQuery = Object.freeze({
  startId: '',
  endId: '',
  relationshipTypes: EMPTY_STRINGS,
  nodeTypes: EMPTY_STRINGS,
  direction: 'both',
  minHops: 1,
  maxHops: 1,
});
const EMPTY_OPTIONS: readonly GraphQueryTypeOption[] = Object.freeze([]);
const EMPTY_SAVED: readonly GraphQuerySavedItem[] = Object.freeze([]);

/** Reads only own data properties so a hostile provider getter cannot reject a Lit update. */
function ownValue(record: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function boundedString(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : '';
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return EMPTY_STRINGS;
  return Object.freeze([
    ...new Set(
      value
        .slice(0, MAX_TYPES)
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => boundedString(entry))
        .filter(Boolean)
    ),
  ]);
}

function normalizeGraphQuery(value: unknown): GraphQuery {
  const record =
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value : EMPTY_VALUE;
  const direction = ownValue(record, 'direction');
  return Object.freeze({
    startId: boundedString(ownValue(record, 'startId')),
    endId: boundedString(ownValue(record, 'endId')),
    relationshipTypes: stringArray(ownValue(record, 'relationshipTypes')),
    nodeTypes: stringArray(ownValue(record, 'nodeTypes')),
    direction: direction === 'out' || direction === 'in' || direction === 'both' ? direction : 'both',
    minHops: finiteInteger(
      typeof ownValue(record, 'minHops') === 'number' ? (ownValue(record, 'minHops') as number)
        : EMPTY_VALUE.minHops,
      EMPTY_VALUE.minHops,
      1,
      20
    ),
    maxHops: finiteInteger(
      typeof ownValue(record, 'maxHops') === 'number' ? (ownValue(record, 'maxHops') as number)
        : EMPTY_VALUE.maxHops,
      EMPTY_VALUE.maxHops,
      1,
      20
    ),
  });
}

function normalizeTypeOptions(value: unknown): readonly GraphQueryTypeOption[] {
  if (!Array.isArray(value)) return EMPTY_OPTIONS;
  const values = new Set<string>();
  const result: GraphQueryTypeOption[] = [];
  for (const candidate of value.slice(0, MAX_TYPES)) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const optionValue = boundedString(ownValue(candidate, 'value'));
    if (optionValue.trim().length === 0 || values.has(optionValue)) continue;
    values.add(optionValue);
    const label = boundedString(ownValue(candidate, 'label'));
    result.push(Object.freeze({ value: optionValue, ...(label ? { label } : {}) }));
  }
  return Object.freeze(result);
}

function normalizeSavedQueries(value: unknown): readonly GraphQuerySavedItem[] {
  if (!Array.isArray(value)) return EMPTY_SAVED;
  const ids = new Set<string>();
  const result: GraphQuerySavedItem[] = [];
  for (const candidate of value.slice(0, MAX_SAVED_QUERIES)) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const id = boundedString(ownValue(candidate, 'id'));
    if (id.trim().length === 0 || ids.has(id)) continue;
    ids.add(id);
    result.push(Object.freeze({
      id,
      name: boundedString(ownValue(candidate, 'name')),
      query: normalizeGraphQuery(ownValue(candidate, 'query')),
    }));
  }
  return Object.freeze(result);
}

export interface LyraGraphQueryBuilderEventMap {
  'lr-invalid': CustomEvent<null>;
  'lr-input': CustomEvent<LyraEventDetailSnapshot<{ readonly value: GraphQuery }>>;
  'lr-validity-change': CustomEvent<{
    readonly valid: boolean;
    readonly errors: Readonly<Record<string, string>>;
  }>;
  'lr-before-query-run': CustomEvent<LyraEventDetailSnapshot<GraphQueryRunDetail>>;
  'lr-query-run': CustomEvent<LyraEventDetailSnapshot<GraphQueryRunDetail>>;
  'lr-before-query-save': CustomEvent<LyraEventDetailSnapshot<GraphQuerySaveDetail>>;
  'lr-query-save': CustomEvent<LyraEventDetailSnapshot<GraphQuerySaveDetail>>;
  'lr-before-query-load': CustomEvent<LyraEventDetailSnapshot<GraphQueryLoadDetail>>;
  'lr-query-load': CustomEvent<LyraEventDetailSnapshot<GraphQueryLoadDetail>>;
  'lr-before-query-delete': CustomEvent<GraphQueryDeleteDetail>;
  'lr-query-delete': CustomEvent<GraphQueryDeleteDetail>;
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
 * Removing a focused filter chip moves focus to its adjacent survivor or the matching add picker.
 * When the host applies a focused saved-query deletion, focus follows the adjacent delete action
 * or the stable save-name input; unrelated controlled updates never steal external focus.
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
 * The normalized initial `value` is captured as the reset default; `form.reset()` restores that
 * model, clears interaction/touched state and the save-name draft, and preserves a caller-set
 * custom validity message like a native control.
 * The start-entity input carries native `required`, matching the aggregate builder's
 * `valueMissing` rule. Host `focus()`/`click()` reach the first rendered field, and `blur()`
 * releases whichever nested field owns deep focus.
 * An unavailable DOM focus getter skips restoration without preventing chip removal or saved-query
 * updates. Ordinary focused removal still follows the adjacent control and leaves outside focus alone.
 *
 * Run, save, load, and delete use the same two-phase action contract: a cancelable
 * `lr-before-query-*` request precedes any local effect, followed by a non-cancelable
 * `lr-query-*` accepted notification. Vetoing a request suppresses its accepted notification;
 * for save it also preserves the draft name, and for load it preserves the current `value`.
 *
 * **Accessible name:** a host-level `aria-label` wins. Otherwise the region (`role="group"`) is
 * labelled by the same visible label element that renders the `label` slot/property/localized
 * default, so visible and announced names cannot diverge. The same region carries explicit
 * `aria-invalid="true"|"false"` from the complete builder's effective intrinsic/custom validity.
 *
 * @customElement lr-graph-query-builder
 * @slot actions - Extra host controls rendered in the footer beside the Run button.
 * @slot label - Visible label for the complete form control.
 * @slot hint - Supporting text for the complete form control.
 * @slot error - Error text for the complete form control.
 * @event lr-input - `detail: { value }` — any field changed; the full current query. Hop select
 *   choices emit it once; child native/prefixed value and listbox lifecycle aliases are contained.
 * @event lr-validity-change - Frozen `detail: { valid, errors }` from effective native validity,
 *   including custom errors and validation barring; fired only on an actual change.
 * @event lr-before-query-run - Cancelable request emitted after `reportValidity()` passes, before
 *   accepting Run. Frozen `detail: { query }`; vetoing it suppresses `lr-query-run`.
 * @event lr-query-run - Non-cancelable accepted Run notification. Frozen `detail: { query }`.
 * @event lr-before-query-save - Cancelable save request with frozen `detail: { name, query }`.
 *   Vetoing it preserves the draft name and suppresses `lr-query-save`.
 * @event lr-query-save - Non-cancelable accepted Save notification. Frozen
 *   `detail: { name, query }`; the host assigns an id and appends to `savedQueries`.
 * @event lr-before-query-load - Cancelable load request with frozen `detail: { queryId, query }`,
 *   emitted before `value` changes. Vetoing it preserves the current query.
 * @event lr-query-load - Non-cancelable accepted Load notification emitted after `value` changes.
 *   Frozen `detail: { queryId, query }` contains the accepted query.
 * @event lr-before-query-delete - Cancelable delete request with frozen `detail: { queryId }`.
 *   Vetoing it suppresses `lr-query-delete`.
 * @event lr-query-delete - Non-cancelable accepted Delete notification. Frozen
 *   `detail: { queryId }`; the host removes the matching entry from `savedQueries`.
 * @event lr-invalid - Cancelable alias when the complete builder fails native validity; vetoing it
 *   also suppresses the native invalid default.
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
 * @cssprop [--lr-graph-query-builder-run-bg=var(--lr-color-brand)] - Run button resting background.
 * @cssprop [--lr-graph-query-builder-run-border-color=var(--lr-color-brand)] - Run button resting border color.
 * @cssprop [--lr-graph-query-builder-run-color=var(--lr-color-on-brand)] - Run button resting foreground.
 * @cssprop --lr-graph-query-builder-run-hover-bg - Run button hover background; defaults to the
 *   current brand hover mix.
 * @cssprop --lr-graph-query-builder-run-active-bg - Run button pressed background; defaults to the
 *   current brand active mix.
 * @cssprop [--lr-graph-query-builder-save-bg=var(--lr-color-surface)] - Save button resting background.
 * @cssprop [--lr-graph-query-builder-save-border-color=var(--lr-color-border)] - Save button resting border color.
 * @cssprop [--lr-graph-query-builder-save-color=var(--lr-color-text)] - Save button resting foreground.
 * @cssprop [--lr-graph-query-builder-save-hover-bg=var(--lr-color-brand-quiet)] - Save button hover background.
 * @cssprop --lr-graph-query-builder-save-active-bg - Save button pressed background; defaults to
 *   the current quiet-brand active mix.
 * @cssprop [--lr-graph-query-builder-saved-load-color=var(--lr-color-text)] - Saved-query Load button foreground.
 * @cssprop --lr-graph-query-builder-saved-load-active-bg - Saved-query Load button pressed
 *   background; defaults to the current surface active mix.
 * @cssprop [--lr-graph-query-builder-saved-delete-color=var(--lr-color-text-quiet)] - Saved-query delete foreground.
 * @cssprop [--lr-graph-query-builder-saved-delete-hover-color=var(--lr-color-danger)] - Saved-query delete hover foreground.
 * @cssprop --lr-graph-query-builder-saved-delete-active-color - Saved-query delete pressed
 *   foreground; defaults to the current danger active mix.
 * @cssprop [--lr-graph-query-builder-saved-delete-active-bg=var(--lr-color-danger-quiet)] - Saved-query delete pressed background.
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
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    graphQueryBuilderLabel: LYRA_DEFAULT_graphQueryBuilderLabel,
    graphQueryDeleteWithContext: LYRA_DEFAULT_graphQueryDeleteWithContext,
    graphQueryDirectionLabel: LYRA_DEFAULT_graphQueryDirectionLabel,
    graphQueryEndLabel: LYRA_DEFAULT_graphQueryEndLabel,
    graphQueryHopRangeInvalid: LYRA_DEFAULT_graphQueryHopRangeInvalid,
    graphQueryLoadWithContext: LYRA_DEFAULT_graphQueryLoadWithContext,
    graphQueryMaxHopsLabel: LYRA_DEFAULT_graphQueryMaxHopsLabel,
    graphQueryMinHopsLabel: LYRA_DEFAULT_graphQueryMinHopsLabel,
    graphQueryNodeTypeLabel: LYRA_DEFAULT_graphQueryNodeTypeLabel,
    graphQueryRelationshipTypeLabel: LYRA_DEFAULT_graphQueryRelationshipTypeLabel,
    graphQueryRun: LYRA_DEFAULT_graphQueryRun,
    graphQuerySaveButton: LYRA_DEFAULT_graphQuerySaveButton,
    graphQuerySaveNameLabel: LYRA_DEFAULT_graphQuerySaveNameLabel,
    graphQuerySavedQueriesLabel: LYRA_DEFAULT_graphQuerySavedQueriesLabel,
    graphQueryStartLabel: LYRA_DEFAULT_graphQueryStartLabel,
    neighborDirectionBoth: LYRA_DEFAULT_neighborDirectionBoth,
    neighborDirectionIn: LYRA_DEFAULT_neighborDirectionIn,
    neighborDirectionOut: LYRA_DEFAULT_neighborDirectionOut,
    noData: LYRA_DEFAULT_noData,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-input',
    'lr-before-query-run',
    'lr-query-run',
    'lr-before-query-save',
    'lr-query-save',
    'lr-before-query-load',
    'lr-query-load',
  ]);

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  /** Clone-owned, bounded pickable relationship types offered by the "add" picker. */
  private _relationshipTypeOptions: readonly GraphQueryTypeOption[] = EMPTY_OPTIONS;
  @property({ attribute: false })
  get relationshipTypeOptions(): readonly GraphQueryTypeOption[] {
    return this._relationshipTypeOptions;
  }
  set relationshipTypeOptions(value: readonly GraphQueryTypeOption[]) {
    const previous = this._relationshipTypeOptions;
    this._relationshipTypeOptions = normalizeTypeOptions(value);
    this.requestUpdate('relationshipTypeOptions', previous);
  }
  /** Clone-owned, bounded pickable node types offered by the node-type "add" picker. */
  private _nodeTypeOptions: readonly GraphQueryTypeOption[] = EMPTY_OPTIONS;
  @property({ attribute: false })
  get nodeTypeOptions(): readonly GraphQueryTypeOption[] {
    return this._nodeTypeOptions;
  }
  set nodeTypeOptions(value: readonly GraphQueryTypeOption[]) {
    const previous = this._nodeTypeOptions;
    this._nodeTypeOptions = normalizeTypeOptions(value);
    this.requestUpdate('nodeTypeOptions', previous);
  }
  /** Clone-owned, bounded host-persisted saved queries. Controlled -- this component never mutates
   *  this array itself; accepted `lr-query-save`/`lr-query-delete` notifications tell the host when
   *  to act. Applying an accepted deletion from the focused row restores focus to the nearest
   *  survivor or save input. */
  private _savedQueries: readonly GraphQuerySavedItem[] = EMPTY_SAVED;
  @property({ attribute: false })
  get savedQueries(): readonly GraphQuerySavedItem[] {
    return this._savedQueries;
  }
  set savedQueries(value: readonly GraphQuerySavedItem[]) {
    const previous = this._savedQueries;
    this._savedQueries = normalizeSavedQueries(value);
    this.requestUpdate('savedQueries', previous);
  }
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
  private defaultValue: GraphQuery = normalizeGraphQuery(EMPTY_VALUE);
  private defaultValueCaptured = false;
  private _disabled = false;
  // Drives the user-valid/user-invalid pair: an empty required query is invalid from the first
  // render, but styling it red before the user has done anything is hostile.
  private hasInteracted = false;
  // Guards lr-validity-change so it only fires on an actual change -- `undefined` guarantees the
  // first computed state always "changes" from it, mirroring lr-rubric-form's identical guard.
  private lastValidityKey: string | undefined;
  private pendingRemovalFocus?:
    | {
        kind: 'chip';
        group: 'relationship' | 'node-type';
        targetValue?: string;
      }
    | { kind: 'saved'; targetId?: string };
  private removalFocusGeneration = 0;

  constructor() {
    super();
    // Degrades to the shared `createFallbackInternals()` stand-in rather than throwing in an
    // environment without a working `attachInternals()` (a downstream consumer's happy-dom test
    // suite): merely constructing -- or importing -- this component must not hard-crash there.
    // Form participation is genuinely unavailable in that environment and stays inert, but the
    // stand-in tracks real validity flags, so `checkValidity()`/`validity`/`validationMessage`
    // keep answering this control's own constraints instead of claiming valid unconditionally.
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) => this.emit('lr-invalid', null, init));
    this.syncFormState();
  }

  override disconnectedCallback(): void {
    this.removalFocusGeneration++;
    this.pendingRemovalFocus = undefined;
    super.disconnectedCallback();
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

  /** The complete controlled query model, detached and deeply frozen with at most 500 relationship
   *  and node type entries. Reassign a new model after changes. Its normalized value at the first
   *  update is the form reset default; later property writes and user edits change only the live
   *  value. */
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

  /** The current effective validation errors. Intrinsic errors are keyed by their field part;
   *  a caller-supplied custom validity message is keyed by the whole-control `base` part. */
  get errors(): Readonly<Record<string, string>> {
    return this.publicValidityErrors();
  }

  private publicValidityErrors(): Readonly<Record<string, string>> {
    const errors: Record<string, string> = { ...this._errors };
    if (this.willValidate && this.validity.customError) errors['base'] = this.validationMessage;
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

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | undefined {
    const firstInvalidPart = Object.keys(this._errors)[0];
    if (!firstInvalidPart || !this.renderRoot) return undefined;
    return (
      (this.renderRoot.querySelector(`[part="${firstInvalidPart}"]`) as HTMLElement | null) ?? undefined
    );
  }

  private computeValidation(): {
    errors: Record<string, string>;
    flags: ValidityStateFlags;
  } {
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
    this.publishValiditySnapshot();
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
   * whole-control state and lands in `errors.base`, keyed to the complete control's `base` part.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncValidityCustomStates();
    this.publishValiditySnapshot();
    this.requestUpdate();
  }

  formResetCallback(): void {
    // Cleared before the `value` assignment below, whose setter is what republishes the custom
    // states — a reset control is pristine again, so user-valid/user-invalid must drop off it.
    this.hasInteracted = false;
    this.captureDefaultValue();
    this.value = this.defaultValue;
    this.touchedFields = new Set();
    this.saveName = '';
  }

  private captureDefaultValue(): void {
    if (this.defaultValueCaptured) return;
    this.defaultValue = normalizeGraphQuery(this._value);
    this.defaultValueCaptured = true;
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

  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  private focusFirstControl(options?: FocusOptions): void {
    if (!this.renderRoot || this.liveDisabled) return;
    const control =
      this.renderRoot.querySelector<HTMLElement>('[part="start-input"]') ||
      this.renderRoot.querySelector<HTMLElement>('[part="end-input"]') ||
      this.renderRoot.querySelector<HTMLElement>('[part="min-hops"]') ||
      this.renderRoot.querySelector<HTMLElement>('[part="max-hops"]') ||
      this.renderRoot.querySelector<HTMLElement>('[part="direction"]') ||
      this.renderRoot.querySelector<HTMLElement>('[part="save-name-input"]');
    control?.focus(options);
  }

  /** Moves focus to the first rendered field while the aggregate control is enabled. */
  override focus(options?: FocusOptions): void {
    this.focusFirstControl(options);
  }

  /** Blurs whichever nested editing owner currently holds focus. */
  override blur(): void {
    const active = deepActiveElementIn(this.shadowRoot);
    if (active && typeof (active as HTMLElement).blur === 'function') {
      (active as HTMLElement).blur();
    }
  }

  /** Forwards host clicks to the first rendered control so callers can interact with this wrapper
   *  as if it exposed a single root control. */
  override click(): void {
    this.focusFirstControl();
  }

  private setValue(next: GraphQuery): void {
    if (this.effectiveDisabled) return;
    // Set before the `value` assignment, whose setter republishes the custom states.
    this.hasInteracted = true;
    this.value = next;
    this.emit('lr-input', Object.freeze({ value: this._value }));
  }

  private addRelationshipType(type: string): void {
    if (!type || this._value.relationshipTypes.includes(type)) return;
    this.setValue({
      ...this._value,
      relationshipTypes: [...this._value.relationshipTypes, type],
    });
  }
  private removeRelationshipType(type: string): void {
    this.captureChipRemovalFocus('relationship', type, this._value.relationshipTypes);
    this.setValue({
      ...this._value,
      relationshipTypes: this._value.relationshipTypes.filter((t) => t !== type),
    });
  }
  private addNodeType(type: string): void {
    if (!type || this._value.nodeTypes.includes(type)) return;
    this.setValue({
      ...this._value,
      nodeTypes: [...this._value.nodeTypes, type],
    });
  }
  private removeNodeType(type: string): void {
    this.captureChipRemovalFocus('node-type', type, this._value.nodeTypes);
    this.setValue({
      ...this._value,
      nodeTypes: this._value.nodeTypes.filter((t) => t !== type),
    });
  }

  private captureChipRemovalFocus(group: 'relationship' | 'node-type', value: string, selected: readonly string[]): void {
    const active = activeElementIn(this.shadowRoot) as HTMLElement | null;
    const expectedPart = group === 'relationship' ? 'relationship-chips' : 'node-type-chips';
    if (
      active?.localName !== 'lr-chip' ||
      active.getAttribute('value') !== value ||
      active.closest<HTMLElement>('lr-chip-group')?.getAttribute('part') !== expectedPart
    )
      return;
    const index = selected.indexOf(value);
    const survivors = selected.filter((candidate) => candidate !== value);
    const targetValue = survivors[Math.min(Math.max(index, 0), survivors.length - 1)];
    this.pendingRemovalFocus = { kind: 'chip', group, targetValue };
    this.removalFocusGeneration++;
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
    const detail = (): GraphQueryRunDetail =>
      Object.freeze({ query: normalizeGraphQuery(this._value) });
    if (this.emit('lr-before-query-run', detail(), { cancelable: true }).defaultPrevented) return;
    this.emit('lr-query-run', detail());
  }

  private saveQuery(): void {
    if (this.effectiveDisabled) return;
    const name = this.saveName.trim();
    if (!name) return;
    const detail = (): GraphQuerySaveDetail =>
      Object.freeze({ name, query: normalizeGraphQuery(this._value) });
    if (this.emit('lr-before-query-save', detail(), { cancelable: true }).defaultPrevented) return;
    this.saveName = '';
    this.emit('lr-query-save', detail());
  }

  private loadQuery(item: GraphQuerySavedItem): void {
    if (this.effectiveDisabled) return;
    const detail = (): GraphQueryLoadDetail =>
      Object.freeze({
      queryId: item.id,
      query: normalizeGraphQuery(item.query),
    });
    if (this.emit('lr-before-query-load', detail(), { cancelable: true }).defaultPrevented) return;
    this.setValue({ ...EMPTY_VALUE, ...item.query });
    this.emit('lr-query-load', detail());
  }

  private deleteQuery(item: GraphQuerySavedItem): void {
    if (this.effectiveDisabled) return;
    const detail = (): GraphQueryDeleteDetail => Object.freeze({ queryId: item.id });
    if (this.emit('lr-before-query-delete', detail(), { cancelable: true }).defaultPrevented) return;
    this.emit('lr-query-delete', detail());
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) this.captureDefaultValue();
    if (!changed.has('savedQueries')) return;
    const active = activeElementIn(this.shadowRoot) as HTMLElement | null;
    if (active?.getAttribute('part') !== 'saved-delete-button') return;
    const focusedId = active.closest<HTMLElement>('[data-query-id]')?.dataset['queryId'];
    if (!focusedId || this.savedQueries.some((item) => item.id === focusedId)) return;
    const previous = (changed.get('savedQueries') as
        | readonly GraphQuerySavedItem[] | undefined) ?? [];
    const index = previous.findIndex((item) => item.id === focusedId);
    const target = this.savedQueries[Math.min(Math.max(index, 0), this.savedQueries.length - 1)];
    this.pendingRemovalFocus = { kind: 'saved', targetId: target?.id };
    this.removalFocusGeneration++;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.publishValiditySnapshot();
    const pending = this.pendingRemovalFocus;
    if (!pending) return;
    this.pendingRemovalFocus = undefined;
    const generation = this.removalFocusGeneration;
    this.scheduleAfterUpdate(() => {
      if (generation !== this.removalFocusGeneration || !this.isConnected) return;
      if (pending.kind === 'chip') {
        if (pending.targetValue) {
          const part = pending.group === 'relationship' ? 'relationship-chips' : 'node-type-chips';
          const chip = [...(this.shadowRoot?.querySelectorAll<HTMLElement>(`[part="${part}"] lr-chip`) ?? [])].find(
            (candidate) => candidate.getAttribute('value') === pending.targetValue
          );
          if (chip) {
            chip.focus();
            return;
          }
        }
        const pickerPart = pending.group === 'relationship' ? 'relationship-picker' : 'node-type-picker';
        this.shadowRoot?.querySelector<HTMLElement>(`[part="${pickerPart}"]`)?.focus();
        return;
      }
      if (pending.targetId) {
        const item = [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[data-query-id]') ?? [])].find(
          (candidate) => candidate.dataset['queryId'] === pending.targetId
        );
        const action = item?.querySelector<HTMLElement>('[part="saved-delete-button"]');
        if (action) {
          action.focus();
          return;
        }
      }
      this.shadowRoot?.querySelector<HTMLElement>('[part="save-name-input"]')?.focus();
    }, 'graph-query-removal-focus');
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
    const hasContent = slot
      .assignedNodes({ flatten: true })
      .some((node) =>
        node.nodeType === Node.TEXT_NODE ? Boolean(node.textContent?.trim()) : true);
    if (slot.name === 'hint') this.hasHintSlot = hasContent;
    else if (slot.name === 'error') this.hasErrorSlot = hasContent;
  };

  private labelForType(options: readonly GraphQueryTypeOption[], value: string): string {
    return options.find((o) => o.value === value)?.label ?? value;
  }

  private containSelectEvent(event: Event): void {
    event.stopPropagation();
  }

  private renderTypeFilter(
    kind: 'relationship' | 'node-type',
    options: readonly GraphQueryTypeOption[],
    selected: readonly string[],
    add: (type: string) => void,
    remove: (type: string) => void,
    disabled: boolean
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
            add(Array.isArray(el.value) ? el.value[0] ?? '' : el.value);
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
            >`
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
    const hostLabel = this.getAttribute('aria-label');
    const hasHint = this.hasHintSlot || Boolean(this.hint);
    const hasError = this.hasErrorSlot || Boolean(this.errorText);
    const describedBy = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ');
    const hopNumber = getNumberFormat(this.effectiveLocale);

    return html`
      <div
        part="base"
        role="group"
        aria-label=${hostLabel ?? nothing}
        aria-labelledby=${hostLabel === null ? this.labelId : nothing}
        aria-describedby=${describedBy || nothing}
        aria-invalid=${this.internals.validity.valid ? 'false' : 'true'}
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
            .required=${true}
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
            @input=${this.containSelectEvent}
            @lr-input=${this.containSelectEvent}
            @lr-change=${this.containSelectEvent}
            @lr-show=${this.containSelectEvent}
            @lr-after-show=${this.containSelectEvent}
            @lr-hide=${this.containSelectEvent}
            @lr-after-hide=${this.containSelectEvent}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.setValue({
                ...value,
                minHops: Number((e.target as LyraSelect).value),
              });
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
            @input=${this.containSelectEvent}
            @lr-input=${this.containSelectEvent}
            @lr-change=${this.containSelectEvent}
            @lr-show=${this.containSelectEvent}
            @lr-after-show=${this.containSelectEvent}
            @lr-hide=${this.containSelectEvent}
            @lr-after-hide=${this.containSelectEvent}
            @change=${(e: Event) => {
              e.stopPropagation();
              this.setValue({
                ...value,
                maxHops: Number((e.target as LyraSelect).value),
              });
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
          disabled
        )}
        ${this.renderTypeFilter(
          'node-type',
          this.nodeTypeOptions,
          value.nodeTypes,
          (t) => this.addNodeType(t),
          (t) => this.removeNodeType(t),
          disabled
        )}

        <lr-select
          part="direction"
          label=${this.localize('graphQueryDirectionLabel')}
          .value=${value.direction}
          ?disabled=${disabled}
          @change=${(e: Event) => {
            e.stopPropagation();
            this.setValue({
              ...value,
              direction: (e.target as LyraSelect).value as GraphQueryDirection,
            });
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
                  (item) => html`<li part="saved-item" data-query-id=${item.id}>
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
                  </li>`
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
