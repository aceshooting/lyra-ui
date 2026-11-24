import type { MessagePart } from '@aceshooting/lyra-ui/ai';
import { resolveLimits } from './schema.js';
import { validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenDiagnostic, LyraGenIsolation, LyraGenLimits, LyraGenRecoveryMode, LyraGenView } from './types.js';

export interface LyraGenAiSdkOptions {
  /** One bridge belongs to one SDK message; create a new bridge when that identity changes. */
  readonly messageId: string;
  readonly catalog: LyraGenCatalog;
  /** Explicitly authorized data part names, without the data- prefix. */
  readonly dataNames?: readonly string[];
  /** Explicitly authorized tool names whose complete input is a view document. */
  readonly toolNames?: readonly string[];
  /** Also bounds the combined serialized documents retained for stable identity. */
  readonly limits?: Partial<LyraGenLimits>;
  /** `'strict'` (default) rejects any validation error; `'isolate'` contains component-local defects in place. */
  readonly recovery?: LyraGenRecoveryMode;
}

export interface LyraGenAiSdkPart {
  readonly messageId: string;
  readonly partId: string;
  readonly status: 'loading' | 'ready' | 'interrupted' | 'error';
  /** Only validated complete views; interruption may retain the previous safe view. */
  readonly document?: LyraGenView;
  readonly diagnostics: readonly LyraGenDiagnostic[];
  /** Subtrees contained by `recovery: 'isolate'`; the status stays `ready`. */
  readonly isolated?: readonly LyraGenIsolation[];
  readonly resumable?: boolean;
  readonly reason?: string;
  /** Present on views from transient `onData` chunks, which never enter message history. */
  readonly transient?: true;
}

/**
 * A raw AI SDK 5 data chunk as delivered to `onData` (`{ type: 'data-<name>', id?, data, transient? }`),
 * typed structurally so the SDK stays optional.
 */
export interface LyraGenAiSdkDataChunk {
  readonly type: string;
  readonly id?: string;
  readonly data?: unknown;
  readonly transient?: boolean;
}

interface RetainedView { readonly partId: string; readonly document: LyraGenView; readonly isolated?: readonly LyraGenIsolation[]; readonly serialized: string; readonly bytes: number }
const encoder = new TextEncoder();

/** Selects host-authorized SDK data and complete tool input for the existing renderPart hook.
 * Partial JSON is owned by the SDK; no partial input is admitted as executable generated UI. */
export class LyraGenAiSdkBridge {
  private readonly options: LyraGenAiSdkOptions;
  private readonly dataNames: ReadonlySet<string>;
  private readonly toolNames: ReadonlySet<string>;
  private readonly limits: Readonly<LyraGenLimits>;
  private readonly retained = new Map<string, RetainedView>();
  /** Surface id to the reconciliation key of the part that owns it. */
  private readonly owners = new Map<string, string>();
  /** Latest transient revision per reconciliation key; transient views never replace retained ones. */
  private readonly transientRevisions = new Map<string, number>();
  private retainedBytes = 0;

  constructor(options: LyraGenAiSdkOptions) {
    if (typeof options.messageId !== 'string' || !options.messageId || options.messageId.length > 1024) {
      throw new TypeError('The SDK bridge needs an explicit message identity of at most 1024 characters.');
    }
    this.options = { ...options };
    this.dataNames = new Set(options.dataNames ?? []);
    this.toolNames = new Set(options.toolNames ?? []);
    this.limits = resolveLimits(options.limits);
  }

  reset(): void { this.retained.clear(); this.owners.clear(); this.transientRevisions.clear(); this.retainedBytes = 0; }

