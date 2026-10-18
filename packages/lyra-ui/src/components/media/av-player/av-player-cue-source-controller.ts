import type { ReactiveControllerHost } from 'lit';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import type { LyraRangeSource } from '../../../data-sources.js';
import { SourceRequestController } from '../../../internal/source-request-controller.js';
import { SourceWindowController } from '../../../internal/source-window-controller.js';
import type { LyraAvCue } from './av-metadata.js';
import { captureActiveCue, captureCueLocation, captureCueSource, captureSourceCue, sameSourceCue, captureCueSearch, sourceCueMatches,
  type LyraAvActiveCue, type LyraAvCueSource, type LyraAvCueSearch } from './av-cue-source.js';

interface CueBinding { readonly source: LyraAvCueSource; readonly owner: Document; }
interface ActiveRequest { readonly binding: CueBinding; readonly time: number; }
interface SearchRequest {
  readonly binding: CueBinding;
  readonly query: string;
  readonly locale: string;
  readonly settle: (count: number) => void;
}
interface SearchHandle {
  readonly binding: CueBinding;
  readonly query: string;
  readonly locale: string;
  readonly value: LyraAvCueSearch;
}
interface MatchRequest {
  readonly handle: SearchHandle;
  readonly ordinal: number;
  readonly settle: (moved: boolean) => void;
}

/** Domain bridge: the shared window owns all row caches, keys, eviction and range permits. */
export class AvCueSourceController {
  readonly window: SourceWindowController<LyraAvCue>;
  private readonly requests: SourceRequestController<'active' | 'search' | 'match'>;
  private binding?: CueBinding;
  private version = 0;
  private desired?: ActiveRequest;
  private running?: ActiveRequest;
  private scheduled = false;
  private interval?: LyraAvActiveCue;
  active?: { readonly index: number; readonly cue: LyraAvCue };
  unavailable = false;
  private desiredSearch?: SearchRequest;
  private runningSearch?: SearchRequest;
  private desiredMatch?: MatchRequest;
  private runningMatch?: MatchRequest;
  private searchHandle?: SearchHandle;
  private searchVersion = 0;
  private matchVersion = 0;
  private searchScheduled = false;
  private matchScheduled = false;
  private completedQuery = '';
  private completedLocale = '';
  private completedCount = 0;
  private completedOrdinal = -1;
  selected?: { readonly index: number; readonly cue: LyraAvCue };
  searchLoading = false;
  searchUnavailable = false;

  constructor(private readonly host: HTMLElement & ReactiveControllerHost, private readonly options: {
    readonly locale: () => string;
    readonly changed: () => void;
    readonly activeChanged: (cueId: string | null, index: number) => void;
    readonly searchChanged: (detail: LyraSearchChangeDetail) => void;
    readonly reveal: (index: number, current: () => boolean) => Promise<boolean>;
  }) {
    this.requests = new SourceRequestController(host, { channels: ['active', 'search', 'match'], onReset: () => {
      this.desired = undefined;
      this.interval = undefined;
      this.active = undefined;
      this.resetSearch();
    } });
    this.window = new SourceWindowController(host, {
      pageSize: 32, maxRows: 128, maxPages: 4, maxConcurrent: 2,
      keyOf: cue => cue.cueId,
      normalize: (raw, index) => {
        const cue = captureSourceCue(raw);
        this.checkRecord(index, cue, false);
        return cue;
      },
      onChange: options.changed,
    });
  }

  get count(): number { return this.binding?.source.count ?? 0; }
  get epoch(): number { return this.version; }
  isCurrent(epoch: number): boolean { return epoch === this.version && !!this.binding && this.current(this.binding); }

  revoke(): void {
    this.version++;
    this.binding = undefined;
    this.unavailable = false;
    this.requests.refresh();
    this.window.bind(undefined);
  }

