/**
 * Pure, DOM-free allowlist resolution for `<lr-widget-renderer>`'s declarative JSON widget tree.
 * This module never imports or calls a raw-HTML-parsing rendering API of any kind -- every value
 * that reaches a rendered `lr-*` tag has passed an explicit type-key lookup against the type
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

export interface WidgetBinding {
  $bind: string;
  fallback?: string | number | boolean | null;
}

export interface LyraWidgetDocument {
  version: '1';
  root: WidgetNode;
  state?: unknown;
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
  /** Whether the mapped type exposes an action contract and therefore must not contain another
   * actionable mapped type. */
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
  state?: unknown;
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
  (ctx.warn ?? console.warn)(`[lr-widget-renderer] ${message}`);
}

function isBinding(value: unknown): value is WidgetBinding {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof (value as WidgetBinding).$bind === 'string');
}

function readPointer(root: unknown, path: string): unknown {
  if (path === '') return root;
  if (!path.startsWith('/')) return undefined;
  let current = root;
  for (const raw of path.slice(1).split('/')) {
    const segment = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (segment === '__proto__' || segment === 'prototype' || segment === 'constructor') return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else if (current && typeof current === 'object' && Object.hasOwn(current, segment)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function resolveValue(value: unknown, ctx: ResolveContext): { value: unknown; path?: string } {
  if (!isBinding(value)) return { value };
  const resolved = readPointer(ctx.state, value.$bind);
  return {
    value: resolved === undefined ? value.fallback : resolved,
    path: value.$bind,
  };
}

function filterRowColProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props) return out;
  for (const [key, allowed] of Object.entries(ROW_COL_PROP_ENUMS)) {
    const value = props[key];
    if (typeof value === 'string' && allowed.includes(value)) out[key] = value;
  }
  return out;
}

function filterMappedProps(
  props: Record<string, unknown> | undefined,
  def: {
    props?: Record<string, 'string' | 'number' | 'boolean'>;
    forcedProps?: Record<string, unknown>;
    bindings?: Record<string, { event: string }>;
  },
  ctx: ResolveContext,
  type: string,
): { props: Record<string, unknown>; bindings: Array<{ prop: string; path: string; event?: string }> } {
  const out: Record<string, unknown> = {};
  const bindings: Array<{ prop: string; path: string; event?: string }> = [];
  const allowlist = def.props ?? {};
  if (props) {
    for (const [key, rawValue] of Object.entries(props)) {
      const expectedType = allowlist[key];
      const { value, path } = resolveValue(rawValue, ctx);
      if (expectedType === undefined || typeof value !== expectedType) {
        warnOnce(ctx, `${type}:${key}`, `skipped disallowed or mistyped prop "${key}" on type "${type}"`);
        continue;
      }
      out[key] = value;
      if (path) bindings.push({ prop: key, path, event: def.bindings?.[key]?.event });
    }
  }
  return { props: { ...out, ...(def.forcedProps ?? {}) }, bindings };
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

function containsInteractive(node: ResolvedNode): boolean {
  if (node.kind === 'text') return false;
  return node.interactive || node.children.some(containsInteractive);
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
  let interactive = false;
  let props: Record<string, unknown>;
  let actionEvent: string | undefined;
  let bindings: Array<{ prop: string; path: string; event?: string }> = [];
  let slots: string[] = [];

  if (node.type === 'row' || node.type === 'col') {
    kind = node.type === 'row' ? 'builtin-row' : 'builtin-col';
    props = filterRowColProps(node.props);
  } else if (node.type === 'text') {
    kind = 'builtin-text';
    const resolved = resolveValue(node.props?.['value'], ctx);
    props = typeof resolved.value === 'string' || typeof resolved.value === 'number'
      ? { value: String(resolved.value) }
      : {};
    if (resolved.path) bindings = [{ prop: 'value', path: resolved.path }];
  } else {
    const def = ctx.registry.get(node.type);
    if (!def) {
      warnOnce(ctx, node.type, `skipped unknown widget type "${node.type}" (and its subtree)`);
      return null;
    }
    kind = 'mapped';
    tag = def.tag;
    interactive = def.action !== undefined;
    const filtered = filterMappedProps(node.props, def, ctx, node.type);
    props = filtered.props;
    bindings = filtered.bindings;
    slots = def.slots ?? [];
    if (node.actionId !== undefined && def.action) {
      actionEvent = def.action.event;
    }
  }

  const children: ResolvedNode[] = [];
  for (const [i, child] of (node.children ?? []).entries()) {
    const resolvedChild = resolveChild(child, ctx, `${path}.${i}`, depth + 1, budget);
    if (!resolvedChild) continue;
    if (interactive && containsInteractive(resolvedChild)) {
      warnOnce(
        ctx,
        `__nested-interactive__:${node.type}`,
        `skipped an interactive descendant inside actionable type "${node.type}"`,
      );
      continue;
    }
    if (resolvedChild.slot !== undefined && !slots.includes(resolvedChild.slot)) {
      resolvedChild.slot = undefined;
    }
    children.push(resolvedChild);
  }

  return {
    key,
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

/** Resolves `root` through `ctx.registry`'s allowlist. Returns `null` for a structurally unusable
 *  root (non-object) or a root whose own `type` is unknown/over-cap -- the caller treats a `null`
 *  result for a non-null `root` input as a render error. */
export function resolveTree(root: WidgetNode | null | undefined, ctx: ResolveContext): ResolvedNode | null {
  if (root == null || typeof root !== 'object') return null;
  const budget = { remaining: MAX_NODES };
  return resolveNode(root, ctx, '0', 0, budget);
}
