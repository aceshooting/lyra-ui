import type { ReactiveControllerHost } from 'lit';
import type { LyraSourceRevision } from '../data-sources.js';
import type { LyraSpatialChartSource, LyraSpatialChartSeries, LyraSpatialBounds, LyraSpatialPoint, LyraSpatialBin, LyraSpatialQuery, LyraSpatialPointSource } from '../utilities/data-spatial.js';
import { SourceRequestController, sourceCount, sourceRevision } from './source-request-controller.js';

/** @internal Bounded embedding payload; domain adapters may preserve these scalar annotations. */
export interface SpatialPoint extends LyraSpatialPoint {
  readonly seriesId?: string;
  readonly radius?: number;
  readonly label?: string;
  readonly sourceId?: string;
  readonly cluster?: string | number;
}
type Guard = () => boolean;
function own(value: unknown, key: PropertyKey, guard: Guard, optional = false): unknown {
  if (!guard() || value === null || typeof value !== 'object') throw new TypeError('Invalid spatial data');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!guard() || (descriptor && !('value' in descriptor)) || (!descriptor && !optional)) throw new TypeError('Invalid spatial data');
  return descriptor?.value;
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid coordinate');
  return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new TypeError('Invalid metadata');
  return value;
}
/** @internal */
function spatialBounds(value: unknown, guard: Guard = () => true): LyraSpatialBounds {
  const minX = finite(own(value, 'minX', guard)), maxX = finite(own(value, 'maxX', guard));
  const minY = finite(own(value, 'minY', guard)), maxY = finite(own(value, 'maxY', guard));
  if (minX > maxX || minY > maxY) throw new TypeError('Invalid bounds');
  return Object.freeze({ minX, maxX, minY, maxY });
}
/** @internal */
export function spatialContains(bounds: LyraSpatialBounds, point: { x: number; y: number }): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}
function contained(bounds: LyraSpatialBounds, inner: LyraSpatialBounds): boolean {
  return spatialContains(bounds, { x: inner.minX, y: inner.minY }) && spatialContains(bounds, { x: inner.maxX, y: inner.maxY });
}
function viewportBounds(value: unknown, global: LyraSpatialBounds, guard: Guard): LyraSpatialBounds {
  const result = spatialBounds(value, guard);
  if (!contained(global, result) || (global.minX !== global.maxX && result.minX === result.maxX) ||
    (global.minY !== global.maxY && result.minY === result.maxY)) throw new TypeError('Invalid viewport');
  return result;
}
/** @internal Chart projection is opt-in; embedding keeps its original schema. */
export interface SpatialChartPolicy { readonly type: 'scatter' | 'bubble'; }
interface SpatialChartMetadata extends SpatialChartPolicy {
  readonly series: readonly LyraSpatialChartSeries[];
  readonly radiusDomain: Readonly<{ min: number; max: number }> | null;
  readonly metadataUnits: number;
}
const chartSeriesIds = new WeakMap<SpatialChartMetadata, ReadonlySet<string>>();
function chartSnapshot(source: unknown, policy: SpatialChartPolicy, count: number, guard: Guard): SpatialChartMetadata {
  const type = own(policy, 'type', guard);
  if ((type !== 'scatter' && type !== 'bubble') || own(source, 'kind', guard) !== 'spatial') throw new TypeError('Invalid chart source');
  const rawSeries = own(source, 'series', guard);
  if (!Array.isArray(rawSeries)) throw new TypeError('Invalid series');
  const length = sourceCount(own(rawSeries, 'length', guard));
  if (!length || length > 1000) throw new TypeError('Invalid series count');
  const ids = new Set<string>(), series: LyraSpatialChartSeries[] = [];
  let metadataUnits = 0;
  for (let index = 0; index < length; index++) {
    const raw = own(rawSeries, index, guard);
    const id = text(own(raw, 'id', guard), 256), label = text(own(raw, 'label', guard), 1024);
    const rawColor = own(raw, 'color', guard, true), color = rawColor === undefined ? undefined : text(rawColor, 256);
    metadataUnits += id.length + label.length + (color?.length ?? 0);
    if (!id.trim() || ids.has(id) || metadataUnits > 65536) throw new TypeError('Invalid series metadata');
    ids.add(id); series.push(Object.freeze({ id, label, ...(color === undefined ? {} : { color }) }));
  }
  const rawDomain = own(source, 'radiusDomain', guard, type === 'scatter');
  let radiusDomain: SpatialChartMetadata['radiusDomain'] = null;
  if (rawDomain !== undefined && rawDomain !== null) {
    const min = finite(own(rawDomain, 'min', guard)), max = finite(own(rawDomain, 'max', guard));
    if (min < 0 || min > max || count === 0) throw new TypeError('Invalid radius domain');
    radiusDomain = Object.freeze({ min, max });
  }
  if (type === 'bubble' && (count === 0 ? rawDomain !== null : radiusDomain === null)) throw new TypeError('Missing radius domain');
  const result = Object.freeze({ type, series: Object.freeze(series), radiusDomain, metadataUnits });
  chartSeriesIds.set(result, ids);
  return result;
}
function pointSnapshot(value: unknown, count: number, bounds: LyraSpatialBounds, guard: Guard, chart?: SpatialChartMetadata): SpatialPoint {
  const id = text(own(value, 'id', guard), 256);
  const sourceIndex = sourceCount(own(value, 'sourceIndex', guard));
  const x = finite(own(value, 'x', guard)), y = finite(own(value, 'y', guard));
  if (!id.trim() || sourceIndex >= count || !spatialContains(bounds, { x, y })) throw new TypeError('Invalid point');
  const label = own(value, 'label', guard, true);
  if (chart) {
    const seriesId = text(own(value, 'seriesId', guard), 256);
    if (!chartSeriesIds.get(chart)!.has(seriesId)) throw new TypeError('Unknown series');
    const rawRadius = own(value, 'radius', guard, chart.type === 'scatter');
    const radius = rawRadius === undefined && chart.type === 'scatter' ? undefined : finite(rawRadius);
    if (radius !== undefined && (!chart.radiusDomain || radius < chart.radiusDomain.min || radius > chart.radiusDomain.max)) throw new TypeError('Invalid radius');
    return Object.freeze({ id, sourceIndex, x, y, seriesId,
      ...(label === undefined ? {} : { label: text(label, 1024) }), ...(radius === undefined ? {} : { radius }) });
  }
  const sourceId = own(value, 'sourceId', guard, true), cluster = own(value, 'cluster', guard, true);
  return Object.freeze({ id, sourceIndex, x, y,
    ...(label === undefined ? {} : { label: text(label, 1024) }),
    ...(sourceId === undefined ? {} : { sourceId: text(sourceId, 256) }),
    ...(cluster === undefined ? {} : { cluster: typeof cluster === 'number' ? finite(cluster) : text(cluster, 256) }),
  });
}
function pointUnits(point: SpatialPoint): number {
  return (point.seriesId?.length ?? 0) + point.id.length + (point.label?.length ?? 0) + (point.sourceId?.length ?? 0) + (typeof point.cluster === 'string' ? point.cluster.length : 0);
}

