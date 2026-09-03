import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './schema-viewer.styles.js';
import { overallSemanticLabel } from '../semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_schemaViewerCircular, LYRA_DEFAULT_schemaViewerEmpty, LYRA_DEFAULT_schemaViewerIssueLimit, LYRA_DEFAULT_schemaViewerLabel, LYRA_DEFAULT_schemaViewerLimit, LYRA_DEFAULT_schemaViewerRequired, LYRA_DEFAULT_schemaViewerType } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface JsonSchemaNode {
  readonly $ref?: string;
  readonly type?: string | readonly string[];
  readonly title?: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchemaNode>>;
  readonly items?: JsonSchemaNode | readonly JsonSchemaNode[];
  readonly required?: readonly string[];
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly default?: unknown;
  readonly examples?: readonly unknown[];
  readonly oneOf?: readonly JsonSchemaNode[];
  readonly anyOf?: readonly JsonSchemaNode[];
  readonly allOf?: readonly JsonSchemaNode[];
  readonly [key: string]: unknown;
}
export interface SchemaValidationIssue {
  path: string;
  message: string;
  severity?: 'error' | 'warning' | 'info';
}
export interface LyraJsonSchemaViewerEventMap {
  'lr-schema-select': CustomEvent<
    LyraEventDetailSnapshot<{ schemaPath: string; schema: JsonSchemaNode }>
  >;
}

interface SchemaRenderBudget {
  remaining: number;
  truncated: boolean;
}

const MAX_RENDERED_SCHEMA_NODES = 500;
const MAX_RENDERED_SCHEMA_ISSUES = 500;
const MAX_SCHEMA_DEPTH = 100;
const MAX_CONSTRAINT_VALUES = 50;
const MAX_CONSTRAINT_VALUE_CHARACTERS = 1_000;
const MAX_CONSTRAINT_OBJECT_NODES = 50;

function constraintValue(value: unknown): string {
  const seen = new Set<object>();
  let remaining = MAX_CONSTRAINT_OBJECT_NODES;
  const visit = (candidate: unknown, depth: number): string => {
    if (remaining-- <= 0) return '…';
    if (candidate === null) return 'null';
    if (typeof candidate === 'string')
      return JSON.stringify(
        candidate.slice(0, MAX_CONSTRAINT_VALUE_CHARACTERS)
      );
    if (typeof candidate === 'number' || typeof candidate === 'boolean')
      return String(candidate);
    if (typeof candidate === 'bigint') return `${candidate.toString()}n`;
    if (candidate === undefined) return 'undefined';
    if (typeof candidate !== 'object') return String(candidate);
    if (seen.has(candidate)) return '[Circular]';
    if (depth >= 3) return Array.isArray(candidate) ? '[…]' : '{…}';
    seen.add(candidate);
    let result: string;
    if (Array.isArray(candidate)) {
      const values = candidate
        .slice(0, MAX_CONSTRAINT_VALUES)
        .map((item) => visit(item, depth + 1));
      result = `[${values.join(', ')}${
        candidate.length > values.length ? ', …' : ''
      }]`;
    } else {
      const entries = Object.entries(candidate).slice(0, MAX_CONSTRAINT_VALUES);
      result = `{${entries
        .map(
          ([key, item]) => `${JSON.stringify(key)}: ${visit(item, depth + 1)}`
        )
        .join(', ')}${
        Object.keys(candidate).length > entries.length ? ', …' : ''
      }}`;
    }
    seen.delete(candidate);
    return result.slice(0, MAX_CONSTRAINT_VALUE_CHARACTERS);
  };
  return visit(value, 0);
}

function isReadonlyArray<Value>(
  value: Value | readonly Value[] | undefined
): value is readonly Value[] {
  return Array.isArray(value);
}

/** Node-count ceiling for the caller-owned schema snapshot below, mirroring `LyraElement`'s own
 *  generic per-assignment collection budget -- generous enough that a legitimately wide schema
 *  never notices it, while still bounding a truly pathological caller. */
const SCHEMA_SNAPSHOT_NODE_LIMIT = 50_000;
const SCHEMA_SNAPSHOT_INSPECTION_LIMIT = SCHEMA_SNAPSHOT_NODE_LIMIT * 4;
// Array length is independently capped: sparse attacker indexes must not make either the owned
// snapshot or a later render walk an unbounded positional range.
const SCHEMA_SNAPSHOT_ARRAY_LENGTH_LIMIT = SCHEMA_SNAPSHOT_NODE_LIMIT;
const MAX_ARRAY_LENGTH = 0xffff_ffff;
const OMIT_SCHEMA_VALUE = Symbol('omit-schema-value');
const NODE_LIMIT_SCHEMA_VALUE = Symbol('schema-node-limit');
const DEPTH_LIMIT_SCHEMA_VALUE = Symbol('schema-depth-limit');
const FUNCTION_TO_STRING = Function.prototype.toString;
const OBJECT_CONSTRUCTOR_SOURCE = FUNCTION_TO_STRING.call(Object);

