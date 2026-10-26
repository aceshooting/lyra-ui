import type { JsonValue, LyraGenNode, LyraGenView } from './types.js';

/** Exact provider identifiers are supplied by the host; this package maintains no model aliases. */
export interface EvaluationModel {
  readonly provider: string;
  readonly id: string;
  readonly label: string;
}
/** Comparison labels are configuration only; no aliases are resolved or provider requests created. */
export const EVALUATION_LINEUP_LABELS = Object.freeze(['Opus', 'Astra', 'Sonnet', 'Luna'] as const);
export type EvaluationLineupLabel = typeof EVALUATION_LINEUP_LABELS[number];
export type EvaluationLineupConfiguration = Readonly<Partial<Record<EvaluationLineupLabel, EvaluationModel>>>;

/** Resolve only explicit host configuration, preserving its exact provider and model identifiers. */
export function configuredLineup(configuration: EvaluationLineupConfiguration): readonly EvaluationModel[] {
  return EVALUATION_LINEUP_LABELS.flatMap(label => {
    const model = configuration[label];
    if (!model) return [];
    if (!model.id.trim() || !model.provider.trim()) throw new TypeError('Exact provider and model identifiers are required.');
    return [{ provider: model.provider, id: model.id, label }];
  });
}
export interface EvaluationBudget {
  readonly maxCalls: number;
  readonly timeoutMs: number;
  readonly maxInputBytes: number;
  readonly maxOutputBytes: number;
  readonly maxTokens: number;
  readonly maxCostUsd: number;
  /** Host-provided upper bound reserved before each call, including unknown actual costs. */
  readonly maxCostUsdPerCall: number;
}
export interface EvaluationUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly costUsd: number | null;
}
export interface EvaluationChunk {
  readonly text: string;
  /** Cumulative provider-reported usage, never inferred from character counts. */
  readonly usage?: Partial<EvaluationUsage>;
}
export interface EvaluationRequest {
  readonly model: EvaluationModel;
  readonly prompt: string;
  readonly signal: AbortSignal;
  readonly maxTokens: number;
  readonly maxOutputBytes: number;
  readonly maxCostUsd: number;
}
/** Adapters own credentials and must honor the abort signal and request ceilings. */
export type EvaluationProvider = (request: EvaluationRequest) => AsyncIterable<EvaluationChunk> | Promise<AsyncIterable<EvaluationChunk>>;
export type EvaluationStatus = 'complete' | 'budget-exceeded' | 'aborted' | 'provider-error';
export interface EvaluationReport {
  readonly model: EvaluationModel;
  readonly status: EvaluationStatus;
  readonly output: string;
  readonly outputBytes: number;
  readonly usage: EvaluationUsage;
  readonly timings: { readonly firstChunkMs: number | null; readonly completedMs: number };
  /** Stable category only: provider exception messages can contain credentials. */
  readonly error: string | null;
}
export interface EvaluateModelOptions {
  readonly model: EvaluationModel;
  readonly prompt: string;
  readonly budget: EvaluationBudget;
  readonly provider: EvaluationProvider;
  readonly signal?: AbortSignal;
}

function validBudget(budget: EvaluationBudget): boolean {
  return budget !== null && typeof budget === 'object'
    && ['maxCalls', 'timeoutMs', 'maxInputBytes', 'maxOutputBytes', 'maxTokens', 'maxCostUsd', 'maxCostUsdPerCall']
      .every(key => { const value = budget[key as keyof EvaluationBudget]; return typeof value === 'number' && Number.isFinite(value) && value >= 0; })
    && [budget.maxCalls, budget.maxInputBytes, budget.maxOutputBytes, budget.maxTokens].every(Number.isSafeInteger)
    && budget.timeoutMs > 0 && budget.timeoutMs <= 2_147_483_647;
}
function reportedNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** One bounded call. Unknown billing remains null and consumes its entire reserved allowance. */
export async function evaluateModel(options: EvaluateModelOptions): Promise<EvaluationReport> {
  const { model, prompt, budget, provider } = options;
  const started = performance.now();
  let output = '';
  let outputBytes = 0;
  let firstChunkMs: number | null = null;
  let usage: EvaluationUsage = { inputTokens: null, outputTokens: null, costUsd: null };
  const finish = (status: EvaluationStatus, error: string | null): EvaluationReport => ({
    model: { provider: model.provider, id: model.id, label: model.label }, status, output, outputBytes, usage,
    timings: { firstChunkMs, completedMs: performance.now() - started }, error
  });
  if (!model.id.trim() || !model.provider.trim() || !validBudget(budget) || budget.maxCalls < 1 || budget.maxCostUsdPerCall > budget.maxCostUsd
    || new TextEncoder().encode(prompt).byteLength > budget.maxInputBytes) {
    return finish('budget-exceeded', 'request-budget');
  }
  if (options.signal?.aborted) return finish('aborted', 'aborted');
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  let rejectAbort: (() => void) | undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(new Error('aborted'));
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
  });
  const timer = setTimeout(abort, budget.timeoutMs);
  let iterator: AsyncIterator<EvaluationChunk> | undefined;
  let chunks = 0;
  try {
    const stream = await Promise.race([Promise.resolve(provider({
      model, prompt, signal: controller.signal, maxTokens: budget.maxTokens,
      maxOutputBytes: budget.maxOutputBytes, maxCostUsd: budget.maxCostUsdPerCall
    })), cancelled]);
    iterator = stream[Symbol.asyncIterator]();
    while (true) {
      const next = await Promise.race([iterator.next(), cancelled]);
      if (next.done) break;
      if (++chunks > Math.min(100000, budget.maxOutputBytes + 1)) return finish('budget-exceeded', 'output-chunks');
      const chunk = next.value;
      if (!chunk || typeof chunk.text !== 'string') return finish('provider-error', 'invalid-provider-chunk');
      if (firstChunkMs === null) firstChunkMs = performance.now() - started;
      const bytes = new TextEncoder().encode(chunk.text).byteLength;
      if (outputBytes + bytes > budget.maxOutputBytes) return finish('budget-exceeded', 'output-bytes');
      if (chunk.usage) {
        if (typeof chunk.usage !== 'object' || Object.keys(chunk.usage).some(key => !['inputTokens', 'outputTokens', 'costUsd'].includes(key))) {
          return finish('provider-error', 'invalid-provider-usage');
        }
        const merged = { ...usage, ...chunk.usage };
        if (Object.values(merged).some(value => value !== null && !reportedNumber(value))) {
          return finish('provider-error', 'invalid-provider-usage');
        }
        if ([merged.inputTokens, merged.outputTokens].some(value => value !== null && !Number.isSafeInteger(value))) {
          return finish('provider-error', 'invalid-provider-usage');
        }
        usage = merged;
        if ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) > budget.maxTokens
          || (usage.costUsd ?? 0) > budget.maxCostUsdPerCall) {
          return finish('budget-exceeded', 'provider-usage');
        }
      }
      output += chunk.text;
      outputBytes += bytes;
    }
    return finish('complete', null);
  } catch {
    return finish(controller.signal.aborted ? 'aborted' : 'provider-error', controller.signal.aborted ? 'aborted' : 'provider-error');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
    controller.abort();
    // A provider ignoring cancellation cannot hold the caller open during iterator cleanup.
    try { if (iterator?.return) void Promise.resolve(iterator.return()).catch(() => undefined); } catch { /* Adapter cleanup is best-effort. */ }
  }
}

