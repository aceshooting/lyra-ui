import type {
  LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraHierarchyView,
  LyraSourceRangeRequest, LyraTraceSourceSummary,
} from '../data-sources.js';
import { getNumberFormat } from './intl-cache.js';
import { hierarchyField } from './hierarchy-source-controller.js';

/** Locale-formatted counts for a projected hierarchy, ready for the host's summary message. */
export function hierarchySourceSummary(
  projection: { readonly total: number; readonly rows: { readonly count: number } } | undefined,
  locale: string,
): { visible: string; total: string; pluralCount: number } | undefined {
  if (!projection) return undefined;
  const formatter = getNumberFormat(locale);
  return { visible: formatter.format(projection.rows.count), total: formatter.format(projection.total), pluralCount: projection.total };
}

type Host = Pick<HTMLElement, 'ownerDocument' | 'isConnected'>;

interface HierarchySummaryAdapterOptions<T, Summary> {
  readonly captureBinding: () => () => boolean;
  readonly summary: (value: unknown, check: () => void) => Summary;
  readonly row?: (value: unknown, check: () => void) => LyraHierarchyRow<T>;
  readonly range?: (value: unknown, request: LyraSourceRangeRequest, active: () => void,
    row: (value: unknown) => LyraHierarchyRow<T>) => readonly LyraHierarchyRow<T>[];
  readonly total?: (summary: Summary, total: number) => void;
  readonly accepted: (rows: LyraHierarchyView<LyraHierarchyRow<T>>, summary: Summary, current: () => boolean) => void;
  readonly changedMessage: string;
  readonly rangeChangedMessage: string;
  readonly navigationChangedMessage: string;
}

/** Forwards a summary-bearing projection without detaching provider methods from their owners. */
export function createHierarchySummarySource<T, Summary>(
  host: Host,
  source: LyraHierarchySource<T, LyraHierarchyQuery, Summary>,
  options: HierarchySummaryAdapterOptions<T, Summary>,
): LyraHierarchySource<T, LyraHierarchyQuery> {
  return {
    get revision() { return source.revision; },
    async project(request) {
      const binding = options.captureBinding();
      const owner = host.ownerDocument;
      const owned = () => binding() && host.ownerDocument === owner && host.isConnected && !request.signal.aborted;
      const current = () => {
        if (!owned()) return false;
        const revision = source.revision;
        return owned() && revision === request.revision;
      };
      const check = () => { if (!current()) throw new Error(options.changedMessage); };
      check();
      const project = source.project;
      check();
      const result = await project.call(source, request);
      check();
      const rawSummary = result.summary;
      check();
      const summary = options.summary(rawSummary, check);
      const validateRow = (value: unknown) => options.row ? options.row(value, check) : value as LyraHierarchyRow<T>;
      const view = result.rows;
      check();
      const count = view.count;
      check();
      const hasItemAt = 'itemAt' in view;
      check();
      const itemAt = hasItemAt ? (view as { itemAt?: unknown }).itemAt : undefined;
      check();
      let wrapped: LyraHierarchyView<LyraHierarchyRow<T>>;
      if (typeof itemAt === 'function') {
        const indexed = view as Extract<typeof view, { itemAt: unknown }>;
        wrapped = { count,
          itemAt(index) { check(); const method = indexed.itemAt; check(); const value = method.call(indexed, index); check(); return validateRow(value); },
          keyAt(index) { check(); const method = indexed.keyAt; check(); const value = method.call(indexed, index); check(); return value; },
          indexOfKey(key: string | number) { check(); const method = indexed.indexOfKey; check(); const value = method.call(indexed, key); check(); return value; },
        };
      } else {
        const ranged = view as Extract<typeof view, { read: unknown }>;
        wrapped = { count,
          async read(range) {
            const active = () => { check(); if (range.signal.aborted) throw new Error(options.rangeChangedMessage); };
            active(); const method = ranged.read; active();
            const value = await method.call(ranged, range); active();
            return options.range ? options.range(value, range, active, validateRow) : value;
          },
          async indexOfKey(key: string, context) {
            const active = () => { check(); if (context.signal.aborted) throw new Error(options.navigationChangedMessage); };
            active(); const method = ranged.indexOfKey; active();
            const value = await method.call(ranged, key, context); active(); return value;
          },
        };
      }
      const state = result.state;
      check();
      const total = result.total;
      check();
      options.total?.(summary, total);
      const focusIndex = result.focusIndex;
      check();
      options.accepted(wrapped, summary, current);
      return { state, total, rows: wrapped, ...(focusIndex === undefined ? {} : { focusIndex }) };
    },
  };
}

/** Reads a finite complete trace extent through own data descriptors. */
export function traceSourceSummary(value: unknown, check: () => void): LyraTraceSourceSummary {
  const startMs = hierarchyField(value, 'startMs');
  check();
  const endMs = hierarchyField(value, 'endMs');
  check();
  if (typeof startMs !== 'number' || typeof endMs !== 'number' || !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) || startMs < 0 || endMs < startMs || !Number.isFinite(endMs - startMs))
    throw new TypeError('Invalid trace extent');
  return { startMs, endMs };
}

