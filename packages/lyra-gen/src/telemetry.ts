/**
 * Dependency-free tracing hooks for generated views. Spans are shaped like OpenTelemetry spans
 * (name, start and end time, attributes, status) so a host can forward them to any tracer, but
 * nothing here imports one. Attributes carry only counts, durations, codes, ids and sizes: strings
 * that could hold prompts, state values or user text are dropped, never reported.
 */
export type LyraGenTelemetryValue = string | number | boolean;
export type LyraGenTelemetryAttributes = Readonly<Record<string, LyraGenTelemetryValue>>;
/** The pipeline phases a host can time. */
export type LyraGenTelemetryPhase = 'parse' | 'validate' | 'preview' | 'repair' | 'render';

export interface LyraGenSpan {
  /** `lyra.gen.<phase>` or `lyra.gen.<event>`. */
  readonly name: string;
  /** Milliseconds since the Unix epoch, fractional. */
  readonly startTime: number;
  readonly endTime: number;
  readonly durationMs: number;
  readonly status: 'ok' | 'error';
  readonly attributes: LyraGenTelemetryAttributes;
}
export interface LyraGenMetric {
  readonly name: string;
  readonly value: number;
  readonly attributes: LyraGenTelemetryAttributes;
}
/** Token usage as reported by the provider. */
export interface LyraGenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Provider model identifier (an id, never a prompt). */
  readonly model?: string;
}
export interface LyraGenTelemetryOptions {
  readonly onSpan?: (span: LyraGenSpan) => void;
  readonly onMetric?: (metric: LyraGenMetric) => void;
  readonly onUsage?: (usage: LyraGenUsage) => void;
  /** Millisecond clock; defaults to epoch-aligned `performance.now()`. */
  readonly now?: () => number;
}
export interface LyraGenActiveSpan {
  /** Finish the span once; later calls are ignored. */
  end(attributes?: Readonly<Record<string, unknown>>, status?: 'ok' | 'error'): void;
}
export interface LyraGenTelemetry {
  startSpan(name: string, attributes?: Readonly<Record<string, unknown>>): LyraGenActiveSpan;
  /** Time a synchronous or asynchronous phase; a throw or rejection ends the span with status `error` and rethrows. */
  time<T>(phase: LyraGenTelemetryPhase, run: () => T, attributes?: Readonly<Record<string, unknown>>): T;
  count(name: string, value?: number, attributes?: Readonly<Record<string, unknown>>): void;
  recordUsage(usage: LyraGenUsage): void;
  /** Report an already measured span between two clock readings. */
  span(name: string, startTime: number, endTime: number, attributes?: Readonly<Record<string, unknown>>, status?: 'ok' | 'error'): void;
  /** Epoch-aligned milliseconds from the configured clock. */
  now(): number;
}

