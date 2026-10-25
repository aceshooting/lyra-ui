import type {
  LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraHierarchyView,
  LyraSourceRangeRequest, LyraTraceSourceSummary,
} from '../data-sources.js';
import { hierarchyField } from './hierarchy-source-controller.js';

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
