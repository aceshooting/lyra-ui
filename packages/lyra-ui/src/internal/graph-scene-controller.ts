import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraGraphScene, LyraGraphSceneRequest, LyraGraphSource, LyraSourceBounds, LyraSourceRevision } from '../data-sources.js';
import { SourceRequestController, sourceCount, sourceRevision } from './source-request-controller.js';

export type GraphSceneIntent = Pick<LyraGraphSceneRequest, 'mode' | 'centerKey' | 'bounds' | 'includeKeys'>;
export interface SceneNodeValue { readonly id: string; readonly position?: { readonly x: number; readonly y: number; readonly z?: number }; }
export interface SceneEdgeValue { readonly id: string; readonly source: string; readonly target: string; }
export interface SceneBinding<N, E> { readonly source: LyraGraphSource<N, E>; readonly epoch: number; readonly locale: string; }
export interface SceneState<N, E> {
  readonly pending: boolean;
  readonly scene?: LyraGraphScene<N, E>;
  readonly error?: unknown;
}
type Current = () => boolean;
function authorizedRead<T>(read: () => T, current: Current): T {
  if (!current()) throw new Error('Scene revoked');
  const value = read();
  if (!current()) throw new Error('Scene revoked');
  return value;
}
interface Binding<N, E> extends SceneBinding<N, E> {
  readonly revision: LyraSourceRevision;
  readonly records: LyraGraphSource<N, E>['records'];
  readonly read: LyraGraphSource<N, E>['scene'];
}
interface Job<N, E> {
  readonly binding: Binding<N, E>;
  readonly intent: GraphSceneIntent;
  readonly settle: (accepted: boolean) => void;
}
export interface SceneDomain<N, E> {
  readonly positionedViewport?: boolean;
  create(reader: SceneReader): {
    node(value: unknown, entryPosition: unknown): N;
    edge(value: unknown): E;
  };
}
const MAX_NODES = 500;
const MAX_EDGES = 1000;
const MAX_KEYS = 32;
const MAX_FIELD_UNITS = 65_536;
const MAX_TEXT_UNITS = 2_000_000;
const MAX_COORDINATE = 1_000_000;

