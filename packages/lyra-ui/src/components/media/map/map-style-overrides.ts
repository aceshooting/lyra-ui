import { MAX_NODES, MAX_TEXT, projectMapStyleOverrides, safeValue, type LyraMapStyleValue, type SafeValue } from './map-style-override-admission.js';

export { projectMapStyleOverrides };
export interface MapStyleOverridePeer {
  getLayer(id: string): unknown;
  getPaintProperty(id: string, property: string): unknown;
  getLayoutProperty(id: string, property: string): unknown;
  setPaintProperty(id: string, property: string, value: unknown): unknown;
  setLayoutProperty(id: string, property: string, value: unknown): unknown;
  triggerRepaint(): unknown;
}
interface MapStyleOverrideContext { readonly layerId: string; readonly kind: 'paint' | 'layout'; readonly property: string; }
export interface MapStyleOverrideOptions {
  readonly isOwned: (id: string) => boolean;
  /** Resolve live component tokens without changing expression structure unintentionally. */
  readonly resolve: (value: LyraMapStyleValue, context: MapStyleOverrideContext) => unknown;
}
interface MapStyleOverrideDiagnostic {
  readonly code: 'invalid-input' | 'missing-layer' | 'owned-layer' | 'peer-error' | 'invalid-original' | 'invalid-resolution' | 'external-change' | 'limit' | 'reentrant' | 'cancelled';
  readonly layerId?: string;
  readonly property?: string;
}
export interface MapStyleOverrideResult {
  /** Input admitted; adapter/individual-property failures remain explicit in diagnostics. */
  readonly accepted: boolean;
  readonly changed: number;
  readonly diagnostics: readonly MapStyleOverrideDiagnostic[];
}
interface Original extends MapStyleOverrideContext { original: SafeValue; applied?: SafeValue; uncertain: boolean; }
const keyOf = ({ layerId, kind, property }: MapStyleOverrideContext) => JSON.stringify([layerId, kind, property]);
const same = (current: SafeValue, applied: SafeValue) => current.key === applied.key || (current.value === undefined && applied.value === null);

/**
 * Basemap-only property ownership for one peer/style generation. Removal restores original JSON
 * values; undefined restores with the engine's null-reset convention. A new style or reset drops
 * old ownership without touching the peer. Layer wrappers need not have stable object identity:
 * the owner must call layerRemoved before replacing an existing layer under the same ID.
 *
 * An observed external write becomes the new restoration baseline while the explicit override
 * remains authoritative, with an external-change diagnostic. On removal, an external write wins.
 * Peer setters can partially mutate before throwing; such writes stay restorable and retryable.
 */
export class MapStyleOverrides {
  private peer?: MapStyleOverridePeer;
  private generation: unknown;
  private originals = new Map<string, Original>();
  private epoch = 0;
  private busy = false;

  reset(): void { this.epoch += 1; this.originals.clear(); this.peer = undefined; this.generation = undefined; }
  /** Notify before removing/replacing a layer, including an immediate same-ID replacement. */
  layerRemoved(id: string): void { this.epoch += 1; for (const [key, entry] of this.originals) if (entry.layerId === id) this.originals.delete(key); }

