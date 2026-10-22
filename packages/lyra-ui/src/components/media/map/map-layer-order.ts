/** One logical overlay, with concrete sublayers in bottom-to-top paint order. */
export interface MapLayerOrderGroup {
  readonly id: string;
  readonly layerIds: readonly string[];
  /** A logical group or concrete layer. An owned sublayer anchors its entire group. */
  readonly before?: string;
}

interface MapLayerOrderOperation {
  readonly kind: 'add' | 'move';
  readonly id: string;
  /** Omitted means append. The target exists by the time this operation is executed. */
  readonly before?: string;
}

interface MapLayerOrderDiagnostic {
  readonly code: 'invalid-input' | 'duplicate-id' | 'limit' | 'missing-anchor' | 'cycle';
  readonly id?: string;
}

export interface MapLayerOrderPlan {
  readonly valid: boolean;
  readonly order: readonly string[];
  readonly operations: readonly MapLayerOrderOperation[];
  readonly diagnostics: readonly MapLayerOrderDiagnostic[];
}

const MAX_GROUPS = 128;
const MAX_GROUP_LAYERS = 32;
const MAX_LAYERS = 4096;
const MAX_ID_LENGTH = 1024;

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_ID_LENGTH;
}

function result(
  valid: boolean,
  order: readonly string[],
  operations: readonly MapLayerOrderOperation[],
  diagnostics: readonly MapLayerOrderDiagnostic[],
): MapLayerOrderPlan {
  return Object.freeze({
    valid, order: Object.freeze([...order]),
    operations: Object.freeze(operations.map((operation) => Object.freeze(operation))),
    diagnostics: Object.freeze(diagnostics.map((diagnostic) => Object.freeze(diagnostic))),
  });
}

/**
 * Plan ordered additions/moves from admitted layer IDs and owned overlay groups.
 * Unclaimed existing IDs retain their relative order and are never moved. Unanchored groups
 * append; missing anchors append with a diagnostic. Logical group anchors take precedence over
 * concrete IDs. Duplicates, cycles or bounds violations return no executable operations.
 *
 * The caller removes obsolete owned layers first and supplies prepared descriptors for additions.
 * Execution is synchronous and follows the returned operation order. Both stable topological
 * selection and replay simulation are O(N²), bounded by the layer/group admission limits.
 */
export function planMapLayerOrder(
  existingLayerIds: readonly string[],
  groups: readonly MapLayerOrderGroup[],
): MapLayerOrderPlan {
  const diagnostics: MapLayerOrderDiagnostic[] = [];
  const fail = (code: MapLayerOrderDiagnostic['code'], id?: string): MapLayerOrderPlan =>
    result(false, [], [], [...diagnostics, { code, ...(id === undefined ? {} : { id }) }]);
  if (!Array.isArray(existingLayerIds) || !Array.isArray(groups)) return fail('invalid-input');
  if (existingLayerIds.length > MAX_LAYERS || groups.length > MAX_GROUPS) return fail('limit');

  const existing = new Set<string>();
  for (const id of existingLayerIds) {
    if (!validId(id)) return fail('invalid-input');
    if (existing.has(id)) return fail('duplicate-id', id);
    existing.add(id);
  }
  const groupIndex = new Map<string, number>();
  const owner = new Map<string, number>();
  const combined = new Set(existing);
  for (const [index, group] of groups.entries()) {
    if (!group || !validId(group.id) || !Array.isArray(group.layerIds) || group.layerIds.length === 0 ||
      (group.before !== undefined && !validId(group.before))) return fail('invalid-input');
    if (group.layerIds.length > MAX_GROUP_LAYERS) return fail('limit', group.id);
    if (groupIndex.has(group.id)) return fail('duplicate-id', group.id);
    groupIndex.set(group.id, index);
    for (const id of group.layerIds) {
      if (!validId(id)) return fail('invalid-input');
      if (owner.has(id)) return fail('duplicate-id', id);
      owner.set(id, index);
      combined.add(id);
      if (combined.size > MAX_LAYERS) return fail('limit');
    }
  }

  const base = existingLayerIds.filter((id) => !owner.has(id));
  const baseIndex = new Map(base.map((id, index) => [id, index]));
  const groupOffset = base.length;
  const count = base.length + groups.length;
  const edges = Array.from({ length: count }, () => new Set<number>());
  const incoming = Array<number>(count).fill(0);
  const edge = (from: number, to: number): void => {
    if (edges[from]!.has(to)) return;
    edges[from]!.add(to);
    incoming[to] = incoming[to]! + 1;
  };
  for (let index = 1; index < base.length; index += 1) edge(index - 1, index);
  for (const [index, group] of groups.entries()) {
    const node = groupOffset + index;
    const before = group.before;
    const targetGroup = before === undefined ? undefined : groupIndex.get(before) ?? owner.get(before);
    const targetBase = before === undefined ? undefined : baseIndex.get(before);
    if (targetGroup !== undefined) edge(node, groupOffset + targetGroup);
    else if (targetBase !== undefined) edge(node, targetBase);
    else {
      if (before !== undefined) diagnostics.push({ code: 'missing-anchor', id: before });
      if (base.length > 0) edge(base.length - 1, node);
    }
  }

  const selected = new Set<number>();
  const order: string[] = [];
  while (selected.size < count) {
    let next = -1;
    for (let index = 0; index < count; index += 1) {
      if (!selected.has(index) && incoming[index] === 0) { next = index; break; }
    }
    if (next < 0) return fail('cycle');
    selected.add(next);
    if (next < groupOffset) order.push(base[next]!);
    else order.push(...groups[next - groupOffset]!.layerIds);
    for (const target of edges[next]!) incoming[target] = incoming[target]! - 1;
  }

  const working = [...existingLayerIds];
  const operations: MapLayerOrderOperation[] = [];
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const id = order[index]!;
    if (!owner.has(id)) continue;
    const before = order[index + 1];
    const current = working.indexOf(id);
    if (current >= 0 && (before === undefined ? current === working.length - 1 : working[current + 1] === before)) continue;
    const operation: MapLayerOrderOperation = {
      kind: current < 0 ? 'add' : 'move', id,
      ...(before === undefined ? {} : { before }),
    };
    operations.push(operation);
    if (current >= 0) working.splice(current, 1);
    const target = before === undefined ? working.length : working.indexOf(before);
    working.splice(target, 0, id);
  }
  return result(true, order, operations, diagnostics);
}