const SAFE_STRING = /^[A-Za-z0-9._:/#@,-]{0,96}$/;
const MAX_ATTRIBUTES = 24;
/** Keep numbers, booleans and short identifier-like strings; everything else is dropped. */
function sanitize(attributes: Readonly<Record<string, unknown>> | undefined): LyraGenTelemetryAttributes {
  const out: Record<string, LyraGenTelemetryValue> = {};
  if (!attributes) return out;
  for (const key of Object.keys(attributes).slice(0, MAX_ATTRIBUTES)) {
    const value = attributes[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string' && SAFE_STRING.test(value)) out[key] = value;
  }
  return out;
}
const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
const isThenable = (value: unknown): value is PromiseLike<unknown> => typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';

export function createGenTelemetry(options: LyraGenTelemetryOptions = {}): LyraGenTelemetry {
  const origin = typeof performance !== 'undefined' ? performance.timeOrigin : Date.now();
  const now = options.now ?? (() => (typeof performance !== 'undefined' ? origin + performance.now() : Date.now()));
  const emit = <T>(callback: ((value: T) => void) | undefined, value: T): void => {
    try { callback?.(value); } catch { /* host callbacks never break rendering */ }
  };
  const report = (name: string, startTime: number, endTime: number, attributes?: Readonly<Record<string, unknown>>, status: 'ok' | 'error' = 'ok'): void => {
    emit(options.onSpan, { name, startTime, endTime, durationMs: Math.max(0, endTime - startTime), status, attributes: sanitize(attributes) });
  };
  const startSpan = (name: string, attributes?: Readonly<Record<string, unknown>>, startedAt = now()): LyraGenActiveSpan => {
    let done = false;
    return {
      end(extra, status = 'ok') {
        if (done) return;
        done = true;
        report(name, startedAt, now(), { ...attributes, ...extra }, status);
      },
    };
  };
  return {
    now,
    span: report,
    startSpan: (name, attributes) => startSpan(name, attributes),
    time(phase, run, attributes) {
      const span = startSpan(`lyra.gen.${phase}`, attributes);
      let result: ReturnType<typeof run>;
      try { result = run(); } catch (error) { span.end(undefined, 'error'); throw error; }
      if (isThenable(result)) {
        return (result as unknown as Promise<unknown>).then(
          value => { span.end(); return value; },
          (error: unknown) => { span.end(undefined, 'error'); throw error; },
        ) as ReturnType<typeof run>;
      }
      span.end();
      return result;
    },
    count(name, value = 1, attributes) {
      if (typeof value === 'number' && Number.isFinite(value)) emit(options.onMetric, { name, value, attributes: sanitize(attributes) });
    },
    recordUsage(usage) {
      const model = typeof usage.model === 'string' && SAFE_STRING.test(usage.model) ? usage.model : undefined;
      const clean: LyraGenUsage = { inputTokens: count(usage.inputTokens), outputTokens: count(usage.outputTokens), ...(model ? { model } : {}) };
      emit(options.onUsage, clean);
      const attributes: LyraGenTelemetryAttributes = model ? { model } : {};
      emit(options.onMetric, { name: 'lyra.gen.tokens.input', value: clean.inputTokens, attributes });
      emit(options.onMetric, { name: 'lyra.gen.tokens.output', value: clean.outputTokens, attributes });
    },
  };
}

/** The slice of `lr-gen-view` this observer needs; any `EventTarget` fits. */
export interface LyraGenObservable {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}
export interface LyraGenObservation {
  /** Mark the start of the next revision's latency (for example when the request is sent). */
  markRequest(): void;
  dispose(): void;
}

const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const length = (value: unknown): number => Array.isArray(value) ? value.length : 0;
const bytes = (value: unknown): number => {
  try { return JSON.stringify(value)?.length ?? 0; } catch { return 0; }
};

/**
 * Report `lr-gen-ready` (a `lyra.gen.revision` span from the last request mark, or the previous
 * terminal event, to the ready event, with changed-node counts), `lr-gen-error` (an error span with
 * diagnostic codes and counts), `lr-gen-state-change` and `lr-gen-action` (counters). Event payload
 * values, state and action payloads are never copied: only ids, counts, codes and sizes.
 */
export function observeGenView(element: LyraGenObservable, telemetry: LyraGenTelemetry): LyraGenObservation {
  let mark = telemetry.now();
  const spanFrom = (name: string, attributes: Readonly<Record<string, unknown>>, status: 'ok' | 'error'): void => {
    const startedAt = mark;
    mark = telemetry.now();
    telemetry.span(name, startedAt, mark, attributes, status);
  };
  const onReady = (event: Event): void => {
    const detail = object((event as CustomEvent).detail);
    const changes = object(detail['changes']);
    spanFrom('lyra.gen.revision', { surfaceId: detail['surfaceId'], revision: count(detail['revision']), added: length(changes['added']), changed: length(changes['changed']), removed: length(changes['removed']) }, 'ok');
  };
  const onError = (event: Event): void => {
    const diagnostics = object((event as CustomEvent).detail)['diagnostics'];
    const list = Array.isArray(diagnostics) ? diagnostics : [];
    const codes = [...new Set(list.map(item => object(item)['code']).filter((code): code is string => typeof code === 'string' && SAFE_STRING.test(code)))].slice(0, 8);
    spanFrom('lyra.gen.error', { diagnosticCount: list.length, codes: codes.join(','), errorCount: list.filter(item => object(item)['severity'] !== 'warning').length }, 'error');
  };
  const onState = (event: Event): void => {
    const detail = object((event as CustomEvent).detail);
    telemetry.count('lyra.gen.state_change', 1, { surfaceId: detail['surfaceId'] as string, nodeId: detail['nodeId'] as string, revision: count(detail['revision']), dirtyCount: length(detail['dirty']) });
  };
  const onAction = (event: Event): void => {
    const detail = object((event as CustomEvent).detail);
    telemetry.count('lyra.gen.action', 1, { surfaceId: detail['surfaceId'] as string, nodeId: detail['nodeId'] as string, action: detail['name'] as string, revision: count(detail['revision']), payloadBytes: bytes(detail['payload']) });
  };
  const listeners: ReadonlyArray<readonly [string, (event: Event) => void]> = [['lr-gen-ready', onReady], ['lr-gen-error', onError], ['lr-gen-state-change', onState], ['lr-gen-action', onAction]];
  for (const [type, listener] of listeners) element.addEventListener(type, listener);
  return {
    markRequest() { mark = telemetry.now(); },
    dispose() { for (const [type, listener] of listeners) element.removeEventListener(type, listener); },
  };
}
