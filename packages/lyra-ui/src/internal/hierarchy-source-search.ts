import type { LyraSourceSearchResult } from '../data-sources.js';
import { writeAcceptedClipboardText } from './clipboard.js';
import type { HierarchyCapabilityResult } from './hierarchy-source-controller.js';
import { reportCopyOutcome, type CopyOutcome } from './record-copy-feedback.js';

type SearchResult = LyraSourceSearchResult<{ readonly key: string }>;

/** A completed provider search whose `isCurrent()` tracks the projection it was run against. */
export type HierarchySourceHits = Extract<HierarchyCapabilityResult<SearchResult>, { status: 'ready' }>;

/** The provider capabilities whole-source search drives (a `HierarchySourceController`). */
export interface HierarchySourceSearchControl {
  search(): Promise<HierarchyCapabilityResult<SearchResult>>;
  reveal(key: string): Promise<boolean>;
  cancelSearch(): void;
}

export interface HierarchySourceSearchOptions {
  readonly host: Pick<HTMLElement, 'isConnected'> & { readonly hasUpdated: boolean; readonly updateComplete: Promise<unknown> };
  readonly control: HierarchySourceSearchControl;
  /** The bound provider; a result that settles for another one is dropped. */
  readonly source: () => unknown;
  readonly query: () => string;
  /** The host's shared search cursor, which also drives its legacy search. */
  readonly cursor: () => number;
  readonly setCursor: (index: number) => void;
  /** Requests the render that paints a changed result. */
  readonly changed: () => void;
  /** Emits the host's `lr-search-change`. */
  readonly emitChange: () => void;
  /** Moves the cursor to the first hit and reveals it after each completed search. */
  readonly revealFirst?: boolean;
  /** Runs before each cursor step, e.g. to cancel a pending anchor navigation. */
  readonly beforeStep?: () => void;
}

/**
 * Whole-source search for a hierarchy host: the search and navigation intents, the retained hits
 * and their keys, exactness, availability and cursor stepping. Every settled search or step is
 * dropped once a later invalidation, provider change or disconnect supersedes it.
 */
export class HierarchySourceSearchController {
  /** Whether the next update must start a search; see {@link schedule}. */
  dirty = true;
  /** The latest search: its retained hit count, or 0 when it was superseded. */
  task: Promise<number> = Promise.resolve(0);
  /** Whether the retained hits are every match in the source. */
  exact = true;
  /** Whether the provider could not search. */
  unavailable = false;
  private hits?: HierarchySourceHits;
  private keys = new Set<string>();
  private intent = 0;
  private navigation = 0;

  constructor(private readonly options: HierarchySourceSearchOptions) {}

  /** Changes on every invalidation; compare it across an update to detect a superseded search. */
  get generation(): number {
    return this.intent;
  }

  /** Retained hit count. */
  get count(): number {
    return this.keys.size;
  }

  /** Drops the retained hits and supersedes pending searches and steps. */
  invalidate(): void {
    this.intent++;
    this.navigation++;
    this.hits = undefined;
    this.keys.clear();
    this.exact = true;
    this.unavailable = false;
    this.dirty = true;
  }

  /** Supersedes pending steps without dropping hits, for a navigation started elsewhere. */
  supersedeSteps(): void {
    this.navigation++;
  }

  /** Starts the pending search when {@link dirty}; call from `willUpdate()` in source mode. */
  schedule(): void {
    if (this.dirty) this.task = this.run();
  }

  /** Whether `key` is a hit of the current projection. */
  isMatch(key: string): boolean {
    return Boolean(this.hits?.isCurrent()) && this.keys.has(key);
  }

  /** Whether `key` is the hit under the cursor. */
  isActive(key: string): boolean {
    return this.hits?.value.hits[this.options.cursor()]?.key === key;
  }

  private async run(): Promise<number> {
    const { host, control, source, query, setCursor, changed, emitChange, revealFirst } = this.options;
    this.dirty = false;
    const intent = this.intent;
    const provider = source();
    if (!query()) {
      control.cancelSearch();
      if (host.hasUpdated) emitChange();
      return 0;
    }
    const result = await control.search();
    if (intent !== this.intent || provider !== source() || !host.isConnected) return 0;
    if (result.status === 'stale' || (result.status === 'ready' && !result.isCurrent())) return 0;
    this.hits = result.status === 'ready' ? result : undefined;
    this.keys = new Set(this.hits?.value.hits.map((hit) => hit.key) ?? []);
    this.exact = result.status === 'ready' && result.value.exhaustive;
    this.unavailable = result.status !== 'ready';
    if (revealFirst) setCursor(this.keys.size ? 0 : -1);
    changed();
    emitChange();
    if (revealFirst && this.hits?.isCurrent() && this.options.cursor() >= 0) await control.reveal(this.hits.value.hits[0]!.key);
    await host.updateComplete;
    return intent === this.intent ? this.keys.size : 0;
  }

