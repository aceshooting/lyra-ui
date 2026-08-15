/**
 * DOM-free, bounded allowlist resolution for `<lr-widget-renderer>`. Authored input is copied into
 * a capped snapshot exactly once before validation/resolution, so getters and sibling indices
 * outside the admitted prefix are never touched and later passes cannot observe mutation.
 */
import {
  isWidgetTypeRegistry,
  type LyraWidgetTypeDefinition,
  type LyraWidgetTypeRegistry,
} from "./registry.js";
import {
  readWidgetPointer,
  WIDGET_MAX_DEPTH,
  WIDGET_MAX_NODES,
  WIDGET_MAX_PROPS_PER_NODE,
  WIDGET_MAX_WARNINGS,
} from "../../../internal/widget-resolver.js";

export interface LyraWidgetNode {
  readonly type: string;
  readonly id?: string;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly children?: readonly (LyraWidgetNode | string)[];
  readonly slot?: string;
  readonly actionId?: string;
  readonly payload?: unknown;
}

export interface LyraWidgetBinding {
  readonly $bind: string;
  readonly fallback?: string | number | boolean | null;
}

/** Version-two document. Controlled binding state is supplied separately through `bindingState`. */
export interface LyraWidgetDocument {
  readonly version: "2";
  readonly root: LyraWidgetNode;
}

const DOCUMENT_INVALID = Symbol("invalid-widget-document");
const DOCUMENT_MISSING = Symbol("missing-widget-document-field");

interface DocumentSnapshotContext {
  readonly ancestors: Set<object>;
  readonly ids: Set<string>;
  remaining: number;
}

function readDocumentField(
  input: object,
  key: PropertyKey
): unknown | typeof DOCUMENT_INVALID | typeof DOCUMENT_MISSING {
  try {
    return Object.hasOwn(input, key)
      ? Reflect.get(input, key)
      : DOCUMENT_MISSING;
  } catch {
    return DOCUMENT_INVALID;
  }
}

function snapshotDocumentProps(
  input: object
): Readonly<Record<string, unknown>> | typeof DOCUMENT_INVALID {
  const output: Record<string, unknown> = {};
  let admitted = 0;
  try {
    for (const key in input) {
      if (!Object.hasOwn(input, key)) continue;
      if (admitted >= WIDGET_MAX_PROPS_PER_NODE) break;
      const value = Reflect.get(input, key);
      admitted += 1;
      output[key] = value;
    }
  } catch {
    return DOCUMENT_INVALID;
  }
  return Object.freeze(output);
}