/** Own-data reads share a cumulative text budget and stop at reentrant authority changes. */
export class SceneReader {
  private used = 0;
  constructor(private readonly current: Current) {}
  check(): void { if (!this.current()) throw new Error('Scene revoked'); }
  field(value: unknown, key: PropertyKey): unknown {
    this.check();
    if (value === null || typeof value !== 'object') throw new TypeError('Invalid scene object');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    this.check();
    if (descriptor && !('value' in descriptor)) throw new TypeError('Accessor scene field');
    return descriptor?.value;
  }
  array(value: unknown, limit: number): { readonly length: number; at(index: number): unknown } {
    this.check();
    if (!Array.isArray(value)) throw new TypeError('Invalid scene collection');
    const length = sourceCount(this.field(value, 'length'));
    if (length > limit) throw new RangeError('Invalid scene collection');
    return { length, at: index => this.field(value, index) };
  }
  number(value: unknown, limit = Number.MAX_VALUE): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) throw new TypeError('Invalid scene number');
    return value;
  }
  text(value: unknown, nonempty = false): string {
    if (typeof value !== 'string' || (nonempty && !value.length) || value.length > MAX_FIELD_UNITS) throw new TypeError('Invalid scene text');
    this.used += value.length;
    if (this.used > MAX_TEXT_UNITS) throw new RangeError('Scene text budget exceeded');
    return value;
  }
  key(value: unknown, kind?: 'node' | 'edge'): string {
    const key = this.text(value, true);
    const prefix = kind ? `${kind}:` : key.startsWith('node:') ? 'node:' : 'edge:';
    if (!key.startsWith(prefix) || key.length === prefix.length) throw new TypeError('Invalid scene key');
    return key;
  }
  bounds(value: unknown): LyraSourceBounds | null {
    if (value === null) return null;
    const x = this.number(this.field(value, 'x'), MAX_COORDINATE);
    const y = this.number(this.field(value, 'y'), MAX_COORDINATE);
    const width = this.number(this.field(value, 'width'), MAX_COORDINATE * 2);
    const height = this.number(this.field(value, 'height'), MAX_COORDINATE * 2);
    if (width < 0 || height < 0 || Math.abs(x + width) > MAX_COORDINATE || Math.abs(y + height) > MAX_COORDINATE) throw new RangeError('Invalid scene bounds');
    return Object.freeze({ x, y, width, height });
  }
  position(value: unknown): Readonly<{ x: number; y: number; z: number }> | undefined {
    if (value === undefined) return undefined;
    const z = this.field(value, 'z');
    return Object.freeze({ x: this.number(this.field(value, 'x'), MAX_COORDINATE), y: this.number(this.field(value, 'y'), MAX_COORDINATE),
      z: z === undefined ? 0 : this.number(z, MAX_COORDINATE) });
  }
  texts(value: unknown, names: readonly string[]): { [key: string]: string } {
    const result: { [key: string]: string } = {};
    for (const name of names) {
      const item = this.field(value, name);
      if (item !== undefined) result[name] = this.text(item);
    }
    return result;
  }
  flag(value: unknown, key: string): boolean | undefined {
    const item = this.field(value, key);
    if (item !== undefined && typeof item !== 'boolean') throw new TypeError('Invalid scene flag');
    return item;
  }
}
function projectIntent(value: GraphSceneIntent, positionedViewport: boolean, current: Current): GraphSceneIntent {
  const reader = new SceneReader(current);
  const mode = reader.field(value, 'mode');
  if (mode !== 'neighborhood' && mode !== 'viewport') throw new TypeError('Invalid scene mode');
  if (positionedViewport && mode !== 'viewport') throw new TypeError('Scene requires viewport mode');
  const center = reader.field(value, 'centerKey');
  const centerKey = center === null ? null : reader.key(center, 'node');
  const area = reader.bounds(reader.field(value, 'bounds'));
  if ((mode === 'neighborhood' && area !== null) || (mode === 'viewport' && area === null)) throw new TypeError('Invalid scene query bounds');
  const rawKeys = reader.array(reader.field(value, 'includeKeys'), MAX_KEYS);
  const keys = new Set<string>();
  for (let i = 0; i < rawKeys.length; i++) {
    const key = reader.key(rawKeys.at(i));
    if (keys.has(key)) throw new TypeError('Duplicate scene reservation');
    keys.add(key);
  }
  return Object.freeze({ mode, centerKey, bounds: area, includeKeys: Object.freeze([...keys]) });
}
function projectScene<N extends SceneNodeValue, E extends SceneEdgeValue>(raw: unknown, current: Current, domain: SceneDomain<N, E>): LyraGraphScene<N, E> {
  const reader = new SceneReader(current);
  // Check both collection lengths before touching any record.
  const rawNodes = reader.array(reader.field(raw, 'nodes'), MAX_NODES);
  const rawEdges = reader.array(reader.field(raw, 'edges'), MAX_EDGES);
  const summary = reader.field(raw, 'total');
  const total = Object.freeze({ nodes: sourceCount(reader.field(summary, 'nodes')), edges: sourceCount(reader.field(summary, 'edges')) });
  const coverage = reader.field(raw, 'coverage');
  if (coverage !== 'complete' && coverage !== 'neighborhood' && coverage !== 'aggregate') throw new TypeError('Invalid scene coverage');
  if (total.nodes < rawNodes.length || total.edges < rawEdges.length ||
    (coverage === 'complete' && (total.nodes !== rawNodes.length || total.edges !== rawEdges.length))) throw new RangeError('Invalid scene totals');
  const worldBounds = reader.bounds(reader.field(raw, 'worldBounds'));
  if (domain.positionedViewport && worldBounds === null) throw new TypeError('Scene requires world bounds');
  const normalize = domain.create(reader);
  const nodeKeys = new Set<string>();
  const edgeKeys = new Set<string>();
  const nodes: LyraGraphScene<N, E>['nodes'][number][] = [];
  const edges: LyraGraphScene<N, E>['edges'][number][] = [];
  for (let i = 0; i < rawNodes.length; i++) {
    reader.check();
    const entry = rawNodes.at(i);
    const key = reader.key(reader.field(entry, 'key'), 'node');
    const value = normalize.node(reader.field(entry, 'value'), reader.field(entry, 'position'));
    if (key !== `node:${value.id}` || nodeKeys.has(key)) throw new TypeError('Invalid node identity');
    if (domain.positionedViewport) {
      const point = value.position;
      if (!point || !worldBounds || point.x < worldBounds.x || point.y < worldBounds.y ||
        point.x > worldBounds.x + worldBounds.width || point.y > worldBounds.y + worldBounds.height) throw new RangeError('Flow scene point outside world bounds');
    }
    nodeKeys.add(key);
    nodes.push(Object.freeze({ key, value, ...(value.position === undefined ? {} : { position: value.position }) }));
  }
  for (let i = 0; i < rawEdges.length; i++) {
    reader.check();
    const entry = rawEdges.at(i);
    const key = reader.key(reader.field(entry, 'key'), 'edge');
    const source = reader.key(reader.field(entry, 'source'), 'node');
    const target = reader.key(reader.field(entry, 'target'), 'node');
    const value = normalize.edge(reader.field(entry, 'value'));
    if (key !== `edge:${value.id}` || edgeKeys.has(key) || source !== `node:${value.source}` || target !== `node:${value.target}` ||
      !nodeKeys.has(source) || !nodeKeys.has(target)) throw new TypeError('Invalid edge identity or endpoint');
    edgeKeys.add(key); edges.push(Object.freeze({ key, source, target, value }));
  }
  return Object.freeze({ nodes: Object.freeze(nodes), edges: Object.freeze(edges), total, coverage, worldBounds });
}

