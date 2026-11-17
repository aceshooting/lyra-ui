import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraCursorNavigationState, LyraCursorRecord, LyraCursorSource, LyraSourceRevision } from '../data-sources.js';
import { SourceRequestController, sourceRevision } from './source-request-controller.js';
import { sourcePageScope } from './source-page-scope.js';
import { cursorCurrent, cursorField, cursorList, cursorText, cursorToken, type CursorCurrent } from './source-cursor-projection.js';

export interface SourceCursorBinding<T, Q> {
  readonly source: LyraCursorSource<T, Q>;
  readonly revision: LyraSourceRevision;
  readonly scope: string;
  readonly epoch: number;
  readonly locale: string;
}
interface Binding<T, Q> extends SourceCursorBinding<T, Q> {
  readonly queryPage: LyraCursorSource<T, Q>['query'];
}
export interface SourceCursorState<T> {
  readonly navigation: LyraCursorNavigationState;
  readonly rows: readonly LyraCursorRecord<T>[];
  /** The current request starts the listing, rather than continuing an earlier batch. */
  readonly initial: boolean;
}
export interface SourceCursorOptions<T> {
  readonly normalizeRecord: (key: string, value: unknown, current: CursorCurrent) => { readonly value: T; readonly textUnits: number };
  readonly onChange: () => void;
}
interface Intent<T, Q> {
  readonly binding: Binding<T, Q>;
  readonly query: Q;
  readonly limit: number;
  readonly cursor: string | null;
  readonly history: readonly (string | null)[];
  readonly truncated: boolean;
  readonly initial: boolean;
}
interface Job<T, Q> {
  readonly intent: Intent<T, Q>;
  readonly settle: (accepted: boolean) => void;
}

const HISTORY_LIMIT = 32;
const PAGE_TEXT_LIMIT = 2_000_000;
function snapshot<T>(status: LyraCursorNavigationState['status'] = 'idle', rows: readonly LyraCursorRecord<T>[] = [],
  initial = true, historyLength = 0, next: string | null = null, truncated = false): SourceCursorState<T> {
  return Object.freeze({ rows: Object.freeze(rows), initial, navigation: Object.freeze({ status,
    canGoBack: status === 'ready' && historyLength > 1, canGoForward: status === 'ready' && next !== null,
    atEnd: status === 'ready' && next === null, historyTruncated: truncated }) });
}

/** Bounded refetch navigation for one unknown-total source, without selected-record caches. */
export class SourceCursorController<T, Q> implements ReactiveController {
  private binding?: Binding<T, Q>;
  private generation = 0;
  private connected: boolean;
  private value: SourceCursorState<T> = snapshot();
  private history: readonly (string | null)[] = [];
  private nextToken: string | null = null;
  private truncated = false;
  private last?: Intent<T, Q>;
  private currentJob?: Job<T, Q>;
  private running?: Job<T, Q>;
  private scheduled = false;
  private notification?: object;
  private unsubscribeScope?: () => void;
  private scopeSubscription?: object;
  private readonly authority: SourceRequestController<'page'>;
  private readonly options: SourceCursorOptions<T>;

  constructor(private readonly host: HTMLElement & ReactiveControllerHost, options: SourceCursorOptions<T>) {
    this.options = Object.freeze({ ...options });
    this.connected = host.isConnected;
    this.authority = new SourceRequestController(host, { channels: ['page'] });
    host.addController(this);
  }

  get state(): SourceCursorState<T> { return this.value; }