function snapshotDocumentNode(
  input: unknown,
  depth: number,
  context: DocumentSnapshotContext
): LyraWidgetNode | typeof DOCUMENT_INVALID | null {
  if (depth > WIDGET_MAX_DEPTH || context.remaining <= 0) return null;
  context.remaining -= 1;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return DOCUMENT_INVALID;
  }
  if (context.ancestors.has(input)) return DOCUMENT_INVALID;

  const type = readDocumentField(input, "type");
  if (typeof type !== "string") return DOCUMENT_INVALID;
  const id = readDocumentField(input, "id");
  const slot = readDocumentField(input, "slot");
  const actionId = readDocumentField(input, "actionId");
  const propsInput = readDocumentField(input, "props");
  const childrenInput = readDocumentField(input, "children");
  if (
    [id, slot, actionId, propsInput, childrenInput].includes(DOCUMENT_INVALID)
  ) {
    return DOCUMENT_INVALID;
  }
  if (
    id !== DOCUMENT_MISSING &&
    (typeof id !== "string" || id.length === 0 || id !== id.trim())
  ) {
    return DOCUMENT_INVALID;
  }
  if (typeof id === "string") {
    if (context.ids.has(id)) return DOCUMENT_INVALID;
    context.ids.add(id);
  }
  if (
    slot !== DOCUMENT_MISSING &&
    (typeof slot !== "string" || slot.length === 0 || slot !== slot.trim())
  ) {
    return DOCUMENT_INVALID;
  }
  if (
    actionId !== DOCUMENT_MISSING &&
    (typeof actionId !== "string" ||
      actionId.length === 0 ||
      actionId !== actionId.trim())
  ) {
    return DOCUMENT_INVALID;
  }
  if (
    propsInput !== DOCUMENT_MISSING &&
    (propsInput === null ||
      typeof propsInput !== "object" ||
      Array.isArray(propsInput))
  ) {
    return DOCUMENT_INVALID;
  }
  if (
    childrenInput !== DOCUMENT_MISSING &&
    !Array.isArray(childrenInput)
  ) {
    return DOCUMENT_INVALID;
  }

  const props =
    propsInput === DOCUMENT_MISSING
      ? undefined
      : snapshotDocumentProps(propsInput as object);
  if (props === DOCUMENT_INVALID) return DOCUMENT_INVALID;
  let payload: unknown | typeof DOCUMENT_MISSING = DOCUMENT_MISSING;
  if (actionId !== DOCUMENT_MISSING) {
    payload = readDocumentField(input, "payload");
    if (payload === DOCUMENT_INVALID) return DOCUMENT_INVALID;
  }

  const children: Array<LyraWidgetNode | string> = [];
  if (childrenInput !== DOCUMENT_MISSING && depth < WIDGET_MAX_DEPTH) {
    const length = readDocumentField(childrenInput, "length");
    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0
    ) {
      return DOCUMENT_INVALID;
    }
    context.ancestors.add(input);
    try {
      for (let index = 0; index < length && context.remaining > 0; index++) {
        const child = readDocumentField(childrenInput, index);
        if (child === DOCUMENT_INVALID || child === DOCUMENT_MISSING) {
          return DOCUMENT_INVALID;
        }
        if (typeof child === "string") {
          context.remaining -= 1;
          children.push(child);
          continue;
        }
        const snapshot = snapshotDocumentNode(child, depth + 1, context);
        if (snapshot === DOCUMENT_INVALID) return DOCUMENT_INVALID;
        if (snapshot) children.push(snapshot);
      }
    } finally {
      context.ancestors.delete(input);
    }
  }

  return Object.freeze({
    type,
    ...(typeof id === "string" ? { id } : {}),
    ...(typeof slot === "string" ? { slot } : {}),
    ...(typeof actionId === "string"
      ? {
          actionId,
          payload: payload === DOCUMENT_MISSING ? undefined : payload,
        }
      : {}),
    ...(props === undefined ? {} : { props }),
    ...(children.length === 0 ? {} : { children: Object.freeze(children) }),
  });
}

/**
 * Creates an immediate, bounded, frozen version-two document snapshot. Widget-owned structure and
 * prop records are copied; opaque prop values and action payloads intentionally retain identity.
 * Malformed, cyclic, duplicate-id, or hostile input throws `TypeError` before a document escapes.
 */
export function createWidgetDocument(root: LyraWidgetNode): LyraWidgetDocument {
  const snapshot = snapshotDocumentNode(root, 0, {
    ancestors: new Set(),
    ids: new Set(),
    remaining: WIDGET_MAX_NODES,
  });
  if (snapshot === DOCUMENT_INVALID || snapshot === null) {
    throw new TypeError("A widget document root must be a valid bounded widget node.");
  }
  return Object.freeze({ version: "2", root: snapshot });
}

export interface ResolvedText {
  /** Collision-free deterministic reconciliation key. */
  nodeKey: string;
  nodePath: string;
  kind: "text";
  text: string;
  slot?: string;
}

export interface ResolvedElement {
  /** Explicit public identity, when authored. Stateful/actionable mapped nodes always have one. */
  nodeId?: string;
  /** Collision-free deterministic key: authored id when present, otherwise structural path. */
  nodeKey: string;
  /** Deterministic occurrence path within this document. */
  nodePath: string;
  kind: "builtin-row" | "builtin-col" | "builtin-text" | "mapped";
  tag?: string;
  /** Semantic control classification, independent of actions and bindings. */
  interactive: boolean;
  props: Record<string, unknown>;
  actionEvent?: string;
  actionId?: string;
  payload?: unknown;
  bindings: Array<{ prop: string; path: string; event?: string }>;
  children: ResolvedNode[];
  slot?: string;
}

export type ResolvedNode = ResolvedText | ResolvedElement;

export interface ResolveContext {
  registry: LyraWidgetTypeRegistry;
  bindingState: unknown;
  /** Warning keys retained for one renderer document/registry generation. */
  warned: Set<string>;
  warn?: (message: string) => void;
}