/** Accepts one closed scene while serializing provider calls and replacing queued intent. */
export class GraphSceneController<N extends SceneNodeValue, E extends SceneEdgeValue> implements ReactiveController {
  private snapshot: SceneState<N, E> = Object.freeze({ pending: false });
  private binding?: Binding<N, E>;
  private bindVersion = 0;
  private requestVersion = 0;
  private current?: Job<N, E>;
  // An abort-ignoring callback retains its physical permit until settlement.
  private running?: Job<N, E>;
  private scheduled = false;
  private notification?: object;
  private readonly authority: SourceRequestController<'scene'>;
  private readonly onChange: () => void;
  private readonly domain: SceneDomain<N, E>;

  constructor(private readonly host: HTMLElement & ReactiveControllerHost, options: { readonly onChange: () => void; readonly domain: SceneDomain<N, E> }) {
    this.onChange = options.onChange;
    this.domain = options.domain;
    this.authority = new SourceRequestController(host, { channels: ['scene'], onReset: () => this.reset() });
    host.addController(this);
  }
  get state(): SceneState<N, E> { return this.snapshot; }

  bind(value: SceneBinding<N, E> | undefined): boolean {
    const transaction = ++this.bindVersion;
    const readCurrent = <T>(read: () => T): T => authorizedRead(read, () => transaction === this.bindVersion);
    let candidate: Binding<N, E> | undefined;
    try {
      if (value !== undefined) {
        const source = readCurrent(() => value.source);
        if (!source || typeof source !== 'object') throw new TypeError('Invalid graph source');
        const revision = sourceRevision(readCurrent(() => source.revision));
        const records = readCurrent(() => source.records);
        const read = readCurrent(() => source.scene);
        if (!records || sourceRevision(readCurrent(() => records.revision)) !== revision || typeof read !== 'function' ||
          typeof readCurrent(() => records.query) !== 'function' || typeof readCurrent(() => records.lookup) !== 'function' ||
          typeof readCurrent(() => records.locate) !== 'function') throw new TypeError('Invalid graph source capabilities');
        const locale = readCurrent(() => value.locale);
        if (typeof locale !== 'string') throw new TypeError('Invalid graph source locale');
        const epoch = sourceCount(readCurrent(() => value.epoch));
        candidate = Object.freeze({ source, revision, records, read, epoch, locale });
      }
    } catch (error) {
      if (transaction === this.bindVersion) {
        this.binding = undefined; this.authority.setSource(undefined, undefined);
        if (transaction !== this.bindVersion) return false;
        this.authority.refresh();
        if (transaction === this.bindVersion) this.patch({ pending: false, error });
      }
      return false;
    }
    if (transaction !== this.bindVersion) return false;
    const previous = this.binding;
    if (candidate && previous && candidate.source === previous.source && candidate.revision === previous.revision &&
      candidate.records === previous.records && candidate.read === previous.read && candidate.epoch === previous.epoch && candidate.locale === previous.locale) return true;
    this.binding = undefined;
    this.authority.refresh();
    if (transaction !== this.bindVersion) return false;
    this.authority.setSource(candidate?.source, candidate?.revision);
    if (transaction !== this.bindVersion) return false;
    this.binding = candidate;
    return true;
  }

