export type SimulationClockMode = 'replay' | 'live';
export type SimulationClockReason = 'initial' | 'tick' | 'seek' | 'play' | 'pause' | 'rate' | 'range' | 'mode' | 'live';
export type SimulationClockErrorCode = 'invalid-options' | 'invalid-instant' | 'invalid-range' | 'invalid-rate' | 'invalid-capabilities' | 'invalid-listener' | 'disposed';
export class SimulationClockError extends Error {
  constructor(readonly code: SimulationClockErrorCode, message: string = code) { super(message); this.name = 'SimulationClockError'; }
}
export interface SimulationClockOptions { readonly range: readonly [number, number]; readonly instant: number; readonly rate?: number; }
export interface ClockScheduler {
  monotonicNow(): number;
  epochNow(): number;
  requestFrame(callback: () => void): unknown;
  cancelFrame(handle: unknown): void;
}
export interface SimulationClockCapabilities { readonly scheduler?: ClockScheduler; readonly onSubscriberError?: (error: unknown) => void; }
export interface ClockSnapshot {
  readonly instant: number; readonly range: readonly [number, number]; readonly mode: SimulationClockMode;
  readonly playing: boolean; readonly rate: number; readonly revision: number; readonly reason: SimulationClockReason;
}
export interface SimulationClock {
  readonly snapshot: ClockSnapshot;
  currentInstant(): number;
  seek(instant: number): void;
  stepTo(instant: number): void;
  play(): void;
  pause(): void;
  setRate(rate: number): void;
  setRange(range: readonly [number, number]): void;
  setMode(mode: SimulationClockMode): void;
  subscribe(listener: (snapshot: ClockSnapshot) => void, options?: { readonly signal?: AbortSignal }): () => void;
  dispose(): void;
}
interface ClockLifetime { disposed(): boolean; isDispatching(): boolean; onDelivery(listener: () => void): () => void; onDispose(listener: () => void): () => void; }
const lifetimes = new WeakMap<object, ClockLifetime>();
/** @internal */
export const simulationClockLifetime = (value: unknown): ClockLifetime | undefined => typeof value === 'object' && value !== null ? lifetimes.get(value) : undefined;
const fail = (code: SimulationClockErrorCode): never => { throw new SimulationClockError(code); };
const validInstant = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8.64e15;
function own(value: unknown, keys: readonly string[], code: SimulationClockErrorCode): Record<string, unknown> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail(code);
    const result: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !keys.includes(key)) return fail(code);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return fail(code);
      result[key] = descriptor.value;
    }
    return result;
  } catch { return fail(code); }
}
function rangeValue(value: unknown): readonly [number, number] {
  try {
    if (!Array.isArray(value) || Reflect.ownKeys(value).some(key => key !== 'length' && key !== '0' && key !== '1') || Object.getOwnPropertyDescriptor(value, 'length')?.value !== 2) return fail('invalid-range');
    const a = Object.getOwnPropertyDescriptor(value, '0'), b = Object.getOwnPropertyDescriptor(value, '1');
    if (!a || !b || !Object.hasOwn(a, 'value') || !Object.hasOwn(b, 'value') || !validInstant(a.value) || !validInstant(b.value) || a.value > b.value) return fail('invalid-range');
    return Object.freeze([a.value as number, b.value as number]);
  } catch { return fail('invalid-range'); }
}
const rateValue = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fail('invalid-rate');