  bind(input: SourceCursorBinding<T, Q> | undefined): void {
    const previous = this.binding;
    if (input && previous && input.source === previous.source && input.revision === previous.revision &&
      input.scope === previous.scope && input.epoch === previous.epoch && input.locale === previous.locale) return;
    const transaction = this.clear();
    if (!input || transaction !== this.generation) return;
    const current = () => transaction === this.generation;
    try {
      const registration = sourcePageScope(this.host);
      const subscription = this.scopeSubscription = {};
      const unsubscribe = registration?.onInvalidate(() => {
        if (this.scopeSubscription === subscription) this.invalidate();
      });
      if (!current()) { unsubscribe?.(); return; }
      this.unsubscribeScope = unsubscribe;
      const { source, revision, scope, epoch, locale } = input;
      if ((typeof source !== 'object' && typeof source !== 'function') || source === null ||
        typeof locale !== 'string' || !Number.isSafeInteger(epoch) || epoch < 0) throw new TypeError('Invalid cursor binding');
      sourceRevision(revision);
      if (typeof revision === 'string' && revision.length > 8_192) throw new RangeError('Cursor revision limit');
      if (cursorText(scope, 8_192).length === 0) throw new TypeError('Empty cursor scope');
      cursorCurrent(current);
      const queryPage = source.query;
      cursorCurrent(current);
      if (typeof queryPage !== 'function') throw new TypeError('Invalid cursor query');
      const accepted = Object.freeze({ source, revision, scope, epoch, locale, queryPage });
      this.authority.setSource(source, revision);
      if (current()) this.binding = accepted;
    } catch {
      if (current()) this.publish(snapshot('error'));
    }
  }

  /** Revoke before a reactive property setter returns; aborted callbacks retain their permits. */
  invalidate(): void { this.clear(); }

  /** Invalid input has no retryable provider intent and retains no thrown object. */
  fail(): void {
    const transaction = this.clear();
    if (transaction === this.generation) this.publish(snapshot('error'));
  }

