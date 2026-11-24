/** Serializable values admitted at the generated-content boundary. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;
export interface JsonObject { readonly [key: string]: JsonValue }

interface SchemaAnnotations {
  readonly description?: string;
  readonly enum?: readonly JsonPrimitive[];
  readonly default?: JsonValue;
}

/** A deliberately bounded JSON Schema subset; no executable validators or references. */
export type LyraGenSchema = SchemaAnnotations & (
  | { readonly type: 'string'; readonly minLength?: number; readonly maxLength?: number }
  | { readonly type: 'number' | 'integer'; readonly minimum?: number; readonly maximum?: number }
  | { readonly type: 'boolean' | 'null' }
  | { readonly type: 'array'; readonly items: LyraGenSchema; readonly minItems?: number; readonly maxItems?: number }
  | { readonly type: 'object'; readonly properties: Readonly<Record<string, LyraGenSchema>>; readonly required?: readonly string[]; readonly additionalProperties?: false }
  | LyraGenMapSchema
  | { readonly anyOf: readonly LyraGenSchema[] }
);

/**
 * A bounded map-like object: declared `properties` keep their own schemas and every other key is
 * validated by `additionalProperties`. `maxProperties` (all keys, declared ones included) and
 * `propertyNames.maxLength` are required, so a generated map can never be wider or carry longer
 * keys than the host admitted; prototype-related keys are always refused.
 */
export interface LyraGenMapSchema extends SchemaAnnotations {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, LyraGenSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties: LyraGenSchema;
  readonly minProperties?: number;
  readonly maxProperties: number;
  readonly propertyNames: { readonly type?: 'string'; readonly minLength?: number; readonly maxLength: number };
}

export interface LyraGenLimits {
  readonly maxBytes: number;
  readonly maxDepth: number;
  /** JSON value count per input or schema snapshot, and schema validation work ceiling; not a rendered component count. */
  readonly maxNodes: number;
  readonly maxStringLength: number;
  readonly maxArrayLength: number;
  readonly maxObjectKeys: number;
  readonly maxDiagnostics: number;
}

export interface LyraGenSourceRange { readonly start: number; readonly end: number }
export interface LyraGenDiagnostic {
  readonly code: string;
  /** JSON Pointer into the supplied value; the empty string denotes its root. */
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
  /** Offsets in original UTF-16 source, when available. */
  readonly source?: LyraGenSourceRange;
  readonly hint?: string;
}
export type LyraGenResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly LyraGenDiagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly LyraGenDiagnostic[] };

/** `'strict'` (default) rejects any error; `'isolate'` contains component-local errors in place. */
export type LyraGenRecoveryMode = 'strict' | 'isolate';
/** One subtree replaced by an isolation marker; its diagnostics are also reported as warnings. */
export interface LyraGenIsolation {
  readonly nodeId: string;
  /** JSON Pointer of the isolated node in the supplied view. */
  readonly path: string;
  readonly diagnostics: readonly LyraGenDiagnostic[];
}
/** View validation result; `isolated` is present only in `'isolate'` mode when a subtree was contained. */
export type LyraGenValidationResult = LyraGenResult<LyraGenView> & { readonly isolated?: readonly LyraGenIsolation[] };