/** A shared epoch-millisecond clock; importing or constructing it schedules no work. */
export function createSimulationClock(options: SimulationClockOptions, capabilities: SimulationClockCapabilities = {}): SimulationClock {
  const input = own(options, ['range', 'instant', 'rate'], 'invalid-options');
  let range = rangeValue(input['range']);
  if (!validInstant(input['instant'])) return fail('invalid-instant');
  const initialRate = input['rate'] === undefined ? 1 : rateValue(input['rate']);
  const trusted = own(capabilities, ['scheduler', 'onSubscriberError'], 'invalid-capabilities');
  let scheduler = trusted['scheduler'] as ClockScheduler | undefined;
  const errorHandler = trusted['onSubscriberError'];
  if (errorHandler !== undefined && typeof errorHandler !== 'function') return fail('invalid-capabilities');
  if (scheduler !== undefined) {
    try { if (!scheduler || ['monotonicNow', 'epochNow', 'requestFrame', 'cancelFrame'].some(key => typeof Reflect.get(scheduler!, key) !== 'function')) return fail('invalid-capabilities'); }
    catch { return fail('invalid-capabilities'); }
  }
  interface State { snapshot: ClockSnapshot; anchorInstant: number; anchorMono: number; }
  const clamp = (instant: number, bounds: readonly [number, number]): number => Math.max(bounds[0], Math.min(bounds[1], instant));
  let state: State = { snapshot: Object.freeze({ instant: clamp(input['instant'], range), range, mode: 'replay', playing: false, rate: initialRate, revision: 0, reason: 'initial' }), anchorInstant: clamp(input['instant'], range), anchorMono: 0 };
  let desired: State | undefined;
  let disposed = false, dispatching = false, pendingFrame = false, handle: unknown, generation = 0;
  interface Registration { listener(value: ClockSnapshot): void; active: boolean; installed: boolean; signal?: AbortSignal; release(): void; }
  const listeners = new Set<Registration>(), waiting = new Set<Registration>(), disposal = new Set<() => void>(), deliveries = new Set<() => void>();
  const active = (): void => { if (disposed) fail('disposed'); };
  const report = (error: unknown): void => {
    try { if (typeof errorHandler === 'function') { errorHandler(error); return; } }
    catch (secondary) { error = secondary; }
    try { if (typeof globalThis.reportError === 'function') globalThis.reportError(error); } catch { /* Error reporting cannot interrupt cleanup. */ }
  };
  const getScheduler = (): ClockScheduler => {
    if (!scheduler) {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return fail('invalid-capabilities');
      const owner = window;
      scheduler = { monotonicNow: () => owner.performance.now(), epochNow: () => Date.now(), requestFrame: callback => owner.requestAnimationFrame(callback), cancelFrame: value => owner.cancelAnimationFrame(value as number) };
    }
    return scheduler;
  };
  const now = (kind: 'monotonicNow' | 'epochNow'): number => {
    let value: number;
    try { value = getScheduler()[kind](); } catch { return fail('invalid-capabilities'); }
    if (!Number.isFinite(value)) return fail('invalid-capabilities');
    return value;
  };
  const sampled = (base: State): { instant: number; mono?: number } => {
    const value = base.snapshot;
    if (value.mode === 'live') return { instant: clamp(now('epochNow'), value.range) };
    if (!value.playing) return { instant: value.instant };
    const mono = now('monotonicNow');
    return { mono, instant: clamp(base.anchorInstant + Math.max(0, mono - base.anchorMono) * value.rate, value.range) };
  };
  const cancel = (): void => {
    generation++;
    if (pendingFrame) { pendingFrame = false; try { scheduler?.cancelFrame(handle); } catch (error) { report(error); } }
    handle = undefined;
  };
  const needsDelivery = (base = desired ?? state): boolean => Boolean(desired || waiting.size || (listeners.size && (base.snapshot.playing || base.snapshot.mode === 'live')));
  const ensureFrame = (needed: boolean): void => {
    if (!needed || disposed || pendingFrame) return;
    const epoch = generation;
    let installing = true, early = false;
    pendingFrame = true;
    try {
      handle = getScheduler().requestFrame(() => {
        if (installing) { early = true; return; }
        if (disposed || epoch !== generation || !pendingFrame) return;
        pendingFrame = false; handle = undefined;
        try {
          const queued = [...waiting];
          if (desired) { const next = desired; desired = undefined; publish(next); }
          else publish(transition(state, {}, state.snapshot.mode === 'live' ? 'live' : 'tick', false));
          dispatching = true;
          try { for (const listener of [...deliveries]) { if (disposed) break; if (deliveries.has(listener)) { try { listener(); } catch (error) { report(error); } } } }
          finally { dispatching = false; }
          // Only registrations already waiting at this turn are installed. New reentrant
          // registrations remain deferred to another turn.
          for (const registration of queued) { waiting.delete(registration); install(registration); }
          ensureFrame(needsDelivery());
        } catch (error) { cancel(); report(error); }
      });
      installing = false;
      if (early) { cancel(); fail('invalid-capabilities'); }
    } catch { installing = false; cancel(); fail('invalid-capabilities'); }
  };
  const same = (a: ClockSnapshot, b: ClockSnapshot): boolean => a.instant === b.instant && a.range === b.range && a.mode === b.mode && a.playing === b.playing && a.rate === b.rate;
  const publish = (next: State): void => {
    if (disposed) return;
    if (same(state.snapshot, next.snapshot)) { state = { ...next, snapshot: state.snapshot }; return; }
    state = { ...next, snapshot: Object.freeze({ ...next.snapshot, revision: state.snapshot.revision + 1 }) };
    const current = state.snapshot;
    dispatching = true;
    try {
      for (const registration of [...listeners]) {
        if (disposed) break;
        if (registration.active) { try { registration.listener(current); } catch (error) { report(error); } }
      }
    } finally { dispatching = false; }
  };
  const transition = (base: State, change: Partial<Pick<ClockSnapshot, 'instant' | 'range' | 'mode' | 'playing' | 'rate'>>, reason: SimulationClockReason, reanchor: boolean): State => {
    const sample = sampled(base);
    const bounds = change.range ?? base.snapshot.range;
    let instant = change.instant ?? sample.instant;
    if (base.snapshot.mode === 'live' && change.range) instant = now('epochNow');
    const value = { ...base.snapshot, ...change, instant: clamp(instant, bounds), range: bounds, reason };
    if (value.mode === 'replay' && value.instant >= bounds[1]) value.playing = false;
    let anchorMono = base.anchorMono, anchorInstant = base.anchorInstant;
    if (reanchor && value.playing) { anchorMono = sample.mono ?? now('monotonicNow'); anchorInstant = value.instant; }
    return { snapshot: Object.freeze(value), anchorMono, anchorInstant };
  };
  const command = (operation: (base: State) => State): void => {
    active();
    const next = operation(desired ?? state);
    if (dispatching) {
      ensureFrame(true); desired = next;
    } else {
      ensureFrame(Boolean(waiting.size || (listeners.size && (next.snapshot.playing || next.snapshot.mode === 'live'))));
      desired = undefined; publish(next);
      if (!needsDelivery()) cancel();
    }
  };
  const install = (registration: Registration): void => {
    if (!registration.active || disposed || registration.signal?.aborted) return;
    ensureFrame(state.snapshot.playing || state.snapshot.mode === 'live');
    registration.installed = true; listeners.add(registration);
    const previous = dispatching; dispatching = true;
    try { registration.listener(state.snapshot); } catch (error) { report(error); } finally { dispatching = previous; }
  };
  const seek = (instant: number, preserve: boolean): void => {
    active(); if (!validInstant(instant)) fail('invalid-instant');
    command(base => transition(base, { instant, mode: 'replay', playing: preserve && base.snapshot.mode === 'replay' && base.snapshot.playing }, 'seek', true));
  };
  const clock: SimulationClock = {
    get snapshot() { return state.snapshot; }, currentInstant: () => disposed ? state.snapshot.instant : sampled(state).instant,
    seek: instant => seek(instant, false), stepTo: instant => seek(instant, true),
    play() { command(base => transition(base, { mode: 'replay', playing: true }, 'play', true)); },
    pause() { command(base => transition(base, { mode: 'replay', playing: false }, 'pause', true)); },
    setRate(value) { active(); const rate = rateValue(value); command(base => transition(base, { rate }, 'rate', true)); },
    setRange(value) { active(); const accepted = rangeValue(value); command(base => base.snapshot.range[0] === accepted[0] && base.snapshot.range[1] === accepted[1] ? base : transition(base, { range: accepted }, 'range', true)); },
    setMode(mode) { active(); if (mode !== 'live' && mode !== 'replay') fail('invalid-options'); command(base => mode === base.snapshot.mode ? base : transition(base, { mode, instant: mode === 'live' ? now('epochNow') : sampled(base).instant, playing: false }, 'mode', true)); },
    subscribe(listener, subscription = {}) {
      active(); if (typeof listener !== 'function') fail('invalid-listener');
      const record = own(subscription, ['signal'], 'invalid-options');
      const signal = record['signal'] as AbortSignal | undefined;
      try { if (signal && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) fail('invalid-options'); } catch { fail('invalid-options'); }
      if (signal?.aborted) return () => undefined;
      const registration: Registration = { listener, active: true, installed: false, signal,
        release() { if (!registration.active) return; registration.active = false; listeners.delete(registration); waiting.delete(registration); signal?.removeEventListener('abort', registration.release); if (!needsDelivery()) cancel(); } };
      // Acquire scheduling before adding a listener that could otherwise leak on failure.
      ensureFrame(dispatching || state.snapshot.playing || state.snapshot.mode === 'live');
      try {
        signal?.addEventListener('abort', registration.release, { once: true });
        if (dispatching) waiting.add(registration);
        else { publish(transition(state, {}, state.snapshot.mode === 'live' ? 'live' : 'tick', false)); install(registration); if (!needsDelivery()) cancel(); }
      } catch (error) { registration.release(); throw error; }
      return registration.release;
    },
    dispose() {
      if (disposed) return;
      let instant = state.snapshot.instant; try { instant = sampled(state).instant; } catch (error) { report(error); }
      disposed = true; state = { ...state, snapshot: Object.freeze({ ...state.snapshot, instant, playing: false }) }; desired = undefined; cancel();
      for (const hook of [...disposal]) { try { hook(); } catch (error) { report(error); } }
      disposal.clear(); deliveries.clear(); for (const registration of [...listeners, ...waiting]) registration.release(); listeners.clear(); waiting.clear();
    },
  };
  lifetimes.set(clock, { disposed: () => disposed, isDispatching: () => dispatching, onDelivery(listener) { deliveries.add(listener); return () => { deliveries.delete(listener); }; }, onDispose(listener) { if (disposed) { listener(); return () => undefined; } disposal.add(listener); return () => { disposal.delete(listener); }; } });
  return Object.freeze(clock);
}