  /** Moves the cursor one hit (wrapping, starting at the first or last), reveals it and reports it. */
  async step(direction: 1 | -1): Promise<boolean> {
    const navigation = ++this.navigation;
    this.options.beforeStep?.();
    const hits = this.hits;
    if (!hits?.isCurrent() || !hits.value.hits.length) return false;
    const size = hits.value.hits.length;
    const cursor = this.options.cursor();
    const next = cursor < 0 ? (direction === 1 ? 0 : size - 1) : (cursor + direction + size) % size;
    this.options.setCursor(next);
    const found = await this.options.control.reveal(hits.value.hits[next]!.key);
    if (!found || navigation !== this.navigation || !hits.isCurrent() || this.hits !== hits) return false;
    this.options.emitChange();
    return true;
  }
}

/** The provider copy capability (a `HierarchySourceController`). */
export interface HierarchySourceCopyControl {
  readonly epoch: number;
  copy(key: string | null, scope: HierarchyCopyScope, maxBytes: number): Promise<HierarchyCapabilityResult<string>>;
}

export type HierarchyCopyScope = 'node' | 'subtree' | 'document';

/** Copy feedback, announcement and events owned by the host. */
export interface HierarchySourceCopySinks {
  /** Clears visible copy feedback before a new copy starts. */
  clearFeedback(): void;
  feedback(key: string, ok: boolean): void;
  /** Localized outcome text, announced only while the copy is still current. */
  message(ok: boolean): string;
  announce(text: string): void;
  emit(name: 'lr-copy' | 'lr-error' | 'lr-copy-error', detail?: CopyOutcome): void;
}

export interface HierarchySourceCopyOptions {
  readonly host: Pick<HTMLElement, 'isConnected' | 'ownerDocument'>;
  readonly control: HierarchySourceCopyControl;
  /** The bound provider; a copy that settles for another one is dropped. */
  readonly source: () => unknown;
  readonly sinks: HierarchySourceCopySinks;
}

/** The copy scope of an inspection node: containers copy their subtree, no node the document. */
export function hierarchyCopyScope(kind?: string): HierarchyCopyScope {
  if (kind === undefined) return 'document';
  return kind === 'object' || kind === 'array' || kind === 'element' ? 'subtree' : 'node';
}

/** Whether the bound provider offers `copy`; a getter that rebinds the provider or throws reads as no. */
export function hasHierarchySourceCopy(source: () => { readonly copy?: unknown } | undefined): boolean {
  const provider = source();
  try {
    const available = typeof provider?.copy === 'function';
    return provider === source() && available;
  } catch {
    return false;
  }
}

/**
 * Provider-backed copy for a hierarchy host: one intent at a time, owner-window clipboard writes,
 * and feedback, announcements and `lr-copy`/`lr-error`/`lr-copy-error` only while the copy is still
 * current for the same provider, epoch, owner document and connection.
 */
export class HierarchySourceCopyController {
  private intent = 0;

  constructor(private readonly options: HierarchySourceCopyOptions) {}

  /** Supersedes a pending copy. */
  invalidate(): void {
    this.intent++;
  }

  async copy(key: string | null, scope: HierarchyCopyScope, maxBytes: number, feedbackKey: string): Promise<void> {
    const { host, control, source, sinks } = this.options;
    const provider = source();
    const epoch = control.epoch;
    const owner = host.ownerDocument;
    const intent = ++this.intent;
    const current = () => source() === provider && control.epoch === epoch && host.ownerDocument === owner &&
      host.isConnected && intent === this.intent;
    sinks.clearFeedback();
    const result = await control.copy(key, scope, maxBytes);
    if (!current() || result.status === 'stale') return;
    if (result.status !== 'ready') {
      sinks.feedback(feedbackKey, false);
      const text = sinks.message(false);
      if (current()) sinks.announce(text);
      return;
    }
    const accepted = () => current() && result.isCurrent();
    if (!accepted()) return;
    const outcome = await writeAcceptedClipboardText(owner.defaultView, result.value, accepted);
    if (!outcome || !accepted()) return;
    sinks.feedback(feedbackKey, outcome.ok);
    reportCopyOutcome({
      announce: (ok) => {
        const text = sinks.message(ok);
        if (accepted()) sinks.announce(text);
      },
      emit: (name, detail) => sinks.emit(name, detail),
    }, outcome, accepted);
  }
}
