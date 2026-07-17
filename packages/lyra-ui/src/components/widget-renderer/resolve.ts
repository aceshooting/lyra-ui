/**
 * Pure, DOM-free allowlist resolution for `<lyra-widget-renderer>`'s declarative JSON widget tree.
 * This module never imports or calls a raw-HTML-parsing rendering API of any kind -- every value
 * that reaches a rendered `lyra-*` tag has passed an explicit type-key lookup against the type
 * registry plus a per-prop primitive-type check against that type's `WidgetTypeDefinition`. An
 * unregistered `type` is rejected outright (its whole subtree is skipped), and a prop not declared
 * in `props` is silently dropped rather than forwarded.
 */
import type { WidgetTypeRegistry } from './registry.js';

export interface WidgetNode {
  type: string;
  id?: string;
  props?: Record<string, unknown>;
  children?: (WidgetNode | string)[];
  slot?: string;
  actionId?: string;
  payload?: unknown;
}

export interface ResolvedText {
  key: string;
  kind: 'text';
  text: string;
  slot?: string;
}

export interface ResolvedElement {
  key: string;
  kind: 'builtin-row' | 'builtin-col' | 'builtin-text' | 'mapped';
  tag?: string;
  props: Record<string, unknown>;
  actionEvent?: string;
  actionId?: string;
  payload?: unknown;
  children: ResolvedNode[];
  slot?: string;
}

export type ResolvedNode = ResolvedText | ResolvedElement;

export interface ResolveContext {
  registry: WidgetTypeRegistry;
  /** Dedup key set (`type` or `type:prop`) -- persists across a whole `resolveTree()` call for one
   *  component instance's `tree` value, so a repeated unknown type/prop warns exactly once. */
  warned: Set<string>;
  warn?: (message: string) => void;
}

const MAX_DEPTH = 32;
const MAX_NODES = 5000;

const ROW_COL_PROP_ENUMS: Record<string, string[]> = {
  gap: ['s', 'm', 'l'],
  align: ['start', 'center', 'end', 'stretch'],
  justify: ['start', 'center', 'end', 'between'],
};

function warnOnce(ctx: ResolveContext, key: string, message: string): void {
  if (ctx.warned.has(key)) return;
  ctx.warned.add(key);
  (ctx.warn ?? console.warn)(`[lyra-widget-renderer] ${message}`);
}

function filterRowColProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props) return out;
  for (const key of Object.keys(ROW_COL_PROP_ENUMS)) {
    const value = props[key];
    if (typeof value === 'string' && ROW_COL_PROP_ENUMS[key].includes(value)) out[key] = value;
  }
  return out;
}

function filterMappedProps(
  props: Record<string, unknown> | undefined,
  def: { props?: Record<string, 'string' | 'number' | 'boolean'>; forcedProps?: Record<string, unknown> },
  ctx: ResolveContext,
  type: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const allowlist = def.props ?? {};
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      const expectedType = allowlist[key];
      if (expectedType === undefined || typeof value !== expectedType) {
        warnOnce(ctx, `${type}:${key}`, `skipped disallowed or mistyped prop "${key}" on type "${type}"`);
        continue;
      }
      out[key] = value;
    }
  }
  return { ...out, ...(def.forcedProps ?? {}) };
}

function budgetExceeded(budget: { remaining: number }, ctx: ResolveContext): boolean {
  if (budget.remaining <= 0) {
    warnOnce(ctx, '__node-cap__', `stopped resolving after the ${MAX_NODES}-node cap was reached`);
    return true;
  }
  budget.remaining--;
  return false;
}

function resolveChild(
  value: WidgetNode | string,
  ctx: ResolveContext,
  path: string,
  depth: number,
  budget: { remaining: number },
): ResolvedNode | null {
  if (typeof value === 'string') {
    if (budgetExceeded(budget, ctx)) return null;
    return { key: path, kind: 'text', text: value };
  }
  return resolveNode(value, ctx, path, depth, budget);
}

function resolveNode(
  node: WidgetNode,
  ctx: ResolveContext,
  path: string,
  depth: number,
  budget: { remaining: number },
): ResolvedElement | null {
  if (depth > MAX_DEPTH) {
    warnOnce(ctx, '__depth-cap__', `stopped resolving after the ${MAX_DEPTH}-level depth cap was reached`);
    return null;
  }
  if (budgetExceeded(budget, ctx)) return null;

  const key = node.id ?? path;

  let kind: ResolvedElement['kind'];
  let tag: string | undefined;
  let props: Record<string, unknown>;
  let actionEvent: string | undefined;
  let slots: string[] = [];

  if (node.type === 'row' || node.type === 'col') {
    kind = node.type === 'row' ? 'builtin-row' : 'builtin-col';
    props = filterRowColProps(node.props);
  } else if (node.type === 'text') {
    kind = 'builtin-text';
    props = {};
  } else {
    const def = ctx.registry.get(node.type);
    if (!def) {
      warnOnce(ctx, node.type, `skipped unknown widget type "${node.type}" (and its subtree)`);
      return null;
    }
    kind = 'mapped';
    tag = def.tag;
    props = filterMappedProps(node.props, def, ctx, node.type);
    slots = def.slots ?? [];
    if (node.actionId !== undefined && def.action) {
      actionEvent = def.action.event;
    }
  }

  const children: ResolvedNode[] = [];
  for (const [i, child] of (node.children ?? []).entries()) {
    const resolvedChild = resolveChild(child, ctx, `${path}.${i}`, depth + 1, budget);
    if (!resolvedChild) continue;
    if (resolvedChild.slot !== undefined && !slots.includes(resolvedChild.slot)) {
      resolvedChild.slot = undefined;
    }
    children.push(resolvedChild);
  }

  return {
    key,
    kind,
    tag,
    props,
    actionEvent,
    actionId: actionEvent ? node.actionId : undefined,
    payload: actionEvent ? node.payload : undefined,
    children,
    slot: node.slot,
  };
}

/** Resolves `root` through `ctx.registry`'s allowlist. Returns `null` for a structurally unusable
 *  root (non-object) or a root whose own `type` is unknown/over-cap -- the caller treats a `null`
 *  result for a non-null `root` input as a render error. */
export function resolveTree(root: WidgetNode | null | undefined, ctx: ResolveContext): ResolvedNode | null {
  if (root == null || typeof root !== 'object') return null;
  const budget = { remaining: MAX_NODES };
  return resolveNode(root, ctx, '0', 0, budget);
}