  reconcile(peer: MapStyleOverridePeer, generation: unknown, input: unknown, options: MapStyleOverrideOptions): MapStyleOverrideResult {
    const diagnostics: MapStyleOverrideDiagnostic[] = [];
    let changed = 0; let attempted = false;
    const finish = (accepted: boolean): MapStyleOverrideResult => Object.freeze({ accepted, changed, diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze(item))) });
    if (this.busy) { diagnostics.push({ code: 'reentrant' }); return finish(false); }
    // Reflection on caller-owned proxies can reenter too; guard before admission begins.
    this.busy = true;
    try {
      if (this.peer !== peer || !Object.is(this.generation, generation)) { this.reset(); this.peer = peer; this.generation = generation; }
      const epoch = this.epoch;
      const current = () => epoch === this.epoch;
      const overrides = projectMapStyleOverrides(input);
      if (!current()) { diagnostics.push({ code: 'cancelled' }); return finish(false); }
      if (!overrides) { diagnostics.push({ code: 'invalid-input' }); return finish(false); }
      const report = (code: MapStyleOverrideDiagnostic['code'], entry: MapStyleOverrideContext) => { diagnostics.push({ code, layerId: entry.layerId, property: entry.property }); };
      const fits = (replacement: Original, key: string): boolean => {
        let originalNodes = replacement.original.nodes, originalText = replacement.original.text;
        let appliedNodes = replacement.applied?.nodes ?? 0, appliedText = replacement.applied?.text ?? 0;
        for (const [otherKey, entry] of this.originals) if (otherKey !== key) {
          originalNodes += entry.original.nodes; originalText += entry.original.text;
          appliedNodes += entry.applied?.nodes ?? 0; appliedText += entry.applied?.text ?? 0;
        }
        return originalNodes <= MAX_NODES && appliedNodes <= MAX_NODES && originalText <= MAX_TEXT && appliedText <= MAX_TEXT;
      };
      const read = (entry: MapStyleOverrideContext) => safeValue(entry.kind === 'paint' ? peer.getPaintProperty(entry.layerId, entry.property) : peer.getLayoutProperty(entry.layerId, entry.property), true);
      const write = (entry: Original, value: SafeValue): void => {
        const owned = options.isOwned(entry.layerId);
        const exists = !owned && Boolean(peer.getLayer(entry.layerId));
        if (!current()) return;
        if (!exists) {
          report(owned ? 'owned-layer' : 'missing-layer', entry);
          for (const [key, original] of this.originals) if (original.layerId === entry.layerId) this.originals.delete(key);
          return;
        }
        attempted = true; entry.uncertain = true;
        if (entry.kind === 'paint') peer.setPaintProperty(entry.layerId, entry.property, value.value === undefined ? null : value.value);
        else peer.setLayoutProperty(entry.layerId, entry.property, value.value === undefined ? null : value.value);
        if (!current()) return;
        entry.applied = value; entry.uncertain = false; changed += 1;
      };
      const desired = new Map<string, { context: MapStyleOverrideContext; value: LyraMapStyleValue }>();
      for (const layer of overrides) for (const kind of ['paint', 'layout'] as const) {
        for (const [property, value] of Object.entries(layer[kind] ?? {})) {
          const context = { layerId: layer.layerId, kind, property }; desired.set(keyOf(context), { context, value });
        }
      }
      // Discard absent/now-owned resources before any restoration, even if an ID is reused later.
      const availability = new Map<string, boolean>();
      const ids = new Set([...overrides.map((entry) => entry.layerId), ...[...this.originals.values()].map((entry) => entry.layerId)]);
      for (const layerId of ids) {
        let available = false;
        try {
          const owned = options.isOwned(layerId);
          available = !owned && Boolean(peer.getLayer(layerId));
          if (!available) diagnostics.push({ code: owned ? 'owned-layer' : 'missing-layer', layerId });
        } catch { diagnostics.push({ code: 'peer-error', layerId }); continue; }
        if (!current()) break;
        availability.set(layerId, available);
        if (!available) for (const [key, entry] of this.originals) if (entry.layerId === layerId) this.originals.delete(key);
      }
      for (const [key, entry] of this.originals) {
        if (!current()) break;
        if (desired.has(key) || !availability.get(entry.layerId)) continue;
        try {
          const shown = read(entry);
          if (!current()) break;
          if (!shown) { report('invalid-original', entry); continue; }
          if (entry.applied && !entry.uncertain && !same(shown, entry.applied)) report('external-change', entry);
          else if (!same(shown, entry.original)) write(entry, entry.original);
          if (current()) this.originals.delete(key);
        } catch { report('peer-error', entry); }
      }
      for (const [key, { context, value }] of desired) {
        if (!current()) break;
        if (!availability.get(context.layerId)) continue;
        try {
          let resolved: SafeValue | undefined;
          try { resolved = safeValue(options.resolve(value, Object.freeze({ ...context }))); }
          catch { report('invalid-resolution', context); continue; }
          if (!current()) break;
          if (!resolved) { report('invalid-resolution', context); continue; }
          const shown = read(context);
          if (!current()) break;
          if (!shown) { report('invalid-original', context); continue; }
          const prior = this.originals.get(key);
          const original = prior ?? { ...context, original: shown, uncertain: false };
          const replacement: Original = { ...original, applied: resolved };
          if (prior?.applied && !prior.uncertain && !same(shown, prior.applied)) {
            replacement.original = shown; report('external-change', context);
          }
          if (!fits(replacement, key)) { report('limit', context); continue; }
          // Retain the baseline before a setter that may mutate and then throw.
          const retained: Original = { ...replacement, applied: prior?.applied };
          this.originals.set(key, retained);
          if (!same(shown, resolved)) write(retained, resolved);
          else { retained.applied = resolved; retained.uncertain = false; }
        } catch { report('peer-error', context); }
      }
      if (!current()) { diagnostics.push({ code: 'cancelled' }); return finish(false); }
      if (attempted) { try { peer.triggerRepaint(); } catch { diagnostics.push({ code: 'peer-error' }); } }
      if (!current()) { diagnostics.push({ code: 'cancelled' }); return finish(false); }
      return finish(true);
    } finally { this.busy = false; }
  }
}