type SchemaSnapshotFailure =
  | typeof OMIT_SCHEMA_VALUE
  | typeof NODE_LIMIT_SCHEMA_VALUE
  | typeof DEPTH_LIMIT_SCHEMA_VALUE;

interface SchemaSnapshotBudget {
  remaining: number;
  remainingInspections: number;
  readonly seen: Map<object, object>;
  readonly additions: object[];
}

interface SchemaSnapshotCheckpoint {
  readonly remaining: number;
  readonly additions: number;
}

interface OwnEnumerableDataDescriptor {
  readonly value: unknown;
}

const MISSING_SCHEMA_DESCRIPTOR = Symbol('missing-schema-descriptor');
const ACCESSOR_SCHEMA_DESCRIPTOR = Symbol('accessor-schema-descriptor');
const UNSAFE_SCHEMA_DESCRIPTOR = Symbol('unsafe-schema-descriptor');

type SchemaDescriptorResult =
  | OwnEnumerableDataDescriptor
  | typeof MISSING_SCHEMA_DESCRIPTOR
  | typeof ACCESSOR_SCHEMA_DESCRIPTOR
  | typeof UNSAFE_SCHEMA_DESCRIPTOR;

function isSchemaSnapshotFailure(
  value: unknown
): value is SchemaSnapshotFailure {
  return (
    value === OMIT_SCHEMA_VALUE ||
    value === NODE_LIMIT_SCHEMA_VALUE ||
    value === DEPTH_LIMIT_SCHEMA_VALUE
  );
}

/** Accept ordinary and cross-realm plain records, while refusing custom prototypes. */
function isPlainSchemaRecord(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    if (Object.getPrototypeOf(prototype) !== null) return false;
    const constructorDescriptor = Object.getOwnPropertyDescriptor(
      prototype,
      'constructor'
    );
    if (
      !constructorDescriptor ||
      !('value' in constructorDescriptor) ||
      typeof constructorDescriptor.value !== 'function'
    ) {
      return false;
    }
    const constructor = constructorDescriptor.value;
    const constructorPrototype = Object.getOwnPropertyDescriptor(
      constructor,
      'prototype'
    );
    return Boolean(
      constructorPrototype &&
        'value' in constructorPrototype &&
        constructorPrototype.value === prototype &&
        FUNCTION_TO_STRING.call(constructor) === OBJECT_CONSTRUCTOR_SOURCE
    );
  } catch {
    return false;
  }
}

function isSchemaArray(value: object): boolean {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function isArrayIndex(key: string): boolean {
  const index = Number(key);
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < MAX_ARRAY_LENGTH &&
    String(index) === key
  );
}

function checkpointSchemaSnapshot(
  budget: SchemaSnapshotBudget
): SchemaSnapshotCheckpoint {
  return {
    remaining: budget.remaining,
    additions: budget.additions.length,
  };
}

function restoreSchemaSnapshot(
  budget: SchemaSnapshotBudget,
  checkpoint: SchemaSnapshotCheckpoint
): void {
  budget.remaining = checkpoint.remaining;
  // An omitted branch reclaims retained nodes and aliases, while source positions already
  // inspected remain spent so repeated reflection failures cannot multiply total work.
  while (budget.additions.length > checkpoint.additions) {
    const source = budget.additions.pop();
    if (source) budget.seen.delete(source);
  }
}

function rememberSchemaSnapshot(
  budget: SchemaSnapshotBudget,
  source: object,
  output: object
): void {
  budget.seen.set(source, output);
  budget.additions.push(source);
}

function ownEnumerableDataDescriptor(
  value: object,
  key: string
): SchemaDescriptorResult {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    return UNSAFE_SCHEMA_DESCRIPTOR;
  }
  if (!descriptor || !descriptor.enumerable) return MISSING_SCHEMA_DESCRIPTOR;
  if (!('value' in descriptor)) return ACCESSOR_SCHEMA_DESCRIPTOR;
  return descriptor as OwnEnumerableDataDescriptor;
}

function safeArrayLength(
  value: object
): number | typeof UNSAFE_SCHEMA_DESCRIPTOR {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, 'length');
  } catch {
    return UNSAFE_SCHEMA_DESCRIPTOR;
  }
  if (
    !descriptor ||
    !('value' in descriptor) ||
    typeof descriptor.value !== 'number' ||
    !Number.isSafeInteger(descriptor.value) ||
    descriptor.value < 0 ||
    descriptor.value > MAX_ARRAY_LENGTH
  ) {
    return UNSAFE_SCHEMA_DESCRIPTOR;
  }
  return descriptor.value;
}