const WARNING_SUPPRESSION_KEY = "__warning-cap__";
const INVALID = Symbol("invalid-widget-input");

const ROW_COL_PROP_ENUMS: Record<string, readonly string[]> = {
  gap: ["s", "m", "l"],
  align: ["start", "center", "end", "stretch"],
  justify: ["start", "center", "end", "between"],
};

function warnOnce(ctx: ResolveContext, key: string, message: string): void {
  if (ctx.warned.has(key)) return;
  if (ctx.warned.size >= WIDGET_MAX_WARNINGS) {
    if (ctx.warned.has(WARNING_SUPPRESSION_KEY)) return;
    ctx.warned.add(WARNING_SUPPRESSION_KEY);
    (ctx.warn ?? console.warn)(
      `[lr-widget-renderer] suppressed further diagnostics after ${WIDGET_MAX_WARNINGS} unique warnings`
    );
    return;
  }
  ctx.warned.add(key);
  (ctx.warn ?? console.warn)(`[lr-widget-renderer] ${message}`);
}

function isBinding(value: unknown): value is LyraWidgetBinding {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as LyraWidgetBinding).$bind === "string"
  );
}

function resolveValue(
  value: unknown,
  ctx: ResolveContext
): { value: unknown; path?: string } {
  if (!isBinding(value)) return { value };
  const resolved = readWidgetPointer(ctx.bindingState, value.$bind);
  return {
    value: resolved === undefined ? value.fallback : resolved,
    path: value.$bind,
  };
}

interface SnapshotNode extends LyraWidgetNode {
  readonly children?: readonly (SnapshotNode | string)[];
}

interface SnapshotContext {
  readonly resolve: ResolveContext;
  readonly ancestors: Set<object>;
  remaining: number;
}

function consumeNodeBudget(snapshot: SnapshotContext): boolean {
  if (snapshot.remaining <= 0) {
    warnOnce(
      snapshot.resolve,
      "__node-cap__",
      `stopped resolving after the ${WIDGET_MAX_NODES}-node cap was reached`
    );
    return false;
  }
  snapshot.remaining--;
  return true;
}

function snapshotProps(
  input: object,
  type: string,
  ctx: ResolveContext
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let visited = 0;
  for (const key in input) {
    if (visited >= WIDGET_MAX_PROPS_PER_NODE) {
      warnOnce(
        ctx,
        `__prop-cap__:${type}`,
        `stopped reading props on type "${type}" after the ${WIDGET_MAX_PROPS_PER_NODE}-prop cap was reached`
      );
      break;
    }
    visited++;
    if (!Object.hasOwn(input, key)) continue;
    out[key] = (input as Record<string, unknown>)[key];
  }
  return out;
}

function definitionFor(
  type: string,
  registry: LyraWidgetTypeRegistry
): Readonly<LyraWidgetTypeDefinition> | undefined {
  return registry.get(type);
}

