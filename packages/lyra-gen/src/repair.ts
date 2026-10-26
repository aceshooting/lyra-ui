import { applyViewPatch, findNode, REPAIRABLE_DIAGNOSTIC_CODES, validateView } from './runtime.js';
import type { LyraGenPatch, LyraGenValidationOptions } from './runtime.js';
import { snapshotJson } from './schema.js';
import type { LyraGenCatalog, LyraGenDiagnostic, LyraGenNode, LyraGenResult, LyraGenView } from './types.js';

export interface LyraGenRepairRequest {
  readonly surfaceId: string;
  readonly expectedRevision: number;
  readonly nodes: readonly LyraGenNode[];
  readonly diagnostics: readonly LyraGenDiagnostic[];
}
export interface LyraGenRepairLimits { readonly maxAttempts?: number; readonly maxElapsedMs?: number; readonly maxTokens?: number }
const failed = <T>(code: string, message: string): LyraGenResult<T> => ({ ok: false, diagnostics: [{ code, message, path: '', severity: 'error' }] });
const forbidden = (diagnostic: LyraGenDiagnostic) => !REPAIRABLE_DIAGNOSTIC_CODES.includes(diagnostic.code);

/** Explicitly scope repair to known nodes; security, resource and identity failures are terminal. */
export function createRepairRequest(view: LyraGenView, nodeIds: readonly string[], diagnostics: readonly LyraGenDiagnostic[]): LyraGenResult<LyraGenRepairRequest> {
  if (!diagnostics.length || diagnostics.some(forbidden)) return failed('repair.forbidden', 'These diagnostics cannot be repaired automatically.');
  if (!nodeIds.length || nodeIds.length > 32 || new Set(nodeIds).size !== nodeIds.length) return failed('repair.scope', 'Repair needs one to 32 distinct node identities.');
  const nodes = nodeIds.map(id => findNode(view, id));
  if (nodes.some(node => !node)) return failed('repair.scope', 'Repair targets must exist in the current view.');
  const admitted = snapshotJson({ surfaceId: view.surfaceId, expectedRevision: view.revision, nodes, diagnostics });
  return admitted.ok ? { ok: true, value: admitted.value as unknown as LyraGenRepairRequest, diagnostics: [] } : admitted;
}

/** A bounded synchronous merge session. The host owns model calls, cancellation and token accounting. */
export class LyraGenRepairSession {
  readonly #request: LyraGenRepairRequest;
  readonly #started: number;
  readonly #maxAttempts: number;
  readonly #maxElapsedMs: number;
  readonly #maxTokens: number;
  #attempts = 0;
  #tokens = 0;
  #complete = false;
  constructor(request: LyraGenRepairRequest, limits: LyraGenRepairLimits = {}) {
    const copied = snapshotJson(request);
    if (!copied.ok) throw new TypeError('Invalid repair request.');
    this.#request = copied.value as unknown as LyraGenRepairRequest;
    if (!Array.isArray(this.#request.diagnostics) || !this.#request.diagnostics.length || this.#request.diagnostics.some(forbidden) || !Array.isArray(this.#request.nodes) || !this.#request.nodes.length || this.#request.nodes.length > 32) throw new TypeError('Invalid repair scope or diagnostic category.');
    const cap = (value: number | undefined, fallback: number, hard: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(hard, Math.floor(value)) : fallback;
    this.#maxAttempts = cap(limits.maxAttempts, 2, 3);
    this.#maxElapsedMs = cap(limits.maxElapsedMs, 30_000, 60_000);
    this.#maxTokens = cap(limits.maxTokens, 4096, 16_384);
    this.#started = Date.now();
  }
  get attempts(): number { return this.#attempts; }
  get tokens(): number { return this.#tokens; }
  apply(current: LyraGenView, patch: LyraGenPatch, catalog: LyraGenCatalog, tokensUsed: number, options: LyraGenValidationOptions = {}): LyraGenResult<LyraGenView> {
    if (this.#complete || this.#attempts >= this.#maxAttempts || Date.now() - this.#started > this.#maxElapsedMs || !Number.isSafeInteger(tokensUsed) || tokensUsed < 0 || this.#tokens + tokensUsed > this.#maxTokens) return failed('repair.limit', 'Repair budget is exhausted or invalid.');
    this.#attempts++; this.#tokens += tokensUsed;
    if (current.surfaceId !== this.#request.surfaceId || current.revision !== this.#request.expectedRevision) return failed('revision.conflict', 'Repair cannot overwrite a newer surface revision.');
    const safe = snapshotJson(patch, options.limits);
    if (!safe.ok) return safe;
    const scoped = safe.value as unknown as LyraGenPatch;
    const allowed = new Set(this.#request.nodes.map(node => node.id));
    if (!scoped || !Array.isArray(scoped.operations) || scoped.operations.some(operation => !operation || !allowed.has(operation.nodeId) || operation.op !== 'replace')) return failed('repair.scope', 'Repair may replace only its declared failing nodes.');
    const checkedCurrent = validateView(current, catalog, options);
    if (!checkedCurrent.ok && checkedCurrent.diagnostics.some(forbidden)) return failed('repair.forbidden', 'The current boundary has a nonrepairable failure.');
    let base = current;
    if (!checkedCurrent.ok) {
      // A rejected initial boundary has no live identities to preserve. Admit plain data first,
      // substitute only requested nodes, then validate the complete candidate atomically.
      const admitted = snapshotJson(current, options.limits);
      if (!admitted.ok) return admitted;
      base = admitted.value as unknown as LyraGenView;
      const replace = (node: LyraGenNode): LyraGenNode => {
        const operation = scoped.operations.find(candidate => candidate.nodeId === node.id);
        if (operation?.op === 'replace') return operation.node;
        return node.children ? { ...node, children: node.children.map(replace) } : node;
      };
      base = { ...base, root: replace(base.root) };
    }
    const result = applyViewPatch(base, scoped, catalog, options);
    if (result.ok) this.#complete = true;
    return result;
  }
}