function consumeSchemaInspection(budget: SchemaSnapshotBudget): boolean {
  if (budget.remainingInspections <= 0) return false;
  budget.remainingInspections -= 1;
  return true;
}

function defineSnapshotValue(
  output: object,
  key: string,
  value: unknown
): void {
  Object.defineProperty(output, key, {
    configurable: false,
    enumerable: true,
    value,
    writable: false,
  });
}

function finishSchemaSnapshot<T extends object>(
  output: T
): T | typeof OMIT_SCHEMA_VALUE {
  try {
    return Object.freeze(output);
  } catch {
    return OMIT_SCHEMA_VALUE;
  }
}

/**
 * Clones an arbitrary supported schema keyword value. Structural schema keys use the specialized
 * helpers below so their nested nodes keep the viewer's documented node budget, while ordinary
 * keyword values still receive the same recursive, descriptor-safe ownership boundary.
 */
function snapshotSchemaValue(
  value: unknown,
  budget: SchemaSnapshotBudget,
  depth: number
): unknown | SchemaSnapshotFailure {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  )
    return value;
  if (typeof value === 'function') return OMIT_SCHEMA_VALUE;
  if (budget.seen.has(value)) return budget.seen.get(value)!;
  if (depth > MAX_SCHEMA_DEPTH) return DEPTH_LIMIT_SCHEMA_VALUE;
  if (budget.remaining <= 0) return NODE_LIMIT_SCHEMA_VALUE;
  if (isSchemaArray(value))
    return snapshotSchemaValueArray(value, budget, depth);
  if (!isPlainSchemaRecord(value)) return OMIT_SCHEMA_VALUE;
  return snapshotSchemaValueRecord(value, budget, depth);
}