  request(value: GraphSceneIntent): Promise<boolean> {
    const transaction = ++this.requestVersion;
    this.current?.settle(false); this.current = undefined;
    this.authority.invalidate('scene');
    if (transaction !== this.requestVersion) return Promise.resolve(false);
    try {
      const intent = projectIntent(value, this.domain.positionedViewport === true, () => transaction === this.requestVersion);
      if (transaction !== this.requestVersion || !this.binding || !this.host.isConnected) return Promise.resolve(false);
      const binding = this.binding;
      let settle!: (accepted: boolean) => void;
      const done = new Promise<boolean>(resolve => { settle = resolve; });
      this.current = { binding, intent, settle };
      this.patch({ pending: true });
      this.schedule();
      return done;
    } catch (error) {
      if (transaction === this.requestVersion) this.patch({ pending: false, error });
      return Promise.resolve(false);
    }
  }

  private schedule(): void {
    if (this.scheduled || this.running || !this.current) return;
    this.scheduled = true;
    queueMicrotask(() => { this.scheduled = false; void this.pump(); });
  }
  private async pump(): Promise<void> {
    const job = this.current;
    if (this.running || !job || this.binding !== job.binding) return;
    const lease = this.authority.begin('scene', job.binding.locale);
    if (!lease || this.current !== job) return;
    this.running = job;
    const current = () => this.current === job && this.binding === job.binding && lease.isCurrent();
    try {
      this.validateRevision(job.binding, current);
      if (!current()) return;
      const raw = await Reflect.apply(job.binding.read, job.binding.source, [{ ...lease.context, ...job.intent, nodeLimit: MAX_NODES, edgeLimit: MAX_EDGES }]);
      if (!current()) return;
      this.validateRevision(job.binding, current);
      if (!current()) return;
      const scene = projectScene(raw, current, this.domain);
      if (!current()) return;
      // Descriptor traps can change provider metadata while the closed scene is projected.
      this.validateRevision(job.binding, current);
      if (!current()) return;
      this.patch({ pending: false, scene });
      job.settle(true); this.current = undefined;
    } catch (error) {
      if (current()) { this.patch({ pending: false, error }); job.settle(false); this.current = undefined; }
    } finally {
      if (this.running === job) this.running = undefined;
      this.schedule();
    }
  }
  private validateRevision(binding: Binding<N, E>, current: Current): void {
    const read = <T>(get: () => T): T => authorizedRead(get, current);
    if (sourceRevision(read(() => binding.source.revision)) !== binding.revision || read(() => binding.source.records) !== binding.records ||
      sourceRevision(read(() => binding.records.revision)) !== binding.revision || read(() => binding.source.scene) !== binding.read) throw new TypeError('Graph source revision changed');
  }
  private reset(): void {
    this.requestVersion++;
    this.current?.settle(false); this.current = undefined;
    this.patch({ pending: false });
  }
  private patch(state: SceneState<N, E>): void {
    this.snapshot = Object.freeze(state);
    if (this.notification) return;
    const notification = this.notification = {};
    queueMicrotask(() => {
      if (this.notification !== notification) return;
      this.notification = undefined;
      if (this.host.isConnected) this.onChange();
    });
  }
  adopted(): void { this.bindVersion++; this.binding = undefined; this.authority.adopted(); }
  hostConnected(): void { this.patch({ pending: false }); }
  hostDisconnected(): void { this.bindVersion++; this.binding = undefined; this.notification = undefined; }
}