// Coordinate compression includes endpoints and the open intervals between them. A lazy segment
// tree tests occupied ranges and representative membership without comparing every pair of bins.
function validatePartition(bins: readonly LyraSpatialBin[], points: readonly SpatialPoint[], bounds: LyraSpatialBounds): void {
  const ys = [...new Set([...bins.flatMap(bin => [bin.bounds.minY, bin.bounds.maxY]), ...points.map(point => point.y)])].sort((a, b) => a - b);
  if (!ys.length) return;
  const indices = new Map(ys.map((value, index) => [value, index * 2]));
  const size = ys.length * 2;
  const tree = new Int32Array(size * 4), lazy = new Int32Array(size * 4);
  const range = (lo: number, hi: number, delta: number, node = 1, left = 0, right = size - 1): number => {
    if (lo > right || hi < left) return delta === 0 ? -Infinity : 0;
    if (lo <= left && right <= hi) {
      if (delta) { tree[node] = tree[node]! + delta; lazy[node] = lazy[node]! + delta; }
      return tree[node]!;
    }
    const mid = (left + right) >>> 1;
    const value = Math.max(range(lo, hi, delta, node * 2, left, mid), range(lo, hi, delta, node * 2 + 1, mid + 1, right));
    if (delta) tree[node] = lazy[node]! + Math.max(tree[node * 2]!, tree[node * 2 + 1]!);
    return lazy[node]! + value;
  };
  const owners = new Int32Array(size + 2), represented = new Uint32Array(bins.length);
  const addOwner = (index: number, value: number): void => { for (let at = index + 1; at < owners.length; at += at & -at) owners[at] = owners[at]! + value; };
  const ownerAt = (index: number): number => { let result = 0; for (let at = index + 1; at > 0; at -= at & -at) result += owners[at]!; return result - 1; };
  const events: { x: number; order: number; lo: number; hi: number; delta: number; owner: number }[] = [];
  for (const [index, bin] of bins.entries()) {
    const b = bin.bounds;
    const lo = indices.get(b.minY)!, hi = indices.get(b.maxY)! - (b.maxY === bounds.maxY ? 0 : 1);
    events.push({ x: b.minX, order: 1, lo, hi, delta: 1, owner: index + 1 });
    events.push({ x: b.maxX, order: b.maxX === bounds.maxX ? 3 : 0, lo, hi, delta: -1, owner: index + 1 });
  }
  for (const point of points) events.push({ x: point.x, order: 2, lo: indices.get(point.y)!, hi: indices.get(point.y)!, delta: 0, owner: 0 });
  events.sort((a, b) => a.x - b.x || a.order - b.order);
  for (const event of events) {
    const occupied = range(event.lo, event.hi, 0);
    if ((event.delta === 1 && occupied !== 0) || (event.delta === 0 && occupied !== 1)) throw new TypeError('Invalid spatial partition');
    if (event.delta) {
      range(event.lo, event.hi, event.delta);
      addOwner(event.lo, event.owner * event.delta); addOwner(event.hi + 1, -event.owner * event.delta);
    } else {
      const owner = ownerAt(event.lo);
      represented[owner] = represented[owner]! + 1;
      if (represented[owner]! > bins[owner]!.count) throw new TypeError('Too many bin representatives');
    }
  }
}

