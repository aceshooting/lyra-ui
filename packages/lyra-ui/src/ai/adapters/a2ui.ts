import type {
  LyraWidgetDocument,
  LyraWidgetNode,
} from '../../components/conversation/widget-renderer/resolve.js';
import {
  createProviderSnapshotBudget,
  resolveProviderSnapshotLimits,
  snapshotProviderValue,
  type ProviderSnapshotLimits,
} from '../snapshot.js';

export interface A2UiLikeAction {
  id: string;
  payload?: unknown;
}

export interface A2UiLikeComponent {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  text?: string;
  children?: string[];
  action?: A2UiLikeAction;
}

export interface A2UiLikeSurface {
  surfaceId?: string;
  rootId: string;
  components: A2UiLikeComponent[];
  data?: unknown;
}

export type A2UiTypeMap = Readonly<Record<string, string>>;

export interface A2UiAdapterLimits extends ProviderSnapshotLimits {
  maxComponents: number;
  maxDepth: number;
  maxOutputNodes: number;
  maxChildrenPerComponent: number;
}

export const DEFAULT_A2UI_ADAPTER_LIMITS: Readonly<A2UiAdapterLimits> = Object.freeze({
  ...resolveProviderSnapshotLimits({ maxDepth: 40, maxNodes: 100_000, maxBytes: 8_388_608 }),
  maxComponents: 5_000,
  maxDepth: 32,
  maxOutputNodes: 5_000,
  maxChildrenPerComponent: 1_000,
});

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function resolveLimits(limits: Partial<A2UiAdapterLimits>): Readonly<A2UiAdapterLimits> {
  const snapshot = resolveProviderSnapshotLimits({
    maxDepth: limits.maxDepth ?? DEFAULT_A2UI_ADAPTER_LIMITS.maxDepth,
    maxNodes: limits.maxNodes ?? DEFAULT_A2UI_ADAPTER_LIMITS.maxNodes,
    maxBytes: limits.maxBytes ?? DEFAULT_A2UI_ADAPTER_LIMITS.maxBytes,
    maxStringCharacters: limits.maxStringCharacters ?? DEFAULT_A2UI_ADAPTER_LIMITS.maxStringCharacters,
  });
  return Object.freeze({
    ...snapshot,
    maxComponents: positiveInteger(limits.maxComponents, DEFAULT_A2UI_ADAPTER_LIMITS.maxComponents),
    maxDepth: positiveInteger(limits.maxDepth, DEFAULT_A2UI_ADAPTER_LIMITS.maxDepth),
    maxOutputNodes: positiveInteger(limits.maxOutputNodes, DEFAULT_A2UI_ADAPTER_LIMITS.maxOutputNodes),
    maxChildrenPerComponent: positiveInteger(
      limits.maxChildrenPerComponent,
      DEFAULT_A2UI_ADAPTER_LIMITS.maxChildrenPerComponent,
    ),
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function componentRecord(value: unknown, limits: Readonly<A2UiAdapterLimits>): A2UiLikeComponent | null {
  const component = record(value);
  if (!component || typeof component['id'] !== 'string' || typeof component['type'] !== 'string') return null;
  if (component['props'] !== undefined && !record(component['props'])) return null;
  if (component['text'] !== undefined && typeof component['text'] !== 'string') return null;
  if (component['children'] !== undefined) {
    if (!Array.isArray(component['children'])
      || component['children'].length > limits.maxChildrenPerComponent
      || !component['children'].every((child) => typeof child === 'string')) {
      return null;
    }
  }
  if (component['action'] !== undefined) {
    const action = record(component['action']);
    if (!action || typeof action['id'] !== 'string') return null;
  }
  return component as unknown as A2UiLikeComponent;
}

/**
 * Maps a structurally compatible A2UI component graph into Lyra's versioned, allowlisted widget
 * document. Input, child-cardinality, traversal, and output budgets fail closed as `null`.
 */
export function adaptA2UiSurface(
  surface: unknown,
  typeMap: unknown,
  limits: Partial<A2UiAdapterLimits> = {},
): LyraWidgetDocument | null {
  const resolved = resolveLimits(limits);
  const budget = createProviderSnapshotBudget(resolved);
  const ownedSurface = snapshotProviderValue<unknown>(surface, budget);
  if (!ownedSurface.ok) return null;
  const source = record(ownedSurface.value);
  if (!source || typeof source['rootId'] !== 'string' || !Array.isArray(source['components'])) return null;
  if (source['components'].length > resolved.maxComponents) return null;

  const ownedTypeMap = snapshotProviderValue<unknown>(typeMap, budget);
  const mappedTypes = ownedTypeMap.ok ? record(ownedTypeMap.value) : null;
  if (!mappedTypes || !Object.values(mappedTypes).every((value) => typeof value === 'string')) return null;

  const byId = new Map<string, A2UiLikeComponent>();
  for (const value of source['components']) {
    const component = componentRecord(value, resolved);
    if (!component || byId.has(component.id)) return null;
    byId.set(component.id, component);
  }

  let remainingOutputNodes = resolved.maxOutputNodes;
  let outputLimitExceeded = false;
  const reserveOutputNode = (): boolean => {
    if (remainingOutputNodes <= 0) {
      outputLimitExceeded = true;
      return false;
    }
    remainingOutputNodes -= 1;
    return true;
  };

  const visit = (id: string, depth: number, ancestors: ReadonlySet<string>): LyraWidgetNode | null => {
    if (depth > resolved.maxDepth || ancestors.has(id) || outputLimitExceeded) return null;
    const component = byId.get(id);
    if (!component) return null;
    const mappedType = mappedTypes[component.type];
    if (typeof mappedType !== 'string' || !mappedType || !reserveOutputNode()) return null;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(id);
    const children: LyraWidgetNode[] = [];
    for (const childId of component.children ?? []) {
      if (outputLimitExceeded) break;
      const child = visit(childId, depth + 1, nextAncestors);
      if (child) children.push(child);
    }
    if (component.text) {
      if (!reserveOutputNode()) return null;
      children.unshift({ type: 'text', props: { value: component.text } });
    }
    return {
      id: component.id,
      type: mappedType,
      ...(component.props ? { props: component.props } : {}),
      ...(children.length ? { children } : {}),
      ...(component.action
        ? { actionId: component.action.id, ...(Object.hasOwn(component.action, 'payload') ? { payload: component.action.payload } : {}) }
        : {}),
    };
  };

  const root = visit(source['rootId'], 0, new Set());
  if (!root || outputLimitExceeded) return null;
  return {
    version: '2',
    root,
    ...(Object.hasOwn(source, 'data') ? { state: source['data'] } : {}),
  };
}
