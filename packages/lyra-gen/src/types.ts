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
  | { readonly anyOf: readonly LyraGenSchema[] }
);

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
  readonly action?: LyraGenActionBinding;
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
export interface LyraGenCatalog extends LyraGenCatalogReference {
  readonly components: Readonly<Record<string, LyraGenComponent>>;
  readonly actions?: Readonly<Record<string, LyraGenActionDefinition>>;
  readonly fieldPolicy?: LyraGenFieldPolicy;
}
export interface LyraGenAction {
  readonly surfaceId: string;
  readonly nodeId: string;
  readonly revision: number;
  readonly name: string;
  readonly payload: JsonValue;
}