  bind(input: unknown, authoritative: () => boolean): void {
    const version = this.version;
    try {
      const source = captureCueSource(input);
      if (version !== this.version || !authoritative()) return;
      const binding: CueBinding = { source, owner: this.host.ownerDocument };
      this.requests.setSource(binding, source.revision);
      if (version !== this.version || !authoritative()) return;
      this.binding = binding;
      const current = (signal: AbortSignal) => !signal.aborted && this.current(binding);
      const view: LyraRangeSource<LyraAvCue> = {
        count: source.count,
        read: async request => {
          const values: LyraAvCue[] = [];
          const ids = new Set<string>();
          try {
            for (let offset = 0; offset < request.limit; offset++) {
              if (!current(request.signal)) throw new Error('Cue read canceled');
              const raw = await source.getCue(request.offset + offset, request);
              if (!current(request.signal)) throw new Error('Cue read canceled');
              const cue = captureSourceCue(raw);
              if (!current(request.signal)) throw new Error('Cue read canceled');
              this.checkRecord(request.offset + offset, cue);
              if (ids.has(cue.cueId)) throw new TypeError('Duplicate cue identity');
              ids.add(cue.cueId);
              values.push(cue);
            }
            return values;
          } catch (error) {
            if (current(request.signal)) {
              this.unavailable = true;
              this.options.changed();
            }
            throw error;
          }
        },
        indexOfKey: async (key, request) => {
          if (!current(request.signal)) return null;
          const raw = await source.findCue(key, request);
          if (!current(request.signal) || raw === null) return null;
          const found = captureCueLocation(raw, source.count);
          if (!current(request.signal)) return null;
          if (found.cue.cueId !== key) throw new TypeError('Cue lookup mismatch');
          this.checkRecord(found.index, found.cue);
          return current(request.signal) ? found.index : null;
        },
      };
      this.window.bind({ owner: binding, revision: source.revision, epoch: version, locale: this.options.locale(), view });
      if (version !== this.version || !authoritative()) return;
      this.unavailable = false;
    } catch {
      if (version !== this.version || !authoritative()) return;
      this.unavailable = true;
      this.binding = undefined;
    }
  }

  private current(binding: CueBinding): boolean {
    return this.binding === binding && this.host.isConnected && this.host.ownerDocument === binding.owner;
  }

  /** Only cached keys and the retained active record participate; there is no full-ID index. */
  private checkRecord(index: number, cue: LyraAvCue, cached = true): void {
    if (this.active && ((this.active.index === index && !sameSourceCue(this.active.cue, cue)) ||
      (this.active.index !== index && this.active.cue.cueId === cue.cueId))) throw new TypeError('Contradictory cue reply');
    if (this.selected && ((this.selected.index === index && !sameSourceCue(this.selected.cue, cue)) ||
      (this.selected.index !== index && this.selected.cue.cueId === cue.cueId))) throw new TypeError('Contradictory selected cue');
    if (!cached) return;
    const key = this.window.source.keyAt!(index);
    if (typeof key === 'string') {
      if (key !== cue.cueId) throw new TypeError('Contradictory cue identity');
      const slot = this.window.source.itemAt(index);
      if (slot.state === 'ready' && !sameSourceCue(slot.value, cue)) throw new TypeError('Contradictory cue reply');
    }
    const other = this.window.source.indexOfKey!(cue.cueId);
    if (other >= 0 && other !== index) throw new TypeError('Duplicate cue identity');
  }

