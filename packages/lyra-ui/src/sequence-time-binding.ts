import { simulationClockLifetime, SimulationClockError, type SimulationClock, type ClockSnapshot } from './simulation-clock.js';
import { isTimeIndex, type TimeIndex } from './time-index.js';
import { sequencePlaybackAttachment, type SequencePlaybackOwner } from './internal/sequence-playback-binding.js';

export interface SequenceTimeBindingOptions { readonly signal?: AbortSignal; }
export type SequenceTimeBindingErrorCode = 'unsupported-control' | 'inactive-control' | 'already-bound' | 'invalid-clock' | 'invalid-index' | 'invalid-options';
export class SequenceTimeBindingError extends Error {
  constructor(readonly code: SequenceTimeBindingErrorCode, message: string = code) { super(message); this.name = 'SequenceTimeBindingError'; }
}
/** Bind a registered sequence control to shared epoch time without registering any elements. */
export function bindSequencePlayback(control: HTMLElement, clock: SimulationClock, index: TimeIndex, options: SequenceTimeBindingOptions = {}): () => void {
  const fail = (code: SequenceTimeBindingErrorCode): never => { throw new SequenceTimeBindingError(code); };
  let signal: AbortSignal | undefined;
  try {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) return fail('invalid-options');
    for (const key of Reflect.ownKeys(options)) {
      if (key !== 'signal') return fail('invalid-options');
      const descriptor = Object.getOwnPropertyDescriptor(options, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return fail('invalid-options');
      signal = descriptor.value as AbortSignal | undefined;
    }
    if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function' || typeof signal.aborted !== 'boolean')) return fail('invalid-options');
  } catch { return fail('invalid-options'); }
  if (signal?.aborted) return () => undefined;
  const attachment = sequencePlaybackAttachment(control);
  if (!attachment) return fail('unsupported-control');
  if (!control.isConnected || control.hidden) return fail('inactive-control');
  const lifetime = simulationClockLifetime(clock);
  if (!lifetime) return fail('invalid-clock');
  if (lifetime.disposed()) throw new SimulationClockError('disposed');
  if (!isTimeIndex(index)) return fail('invalid-index');
  if (!attachment.available()) return fail('already-bound');
  let owner: SequencePlaybackOwner | undefined, active = true, initializing = true;
  let unsubscribe: (() => void) | undefined, removeDispose: (() => void) | undefined, removeDelivery: (() => void) | undefined;
  let pendingManual: { forceStep: boolean } | undefined;
  let action: { delivered: boolean; forceStep: boolean } | undefined;
  const release = (): void => {
    if (!active) return;
    active = false; signal?.removeEventListener('abort', release);
    unsubscribe?.(); removeDispose?.(); removeDelivery?.(); owner?.release();
  };
  const project = (snapshot: ClockSnapshot, force = false): void => {
    if (!active || !owner?.current()) return;
    if (action) action.delivered = true;
    force ||= pendingManual?.forceStep ?? false;
    pendingManual = undefined;
    owner.project({ count: index.length, index: index.locate(snapshot.instant)?.lowerIndex ?? 0, playing: index.length > 1 && snapshot.mode === 'replay' && snapshot.playing }, force, initializing);
  };
  const command = (operation: () => void, forceStep = false): void => {
    if (!active) return;
    const deferred = lifetime.isDispatching();
    if (deferred) pendingManual = { forceStep: forceStep || (pendingManual?.forceStep ?? false) };
    const current = { delivered: false, forceStep }; action = current;
    try {
      operation();
      if (active && !current.delivered && !deferred) project(clock.snapshot, forceStep);
    } finally { if (action === current) action = undefined; }
  };
  const selected = (): number => index.locate(clock.currentInstant())?.lowerIndex ?? 0;
  const normalized = (value: number): number => Math.max(0, Math.min(index.length - 1, Number.isFinite(value) ? Math.floor(Math.max(0, value)) : 0));
  try {
    signal?.addEventListener('abort', release, { once: true });
    unsubscribe = clock.subscribe(value => project(value, action?.forceStep ?? false));
    if (!active || signal?.aborted) { release(); return release; }
    if (lifetime.disposed()) throw new SimulationClockError('disposed');
    // Catch-up can synchronously invoke another owner or retire this host. Recheck at
    // the commit boundary; a failed outer transaction releases only its own subscription.
    if (!control.isConnected || control.hidden) return fail('inactive-control');
    if (!attachment.available()) return fail('already-bound');
    owner = attachment.attach({
      play: () => { if (index.length > 1) command(() => clock.play()); },
      pause: () => command(() => clock.pause()),
      toggle: () => { if (index.length > 1) command(() => clock.snapshot.playing ? clock.pause() : clock.play()); },
      next: () => { const next = selected() + 1; if (next < index.length) command(() => clock.stepTo(index.instantAt(next)), true); },
      previous: () => { const previous = selected() - 1; if (previous >= 0) command(() => clock.stepTo(index.instantAt(previous)), true); },
      goTo: value => { if (index.length) command(() => clock.seek(index.instantAt(normalized(value))), true); },
    }, release);
    project(clock.snapshot);
    initializing = false;
    removeDispose = lifetime.onDispose(release);
    removeDelivery = lifetime.onDelivery(() => { if (pendingManual) project(clock.snapshot, pendingManual.forceStep); });
    if (signal?.aborted) release();
    return release;
  } catch (error) { release(); throw error; }
}