  request(query: Q, limit: number): Promise<boolean> {
    const binding = this.binding;
    if (!binding || !this.usable()) return Promise.resolve(false);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) { this.fail(); return Promise.resolve(false); }
    this.history = []; this.nextToken = null; this.truncated = false;
    return this.start(Object.freeze({ binding, query, limit, cursor: null, history: Object.freeze([null]), truncated: false, initial: true }));
  }

  next(): Promise<boolean> {
    if (!this.value.navigation.canGoForward || !this.last || this.nextToken === null) return Promise.resolve(false);
    const history = [...this.history, this.nextToken];
    const truncated = this.truncated || history.length > HISTORY_LIMIT;
    if (history.length > HISTORY_LIMIT) history.shift();
    return this.start(Object.freeze({ ...this.last, cursor: this.nextToken, history: Object.freeze(history), truncated, initial: false }));
  }

  previous(): Promise<boolean> {
    if (!this.value.navigation.canGoBack || !this.last) return Promise.resolve(false);
    const history = this.history.slice(0, -1);
    const cursor = history[history.length - 1];
    if (cursor === undefined) return Promise.resolve(false);
    return this.start(Object.freeze({ ...this.last, cursor, history: Object.freeze(history), truncated: this.truncated,
      initial: cursor === null && !this.truncated }));
  }

  retry(): Promise<boolean> {
    return this.value.navigation.status === 'error' && this.last ? this.start(this.last) : Promise.resolve(false);
  }

  private start(intent: Intent<T, Q>): Promise<boolean> {
    if (!this.usable() || this.binding !== intent.binding) return Promise.resolve(false);
    const transaction = ++this.generation;
    this.notification = undefined;
    this.stop();
    if (transaction !== this.generation || this.binding !== intent.binding || !this.usable()) return Promise.resolve(false);
    this.last = intent;
    this.publish(snapshot('loading', [], intent.initial, 0, null, this.truncated));
    let settle!: (accepted: boolean) => void;
    const done = new Promise<boolean>(resolve => { settle = resolve; });
    this.currentJob = { intent, settle };
    this.schedule();
    return done;
  }

  private clear(): number {
    const transaction = ++this.generation;
    this.binding = undefined; this.last = undefined; this.history = []; this.nextToken = null;
    this.truncated = false; this.notification = undefined; this.value = snapshot();
    const unsubscribe = this.unsubscribeScope;
    this.unsubscribeScope = undefined;
    this.scopeSubscription = undefined;
    unsubscribe?.();
    this.stop();
    if (transaction !== this.generation) return transaction;
    this.authority.setSource(undefined, undefined);
    if (transaction === this.generation) this.notify();
    return transaction;
  }

  private stop(): void {
    const previous = this.currentJob;
    this.currentJob = undefined;
    previous?.settle(false);
    this.authority.invalidate('page');
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => { this.scheduled = false; this.pump(); });
  }

  private pump(): void {
    if (this.running || !this.currentJob) return;
    const job = this.currentJob;
    const { intent } = job;
    const binding = this.binding;
    if (!binding || binding !== intent.binding || !this.usable()) { this.stop(); return; }
    this.running = job;
    const generation = this.generation;
    const owner = this.host.ownerDocument;
    const lease = this.authority.begin('page', binding.locale);
    const scope = sourcePageScope(this.host);
    const current = () => this.currentJob === job && this.generation === generation && this.binding === binding &&
      this.usable() && this.host.ownerDocument === owner && lease?.isCurrent() === true && (!scope || scope.isCurrent());
    void Promise.resolve().then(async () => {
      if (!lease || !current()) return false;
      const release = scope ? await scope.acquire(binding.source, 'page', lease.context.signal) : undefined;
      if (scope && !release) return false;
      try {
        if (!current()) return false;
        const request = Object.freeze({ ...lease.context, scope: binding.scope, query: intent.query, cursor: intent.cursor, limit: intent.limit });
        const raw: unknown = await Reflect.apply(binding.queryPage, binding.source, [request]);
        cursorCurrent(current);
        const rows = cursorList(cursorField(raw, 'rows', current), intent.limit, current);
        const next = cursorToken(cursorField(raw, 'nextCursor', current));
        if (next !== null && intent.history.includes(next)) throw new TypeError('Cursor cycle');
        const accepted: LyraCursorRecord<T>[] = [];
        const keys = new Set<string>();
        let textUnits = 0;
        for (const row of rows) {
          const key = cursorText(cursorField(row, 'key', current), 65_536, true);
          if (keys.has(key)) throw new TypeError('Duplicate cursor key');
          keys.add(key);
          const projected = this.options.normalizeRecord(key, cursorField(row, 'value', current), current);
          cursorCurrent(current);
          if (!Number.isSafeInteger(projected.textUnits) || projected.textUnits < 0 || projected.textUnits > 65_536) throw new RangeError('Cursor document text limit');
          textUnits += key.length + projected.textUnits;
          if (textUnits > PAGE_TEXT_LIMIT) throw new RangeError('Cursor page text limit');
          accepted.push(Object.freeze({ key, value: projected.value }));
        }
        cursorCurrent(current);
        this.history = intent.history; this.nextToken = next; this.truncated = intent.truncated;
        this.publish(snapshot('ready', accepted, intent.initial, intent.history.length, next, intent.truncated));
        return true;
      } finally { release?.(); }
    }).then(accepted => { job.settle(current() && accepted); }).catch(() => {
      if (current()) this.publish(snapshot('error', [], intent.initial, 0, null, this.truncated));
      job.settle(false);
    }).finally(() => {
      if (this.currentJob === job) this.currentJob = undefined;
      if (this.running === job) this.running = undefined;
      this.schedule();
    });
  }

  private usable(): boolean { return this.connected && this.host.isConnected; }
  private publish(value: SourceCursorState<T>): void { this.value = value; this.notify(); }
  private notify(): void {
    if (this.notification) return;
    const token = {};
    const generation = this.generation;
    const owner = this.host.ownerDocument;
    this.notification = token;
    queueMicrotask(() => {
      if (this.notification !== token) return;
      this.notification = undefined;
      if (generation === this.generation && this.usable() && this.host.ownerDocument === owner) this.options.onChange();
    });
  }
  adopted(): void { this.invalidate(); }
  hostConnected(): void { this.connected = true; }
  hostDisconnected(): void { this.connected = false; this.invalidate(); }
}