  updateTime(time: number, discontinuity = false): void {
    const binding = this.binding;
    if (!binding || !this.current(binding) || !Number.isFinite(time) || time < 0) return;
    if (discontinuity) {
      this.interval = undefined;
      this.desired = undefined;
      this.requests.invalidate('active');
      if (!this.current(binding)) return;
    }
    if (this.interval && time >= this.interval.validFrom && time < this.interval.validUntil) {
      if (this.desired) {
        this.desired = undefined;
        // Reusing an answer revokes obsolete intent, but the running provider keeps its permit.
        // Abort callbacks may establish newer intent; do not mutate state after invalidation.
        this.requests.invalidate('active');
      }
      return;
    }
    if (this.desired?.time === time && this.desired.binding === binding) return;
    this.desired = { binding, time };
    this.schedule();
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => { this.scheduled = false; this.pump(); });
  }

  private pump(): void {
    if (this.running) return;
    const request = this.desired;
    if (!request || !this.current(request.binding)) return;
    this.running = request;
    const lease = this.requests.begin('active', this.options.locale());
    const current = () => this.desired === request && this.current(request.binding) && !!lease?.isCurrent();
    void Promise.resolve().then(() => current() ? request.binding.source.activeAt(request.time, lease!.context) : undefined).then(raw => {
      if (!current()) return;
      const answer = captureActiveCue(raw, request.binding.source.count, request.time);
      if (!current()) return;
      if (answer.index !== null && answer.cue !== null) this.checkRecord(answer.index, answer.cue);
      if (!current()) return;
      this.interval = answer;
      this.active = answer.index !== null && answer.cue !== null ? { index: answer.index, cue: answer.cue } : undefined;
      this.unavailable = false;
      this.options.activeChanged(answer.cue?.cueId ?? null, answer.index ?? -1);
      if (current()) this.options.changed();
    }).catch(() => {
      if (!current()) return;
      this.interval = undefined;
      this.active = undefined;
      this.unavailable = true;
      this.options.activeChanged(null, -1);
      if (current()) this.options.changed();
    }).finally(() => {
      if (this.desired === request) this.desired = undefined;
      if (this.running === request) this.running = undefined;
      this.schedule();
    });
  }

  private resetSearch(): void {
    this.searchVersion++;
    this.matchVersion++;
    const search = this.desiredSearch;
    const match = this.desiredMatch;
    this.desiredSearch = undefined;
    this.desiredMatch = undefined;
    this.searchHandle = undefined;
    this.selected = undefined;
    this.completedQuery = '';
    this.completedLocale = '';
    this.completedCount = 0;
    this.completedOrdinal = -1;
    this.searchLoading = false;
    this.searchUnavailable = false;
    search?.settle(0);
    match?.settle(false);
  }

  /** Detach logical work before abort callbacks run; physical slots remain owned until settlement. */
  private cancelSearch(): number {
    const version = ++this.searchVersion;
    this.matchVersion++;
    const search = this.desiredSearch;
    const match = this.desiredMatch;
    this.desiredSearch = undefined;
    this.desiredMatch = undefined;
    this.searchHandle = undefined;
    this.selected = undefined;
    search?.settle(0);
    match?.settle(false);
    this.requests.invalidate('match');
    if (version === this.searchVersion) this.requests.invalidate('search');
    return version;
  }

  clearSearch(): void {
    const version = this.cancelSearch();
    if (version !== this.searchVersion) return;
    this.completedQuery = '';
    this.completedLocale = '';
    this.completedCount = 0;
    this.completedOrdinal = -1;
    this.searchLoading = false;
    this.searchUnavailable = false;
    this.options.changed();
    if (version === this.searchVersion) this.emitSearchChange();
  }

  search(query: string, locale: string): Promise<number> {
    query = query.trim();
    if (!query) { this.clearSearch(); return Promise.resolve(0); }
    const binding = this.binding;
    const version = this.cancelSearch();
    if (version !== this.searchVersion || !binding || !this.current(binding)) return Promise.resolve(0);
    let settle!: (count: number) => void;
    const result = new Promise<number>(resolve => { settle = resolve; });
    this.desiredSearch = { binding, query, locale, settle };
    this.searchLoading = true;
    this.searchUnavailable = false;
    this.options.changed();
    this.scheduleSearch();
    return result;
  }

  private scheduleSearch(): void {
    if (this.searchScheduled) return;
    this.searchScheduled = true;
    queueMicrotask(() => { this.searchScheduled = false; this.pumpSearch(); });
  }

  private pumpSearch(): void {
    if (this.runningSearch) return;
    const request = this.desiredSearch;
    if (!request || !this.current(request.binding)) return;
    this.runningSearch = request;
    const lease = this.requests.begin('search', request.locale);
    const current = () => this.desiredSearch === request && this.current(request.binding) && !!lease?.isCurrent();
    void Promise.resolve().then(() => current() ? request.binding.source.search(request.query, lease!.context) : undefined).then(async raw => {
      if (!current()) return;
      const value = captureCueSearch(raw, request.binding.source.count);
      if (!current()) return;
      const handle: SearchHandle = { binding: request.binding, query: request.query, locale: request.locale, value };
      this.searchHandle = handle;
      if (value.count === 0) {
        this.completedQuery = handle.query;
        this.completedLocale = handle.locale;
        this.completedCount = 0;
        this.completedOrdinal = -1;
        this.searchLoading = false;
        this.options.changed();
        if (current()) this.emitSearchChange();
        if (current()) this.desiredSearch = undefined;
        request.settle(0);
      } else {
        const moved = await this.requestMatch(handle, 0);
        if (current()) { this.desiredSearch = undefined; request.settle(moved ? value.count : 0); }
      }
    }).catch(() => {
      if (!current()) return;
      this.searchHandle = undefined;
      this.searchLoading = false;
      this.searchUnavailable = true;
      this.options.changed();
      if (current()) request.settle(0);
    }).finally(() => {
      if (this.desiredSearch === request) this.desiredSearch = undefined;
      if (this.runningSearch === request) this.runningSearch = undefined;
      this.scheduleSearch();
    });
  }

  navigate(delta: -1 | 1): Promise<boolean> {
    const handle = this.searchHandle;
    if (!handle || (this.desiredSearch && this.searchLoading) || this.searchUnavailable || !this.current(handle.binding) || !handle.value.count) return Promise.resolve(false);
    const ordinal = this.desiredMatch?.handle === handle ? this.desiredMatch.ordinal : this.completedOrdinal;
    const next = delta === 1 ? (ordinal >= handle.value.count - 1 ? 0 : ordinal + 1)
      : (ordinal <= 0 ? handle.value.count - 1 : ordinal - 1);
    return this.requestMatch(handle, next);
  }

  private requestMatch(handle: SearchHandle, ordinal: number): Promise<boolean> {
    const version = ++this.matchVersion;
    const previous = this.desiredMatch;
    this.desiredMatch = undefined;
    this.selected = undefined;
    previous?.settle(false);
    this.requests.invalidate('match');
    if (version !== this.matchVersion || this.searchHandle !== handle || !this.current(handle.binding)) return Promise.resolve(false);
    let settle!: (moved: boolean) => void;
    const result = new Promise<boolean>(resolve => { settle = resolve; });
    this.desiredMatch = { handle, ordinal, settle };
    this.searchLoading = true;
    this.options.changed();
    this.scheduleMatch();
    return result;
  }

  private scheduleMatch(): void {
    if (this.matchScheduled) return;
    this.matchScheduled = true;
    queueMicrotask(() => { this.matchScheduled = false; this.pumpMatch(); });
  }

  private pumpMatch(): void {
    if (this.runningMatch) return;
    const request = this.desiredMatch;
    if (!request || !this.current(request.handle.binding)) return;
    this.runningMatch = request;
    const lease = this.requests.begin('match', request.handle.locale);
    const current = () => this.desiredMatch === request && this.searchHandle === request.handle &&
      this.current(request.handle.binding) && !!lease?.isCurrent();
    void Promise.resolve().then(() => current() ? request.handle.value.getMatch(request.ordinal, lease!.context) : undefined).then(async raw => {
      if (!current()) return;
      const found = captureCueLocation(raw, request.handle.binding.source.count);
      if (!current()) return;
      if (!sourceCueMatches(found.cue, request.handle.query, request.handle.locale)) throw new TypeError('Nonmatching source cue');
      this.checkRecord(found.index, found.cue);
      if (!current()) return;
      if (!await this.window.ensure(found.index)) {
        if (current()) throw new Error('Source cue unavailable');
        return;
      }
      if (!current()) return;
      this.checkRecord(found.index, found.cue);
      if (!current()) return;
      if (!await this.options.reveal(found.index, current)) {
        if (current()) throw new Error('Source cue unavailable');
        return;
      }
      if (!current()) return;
      this.checkRecord(found.index, found.cue);
      if (!current()) return;
      this.selected = found;
      this.completedQuery = request.handle.query;
      this.completedLocale = request.handle.locale;
      this.completedCount = request.handle.value.count;
      this.completedOrdinal = request.ordinal;
      this.searchLoading = false;
      this.searchUnavailable = false;
      this.options.changed();
      if (!current()) return;
      this.emitSearchChange();
      request.settle(current());
    }).catch(() => {
      if (!current()) return;
      this.selected = undefined;
      this.searchLoading = false;
      this.searchUnavailable = true;
      this.options.changed();
      if (current()) request.settle(false);
    }).finally(() => {
      if (this.desiredMatch === request) this.desiredMatch = undefined;
      if (this.runningMatch === request) this.runningMatch = undefined;
      this.scheduleMatch();
    });
  }

  matches(cue: LyraAvCue): boolean {
    return sourceCueMatches(cue, this.completedQuery, this.completedLocale || this.options.locale());
  }

  private emitSearchChange(): void {
    this.options.searchChanged({ query: this.completedQuery, matchCount: this.completedCount,
      matchCountExact: true, activeIndex: this.completedOrdinal });
  }

  adopted(): void { this.revoke(); this.requests.adopted(); this.window.adopted(); }
}
