import { expandMapStyleLayerTargets, projectMapStyleLayerSelector, type LyraMapStyleLayer } from './map-interaction-options.js';
import { planMapLayerOrder, type MapLayerOrderGroup, type MapLayerOrderPlan } from './map-layer-order.js';
import type { LyraMapStyleOverride } from './map-style-override-admission.js';

interface Baseline { readonly original: readonly string[]; readonly applied: readonly string[]; }
export interface MapBasemapOrderDraft {
  readonly groups: readonly MapLayerOrderGroup[];
  /** Re-plan against the live order after owned resources have been reconciled. */
  plan(existing: readonly string[], owned: readonly MapLayerOrderGroup[]): MapLayerOrderPlan;
  /** Commit only after all native moves have been verified, while the transaction is current. */
  commit(order: readonly string[]): void;
}

function relocated(id: string, current: readonly string[], applied: readonly string[], controlled?: ReadonlySet<string>): boolean {
  const positions = new Map(current.map((value, index) => [value, index]));
  const at = positions.get(id), prior = applied.indexOf(id);
  if (at === undefined) return true;
  return applied.some((other, index) => {
    const now = positions.get(other);
    return other !== id && !controlled?.has(other) && now !== undefined && (now < at) !== (index < prior);
  });
}

/**
 * ID-only basemap placement ownership. Drafts never mutate retained state; a failed or superseded
 * transaction cannot replace a restoration baseline. The host resets this owner on style/peer
 * replacement, and executes the combined plan with its normal connection/generation guards.
 */
export class MapBasemapOrder {
  private baselines = new Map<string, Baseline>();
  private epoch = 0;

  get active(): boolean { return this.baselines.size > 0; }
  reset(): void { this.epoch += 1; this.baselines.clear(); }

  stage(existing: readonly string[], overrides: readonly LyraMapStyleOverride[], layers: readonly LyraMapStyleLayer[],
    isOwned: (id: string) => boolean): MapBasemapOrderDraft {
    const epoch = this.epoch;
    const snapshot = Object.freeze([...existing]);
    const controlled = new Set(existing.filter(isOwned));
    const expanded = expandMapStyleLayerTargets(overrides, layers, entry => {
      const selector = projectMapStyleLayerSelector(entry);
      return entry.layerId !== undefined ? { layerId: entry.layerId } : selector ? { selector } : {};
    });
    if (expanded.length > 1024) throw new Error('Map layer order exceeds its limit.');
    const next = new Map<string, Baseline>();
    const members = new Map<LyraMapStyleOverride, string[]>();
    for (const { layerId, entry } of expanded) {
      if (entry.before === undefined) continue;
      if (isOwned(layerId)) throw new Error('Map layer order requires a basemap layer.');
      if (!existing.includes(layerId)) continue;
      const previous = this.baselines.get(layerId);
      const baseline = previous && !relocated(layerId, existing, previous.applied) ? previous : { original: snapshot, applied: snapshot };
      next.set(layerId, baseline);
      const group = members.get(entry) ?? [];
      group.push(layerId); members.set(entry, group);
    }
    const groups: MapLayerOrderGroup[] = [];
    for (const [entry, ids] of members) {
      // Selector expansion follows style order; retained baselines keep it stable after our moves.
      const original = next.get(ids[0]!)!.original;
      ids.sort((a, b) => original.indexOf(a) - original.indexOf(b));
      groups.push(Object.freeze({ id: ids[0]!, layerIds: Object.freeze(ids), ...(entry.before === null ? {} : { before: entry.before }) }));
    }
    const released = [...this.baselines].filter(([id, baseline]) => !next.has(id) && existing.includes(id) && !isOwned(id) &&
      !relocated(id, existing, baseline.applied))
      .sort(([a, first], [b, second]) => second.original.indexOf(b) - first.original.indexOf(a));
    return {
      groups: Object.freeze(groups),
      plan: (live, owned) => {
        const working = [...live];
        const snapshot = Object.freeze([...live]);
        // Owned resources may be removed and re-added between staging and this final plan.
        // Only surviving basemap relationships distinguish a concurrent external relocation here.
        const controlledIds = new Set([...controlled, ...owned.flatMap(group => group.layerIds)]);
        for (const [id, baseline] of next) {
          if (this.baselines.has(id) && relocated(id, live, baseline.applied, controlledIds)) {
            next.set(id, { original: snapshot, applied: snapshot });
          }
        }
        const restores: Array<{ kind: 'move'; id: string; before?: string }> = [];
        // Restore only released IDs; unrelated IDs retain their relative order. Active constraints
        // run afterwards, so a released placement cannot create a cycle against an active owner.
        for (const [id, baseline] of released) {
          if (relocated(id, live, baseline.applied, controlledIds)) continue;
          const index = working.indexOf(id);
          if (index < 0) continue;
          const before = baseline.original.slice(baseline.original.indexOf(id) + 1).find(other =>
            working.includes(other) && !controlledIds.has(other) && !next.has(other));
          if (before === undefined ? index === working.length - 1 : working[index + 1] === before) continue;
          working.splice(index, 1);
          working.splice(before === undefined ? working.length : working.indexOf(before), 0, id);
          restores.push({ kind: 'move', id, ...(before === undefined ? {} : { before }) });
        }
        const plan = planMapLayerOrder(working, [...owned, ...groups]);
        return plan.valid ? Object.freeze({ ...plan, operations: Object.freeze([...restores, ...plan.operations]) }) : plan;
      },
      commit: order => {
        if (epoch !== this.epoch) return;
        const applied = Object.freeze([...order]);
        this.baselines = new Map([...next].filter(([id]) => order.includes(id)).map(([id, baseline]) => [id, { original: baseline.original, applied }]));
        this.epoch += 1;
      },
    };
  }
}