export interface LyraGenDataReference { readonly $ref: string }
export interface LyraGenActionBinding { readonly name: string; readonly payload?: JsonValue }
export interface LyraGenNode {
  readonly id: string;
  readonly type: string;
  readonly props?: Readonly<Record<string, JsonValue>>;
  readonly children?: readonly LyraGenNode[];
  readonly text?: string;
  readonly slot?: string;
  /** Component property to local-state JSON Pointer. */
  readonly bindings?: Readonly<Record<string, string>>;
  /**
   * Component property read from local state: property to the JSON Pointer of a state path that a
   * binding in the same view owns (or a path inside it). The read value replaces `props[property]`
   * while it exists and satisfies the property schema; otherwise `props[property]` applies. Reads
   * never write state, and URL sinks cannot be read.
   */
  readonly reads?: Readonly<Record<string, string>>;
  /**
   * Component property shown from host-published live data (`lr-gen-view.liveData`): property to
   * a JSON Pointer into that data. The live value replaces `props[property]` while it exists and
   * satisfies the property schema; generated content can only choose what to display, never
   * publish or write live data. URL sinks cannot be live.
   */
  readonly liveReads?: Readonly<Record<string, string>>;
  /**
   * A host-declared catalog query this node displays. `params` are literal arguments and
   * `paramReads` map argument names to owned local-state pointers (filters, selection, time range),
   * so the query re-runs when they change. The node's `liveReads` then read from this query's
   * result instead of `lr-gen-view.liveData`. The host executes queries; generated content never does.
   */
  readonly dataQuery?: LyraGenDataQuery;
  /**
   * Repeat this node's single child (the item template) once per item of an array: `items` points into
   * host live data (or this node's `dataQuery` result) by default, or into owned local state with
   * `from: 'state'`; `key` points inside each item to a string or safe-integer identity. Rendered
   * items keep their elements and focus across updates and reorders; templates cannot bind state,
   * start actions, run queries or repeat.
   */
  readonly repeat?: LyraGenRepeat;
  /** Inside a repeat template: a declared, non-URL property shown from the current item (pointer relative to the item; '' is the item). */
  readonly itemReads?: Readonly<Record<string, string>>;
  /** Show this node only while the condition holds; a hidden node keeps its element, identity and state. */
  readonly visible?: LyraGenCondition;
  /** Every condition must hold, otherwise a role with a `disabled` property is rendered disabled (for example a submit button). */
  readonly checks?: readonly LyraGenCondition[];
  /** Declared, non-URL properties computed by a host-registered pure function from referenced values; a failure keeps `props`. */
  readonly computes?: Readonly<Record<string, LyraGenComputation>>;
  /**
   * Per-node accessibility: `label` fills the role's own accessible-name property when the node does
   * not set it, `description` becomes `aria-description`, and on non-interactive roles `live` sets a
   * polite or off live region and `hidden` removes decorative content from the accessibility tree.
   */
  readonly a11y?: LyraGenNodeAccessibility;
  readonly action?: LyraGenActionBinding;
}
/** A value read from owned local state, host live data or the current repeat item. */
export interface LyraGenValueRef { readonly source: 'state' | 'live' | 'item'; readonly pointer: string }
export type LyraGenConditionOperator = 'truthy' | 'falsy' | 'equals' | 'notEquals' | 'in' | 'gt' | 'gte' | 'lt' | 'lte';
export interface LyraGenCondition extends LyraGenValueRef {
  readonly op: LyraGenConditionOperator;
  /** Compared literal; `in` takes an array of at most 64 literals. */
  readonly value?: JsonValue;
}
export interface LyraGenComputation {
  /** Name of a function in the host registry (`lr-gen-view.functions`). */
  readonly fn: string;
  /** One argument reference, an array of references, or a literal `{ value }`. */
  readonly arg: LyraGenValueRef | { readonly value: JsonValue } | readonly LyraGenValueRef[];
}
export interface LyraGenNodeAccessibility {
  readonly label?: string;
  readonly description?: string;
  readonly live?: 'off' | 'polite';
  readonly hidden?: boolean;
}
export interface LyraGenRepeat {
  readonly items: string;
  readonly key: string;
  readonly from?: 'live' | 'state';
  /** At most this many items render (default and ceiling 200). */
  readonly max?: number;
}
export interface LyraGenDataQuery {
  readonly name: string;
  readonly params?: Readonly<Record<string, JsonValue>>;
  readonly paramReads?: Readonly<Record<string, string>>;
}
export interface LyraGenCatalogReference { readonly id: string; readonly version: string }
export interface LyraGenView {
  readonly version: '1';
  readonly catalog: LyraGenCatalogReference;
  readonly surfaceId: string;
  readonly revision: number;
  readonly root: LyraGenNode;
}

export interface LyraGenBindingDefinition {
  readonly event: string;
  /** Property read from the control after its declared event. */
  readonly property: string;
}
export interface LyraGenAccessibleName {
  readonly required: boolean;
  readonly properties?: readonly string[];
  readonly text?: boolean;
}
/** Trusted collection intent, never inferred from generated labels. */
export type LyraGenFieldPurpose = 'general' | 'password' | 'one-time-code' | 'payment-card' | 'secret';
export interface LyraGenApprovedField {
  readonly surfaceId: string;
  /** The complete reviewed field node, including presentation, state paths and actions. */
  readonly node: LyraGenNode;
  readonly purpose: LyraGenFieldPurpose;
  readonly allowSensitive?: boolean;
}
export interface LyraGenFieldPolicy {
  /** Require an exact host-approved declaration for every collecting node. */
  readonly requireApprovedFields?: boolean;
  readonly approvedFields?: readonly LyraGenApprovedField[];
}
export interface LyraGenUrlPolicy {
  /** Exact canonical HTTPS origins; no wildcard, relative URL or inherited origin authority. */
  readonly origins: readonly string[];
}
export interface LyraGenUrlSink extends LyraGenUrlPolicy {
  /** Direct navigation is intentionally outside the declarative property profile. */
  readonly kind: 'media';
}