function snapshotNode(
  input: unknown,
  depth: number,
  snapshot: SnapshotContext
): SnapshotNode | typeof INVALID | null {
  if (depth > WIDGET_MAX_DEPTH) {
    warnOnce(
      snapshot.resolve,
      "__depth-cap__",
      `stopped resolving after the ${WIDGET_MAX_DEPTH}-level depth cap was reached`
    );
    return null;
  }
  if (!consumeNodeBudget(snapshot)) return null;
  if (input === null || typeof input !== "object" || Array.isArray(input))
    return INVALID;
  if (snapshot.ancestors.has(input)) return INVALID;

  const candidate = input as Record<string, unknown>;
  const type = candidate["type"];
  if (typeof type !== "string") return INVALID;
  const builtin = type === "row" || type === "col" || type === "text";
  if (!builtin && !definitionFor(type, snapshot.resolve.registry)) {
    return { type };
  }

  const id = candidate["id"];
  if (
    id !== undefined &&
    (typeof id !== "string" || id.length === 0 || id !== id.trim())
  ) {
    return INVALID;
  }
  const slot = candidate["slot"];
  if (
    slot !== undefined &&
    (typeof slot !== "string" || slot.length === 0 || slot !== slot.trim())
  ) {
    return INVALID;
  }
  const actionId = candidate["actionId"];
  if (
    actionId !== undefined &&
    (typeof actionId !== "string" ||
      actionId.length === 0 ||
      actionId !== actionId.trim())
  ) {
    return INVALID;
  }
  const propsInput = candidate["props"];
  if (
    propsInput !== undefined &&
    (propsInput === null ||
      typeof propsInput !== "object" ||
      Array.isArray(propsInput))
  ) {
    return INVALID;
  }
  const childrenInput = candidate["children"];
  if (childrenInput !== undefined && !Array.isArray(childrenInput))
    return INVALID;

  const node: SnapshotNode = {
    type,
    ...(id !== undefined ? { id } : {}),
    ...(slot !== undefined ? { slot } : {}),
    ...(actionId !== undefined
      ? { actionId, payload: candidate["payload"] }
      : {}),
    ...(propsInput !== undefined
      ? { props: snapshotProps(propsInput, type, snapshot.resolve) }
      : {}),
  };
  if (childrenInput === undefined || depth === WIDGET_MAX_DEPTH) {
    if (childrenInput && childrenInput.length > 0) {
      warnOnce(
        snapshot.resolve,
        "__depth-cap__",
        `stopped resolving after the ${WIDGET_MAX_DEPTH}-level depth cap was reached`
      );
    }
    return node;
  }

  const children: (SnapshotNode | string)[] = [];
  snapshot.ancestors.add(input);
  try {
    const childCount = childrenInput.length;
    for (let index = 0; index < childCount; index++) {
      if (snapshot.remaining <= 0) {
        consumeNodeBudget(snapshot);
        break;
      }
      const child = childrenInput[index];
      if (typeof child === "string") {
        if (!consumeNodeBudget(snapshot)) break;
        children.push(child);
        continue;
      }
      const accepted = snapshotNode(child, depth + 1, snapshot);
      if (accepted === INVALID) return INVALID;
      if (accepted) children.push(accepted);
    }
  } finally {
    snapshot.ancestors.delete(input);
  }
  return children.length > 0 ? { ...node, children } : node;
}

function filterRowColProps(
  props: Record<string, unknown> | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props) return out;
  for (const [key, allowed] of Object.entries(ROW_COL_PROP_ENUMS)) {
    const value = props[key];
    if (typeof value === "string" && allowed.includes(value)) out[key] = value;
  }
  return out;
}

function filterMappedProps(
  props: Record<string, unknown> | undefined,
  def: Readonly<LyraWidgetTypeDefinition>,
  ctx: ResolveContext,
  type: string
): {
  props: Record<string, unknown>;
  bindings: Array<{ prop: string; path: string; event?: string }>;
} {
  const out: Record<string, unknown> = {};
  const bindings: Array<{ prop: string; path: string; event?: string }> = [];
  const allowlist = def.props ?? {};
  if (props) {
    for (const [key, rawValue] of Object.entries(props)) {
      const expectedType = allowlist[key];
      const { value, path } = resolveValue(rawValue, ctx);
      if (expectedType === undefined || typeof value !== expectedType) {
        warnOnce(
          ctx,
          `${type}:${key}`,
          `skipped disallowed or mistyped prop "${key}" on type "${type}"`
        );
        continue;
      }
      out[key] = value;
      if (path)
        bindings.push({ prop: key, path, event: def.bindings?.[key]?.event });
    }
  }
  return { props: { ...out, ...(def.forcedProps ?? {}) }, bindings };
}

function containsInteractive(node: ResolvedNode): boolean {
  if (node.kind === "text") return false;
  return node.interactive || node.children.some(containsInteractive);
}

function resolveChild(
  value: SnapshotNode | string,
  ctx: ResolveContext,
  path: string
): ResolvedNode | null {
  if (typeof value === "string") {
    return {
      nodeKey: `path:${path}`,
      nodePath: path,
      kind: "text",
      text: value,
    };
  }
  return resolveNode(value, ctx, path);
}

