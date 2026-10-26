import type { MessagePart } from '@aceshooting/lyra-ui/ai';
import { resolveLimits } from './schema.js';
import { validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenDiagnostic, LyraGenLimits, LyraGenView } from './types.js';

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
}

export interface LyraGenAiSdkPart {
  readonly messageId: string;
  readonly partId: string;
  readonly status: 'loading' | 'ready' | 'interrupted' | 'error';
  /** Only validated complete views; interruption may retain the previous safe view. */
  readonly document?: LyraGenView;
  readonly diagnostics: readonly LyraGenDiagnostic[];
  readonly resumable?: boolean;
  readonly reason?: string;
}

interface RetainedView { readonly document: LyraGenView; readonly serialized: string; readonly bytes: number }
const encoder = new TextEncoder();

/** Selects host-authorized SDK data and complete tool input for the existing renderPart hook.
 * Partial JSON is owned by the SDK; no partial input is admitted as executable generated UI. */
export class LyraGenAiSdkBridge {
  private readonly options: LyraGenAiSdkOptions;
  private readonly dataNames: ReadonlySet<string>;
  private readonly toolNames: ReadonlySet<string>;
  private readonly limits: Readonly<LyraGenLimits>;
  private readonly retained = new Map<string, RetainedView>();
  private readonly owners = new Map<string, string>();
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

  reset(): void { this.retained.clear(); this.owners.clear(); this.retainedBytes = 0; }

  /** Undefined delegates to the ordinary renderer. Returned states need host-localized labels. */
  resolve(part: MessagePart): LyraGenAiSdkPart | undefined {
    const data = part.type === 'data' && part.name && this.dataNames.has(part.name) && Object.hasOwn(part, 'data');
    const tool = part.type === 'tool-call' && this.toolNames.has(part.invocation.name);
    if (!data && !tool) return undefined;
    const result = (status: LyraGenAiSdkPart['status'], diagnostics: readonly LyraGenDiagnostic[] = [], document?: LyraGenView): LyraGenAiSdkPart => ({
      messageId: this.options.messageId, partId: part.id, status, diagnostics, ...(document ? { document } : {}),
    });
    const failure = (code: string, message: string): LyraGenAiSdkPart => result('error', [{ code, message, path: '', severity: 'error' }]);
    if (typeof part.id !== 'string' || !part.id || part.id.length > 1024) return failure('identity.invalid', 'A generated part needs a bounded explicit identity.');
    const previous = this.retained.get(part.id);
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
    const checked = validateView(input, this.options.catalog, { limits: this.limits });
    if (!checked.ok) return result('error', checked.diagnostics);
    const serialized = JSON.stringify(checked.value, (_key, value: unknown) => value !== null
      && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
      : value);
    const owner = this.owners.get(checked.value.surfaceId);
    if (owner !== undefined && owner !== part.id) return failure('identity.conflict', 'A generated surface must belong to exactly one message part.');
    if (previous) {
      if (serialized === previous.serialized) return result('ready', [], previous.document);
      if (checked.value.surfaceId !== previous.document.surfaceId || checked.value.revision <= previous.document.revision) {
        return failure('revision.conflict', 'A changed part must retain its surface identity and advance its revision.');
      }
    }
    const bytes = encoder.encode(serialized).byteLength + encoder.encode(part.id).byteLength;
    const total = this.retainedBytes - (previous?.bytes ?? 0) + bytes;
    if (total > this.limits.maxBytes || (!previous && this.retained.size >= this.limits.maxNodes)) {
      return failure('limit.bytes', 'Generated SDK parts exceed the retained-content limit.');
    }
    this.retained.set(part.id, { document: checked.value, serialized, bytes });
    this.owners.set(checked.value.surfaceId, part.id);
    this.retainedBytes = total;
    return result('ready', [], checked.value);
  }
}
