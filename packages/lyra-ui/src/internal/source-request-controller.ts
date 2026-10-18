import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraSourceContext, LyraSourceRevision } from '../data-sources.js';

/** Validates logical counts without turning invalid metadata into a truncated source. */
export function sourceCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid source count');
  return value;
}

/** Source revisions are opaque stable values, not numeric coercions. */
export function sourceRevision(value: unknown): LyraSourceRevision {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new TypeError('Invalid source revision');
}

export interface SourceRequestLease {
  readonly context: LyraSourceContext;
  isCurrent(): boolean;
}

/** Owns bounded operation channels; hosts decide when to start work and repaint. */
export class SourceRequestController<C extends string> implements ReactiveController {
  private source?: object;
  private revision?: LyraSourceRevision;
  private active: boolean;
  private sourceEpoch = 0;
  private readonly channels = new Map<C, AbortController | undefined>();

  constructor(
    private readonly host: HTMLElement & ReactiveControllerHost,
    private readonly options: { readonly channels: readonly C[]; readonly onReset?: () => void },
  ) {
    if (options.channels.length < 1 || options.channels.length > 16) throw new RangeError('Invalid source channels');
    for (const channel of options.channels) {
      if (typeof channel !== 'string' || channel.length === 0 || this.channels.has(channel)) throw new TypeError('Invalid source channel');
      this.channels.set(channel, undefined);
    }
    this.active = host.isConnected;
    host.addController(this);
  }

  get epoch(): number { return this.sourceEpoch; }

  setSource(source: object | undefined, revision: LyraSourceRevision | undefined): boolean {
    if (source === this.source && revision === this.revision) return false;
    let acceptedRevision: LyraSourceRevision | undefined;
    try {
      if (source === undefined) {
        if (revision !== undefined) throw new TypeError('Revision requires a source');
      } else {
        if ((typeof source !== 'object' && typeof source !== 'function') || source === null) throw new TypeError('Invalid source');
        acceptedRevision = sourceRevision(revision);
      }
    } catch (error) {
      this.source = undefined;
      this.revision = undefined;
      this.refresh();
      throw error;
    }
    // Publish before callbacks: a nested source change must remain the newer authority.
    this.source = source;
    this.revision = acceptedRevision;
    this.refresh();
    return true;
  }

  refresh(): void {
    this.sourceEpoch++;
    const controllers = [...this.channels.values()];
    for (const channel of this.channels.keys()) this.channels.set(channel, undefined);
    try {
      this.options.onReset?.();
    } finally {
      // Abort only controllers captured before reset; callbacks may install newer leases.
      for (const controller of controllers) controller?.abort();
    }
  }

  invalidate(channel: C): void {
    if (!this.channels.has(channel)) throw new TypeError('Unknown source channel');
    const controller = this.channels.get(channel);
    this.channels.set(channel, undefined);
    controller?.abort();
  }

  begin(channel: C, locale: string): SourceRequestLease | undefined {
    if (!this.channels.has(channel)) throw new TypeError('Unknown source channel');
    const previous = this.channels.get(channel);
    const source = this.source;
    const revision = this.revision;
    if (!this.active || !this.host.isConnected || source === undefined || revision === undefined) {
      this.channels.set(channel, undefined);
      previous?.abort();
      return undefined;
    }
    const owner = this.host.ownerDocument;
    const controller = new AbortController();
    const epoch = this.sourceEpoch;
    this.channels.set(channel, controller);
    const lease: SourceRequestLease = {
      context: Object.freeze({ revision, locale, signal: controller.signal }),
      isCurrent: () => this.active && this.host.isConnected && this.host.ownerDocument === owner &&
        this.source === source && this.revision === revision && this.sourceEpoch === epoch &&
        this.channels.get(channel) === controller && !controller.signal.aborted,
    };
    previous?.abort();
    return lease.isCurrent() ? lease : undefined;
  }

  adopted(): void { this.refresh(); }
  hostConnected(): void { this.active = true; }
  hostDisconnected(): void { this.active = false; this.refresh(); }
}