interface HierarchyEffectState {
  readonly epoch: number;
  readonly projection?: unknown;
  readonly error: boolean;
  readonly loading: boolean;
  readonly rowError: boolean;
  readonly rowsObserved: boolean;
}

/** Captures authority for local effects without owning rendering, localization or announcements. */
export function captureHierarchySourceEffects(host: Host, control: HierarchyEffectState, binding: () => boolean) {
  const epoch = control.epoch;
  const owner = host.ownerDocument;
  const projection = control.projection;
  const { error, loading, rowError, rowsObserved } = control;
  const bound = () => host.isConnected && host.ownerDocument === owner && binding() && control.epoch === epoch;
  const current = () => bound() && control.projection === projection &&
    control.error === error && control.loading === loading &&
    control.rowError === rowError && control.rowsObserved === rowsObserved;
  return { epoch, error, loading, rowError, rowsObserved, bound, current };
}

/** Authority captured by {@link captureHierarchySourceEffects}. */
export type HierarchySourceEffectSnapshot = ReturnType<typeof captureHierarchySourceEffects>;

/**
 * Authority for normalizing one provider row: the host stays connected in the same owner document,
 * `binding()` holds, the projection, epoch and loading state are unchanged, and the accepted
 * summary for those rows is still current. Captured when the row normalization starts.
 */
export function captureHierarchyRowAuthority(
  host: Host,
  control: Pick<HierarchyEffectState, 'epoch' | 'projection' | 'loading'>,
  binding: () => boolean,
  accepted: (() => boolean) | undefined,
): () => boolean {
  const owner = host.ownerDocument;
  const { epoch, projection } = control;
  const owned = () => host.isConnected && host.ownerDocument === owner && binding() &&
    control.epoch === epoch && control.projection === projection && !control.loading;
  return () => owned() && Boolean(accepted?.()) && owned();
}

/** Reads own data fields of one provider row, throwing `message` once `current()` is lost before or
 *  after any read. */
export function hierarchySourceFieldReader(
  value: unknown,
  current: () => boolean,
  message: string,
): (key: string) => unknown {
  return (key) => {
    if (!current()) throw new Error(message);
    const result = hierarchyField(value, key);
    if (!current()) throw new Error(message);
    return result;
  };
}

/** The epoch and key a host last asked {@link revealActiveHierarchyKey} to reveal. */
export type HierarchyRevealMark = readonly [epoch: number, key: string];

/**
 * Reveals the host's active key once per projection epoch: after the provider settles, and only
 * while `snapshot` keeps its binding and `activeKey()` still names the same key. Returns the mark
 * to remember, unchanged when there is no active key or it was already requested for this epoch.
 */
export function revealActiveHierarchyKey(
  control: { whenReady(): Promise<boolean>; reveal(key: string): Promise<boolean> },
  snapshot: Pick<HierarchySourceEffectSnapshot, 'epoch' | 'bound'>,
  activeKey: () => string | null | undefined,
  last: HierarchyRevealMark | undefined,
): HierarchyRevealMark | undefined {
  const key = activeKey();
  if (!key || (last?.[0] === snapshot.epoch && last[1] === key)) return last;
  void control.whenReady().then((ready) => {
    if (ready && snapshot.bound() && activeKey() === key) void control.reveal(key);
  });
  return [snapshot.epoch, key];
}

/** Localized text and announcement sinks for {@link applyHierarchySourceEffects}. */
export interface HierarchySourceEffectSinks {
  errorText(): string;
  loadingText(): string;
  summary(): string;
  /** Polite announcement of a changed status. */
  announce(text: string): void;
  /** Row-observation outcome (the `source-rows` transition). */
  rowsTransition?(state: 'error' | 'ready', message: string): void;
}

/**
 * The shared status/announcement step of a hierarchy source host: resolves the status (error,
 * loading or summary), announces it when it changed from `lastAnnouncement`, and reports the
 * row-observation outcome. Authority is re-checked before and after every effect; the result is
 * the status to remember, or `undefined` when authority was lost and the host must stop.
 */
export function applyHierarchySourceEffects(
  snapshot: HierarchySourceEffectSnapshot,
  sinks: HierarchySourceEffectSinks,
  lastAnnouncement: string | undefined,
): string | undefined {
  const { current } = snapshot;
  if (!current()) return undefined;
  const status = snapshot.error ? sinks.errorText() : snapshot.loading ? sinks.loadingText() : sinks.summary();
  if (!current()) return undefined;
  if (lastAnnouncement !== undefined && status !== lastAnnouncement) {
    sinks.announce(status);
    if (!current()) return undefined;
  }
  if (snapshot.rowsObserved && sinks.rowsTransition) {
    const message = snapshot.rowError ? sinks.errorText() : '';
    if (!current()) return undefined;
    sinks.rowsTransition(snapshot.rowError ? 'error' : 'ready', message);
    if (!current()) return undefined;
  }
  return status;
}