interface Binding {
  chart?: SpatialChartMetadata;
  source: LyraSpatialPointSource<SpatialPoint>;
  revision: LyraSourceRevision;
  count: number;
  bounds: LyraSpatialBounds | null;
  query: LyraSpatialPointSource<SpatialPoint>['query'];
  getPoint: LyraSpatialPointSource<SpatialPoint>['getPoint'];
}
interface QueryIntent { bounds: LyraSpatialBounds; maxBins: number; maxPoints: number; token: object; }
/** @internal Owns bounded spatial requests and immutable accepted results, never a source index. */
export class SpatialSourceController {
  readonly authority: SourceRequestController<'query' | 'lookup'>;
  binding?: Binding;
  view?: LyraSpatialBounds;
  result?: LyraSpatialQuery<SpatialPoint>;
  selected?: SpatialPoint;
  revealed?: SpatialPoint;
  error = false;
  loading = false;
  private bindingToken: object = {};
  private configurationToken: object = {};
  private queryIntent?: QueryIntent;
  private queryActive = false;
  private lookupActive = false;
  private lookupToken: object = {};
  private selectedId = '';
  private revealId = '';
  private selectedDone = '';
  private revealDone = '';
  private revealResolve?: (point: SpatialPoint | null) => void;
  private resultUnits = 0;
  private pendingUnits = 0;
  private viewport: LyraSpatialBounds | null = null;

