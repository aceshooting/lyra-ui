/**
 * DOM-free, bounded allowlist resolution for `<lr-widget-renderer>`. Authored input is copied into
 * a capped snapshot exactly once before validation/resolution, so getters and sibling indices
 * outside the admitted prefix are never touched and later passes cannot observe mutation.
 */
import {
  isWidgetTypeRegistry,
  type WidgetTypeDefinition,
  type WidgetTypeRegistry,
} from "./registry.js";

export interface WidgetNode {
  type: string;
  id?: string;
  props?: Record<string, unknown>;
  children?: (WidgetNode | string)[];
  slot?: string;
  actionId?: string;
  payload?: unknown;
}

export interface WidgetBinding {
  $bind: string;
  fallback?: string | number | boolean | null;
}

/** Version-two document. Controlled binding state is supplied separately through `bindingState`. */
export interface LyraWidgetDocument {
  version: "2";
  root: WidgetNode;
}

/** Mechanical migration helper for the former `.tree` property. */
export function createWidgetDocument(root: WidgetNode): LyraWidgetDocument {
  return { version: "2", root };
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
  registry: WidgetTypeRegistry;
  bindingState: unknown;
  /** Warning keys retained for one renderer document/registry generation. */
  warned: Set<string>;
  warn?: (message: string) => void;
}

export const WIDGET_MAX_DEPTH = 32;
export const WIDGET_MAX_NODES = 5000;
export const WIDGET_MAX_PROPS_PER_NODE = 100;
export const WIDGET_MAX_WARNINGS = 100;

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

function isBinding(value: unknown): value is WidgetBinding {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as WidgetBinding).$bind === "string"
  );
}

function decodePointerSegment(raw: string): string | undefined {
  let decoded = "";
  for (let index = 0; index < raw.length; index++) {
    const character = raw[index]!;
    if (character !== "~") {
      decoded += character;
      continue;
    }
    const escaped = raw[++index];
    if (escaped === "0") decoded += "~";
    else if (escaped === "1") decoded += "/";
    else return undefined;
  }
  return decoded;
}

function canonicalArrayIndex(segment: string): number | undefined {
  if (!/^(?:0|[1-9][0-9]*)$/.test(segment)) return undefined;
  const index = Number(segment);
  return Number.isSafeInteger(index) ? index : undefined;
}

/** Resolves an RFC 6901 pointer without accepting noncanonical array-index spellings. */
export function readWidgetPointer(root: unknown, path: string): unknown {
  if (path === "") return root;
  if (!path.startsWith("/")) return undefined;
  let current = root;
  for (const raw of path.slice(1).split("/")) {
    const segment = decodePointerSegment(raw);
    if (segment === undefined) return undefined;
    if (
      segment === "__proto__" ||
      segment === "prototype" ||
      segment === "constructor"
    ) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = canonicalArrayIndex(segment);
      if (index === undefined || index >= current.length) return undefined;
      current = current[index];
    } else if (
      current &&
      typeof current === "object" &&
      Object.hasOwn(current, segment)
    ) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
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

interface SnapshotNode extends WidgetNode {
  children?: (SnapshotNode | string)[];
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
  registry: WidgetTypeRegistry
): Readonly<WidgetTypeDefinition> | undefined {
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
  if (children.length > 0) node.children = children;
  return node;
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
  def: Readonly<WidgetTypeDefinition>,
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
  root: WidgetNode | null | undefined,
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
