import type { ReactiveControllerHost } from 'lit';
import { SourceRequestController, sourceCount, sourceRevision, type SourceRequestLease } from '../../../internal/source-request-controller.js';
import type { SequenceStripItem } from './sequence-strip.class.js';
import { sequenceItem, sequenceSnapshot, type LyraSequenceSource, type SequenceSourceSnapshot } from './sequence-strip-source.js';

export interface SequenceExactRecord { readonly index: number; readonly item: SequenceStripItem; }
interface ExactIntent {
  readonly target: number | string;
  readonly lease: SourceRequestLease;
  readonly source: LyraSequenceSource<SequenceStripItem>;
  readonly length: number;
  readonly settle: (record: SequenceExactRecord | null) => void;
}
/** Bounded complete-summary and single-point demand under shared source authority. */
export class SequenceStripSourceController {
  readonly requests: SourceRequestController<'summary' | 'exact'>;
  snapshot?: SequenceSourceSnapshot;
  exact?: SequenceExactRecord;
  length = 0;
  pending = false;
  error = false;
  exactPending = false;
  exactUnavailable = false;
  private source?: LyraSequenceSource<SequenceStripItem>;
  private configuration = 0;
  private summaryIntent?: { source: LyraSequenceSource<SequenceStripItem>; length: number; lease: SourceRequestLease };
  private summaryRunning = false;
  private exactIntent?: ExactIntent;
  private exactRunning = false;
  private exactVersion = 0;

  constructor(private readonly host: HTMLElement & ReactiveControllerHost, private readonly repaint: () => void, private readonly locale: () => string) {
    this.requests = new SourceRequestController(host, { channels: ['summary', 'exact'], onReset: () => this.clear() });
  }
  private clear(): void {
    this.configuration++; this.exactVersion++;
    this.summaryIntent = undefined; this.exactIntent?.settle(null); this.exactIntent = undefined;
    this.source = undefined; this.snapshot = undefined; this.exact = undefined;
    this.length = 0; this.pending = false; this.error = false; this.exactPending = false; this.exactUnavailable = false;
  }
  fail(): void { this.detach(); this.error = true; this.repaint(); }
  detach(): void { this.requests.setSource(undefined, undefined); this.requests.refresh(); }
  configure(source: LyraSequenceSource<SequenceStripItem>): void {
    this.detach();
    const operation = this.configuration;
    const owner = this.host.ownerDocument;
    const current = () => operation === this.configuration && this.host.isConnected && this.host.ownerDocument === owner;
    try {
      if (!source || (typeof source !== 'object' && typeof source !== 'function')) throw new TypeError('Invalid sequence source');
      const revision = sourceRevision(source.revision);
      if (!current()) return;
      const length = sourceCount(source.length);
      if (!current()) return;
      for (const key of ['summarize', 'getItem', 'findIndex'] as const) {
        const method = source[key];
        if (!current()) return;
        if (typeof method !== 'function') throw new TypeError('Invalid sequence source method');
      }
      this.requests.setSource(source, revision);
      // setSource resets the view and may invoke caller abort listeners.
      if (!this.host.isConnected || this.host.ownerDocument !== owner || this.configuration !== operation + 1) return;
      this.source = source; this.length = length;
      const lease = this.requests.begin('summary', this.locale());
      if (!lease?.isCurrent() || this.source !== source) return;
      if (!length) { this.snapshot = sequenceSnapshot([], 0, () => lease.isCurrent()); this.repaint(); return; }
      this.pending = true; this.summaryIntent = { source, length, lease }; this.repaint(); this.pumpSummary();
    } catch {
      if (current()) { this.error = true; this.repaint(); }
    }
  }
  private pumpSummary(): void {
    if (this.summaryRunning || !this.summaryIntent) return;
    const intent = this.summaryIntent;
    const current = () => this.summaryIntent === intent && intent.lease.isCurrent() && this.source === intent.source;
    if (!current()) return;
    this.summaryRunning = true;
    void Promise.resolve().then(async () => {
      const method = intent.source.summarize;
      if (!current()) return;
      const raw = await method.call(intent.source, { startIndex: 0, endIndex: intent.length, maxRanges: Math.min(intent.length, 200), signal: intent.lease.context.signal });
      if (!current()) return;
      const snapshot = sequenceSnapshot(raw, intent.length, current);
      if (!current()) return;
      this.snapshot = snapshot; this.pending = false; this.error = false; this.repaint();
    }).catch(() => {
      if (current()) { this.snapshot = undefined; this.pending = false; this.error = true; this.repaint(); }
    }).finally(() => {
      if (this.summaryIntent === intent) this.summaryIntent = undefined;
      this.summaryRunning = false; this.pumpSummary();
    });
  }
  resolve(target: number | string): Promise<SequenceExactRecord | null> {
    const operation = ++this.exactVersion;
    this.exactIntent?.settle(null); this.exactIntent = undefined;
    this.requests.invalidate('exact');
    if (operation !== this.exactVersion) return Promise.resolve(null);
    this.exact = undefined; this.exactPending = false; this.exactUnavailable = false;
    const source = this.source;
    if (!source || !this.snapshot || (typeof target === 'number' ? !Number.isSafeInteger(target) || target < 0 || target >= this.length
      : typeof target !== 'string' || target.length > 65_536 || !target.trim())) { this.repaint(); return Promise.resolve(null); }
    const lease = this.requests.begin('exact', this.locale());
    if (!lease?.isCurrent() || this.source !== source || operation !== this.exactVersion) return Promise.resolve(null);
    let settle!: ExactIntent['settle'];
    const done = new Promise<SequenceExactRecord | null>(resolve => { settle = resolve; });
    this.exactIntent = { target, source, length: this.length, lease, settle };
    this.exactPending = true; this.repaint(); this.pumpExact(); return done;
  }
  private pumpExact(): void {
    if (this.exactRunning || !this.exactIntent) return;
    const intent = this.exactIntent;
    const current = () => this.exactIntent === intent && intent.lease.isCurrent() && this.source === intent.source;
    if (!current()) return;
    this.exactRunning = true;
    void Promise.resolve().then(async () => {
      let index: number | null;
      if (typeof intent.target === 'string') {
        const lookup = intent.source.findIndex;
        if (!current()) return;
        index = await lookup.call(intent.source, intent.target, { signal: intent.lease.context.signal });
        if (!current()) return;
      } else index = intent.target;
      if (index === null) return this.unavailable(intent);
      sourceCount(index);
      if (index >= intent.length) throw new RangeError('Invalid sequence index');
      const read = intent.source.getItem;
      if (!current()) return;
      const raw = await read.call(intent.source, index, { signal: intent.lease.context.signal });
      if (!current()) return;
      const item = sequenceItem(raw, current);
      if (!current()) return;
      if (!item) return this.unavailable(intent);
      if (typeof intent.target === 'string' && item.id !== intent.target) throw new TypeError('Sequence identity mismatch');
      const record = Object.freeze({ index, item });
      this.exact = record; this.exactPending = false; this.exactUnavailable = false;
      this.repaint(); intent.settle(record);
    }).catch(() => { if (current()) this.unavailable(intent); }).finally(() => {
      intent.settle(null);
      if (this.exactIntent === intent) this.exactIntent = undefined;
      this.exactRunning = false; this.pumpExact();
    });
  }
  private unavailable(intent: ExactIntent): void {
    this.exact = undefined; this.exactPending = false; this.exactUnavailable = true; this.repaint(); intent.settle(null);
  }
}