  constructor(private readonly host: HTMLElement & ReactiveControllerHost, private readonly changed: () => void, private readonly locale: () => string) {
    this.authority = new SourceRequestController(host, { channels: ['query', 'lookup'] });
  }
  private current(token: object): boolean { return this.bindingToken === token && this.host.isConnected; }
  reset(): object {
    const token = this.bindingToken = {};
    this.configurationToken = {};
    this.binding = undefined; this.result = undefined; this.resultUnits = 0; this.view = undefined;
    this.selected = undefined; this.revealed = undefined; this.selectedDone = ''; this.revealDone = ''; this.revealId = '';
    this.queryIntent = undefined; this.lookupToken = {}; this.error = false; this.loading = false;
    const resolve = this.revealResolve; this.revealResolve = undefined;
    if (!this.authority.setSource(undefined, undefined)) this.authority.refresh();
    resolve?.(null);
    return token;
  }
  bind(source: LyraSpatialPointSource<SpatialPoint> | LyraSpatialChartSource | null, viewport: LyraSpatialBounds | null, max: number, selectedId: string, chartPolicy?: SpatialChartPolicy): void {
    const token = this.reset(), guard = () => this.current(token);
    if (!guard()) return;
    if (source === null || !this.host.isConnected) { this.changed(); return; }
    try {
      const revision = sourceRevision(own(source, 'revision', guard));
      if (typeof revision === 'string') text(revision, 256);
      const count = sourceCount(own(source, 'count', guard));
      const rawBounds = own(source, 'bounds', guard);
      const bounds = rawBounds === null ? null : spatialBounds(rawBounds, guard);
      if ((count === 0) !== (bounds === null)) throw new TypeError('Invalid global bounds');
      const chart = chartPolicy === undefined ? undefined : chartSnapshot(source, chartPolicy, count, guard);
      const query = own(source, 'query', guard), getPoint = own(source, 'getPoint', guard);
      if (typeof query !== 'function' || typeof getPoint !== 'function') throw new TypeError('Invalid spatial methods');
      if (!guard()) return;
      this.authority.setSource(source, revision);
      if (!guard()) return;
      this.binding = { chart, source, revision, count, bounds, query: query as Binding['query'], getPoint: getPoint as Binding['getPoint'] };
      this.selectedId = selectedId;
      this.configure(viewport, max);
    } catch { if (guard()) { this.error = true; this.changed(); } }
  }
  configure(viewport: LyraSpatialBounds | null, max: number): void {
    const binding = this.binding, token = this.bindingToken, configuration = this.configurationToken = {};
    const guard = () => this.current(token) && this.configurationToken === configuration;
    if (!binding || !guard()) return;
    try {
      if (max < 3 || max > 10000) throw new TypeError('Invalid spatial budget');
      this.viewport = viewport;
      const bounds = binding.bounds;
      const view = bounds === null ? undefined : viewport === null ? bounds : viewportBounds(viewport, bounds, guard);
      if (!guard()) return;
      this.authority.invalidate('query');
      if (!guard()) return;
      this.error = false; this.view = view;
      if (!view) { this.result = Object.freeze({ points: Object.freeze([]), bins: Object.freeze([]), matchedCount: 0 }); this.loading = false; this.changed(); return; }
      const maxBins = Math.ceil((max - 2) / 2), maxPoints = max - 2 - maxBins;
      this.queryIntent = { bounds: view, maxBins, maxPoints, token: {} };
      this.loading = true;
      this.changed(); this.pumpQuery(); this.pumpLookup();
    } catch { if (guard()) { this.error = true; this.loading = false; this.queryIntent = undefined; this.authority.invalidate('query'); this.changed(); } }
  }
  setSelected(id: string): void {
    this.selectedId = id; this.selectedDone = ''; this.selected = undefined;
    this.lookupToken = {}; this.authority.invalidate('lookup'); this.changed(); this.pumpLookup();
  }
  reveal(id: string): Promise<SpatialPoint | null> {
    this.revealResolve?.(null); this.revealResolve = undefined;
    this.revealId = id; this.revealDone = ''; this.revealed = undefined;
    const token = this.lookupToken = {}; this.authority.invalidate('lookup');
    if (this.lookupToken !== token || typeof id !== 'string' || !id || !this.binding || !this.host.isConnected || id.length > 256 || !id.trim()) return Promise.resolve(null);
    return new Promise(resolve => { this.revealResolve = resolve; this.pumpLookup(); });
  }
  private pumpQuery(): void {
    if (this.queryActive || !this.queryIntent || !this.binding || !this.host.isConnected) return;
    const binding = this.binding, intent = this.queryIntent, token = this.bindingToken;
    const lease = this.authority.begin('query', this.locale());
    if (!lease) return;
    const guard = () => this.current(token) && this.queryIntent === intent && lease.isCurrent();
    if (!guard()) return;
    this.queryActive = true;
    void (async () => {
      try {
        const request = Object.freeze({ bounds: intent.bounds, maxBins: intent.maxBins, maxPoints: intent.maxPoints, signal: lease.context.signal });
        const response = await binding.query.call(binding.source, request);
        if (!guard()) return;
        const matchedCount = sourceCount(own(response, 'matchedCount', guard));
        if (matchedCount > binding.count) throw new TypeError('Invalid matched count');
        const rawBins = own(response, 'bins', guard), rawPoints = own(response, 'points', guard);
        if (!Array.isArray(rawBins) || !Array.isArray(rawPoints)) throw new TypeError('Invalid spatial arrays');
        const binCount = sourceCount(own(rawBins, 'length', guard)), pointCount = sourceCount(own(rawPoints, 'length', guard));
        if (binCount > intent.maxBins || pointCount > intent.maxPoints || pointCount > matchedCount) throw new TypeError('Spatial budget exceeded');
        const bins: LyraSpatialBin[] = [], points: SpatialPoint[] = [], ids = new Set<string>();
        let remainder = matchedCount, units = 0;
        for (let index = 0; index < binCount; index++) {
          const raw = own(rawBins, index, guard), bounds = spatialBounds(own(raw, 'bounds', guard), guard);
          const count = sourceCount(own(raw, 'count', guard));
          if (!count || count > remainder || !contained(intent.bounds, bounds) ||
            (intent.bounds.minX !== intent.bounds.maxX && bounds.minX === bounds.maxX) ||
            (intent.bounds.minY !== intent.bounds.maxY && bounds.minY === bounds.maxY)) throw new TypeError('Invalid bin');
          remainder -= count; bins.push(Object.freeze({ bounds, count }));
        }
        if (remainder) throw new TypeError('Incomplete density');
        for (let index = 0; index < pointCount; index++) {
          const point = pointSnapshot(own(rawPoints, index, guard), binding.count, intent.bounds, guard, binding.chart);
          units += pointUnits(point);
          this.pendingUnits = units;
          if (units > 997000 || !this.metadataFits(units) || ids.has(point.id)) throw new TypeError('Invalid spatial metadata');
          ids.add(point.id); points.push(point);
          for (const exact of [this.selected, this.revealed]) if (exact?.id === point.id && !this.samePoint(exact, point)) throw new TypeError('Inconsistent point');
        }
        validatePartition(bins, points, intent.bounds);
        if (!guard()) return;
        this.resultUnits = units;
        this.result = Object.freeze({ matchedCount, bins: Object.freeze(bins), points: Object.freeze(points) });
        this.queryIntent = undefined; this.loading = false; this.error = false; this.changed();
      } catch { if (guard()) { this.error = true; this.loading = false; this.queryIntent = undefined; this.changed(); } }
      finally { this.pendingUnits = 0; this.queryActive = false; this.pumpQuery(); }
    })();
  }
  private metadataFits(pending = 0, lookup = 0): boolean {
    const revision = this.binding?.revision;
    return (this.binding?.chart?.metadataUnits ?? 0) + this.resultUnits + Math.max(this.pendingUnits, pending) + lookup + (this.selected ? pointUnits(this.selected) : 0) +
      (this.revealed ? pointUnits(this.revealed) : 0) + (typeof revision === 'string' ? revision.length : 0) +
      this.selectedId.length + this.revealId.length <= 2000000;
  }
  private samePoint(a: SpatialPoint, b: SpatialPoint): boolean {
    return a.id === b.id && a.sourceIndex === b.sourceIndex && a.x === b.x && a.y === b.y && a.label === b.label && a.sourceId === b.sourceId && a.cluster === b.cluster && a.seriesId === b.seriesId && a.radius === b.radius;
  }
  private pumpLookup(): void {
    if (this.lookupActive || !this.binding || !this.host.isConnected) return;
    const isSelected = this.selectedId !== '' && this.selectedDone !== this.selectedId;
    const id = isSelected ? this.selectedId : this.revealId;
    if (!id || (!isSelected && this.revealDone === id)) return;
    const binding = this.binding, token = this.bindingToken, lookupToken = this.lookupToken;
    const lease = this.authority.begin('lookup', this.locale());
    if (!lease) return;
    const guard = () => this.current(token) && this.lookupToken === lookupToken && lease.isCurrent();
    if (!guard()) return;
    this.lookupActive = true;
    void (async () => {
      let point: SpatialPoint | null = null;
      try {
        text(id, 256); if (!id.trim()) throw new TypeError('Invalid ID');
        const known = [this.selected, this.revealed, ...(this.result?.points ?? [])].find(item => item?.id === id);
        const raw = known ?? await binding.getPoint.call(binding.source, id, Object.freeze({ signal: lease.context.signal }));
        if (!guard()) return;
        if (raw !== null) {
          if (!binding.bounds) throw new TypeError('Point in empty source');
          const candidate = pointSnapshot(raw, binding.count, binding.bounds, guard, binding.chart);
          if (candidate.id !== id || !this.metadataFits(0, pointUnits(candidate))) throw new TypeError('Invalid exact point');
          const accepted = [this.selected, this.revealed, ...(this.result?.points ?? [])];
          if (accepted.some(item => item?.id === id && !this.samePoint(item, candidate))) throw new TypeError('Inconsistent exact point');
          point = candidate;
        } else if ([this.selected, this.revealed, ...(this.result?.points ?? [])].some(item => item?.id === id)) {
          throw new TypeError('Missing known point');
        }
      } catch { if (guard()) this.error = true; }
      finally {
        if (guard()) {
          if (isSelected) { this.selected = point ?? undefined; this.selectedDone = id; }
          else {
            this.revealed = point ?? undefined; this.revealDone = id;
            const resolve = this.revealResolve; this.revealResolve = undefined; resolve?.(point);
          }
          this.changed();
        }
        this.lookupActive = false; this.pumpLookup();
      }
    })();
  }
  /** Exact overlays may lie outside the viewport until the host explicitly reveals them. */
  points(): readonly SpatialPoint[] {
    const points = [...(this.result?.points ?? [])];
    for (const point of [this.selected, this.revealed]) if (point && !points.some(item => item.id === point.id)) points.push(point);
    return points;
  }
  panTo(point: SpatialPoint): LyraSpatialBounds | null | undefined {
    const global = this.binding?.bounds, view = this.view;
    if (!global || !view) return undefined;
    if (this.viewport === null || spatialContains(view, point)) return this.viewport;
    const axis = (lo: number, hi: number, gLo: number, gHi: number, value: number): [number, number] | undefined => {
      if (lo === hi) return [lo, hi];
      const span = hi - lo;
      if (!Number.isFinite(span)) return undefined;
      let min = value < lo ? value : value > hi ? value - span : lo;
      min = Math.max(gLo, Math.min(min, gHi - span));
      const max = min + span;
      return Number.isFinite(min) && Number.isFinite(max) && min <= value && max >= value && max <= gHi && max - min === span ? [min, max] : undefined;
    };
    const x = axis(view.minX, view.maxX, global.minX, global.maxX, point.x), y = axis(view.minY, view.maxY, global.minY, global.maxY, point.y);
    return x && y ? Object.freeze({ minX: x[0], maxX: x[1], minY: y[0], maxY: y[1] }) : undefined;
  }
}
