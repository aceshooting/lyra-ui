import { createRepairRequest, LyraGenRepairSession } from './repair.js';
import type { LyraGenRepairLimits, LyraGenRepairRequest } from './repair.js';
import { createSurfaceState, reconcileSurfaceState, REPAIRABLE_DIAGNOSTIC_CODES, restoreSnapshot, validateView } from './runtime.js';
import type { LyraGenPatch, LyraGenSurfaceState, LyraGenValidationOptions } from './runtime.js';
import { resolveLimits, snapshotJson } from './schema.js';
import type { LyraGenCatalog, LyraGenDiagnostic, LyraGenNode, LyraGenResult, LyraGenView } from './types.js';

export interface LyraGenRepairBoundary {
  readonly view: LyraGenView;
  readonly state?: LyraGenSurfaceState;
  /** Host-maintained generation; advance on every user edit or newer model request. */
  readonly generation: string | number;
}
export interface LyraGenRepairTransportContext {
  readonly signal: AbortSignal;
  readonly attempt: number;
  readonly maxTokens: number;
}
export interface LyraGenRepairResponse {
  readonly patch: LyraGenPatch;
  /** Actual total usage reported by the transport, including request and response tokens. */
  readonly tokensUsed: number;
}
export type LyraGenRepairTransport = (request: LyraGenRepairRequest, context: LyraGenRepairTransportContext) => Promise<LyraGenRepairResponse>;
export interface LyraGenRepairWorkflowOptions extends LyraGenValidationOptions {
  readonly getCurrent: () => LyraGenRepairBoundary;
  readonly catalog: LyraGenCatalog;
  readonly nodeIds: readonly string[];
  readonly transport: LyraGenRepairTransport;
  readonly signal?: AbortSignal;
  readonly limits?: LyraGenValidationOptions['limits'] & LyraGenRepairLimits;
}
export interface LyraGenRepairOutcome extends LyraGenRepairBoundary {
  readonly attempts: number;
  readonly tokensUsed: number;
}
const failure = <T>(code: string, message: string): LyraGenResult<T> => ({ ok: false, diagnostics: [{ code, message, path: '', severity: 'error' }] });
const repairable = (diagnostics: readonly LyraGenDiagnostic[]): boolean => diagnostics.length > 0 && diagnostics.every(diagnostic => REPAIRABLE_DIAGNOSTIC_CODES.includes(diagnostic.code));
const cap = (value: number | undefined, fallback: number, hard: number): number => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.max(1, Math.min(hard, Math.floor(value))) : fallback;