function resolveNode(
  node: SnapshotNode,
  ctx: ResolveContext,
  path: string
): ResolvedElement | null {
  const authoredId = node.id;
  const nodeKey = authoredId ? `id:${authoredId}` : `path:${path}`;

  let kind: ResolvedElement["kind"];
  let tag: string | undefined;
  let interactive = false;
  let props: Record<string, unknown>;
  let actionEvent: string | undefined;
  let bindings: Array<{ prop: string; path: string; event?: string }> = [];
  let slots: readonly string[] = [];

  if (node.type === "row" || node.type === "col") {
    kind = node.type === "row" ? "builtin-row" : "builtin-col";
    props = filterRowColProps(node.props);
  } else if (node.type === "text") {
    kind = "builtin-text";
    const resolved = resolveValue(node.props?.["value"], ctx);
    props =
      typeof resolved.value === "string" || typeof resolved.value === "number"
        ? { value: String(resolved.value) }
        : {};
    if (resolved.path) {
      if (!authoredId) {
        warnOnce(
          ctx,
          `__required-id__:${path}`,
          "rejected bound text without a stable id"
        );
        throw new TypeError("A bound widget node requires a stable id.");
      }
      bindings = [{ prop: "value", path: resolved.path }];
    }
  } else {
    const def = definitionFor(node.type, ctx.registry);
    if (!def) {
      warnOnce(
        ctx,
        node.type,
        `skipped unknown widget type "${node.type}" (and its subtree)`
      );
      return null;
    }
    kind = "mapped";
    tag = def.tag;
    interactive = def.interaction === "control";
    const filtered = filterMappedProps(node.props, def, ctx, node.type);
    props = filtered.props;
    bindings = filtered.bindings;
    slots = def.slots ?? [];
    if (node.actionId !== undefined && def.action)
      actionEvent = def.action.event;
    if ((actionEvent || bindings.length > 0) && !authoredId) {
      warnOnce(
        ctx,
        `__required-id__:${path}`,
        `rejected stateful or actionable type "${node.type}" without a stable id`
      );
      throw new TypeError(
        "A stateful or actionable widget node requires a stable id."
      );
    }
  }

  const children: ResolvedNode[] = [];
  for (let index = 0; index < (node.children?.length ?? 0); index++) {
    const resolvedChild = resolveChild(
      node.children![index]!,
      ctx,
      `${path}.${index}`
    );
    if (!resolvedChild) continue;
    if (interactive && containsInteractive(resolvedChild)) {
      warnOnce(
        ctx,
        `__nested-interactive__:${node.type}`,
        `skipped a control descendant inside control type "${node.type}"`
      );
      continue;
    }
    if (
      resolvedChild.slot !== undefined &&
      !slots.includes(resolvedChild.slot)
    ) {
      resolvedChild.slot = undefined;
    }
    children.push(resolvedChild);
  }

  return {
    nodeId: authoredId,
    nodeKey,
    nodePath: path,
    kind,
    tag,
    interactive,
    props,
    actionEvent,
    actionId: actionEvent ? node.actionId : undefined,
    payload: actionEvent ? node.payload : undefined,
    bindings,
    children,
    slot: node.slot,
  };
}

function hasDuplicateAuthoredIds(
  root: SnapshotNode,
  ctx: ResolveContext
): boolean {
  const counts = new Map<string, number>();
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.id) counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
    for (const child of node.children ?? []) {
      if (typeof child !== "string") pending.push(child);
    }
  }
  let duplicate = false;
  for (const [id, count] of counts) {
    if (count < 2) continue;
    duplicate = true;
    warnOnce(
      ctx,
      `__duplicate-id__:${id}`,
      `rejected duplicate widget id "${id}"`
    );
  }
  return duplicate;
}

/** Resolves one bounded immutable snapshot through `ctx.registry`. Structural invalidity returns
 * `null`; throwing getters/registry access propagate so the renderer can emit one normalized error. */
export function resolveTree(
  root: LyraWidgetNode | null | undefined,
  ctx: ResolveContext
): ResolvedNode | null {
  if (root == null) return null;
  if (!isWidgetTypeRegistry(ctx.registry)) {
    throw new TypeError(
      "A widget renderer registry must be created with createWidgetTypeRegistry()."
    );
  }
  const snapshot = snapshotNode(root, 0, {
    resolve: ctx,
    ancestors: new Set(),
    remaining: WIDGET_MAX_NODES,
  });
  if (snapshot === INVALID || snapshot === null) return null;
  if (hasDuplicateAuthoredIds(snapshot, ctx)) return null;
  return resolveNode(snapshot, ctx, "0");
}