  /** Undefined delegates to the ordinary renderer. Returned states need host-localized labels. */
  resolve(part: MessagePart): LyraGenAiSdkPart | undefined {
    const data = part.type === 'data' && part.name && this.dataNames.has(part.name) && Object.hasOwn(part, 'data');
    const tool = part.type === 'tool-call' && this.toolNames.has(part.invocation.name);
    if (!data && !tool) return undefined;
    const result = (status: LyraGenAiSdkPart['status'], diagnostics: readonly LyraGenDiagnostic[] = [], document?: LyraGenView, isolated?: readonly LyraGenIsolation[]): LyraGenAiSdkPart => ({
      messageId: this.options.messageId, partId: part.id, status, diagnostics, ...(document ? { document } : {}), ...(isolated ? { isolated } : {}),
    });
    const failure = (code: string, message: string): LyraGenAiSdkPart => result('error', [{ code, message, path: '', severity: 'error' }]);
    if (typeof part.id !== 'string' || !part.id || part.id.length > 1024) return failure('identity.invalid', 'A generated part needs a bounded explicit identity.');
    // The SDK replaces a data part only by the same type and id, so a name is part of the identity.
    const key = part.type === 'data' ? reconciliationKey(part.name!, part.id) : 'tool\u0000' + part.id;
    const previous = this.retained.get(key);
    if (part.state === 'interrupted') {
      return { ...result('interrupted', [], previous?.document), resumable: part.interruption?.resumable ?? false,
        ...(part.interruption?.reason ? { reason: part.interruption.reason } : {}) };
    }
    let input: unknown;
    if (part.type === 'tool-call') {
      if (part.invocation.status === 'error' || part.invocation.status === 'denied' || part.invocation.status === 'incomplete') {
        return failure('ai-sdk.tool-unavailable', 'The generated tool input is not available.');
      }
      const state = part.metadata?.['aiSdkInputState'];
      if (state !== 'input-available' && state !== 'output-available') return result('loading');
      input = part.invocation.args;
    } else if (part.type === 'data') {
      if (part.state !== 'complete') return result('loading');
      input = part.data;
    }
    const checked = validateView(input, this.options.catalog, { limits: this.limits, recovery: this.options.recovery });
    if (!checked.ok) return result('error', checked.diagnostics);
    const serialized = JSON.stringify(checked.value, (_key, value: unknown) => value !== null
      && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
      : value);
    const owner = this.owners.get(checked.value.surfaceId);
    if (owner !== undefined && owner !== key) return failure('identity.conflict', 'A generated surface must belong to exactly one message part.');
    if (previous) {
      if (serialized === previous.serialized) return result('ready', [], previous.document, previous.isolated);
      if (checked.value.surfaceId !== previous.document.surfaceId || checked.value.revision <= previous.document.revision) {
        return failure('revision.conflict', 'A changed part must retain its surface identity and advance its revision.');
      }
    }
    const bytes = encoder.encode(serialized).byteLength + encoder.encode(part.id).byteLength;
    const total = this.retainedBytes - (previous?.bytes ?? 0) + bytes;
    if (total > this.limits.maxBytes || (!previous && this.retained.size >= this.limits.maxNodes)) {
      return failure('limit.bytes', 'Generated SDK parts exceed the retained-content limit.');
    }
    this.retained.set(key, { partId: part.id, document: checked.value, serialized, bytes, ...(checked.isolated ? { isolated: checked.isolated } : {}) });
    this.owners.set(checked.value.surfaceId, key);
    this.retainedBytes = total;
    return result('ready', [], checked.value, checked.isolated);
  }

  /**
   * Resolve a raw `onData` chunk. A persistent chunk needs an id and reconciles exactly like the
   * matching message part. A transient chunk is validated and must advance past both the retained
   * part and earlier transient views for its name and id (or, without an id, for the part owning
   * its surface); it never replaces the retained part, so replayed history stays valid.
   * Undefined delegates: the chunk is not an authorized data chunk.
   */
  resolveData(chunk: unknown): LyraGenAiSdkPart | undefined {
    if (chunk === null || typeof chunk !== 'object') return undefined;
    const own = (name: string): unknown => { const descriptor = Object.getOwnPropertyDescriptor(chunk, name); return descriptor && 'value' in descriptor ? descriptor.value : undefined; };
    const type = own('type');
    if (typeof type !== 'string' || !type.startsWith('data-') || !this.dataNames.has(type.slice(5)) || !Object.hasOwn(chunk, 'data')) return undefined;
    const name = type.slice(5);
    const id = own('id');
    const transient = own('transient') === true;
    const failure = (partId: string, code: string, message: string): LyraGenAiSdkPart => ({ messageId: this.options.messageId, partId, status: 'error', diagnostics: [{ code, message, path: '', severity: 'error' }] });
    if (id !== undefined && (typeof id !== 'string' || !id || id.length > 1024)) return failure('', 'identity.invalid', 'A generated part needs a bounded explicit identity.');
    if (!transient) {
      if (id === undefined) return failure('', 'identity.invalid', 'A persistent generated data chunk needs an explicit identity.');
      return this.resolve({ id, type: 'data', name, data: own('data'), state: 'complete' });
    }
    const checked = validateView(own('data'), this.options.catalog, { limits: this.limits, recovery: this.options.recovery });
    if (!checked.ok) return { messageId: this.options.messageId, partId: id ?? '', status: 'error', diagnostics: checked.diagnostics };
    const owner = this.owners.get(checked.value.surfaceId);
    const key = id !== undefined ? reconciliationKey(name, id) : owner ?? reconciliationKey(name, '\u0000' + checked.value.surfaceId);
    const partId = id ?? (owner !== undefined ? this.retained.get(owner)?.partId : undefined) ?? checked.value.surfaceId;
    if (owner !== undefined && owner !== key) return failure(partId, 'identity.conflict', 'A generated surface must belong to exactly one message part.');
    const retained = this.retained.get(key)?.document;
    if (retained && retained.surfaceId !== checked.value.surfaceId) return failure(partId, 'revision.conflict', 'A changed part must retain its surface identity and advance its revision.');
    const baseline = Math.max(retained?.revision ?? -1, this.transientRevisions.get(key) ?? -1);
    if (checked.value.revision <= baseline) return failure(partId, 'revision.conflict', 'A transient view must advance its revision.');
    if (!this.transientRevisions.has(key) && this.transientRevisions.size >= this.limits.maxNodes) return failure(partId, 'limit.bytes', 'Generated SDK parts exceed the retained-content limit.');
    this.transientRevisions.set(key, checked.value.revision);
    return { messageId: this.options.messageId, partId, status: 'ready', diagnostics: [], document: checked.value, ...(checked.isolated ? { isolated: checked.isolated } : {}), transient: true };
  }
}

const reconciliationKey = (name: string, id: string): string => 'data-' + name + '\u0000' + id;