/** Provider-neutral orchestration; the host owns transport and commits the returned candidate. */
export async function repairView(options: LyraGenRepairWorkflowOptions): Promise<LyraGenResult<LyraGenRepairOutcome>> {
  const { getCurrent, catalog, transport, signal } = options;
  const limits = resolveLimits(options.limits);
  const validation = { limits };
  const controller = new AbortController();
  const maxAttempts = cap(options.limits?.maxAttempts, 2, 3);
  const maxElapsedMs = cap(options.limits?.maxElapsedMs, 30_000, 60_000);
  const maxTokens = cap(options.limits?.maxTokens, 4096, 16_384);
  const started = Date.now();
  let timedOut = false;
  const abort = (): void => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, maxElapsedMs);
  const canceled = (): LyraGenResult<LyraGenRepairOutcome> => failure(timedOut ? 'repair.limit' : 'repair.aborted', timedOut ? 'Repair exceeded its elapsed-time limit.' : 'Repair was canceled.');
  let stop: (() => void) | undefined;
  const abortedMarker = Symbol('repair-aborted');
  const aborted = new Promise<typeof abortedMarker>(resolve => {
    stop = () => resolve(abortedMarker);
    controller.signal.addEventListener('abort', stop, { once: true });
  });
  try {
    if (controller.signal.aborted) return canceled();
    const scope = snapshotJson(options.nodeIds, limits);
    if (!scope.ok) return scope;
    if (!Array.isArray(scope.value)) return failure('repair.scope', 'Repair needs an array of node identities.');
    const nodeIds = scope.value as readonly string[];
    const admitted = snapshotJson(getCurrent(), limits);
    if (!admitted.ok) return admitted;
    const baseline = admitted.value as unknown as LyraGenRepairBoundary;
    if (!baseline || !baseline.view || !['string', 'number'].includes(typeof baseline.generation) || (typeof baseline.generation === 'number' && !Number.isSafeInteger(baseline.generation))) return failure('repair.boundary', 'Repair needs an explicit host generation and current view.');
    if (baseline.state) {
      const reconstructed = createSurfaceState(baseline.view, baseline.state.values);
      if (baseline.state.surfaceId !== baseline.view.surfaceId || baseline.state.revision !== baseline.view.revision || !Array.isArray(baseline.state.dirty) || baseline.state.dirty.some(pointer => !Object.hasOwn(reconstructed.owners, pointer)) || JSON.stringify(reconstructed.owners) !== JSON.stringify(baseline.state.owners) || JSON.stringify(reconstructed.values) !== JSON.stringify(baseline.state.values)) return failure('state.unauthorized', 'Repair state must match the current binding ownership.');
    }
    const fingerprint = JSON.stringify(admitted.value);
    const currentMatches = (): boolean => {
      const current = snapshotJson(getCurrent(), limits);
      return current.ok && JSON.stringify(current.value) === fingerprint;
    };
    const checked = validateView(baseline.view, catalog, validation);
    if (checked.ok) return failure('repair.unnecessary', 'The current view has no failing content to repair.');
    if (!repairable(checked.diagnostics)) return failure('repair.forbidden', 'Identity, authority and resource failures cannot be repaired.');
    const paths = new Map<string, string>();
    const visit = (node: LyraGenNode, path: string): void => { paths.set(node.id, path); node.children?.forEach((child, index) => visit(child, `${path}/children/${index}`)); };
    visit(baseline.view.root, '/root');
    const selected = nodeIds.map(id => paths.get(id));
    if (selected.some(path => !path) || selected.some((path, index) => selected.some((other, otherIndex) => index !== otherIndex && path!.startsWith(`${other}/`)))) return failure('repair.scope', 'Repair targets must exist and cannot overlap.');
    const covers = (path: string, scope: string): boolean => path === scope || path.startsWith(`${scope}/`);
    if (checked.diagnostics.some(diagnostic => !selected.some(path => covers(diagnostic.path, path!))) || selected.some(path => !checked.diagnostics.some(diagnostic => covers(diagnostic.path, path!)))) return failure('repair.scope', 'Repair targets must cover exactly the failing regions.');
    let request = createRepairRequest(baseline.view, nodeIds, checked.diagnostics);
    if (!request.ok) return request;
    const session = new LyraGenRepairSession(request.value, { maxAttempts, maxElapsedMs, maxTokens });
    let diagnostics = checked.diagnostics;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (controller.signal.aborted || Date.now() - started >= maxElapsedMs) { timedOut ||= !signal?.aborted; return canceled(); }
      if (!currentMatches()) return failure('revision.conflict', 'Repair cannot overwrite newer model output or user edits.');
      request = createRepairRequest(baseline.view, nodeIds, diagnostics);
      if (!request.ok) return request;
      const currentRequest = request.value;
      const response = await Promise.race([Promise.resolve().then<LyraGenRepairResponse | typeof abortedMarker>(() => {
        if (controller.signal.aborted || Date.now() - started >= maxElapsedMs) {
          timedOut ||= !signal?.aborted;
          controller.abort();
          return abortedMarker;
        }
        return transport(currentRequest, { signal: controller.signal, attempt, maxTokens: maxTokens - session.tokens });
      }), aborted]);
      if (controller.signal.aborted || response === abortedMarker || Date.now() - started >= maxElapsedMs) { timedOut ||= !signal?.aborted; return canceled(); }
      if (!currentMatches()) return failure('revision.conflict', 'Repair cannot overwrite newer model output or user edits.');
      if (!response || typeof response !== 'object') return failure('repair.transport', 'Repair transport returned no response.');
      const usage = Object.getOwnPropertyDescriptor(response, 'tokensUsed');
      if (!usage || ('value' in usage && (!Number.isSafeInteger(usage.value) || usage.value < 0 || usage.value > maxTokens - session.tokens))) return failure('repair.limit', 'Transport usage is missing, invalid or exceeds the token budget.');
      const admittedResponse = snapshotJson(response, limits);
      if (!admittedResponse.ok) return admittedResponse;
      const safeResponse = admittedResponse.value as unknown as LyraGenRepairResponse;
      if (!Number.isSafeInteger(safeResponse.tokensUsed) || safeResponse.tokensUsed < 0 || safeResponse.tokensUsed > maxTokens - session.tokens) return failure('repair.limit', 'Transport usage is missing, invalid or exceeds the token budget.');
      const merged = session.apply(baseline.view, safeResponse.patch, catalog, safeResponse.tokensUsed, validation);
      if (merged.ok) {
        let state: LyraGenSurfaceState | undefined;
        if (baseline.state) {
          const reconciled = reconcileSurfaceState(baseline.state, baseline.view, merged.value);
          if (!reconciled.ok) return reconciled;
          if (baseline.state.dirty.some(pointer => !reconciled.value.dirty.includes(pointer) || JSON.stringify(baseline.state!.owners[pointer]) !== JSON.stringify(reconciled.value.owners[pointer]))) return failure('state.unauthorized', 'Repair cannot discard dirty binding ownership.');
          const validated = restoreSnapshot({ version: '1', view: merged.value, state: reconciled.value }, catalog, validation);
          if (!validated.ok) return validated;
          state = validated.value.state;
        }
        if (controller.signal.aborted || Date.now() - started >= maxElapsedMs) { timedOut ||= !signal?.aborted; return canceled(); }
        if (!currentMatches()) return failure('revision.conflict', 'Repair cannot overwrite newer model output or user edits.');
        if (controller.signal.aborted || Date.now() - started >= maxElapsedMs) { timedOut ||= !signal?.aborted; controller.abort(); return canceled(); }
        return { ok: true, value: Object.freeze({ view: merged.value, ...(state ? { state } : {}), generation: baseline.generation, attempts: session.attempts, tokensUsed: session.tokens }), diagnostics: [] };
      }
      if (!repairable(merged.diagnostics)) return merged;
      if (merged.diagnostics.some(diagnostic => !selected.some(path => covers(diagnostic.path, path!)))) return failure('repair.scope', 'New diagnostics fall outside the declared repair regions.');
      diagnostics = merged.diagnostics;
      if (session.tokens >= maxTokens) return failure('repair.limit', 'Repair exhausted its token budget.');
    }
    return failure('repair.limit', 'Repair exhausted its attempt budget.');
  } catch { return controller.signal.aborted ? canceled() : failure('repair.transport', 'Repair transport or host boundary failed.'); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    if (stop) controller.signal.removeEventListener('abort', stop);
  }
}