/** A sequential lineup shares call and billing ceilings; it does not make comparative quality claims. */
export async function evaluateLineup(options: Omit<EvaluateModelOptions, 'model' | 'provider'> & {
  readonly models: readonly EvaluationModel[];
  readonly providers: Readonly<Record<string, EvaluationProvider>>;
}): Promise<readonly EvaluationReport[]> {
  if (!validBudget(options.budget)) throw new TypeError('Invalid evaluation budget.');
  const reports: EvaluationReport[] = [];
  let remaining = options.budget.maxCostUsd;
  for (const model of options.models) {
    if (reports.length >= options.budget.maxCalls || options.signal?.aborted) break;
    const provider = Object.hasOwn(options.providers, model.provider) ? options.providers[model.provider] : undefined;
    if (typeof provider !== 'function') throw new TypeError('A configured provider adapter is required for every model.');
    const report = await evaluateModel({ ...options, model, provider, budget: { ...options.budget, maxCostUsd: remaining } });
    reports.push(report);
    if (report.status !== 'budget-exceeded' || report.error !== 'request-budget') {
      remaining -= report.usage.costUsd ?? options.budget.maxCostUsdPerCall;
    }
  }
  return reports;
}

export interface SemanticNodeExpectation {
  readonly id: string;
  readonly type?: string;
  readonly text?: string;
  readonly props?: Readonly<Record<string, JsonValue>>;
  readonly bindings?: Readonly<Record<string, string>>;
  readonly action?: string;
}
export interface SemanticOracle { readonly nodes: readonly SemanticNodeExpectation[] }
export interface SemanticResult { readonly ok: boolean; readonly failures: readonly string[] }
function equalJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const a = Object.keys(left), b = Object.keys(right);
  return a.length === b.length && a.every(key => Object.hasOwn(right, key)
    && equalJson((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}
/** Check explicit task requirements in addition to structural validity. */
export function evaluateSemantics(view: LyraGenView, oracle: SemanticOracle): SemanticResult {
  const nodes = new Map<string, LyraGenNode>();
  const visit = (node: LyraGenNode): void => { nodes.set(node.id, node); node.children?.forEach(visit); };
  visit(view.root);
  const failures: string[] = [];
  for (const expected of oracle.nodes) {
    const node = nodes.get(expected.id);
    if (!node) { failures.push(`${expected.id}: missing node`); continue; }
    if (expected.type !== undefined && node.type !== expected.type) failures.push(`${expected.id}: type mismatch`);
    if (expected.text !== undefined && node.text !== expected.text) failures.push(`${expected.id}: text mismatch`);
    if (expected.action !== undefined && node.action?.name !== expected.action) failures.push(`${expected.id}: action mismatch`);
    for (const [key, value] of Object.entries(expected.props ?? {})) {
      if (!equalJson(node.props?.[key], value)) failures.push(`${expected.id}: property ${key} mismatch`);
    }
    for (const [key, value] of Object.entries(expected.bindings ?? {})) {
      if (node.bindings?.[key] !== value) failures.push(`${expected.id}: binding ${key} mismatch`);
    }
  }
  return { ok: failures.length === 0, failures };
}

export interface MeasurementSummary {
  readonly samples: number;
  readonly min: number;
  readonly median: number;
  readonly p95: number;
  readonly max: number;
  readonly mean: number;
}
/** Measured wall-clock samples only; no estimated token, billing, or rendering metrics. */
export function summarizeMeasurements(samples: readonly number[]): MeasurementSummary {
  if (samples.length === 0 || samples.some(value => !Number.isFinite(value) || value < 0)) throw new TypeError('Finite nonnegative samples are required.');
  const values = [...samples].sort((a, b) => a - b);
  const at = (quantile: number): number => values[Math.max(0, Math.ceil(values.length * quantile) - 1)]!;
  return { samples: values.length, min: values[0]!, median: at(0.5), p95: at(0.95), max: values[values.length - 1]!, mean: values.reduce((a, b) => a + b, 0) / values.length };
}