export interface LyraGenComponent {
  /** Trusted custom-element or structural tag, never supplied by generated content. */
  readonly tag: string;
  readonly properties: Readonly<Record<string, LyraGenSchema>>;
  readonly required?: readonly string[];
  readonly slots?: readonly string[];
  /** Allowed child catalog types; true allows all types in the active catalog. */
  readonly children?: boolean | readonly string[];
  /**
   * The subset of the listed `children` roles that this component renders fine without. A subset
   * catalog may leave an optional child role out; it is then removed from the allowed children, so
   * generated content placing it under this parent is rejected. Every other listed child is required
   * and fails `subsetCatalog()` with `catalog.dependency` when unselected.
   */
  readonly optionalChildren?: readonly string[];
  readonly text?: boolean;
  readonly interactive?: boolean;
  /** Trusted intent for any role that accepts user input, even without state bindings. */
  readonly fieldPurpose?: LyraGenFieldPurpose;
  /** Reviewed URL sinks by top-level property; bindings to these properties are forbidden. */
  readonly urlSinks?: Readonly<Record<string, LyraGenUrlSink>>;
  readonly accessibleName?: LyraGenAccessibleName;
  /** Only these native/component events can initiate this node's declared action. */
  readonly events?: readonly string[];
  readonly bindings?: Readonly<Record<string, LyraGenBindingDefinition>>;
  /**
   * Trusted host adapter deriving an action payload from the event that initiated it (for example an
   * embedded app's tool request). Its result replaces the node's generated payload and is validated
   * against the action schema like any payload; returning `undefined` keeps the generated one, and a
   * throw denies the action.
   */
  readonly eventPayload?: (event: Event) => JsonValue | undefined;
  /**
   * Element properties only `prepareProperties` may supply, such as host callbacks or locale-bound
   * formatters. The view assigns them from the adapter's output, but they are never part of
   * `properties`: generated content cannot set or bind them, and `buildCatalogPrompt()`,
   * `exportCatalogArtifact()` and `exportCatalogJsonSchema()` omit them. Requires
   * `prepareProperties`; names must not overlap `properties` or be URL/navigation sinks.
   */
  readonly hostProperties?: readonly string[];
  /** Trusted host-only adaptation after JSON validation; never supplied by generated content. */
  readonly prepareProperties?: (props: Readonly<Record<string, JsonValue>>, context?: { readonly locale: string }) => Readonly<Record<string, unknown>>;
  readonly load?: () => Promise<unknown>;
  /**
   * Trusted block expansion. Called only after the node's own properties validate; returns the
   * primitive replacement node (same `id`, children ids derived as `<id>--<index>`), which is then
   * validated like any generated node.
   */
  readonly expand?: (node: LyraGenNode) => LyraGenNode;
  readonly minimumBlockSize?: string;
  readonly description?: string;
  readonly useWhen?: string;
  readonly examples?: readonly LyraGenNode[];
  readonly documentation?: string;
}
export interface LyraGenActionDefinition {
  readonly payload: LyraGenSchema;
  /** Host-owned policy; generated documents cannot override it. */
  readonly confirm?: boolean;
  readonly description?: string;
}
/** A host data query generated content may name; the host's query provider executes it. */
export interface LyraGenQueryDefinition {
  /** Object schema every resolved argument set must satisfy before the host is asked to run it. */
  readonly params: LyraGenSchema;
  /** Optional schema the result must satisfy before nodes may display it. */
  readonly result?: LyraGenSchema;
  readonly description?: string;
}
export interface LyraGenCatalog extends LyraGenCatalogReference {
  readonly components: Readonly<Record<string, LyraGenComponent>>;
  readonly actions?: Readonly<Record<string, LyraGenActionDefinition>>;
  /** Host-allowlisted data queries; generated nodes reference them by name through `dataQuery`. */
  readonly queries?: Readonly<Record<string, LyraGenQueryDefinition>>;
  readonly fieldPolicy?: LyraGenFieldPolicy;
}
export interface LyraGenAction {
  readonly surfaceId: string;
  readonly nodeId: string;
  readonly revision: number;
  readonly name: string;
  readonly payload: JsonValue;
}