function snapshotSchemaValueRecord(
  value: object,
  budget: SchemaSnapshotBudget,
  depth: number
): Readonly<Record<string, unknown>> | SchemaSnapshotFailure {
  const checkpoint = checkpointSchemaSnapshot(budget);
  if (budget.remaining <= 0) return NODE_LIMIT_SCHEMA_VALUE;
  budget.remaining -= 1;
  const output = Object.create(null) as Record<string, unknown>;
  rememberSchemaSnapshot(budget, value, output);
  try {
    for (const key in value) {
      if (!consumeSchemaInspection(budget)) break;
      const descriptor = ownEnumerableDataDescriptor(value, key);
      if (
        descriptor === MISSING_SCHEMA_DESCRIPTOR ||
        descriptor === ACCESSOR_SCHEMA_DESCRIPTOR
      )
        continue;
      if (descriptor === UNSAFE_SCHEMA_DESCRIPTOR) {
        restoreSchemaSnapshot(budget, checkpoint);
        return OMIT_SCHEMA_VALUE;
      }
      const entryCheckpoint = checkpointSchemaSnapshot(budget);
      const entry = snapshotSchemaValue(descriptor.value, budget, depth + 1);
      if (entry === OMIT_SCHEMA_VALUE) {
        restoreSchemaSnapshot(budget, entryCheckpoint);
        continue;
      }
      if (entry === DEPTH_LIMIT_SCHEMA_VALUE) continue;
      if (entry === NODE_LIMIT_SCHEMA_VALUE) break;
      defineSnapshotValue(output, key, entry);
    }
  } catch {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  const frozen = finishSchemaSnapshot(output);
  if (frozen === OMIT_SCHEMA_VALUE) {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  return frozen;
}

function snapshotSchemaValueArray(
  value: object,
  budget: SchemaSnapshotBudget,
  depth: number
): readonly unknown[] | SchemaSnapshotFailure {
  const checkpoint = checkpointSchemaSnapshot(budget);
  if (budget.remaining <= 0) return NODE_LIMIT_SCHEMA_VALUE;
  budget.remaining -= 1;
  const sourceLength = safeArrayLength(value);
  if (sourceLength === UNSAFE_SCHEMA_DESCRIPTOR) {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  const output = new Array<unknown>(
    Math.min(sourceLength, SCHEMA_SNAPSHOT_ARRAY_LENGTH_LIMIT)
  );
  rememberSchemaSnapshot(budget, value, output);
  try {
    for (const key in value) {
      if (!consumeSchemaInspection(budget)) break;
      const index = isArrayIndex(key) ? Number(key) : null;
      if (index !== null && index >= output.length) continue;
      const descriptor = ownEnumerableDataDescriptor(value, key);
      if (
        descriptor === MISSING_SCHEMA_DESCRIPTOR ||
        descriptor === ACCESSOR_SCHEMA_DESCRIPTOR
      )
        continue;
      if (descriptor === UNSAFE_SCHEMA_DESCRIPTOR) {
        restoreSchemaSnapshot(budget, checkpoint);
        return OMIT_SCHEMA_VALUE;
      }
      const entryCheckpoint = checkpointSchemaSnapshot(budget);
      const entry = snapshotSchemaValue(descriptor.value, budget, depth + 1);
      if (entry === OMIT_SCHEMA_VALUE) {
        restoreSchemaSnapshot(budget, entryCheckpoint);
        continue;
      }
      if (entry === DEPTH_LIMIT_SCHEMA_VALUE) continue;
      if (entry === NODE_LIMIT_SCHEMA_VALUE) {
        if (index !== null) output.length = index;
        break;
      }
      defineSnapshotValue(output, key, entry);
    }
  } catch {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  const frozen = finishSchemaSnapshot(output);
  if (frozen === OMIT_SCHEMA_VALUE) {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  return frozen;
}

function snapshotSchemaNode(
  value: unknown,
  depth: number,
  budget: SchemaSnapshotBudget
): JsonSchemaNode | SchemaSnapshotFailure {
  if (
    value === null ||
    typeof value !== 'object' ||
    !isPlainSchemaRecord(value)
  ) {
    return OMIT_SCHEMA_VALUE;
  }
  if (budget.seen.has(value)) return budget.seen.get(value)! as JsonSchemaNode;
  if (depth > MAX_SCHEMA_DEPTH) return DEPTH_LIMIT_SCHEMA_VALUE;
  if (budget.remaining <= 0) return NODE_LIMIT_SCHEMA_VALUE;
  const checkpoint = checkpointSchemaSnapshot(budget);
  budget.remaining -= 1;
  const output = Object.create(null) as Record<string, unknown>;
  rememberSchemaSnapshot(budget, value, output);
  try {
    for (const key in value) {
      if (!consumeSchemaInspection(budget)) break;
      const descriptor = ownEnumerableDataDescriptor(value, key);
      if (
        descriptor === MISSING_SCHEMA_DESCRIPTOR ||
        descriptor === ACCESSOR_SCHEMA_DESCRIPTOR
      )
        continue;
      if (descriptor === UNSAFE_SCHEMA_DESCRIPTOR) {
        restoreSchemaSnapshot(budget, checkpoint);
        return OMIT_SCHEMA_VALUE;
      }
      const entryCheckpoint = checkpointSchemaSnapshot(budget);
      const entry = snapshotSchemaNodeField(
        key,
        descriptor.value,
        budget,
        depth
      );
      if (entry === OMIT_SCHEMA_VALUE) {
        restoreSchemaSnapshot(budget, entryCheckpoint);
        continue;
      }
      if (entry === DEPTH_LIMIT_SCHEMA_VALUE) continue;
      if (entry === NODE_LIMIT_SCHEMA_VALUE) break;
      defineSnapshotValue(output, key, entry);
    }
  } catch {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  const frozen = finishSchemaSnapshot(output);
  if (frozen === OMIT_SCHEMA_VALUE) {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  return frozen as JsonSchemaNode;
}

function snapshotSchemaNodeField(
  key: string,
  value: unknown,
  budget: SchemaSnapshotBudget,
  depth: number
): unknown | SchemaSnapshotFailure {
  if (
    depth >= MAX_SCHEMA_DEPTH &&
    (key === 'properties' ||
      key === 'items' ||
      key === 'allOf' ||
      key === 'anyOf' ||
      key === 'oneOf')
  ) {
    return DEPTH_LIMIT_SCHEMA_VALUE;
  }
  if (key === 'properties')
    return snapshotSchemaNodeMap(value, depth + 1, budget);
  if (key === 'allOf' || key === 'anyOf' || key === 'oneOf') {
    return snapshotSchemaNodeArray(value, depth + 1, budget);
  }
  if (key === 'items') {
    if (value !== null && typeof value === 'object' && isSchemaArray(value)) {
      return snapshotSchemaNodeArray(value, depth + 1, budget);
    }
    return snapshotSchemaNode(value, depth + 1, budget);
  }
  return snapshotSchemaValue(value, budget, depth + 1);
}

function snapshotSchemaNodeMap(
  value: unknown,
  depth: number,
  budget: SchemaSnapshotBudget
): Readonly<Record<string, JsonSchemaNode>> | SchemaSnapshotFailure {
  if (
    value === null ||
    typeof value !== 'object' ||
    !isPlainSchemaRecord(value)
  ) {
    return OMIT_SCHEMA_VALUE;
  }
  if (budget.seen.has(value))
    return budget.seen.get(value)! as Readonly<Record<string, JsonSchemaNode>>;
  const checkpoint = checkpointSchemaSnapshot(budget);
  const output = Object.create(null) as Record<string, JsonSchemaNode>;
  rememberSchemaSnapshot(budget, value, output);
  try {
    for (const key in value) {
      if (!consumeSchemaInspection(budget)) break;
      const descriptor = ownEnumerableDataDescriptor(value, key);
      if (
        descriptor === MISSING_SCHEMA_DESCRIPTOR ||
        descriptor === ACCESSOR_SCHEMA_DESCRIPTOR
      )
        continue;
      if (descriptor === UNSAFE_SCHEMA_DESCRIPTOR) {
        restoreSchemaSnapshot(budget, checkpoint);
        return OMIT_SCHEMA_VALUE;
      }
      const entryCheckpoint = checkpointSchemaSnapshot(budget);
      const entry = snapshotSchemaNode(descriptor.value, depth, budget);
      if (entry === OMIT_SCHEMA_VALUE) {
        restoreSchemaSnapshot(budget, entryCheckpoint);
        continue;
      }
      if (entry === DEPTH_LIMIT_SCHEMA_VALUE) continue;
      if (entry === NODE_LIMIT_SCHEMA_VALUE) break;
      defineSnapshotValue(output, key, entry);
    }
  } catch {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  const frozen = finishSchemaSnapshot(output);
  if (frozen === OMIT_SCHEMA_VALUE) {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  return frozen as Readonly<Record<string, JsonSchemaNode>>;
}

function snapshotSchemaNodeArray(
  value: unknown,
  depth: number,
  budget: SchemaSnapshotBudget
): readonly JsonSchemaNode[] | SchemaSnapshotFailure {
  if (value === null || typeof value !== 'object' || !isSchemaArray(value)) {
    return OMIT_SCHEMA_VALUE;
  }
  if (budget.seen.has(value))
    return budget.seen.get(value)! as readonly JsonSchemaNode[];
  const checkpoint = checkpointSchemaSnapshot(budget);
  const sourceLength = safeArrayLength(value);
  if (sourceLength === UNSAFE_SCHEMA_DESCRIPTOR) return OMIT_SCHEMA_VALUE;
  const output = new Array<JsonSchemaNode>(
    Math.min(sourceLength, SCHEMA_SNAPSHOT_ARRAY_LENGTH_LIMIT)
  );
  rememberSchemaSnapshot(budget, value, output);
  try {
    for (const key in value) {
      if (!consumeSchemaInspection(budget)) break;
      const index = isArrayIndex(key) ? Number(key) : null;
      if (index !== null && index >= output.length) continue;
      const descriptor = ownEnumerableDataDescriptor(value, key);
      if (
        descriptor === MISSING_SCHEMA_DESCRIPTOR ||
        descriptor === ACCESSOR_SCHEMA_DESCRIPTOR
      )
        continue;
      if (descriptor === UNSAFE_SCHEMA_DESCRIPTOR) {
        restoreSchemaSnapshot(budget, checkpoint);
        return OMIT_SCHEMA_VALUE;
      }
      const entryCheckpoint = checkpointSchemaSnapshot(budget);
      const entry = index !== null
        ? snapshotSchemaNode(descriptor.value, depth, budget)
        : snapshotSchemaValue(descriptor.value, budget, depth);
      if (entry === OMIT_SCHEMA_VALUE) {
        restoreSchemaSnapshot(budget, entryCheckpoint);
        continue;
      }
      if (entry === DEPTH_LIMIT_SCHEMA_VALUE) continue;
      if (entry === NODE_LIMIT_SCHEMA_VALUE) {
        if (index !== null) output.length = index;
        break;
      }
      defineSnapshotValue(output, key, entry);
    }
  } catch {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  const frozen = finishSchemaSnapshot(output);
  if (frozen === OMIT_SCHEMA_VALUE) {
    restoreSchemaSnapshot(budget, checkpoint);
    return OMIT_SCHEMA_VALUE;
  }
  return frozen as readonly JsonSchemaNode[];
}

/**
 * Bounded, descriptor-safe, cycle-safe clone of a caller-supplied schema tree, run in place of
 * `LyraElement`'s generic `ownedCollectionProperties` snapshot. It accepts only arrays and
 * plain/null-prototype records, reads own enumerable data descriptors without invoking getters,
 * and freezes a detached result before assignment. Each malformed branch restores its provisional
 * node and cycle mappings before omission; genuine node/depth ceilings retain the safely cloned
 * prefix needed by the viewer's existing bounded rendering path.
 */
/** Bounded, clone-owned root entry point for {@link snapshotSchemaNode}. */
function snapshotSchema(value: unknown): JsonSchemaNode | null {
  const snapshot = snapshotSchemaNode(value, 0, {
    remaining: SCHEMA_SNAPSHOT_NODE_LIMIT,
    remainingInspections: SCHEMA_SNAPSHOT_INSPECTION_LIMIT,
    seen: new Map<object, object>(),
    additions: [],
  });
  return isSchemaSnapshotFailure(snapshot) ? null : snapshot;
}

/**
 * `<lr-json-schema-viewer>` — a recursive, selectable JSON Schema inspector with required-state,
 * constraints, composition branches, `$ref` display, validation issues, cycle protection, and a
 * configurable depth ceiling. It does not resolve remote references or validate values.
 *
 * Public schema records and issue collections take bounded, clone-owned readonly snapshots.
 * Schema records recursively copy supported own data fields without invoking accessors; unsupported
 * or unsafe branches are omitted while valid siblings remain. Create and reassign a new record or
 * array after changes; mutating the assigned value does not update the view.
 *
 * @customElement lr-json-schema-viewer
 * @event lr-schema-select - A schema node was activated. `detail: { schemaPath, schema }`.
 * @csspart base - The named schema region.
 * @csspart tree - The recursive schema tree.
 * @csspart node - One schema node.
 * @csspart node-selected - The selected schema node.
 * @csspart node-trigger - A schema-node activation button.
 * @csspart name - Property/branch name.
 * @csspart type - Schema type badge.
 * @csspart required - Required badge.
 * @csspart description - Caller-supplied schema description.
 * @csspart constraints - Recognized schema constraints.
 * @csspart issue - One caller-supplied validation issue.
 * @csspart limit - Resource-ceiling status shown when additional nodes are omitted.
 * @csspart issue-limit - Resource-ceiling status shown when additional validation issues are omitted.
 * @csspart empty - The empty state.
 * @cssprop [--lr-schema-viewer-selected-border=var(--lr-color-brand)] - Selected node branch.
 * @cssprop [--lr-schema-viewer-max-indent=var(--lr-size-12rem)] - Maximum visual indentation;
 *   complete JSON Pointer paths and selection semantics remain unchanged at deeper levels.
 * @cssprop [--lr-schema-viewer-error-border=var(--lr-color-danger)] - Error issue border.
 * @cssprop [--lr-schema-viewer-error-bg=var(--lr-color-danger-quiet)] - Error issue background.
 * @cssprop [--lr-schema-viewer-warning-border=var(--lr-color-warning)] - Warning issue border.
 * @cssprop [--lr-schema-viewer-warning-bg=var(--lr-color-warning-quiet)] - Warning issue background.
 * @cssprop [--lr-schema-viewer-info-border=var(--lr-color-brand)] - Info issue border.
 * @cssprop [--lr-schema-viewer-info-bg=var(--lr-color-brand-quiet)] - Info issue background.
 * @status stable
 * @since 9.0.0
 */
export class LyraJsonSchemaViewer extends LyraElement<LyraJsonSchemaViewerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    schemaViewerCircular: LYRA_DEFAULT_schemaViewerCircular,
    schemaViewerEmpty: LYRA_DEFAULT_schemaViewerEmpty,
    schemaViewerIssueLimit: LYRA_DEFAULT_schemaViewerIssueLimit,
    schemaViewerLabel: LYRA_DEFAULT_schemaViewerLabel,
    schemaViewerLimit: LYRA_DEFAULT_schemaViewerLimit,
    schemaViewerRequired: LYRA_DEFAULT_schemaViewerRequired,
    schemaViewerType: LYRA_DEFAULT_schemaViewerType,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'issues',
  ]);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-schema-select',
  ]);

  private schemaValue: JsonSchemaNode | null = null;

  /** Clone-owned recursive schema snapshot. Reassign a new record after changing any branch.
   *  Bounded and depth-clamped by {@link snapshotSchemaNode}; a malformed branch is omitted
   *  without discarding admitted siblings. A runtime non-array `required` keyword is absent. */
  @property({ attribute: false })
  get schema(): JsonSchemaNode | null {
    return this.schemaValue;
  }
  set schema(value: JsonSchemaNode | null) {
    const previous = this.schemaValue;
    this.schemaValue = snapshotSchema(value);
    this.requestUpdate('schema', previous);
  }
  @property({ attribute: false }) issues: readonly SchemaValidationIssue[] = [];
  /** Controlled JSON Pointer selection. `null` means no selection; the empty
   *  string is the valid JSON Pointer for the schema root. */
  @property({ attribute: 'selected-path' }) selectedPath: string | null = null;
  /** Requested nesting depth, clamped to 100 to keep recursive template construction stack-safe. */
  @property({ type: Number, attribute: 'max-depth' }) maxDepth = 20;
  @property() label = '';
  private announcementSink?: AnnouncementSink;
  private previousNodeLimitText = '';
  private previousIssueLimitText = '';
  private suppressNextLimitAnnouncement = true;

  private syncAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument)
      return;
    this.announcementSink?.release();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
    // A reconnected or adopted component first snapshots the limits already visible in its new
    // context. They are resting content, not fresh transitions caused after that connection.
    if (this.hasUpdated) {
      this.suppressNextLimitAnnouncement = true;
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.announcementSink?.release();
    this.announcementSink = undefined;
    this.suppressNextLimitAnnouncement = true;
  }

  protected override updated(_changed: PropertyValues<this>): void {
    super.updated(_changed);
    const nodeText =
      this.renderRoot.querySelector('[part="limit"]')?.textContent?.trim() ??
      '';
    const issueText =
      this.renderRoot
        .querySelector('[part="issue-limit"]')
        ?.textContent?.trim() ?? '';
    if (!this.suppressNextLimitAnnouncement) {
      if (nodeText && nodeText !== this.previousNodeLimitText)
        this.announcementSink?.announce(nodeText);
      if (issueText && issueText !== this.previousIssueLimitText)
        this.announcementSink?.announce(issueText);
    }
    this.previousNodeLimitText = nodeText;
    this.previousIssueLimitText = issueText;
    this.suppressNextLimitAnnouncement = false;
  }

  private pointerSegment(value: string): string {
    return value.replace(/~/g, '~0').replace(/\//g, '~1');
  }

  private constraints(schema: JsonSchemaNode): string[] {
    const keys = [
      'format',
      'pattern',
      'minimum',
      'maximum',
      'minLength',
      'maxLength',
      'minItems',
      'maxItems',
      'minProperties',
      'maxProperties',
    ];
    const rows = keys.flatMap((key) =>
      schema[key] == null ? [] : [`${key}: ${constraintValue(schema[key])}`]
    );
    if (schema.enum) {
      const values = schema.enum
        .slice(0, MAX_CONSTRAINT_VALUES)
        .map(constraintValue);
      rows.push(
        `enum: [${values.join(', ')}${
          schema.enum.length > values.length ? ', …' : ''
        }]`
      );
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'const'))
      rows.push(`const: ${constraintValue(schema.const)}`);
    if (Object.prototype.hasOwnProperty.call(schema, 'default'))
      rows.push(`default: ${constraintValue(schema.default)}`);
    if (schema.examples) {
      const examples = schema.examples
        .slice(0, MAX_CONSTRAINT_VALUES)
        .map(constraintValue);
      rows.push(
        `examples: [${examples.join(', ')}${
          schema.examples.length > examples.length ? ', …' : ''
        }]`
      );
    }
    if (schema.$ref)
      rows.push(
        `$ref: ${schema.$ref.slice(0, MAX_CONSTRAINT_VALUE_CHARACTERS)}`
      );
    return rows;
  }

  private renderNode(
    name: string,
    schema: JsonSchemaNode,
    path: string,
    required: boolean,
    depth: number,
    ancestors: Set<object>,
    budget: SchemaRenderBudget,
    issuesByPath: ReadonlyMap<string, readonly SchemaValidationIssue[]>
  ): TemplateResult | typeof nothing {
    if (budget.remaining <= 0) {
      budget.truncated = true;
      return nothing;
    }
    budget.remaining--;
    const selected = path === this.selectedPath;
    if (ancestors.has(schema)) {
      return html`<li part="node">
        <span part="description">${this.localize('schemaViewerCircular')}</span>
      </li>`;
    }
    const nextAncestors = new Set(ancestors).add(schema);
    const type = isReadonlyArray(schema.type)
      ? schema.type.join(' | ')
      : schema.type ?? (schema.properties ? 'object' : '');
    const constraints = this.constraints(schema);
    const issues = issuesByPath.get(path) ?? [];
    const children: Array<{
      name: string;
      node: JsonSchemaNode;
      path: string;
      required: boolean;
    }> = [];
    const addChild = (child: {
      name: string;
      node: JsonSchemaNode;
      path: string;
      required: boolean;
    }): boolean => {
      if (children.length >= budget.remaining) {
        budget.truncated = true;
        return false;
      }
      children.push(child);
      return true;
    };
    if (depth < finiteCount(this.maxDepth, 20, MAX_SCHEMA_DEPTH)) {
      const properties = schema.properties ?? {};
      for (const key in properties) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) continue;
        const node = properties[key];
        if (!node) continue;
        if (
          !addChild({
            name: key,
            node,
            path: `${path}/properties/${this.pointerSegment(key)}`,
            required:
              Array.isArray(schema.required) && schema.required.includes(key),
          })
        )
          break;
      }
      for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
        const nodes = schema[keyword] ?? [];
        for (const key of Object.keys(nodes)) {
          if (!isArrayIndex(key)) continue;
          const index = Number(key);
          const node = nodes[index];
          if (!node) continue;
          if (
            !addChild({
              name: `${keyword}[${index}]`,
              node,
              path: `${path}/${keyword}/${index}`,
              required: false,
            })
          )
            break;
        }
      }
      if (isReadonlyArray(schema.items)) {
        for (const key of Object.keys(schema.items)) {
          if (!isArrayIndex(key)) continue;
          const index = Number(key);
          const node = schema.items[index];
          if (!node) continue;
          if (
            !addChild({
              name: `items[${index}]`,
              node,
              path: `${path}/items/${index}`,
              required: false,
            })
          )
            break;
        }
      } else if (schema.items) {
        addChild({
          name: 'items',
          node: schema.items,
          path: `${path}/items`,
          required: false,
        });
      }
    }
    const nodePart = selected ? 'node node-selected' : 'node';
    return html`
      <li part=${nodePart} style=${`--_lr-schema-depth:${depth}`}>
        <button
          part="node-trigger"
          type="button"
          data-path=${path}
          aria-pressed=${selected ? 'true' : 'false'}
          @click=${() =>
            this.emit('lr-schema-select', { schemaPath: path, schema })}
        >
          <strong part="name">${name}</strong>
          ${type
            ? html`<lr-badge part="type" variant="neutral"
                >${this.localize('schemaViewerType', undefined, {
                  type,
                })}</lr-badge
              >`
            : nothing}
          ${required
            ? html`<lr-badge part="required" variant="danger"
                >${this.localize('schemaViewerRequired')}</lr-badge
              >`
            : nothing}
        </button>
        ${schema.description
          ? html`<p part="description">${schema.description}</p>`
          : nothing}
        ${constraints.length
          ? html`<ul part="constraints">
              ${constraints.map((row) => html`<li>${row}</li>`)}
            </ul>`
          : nothing}
        ${issues.map(
          (issue) =>
            html`<p part="issue" data-severity=${issue.severity ?? 'error'}>
              ${issue.message}
            </p>`
        )}
        ${children.length
          ? html`<ul>
              ${children.map((child) =>
                this.renderNode(
                  child.name,
                  child.node,
                  child.path,
                  child.required,
                  depth + 1,
                  nextAncestors,
                  budget,
                  issuesByPath
                )
              )}
            </ul>`
          : nothing}
      </li>
    `;
  }

  override render(): TemplateResult {
    const label = overallSemanticLabel(
      this,
      this.label || this.localize('schemaViewerLabel')
    );
    if (!this.schema || typeof this.schema !== 'object') {
      return html`<section part="base" aria-label=${label ?? nothing}>
        <lr-empty
          part="empty"
          heading=${this.localize('schemaViewerEmpty')}
        ></lr-empty>
      </section>`;
    }
    const budget: SchemaRenderBudget = {
      remaining: MAX_RENDERED_SCHEMA_NODES,
      truncated: false,
    };
    const issuesByPath = new Map<string, SchemaValidationIssue[]>();
    const visibleIssueCount = Math.min(
      this.issues.length,
      MAX_RENDERED_SCHEMA_ISSUES
    );
    for (let index = 0; index < visibleIssueCount; index++) {
      const issue = this.issues[index];
      if (!issue) continue;
      const pathIssues = issuesByPath.get(issue.path) ?? [];
      pathIssues.push(issue);
      issuesByPath.set(issue.path, pathIssues);
    }
    const tree = this.renderNode(
      this.schema.title || '$',
      this.schema,
      '',
      false,
      0,
      new Set(),
      budget,
      issuesByPath
    );
    return html`
      <section part="base" aria-label=${label ?? nothing}>
        <ul part="tree">${tree}</ul>
        ${budget.truncated
          ? html`<p part="limit">${this.localize('schemaViewerLimit', undefined, {
                count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_SCHEMA_NODES),
              })}</p>`
          : nothing}
        ${this.issues.length > MAX_RENDERED_SCHEMA_ISSUES
          ? html`<p part="issue-limit">${this.localize('schemaViewerIssueLimit', undefined, {
                count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_SCHEMA_ISSUES),
              })}</p>`
          : nothing}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-json-schema-viewer': LyraJsonSchemaViewer;
  }
}
