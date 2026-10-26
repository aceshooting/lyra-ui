import type { MessagePart } from '@aceshooting/lyra-ui/ai';
import { createIslandParser, type IslandParser, type IslandResult } from './islands.js';
import { validateView } from './runtime.js';
import { snapshotJson } from './schema.js';
import type { MarkupOptions } from './parser.js';
import type { JsonValue, LyraGenCatalog, LyraGenDiagnostic, LyraGenNode, LyraGenResult, LyraGenView } from './types.js';

export type LyraGenChatStatus = 'streaming' | 'complete' | 'interrupted' | 'cancelled' | 'error';
export type LyraGenChatIslandStatus = 'loading' | 'ready' | 'incomplete' | 'error';
/** Viewer-authorized metadata. Model-authored source labels never establish provenance. */
export interface LyraGenChatSource { readonly id: string; readonly label: string }
export interface LyraGenChatSuggestion {
  /** Host-declared action name, such as ask:details. */
  readonly id: string;
  readonly label: string;
  readonly question: string;
  readonly context?: JsonValue;
}
export interface LyraGenChatAsk extends LyraGenChatSuggestion { readonly signal: AbortSignal }
export interface LyraGenChatStrings {
  readonly loading: string;
  readonly incomplete: string;
  readonly invalid: string;
  readonly sourceUnavailable: string;
}
export interface LyraGenChatOptions {
  readonly messageId: string;
  readonly surfaceId: string;
  readonly revision?: number;
  readonly catalog: LyraGenCatalog;
  readonly limits?: MarkupOptions['limits'];
  /** Host-localized strings; this DOM-free controller does not choose a UI locale. */
  readonly strings: LyraGenChatStrings;
  /** Host-only provenance text, rendered outside the generated view. */
  readonly provenance?: string;
  /** Keep current viewer permissions here; call refreshSources after changes. */
  readonly sources?: ReadonlyMap<string, LyraGenChatSource>;
  readonly suggestions?: readonly LyraGenChatSuggestion[];
  readonly canAsk?: () => boolean;
  readonly onAsk?: (request: LyraGenChatAsk) => void | Promise<void>;
}
export interface LyraGenChatIsland {
  readonly kind: 'lyra-gen-island';
  readonly partId: string;
  readonly surfaceId: string;
  readonly status: LyraGenChatIslandStatus;
  readonly fallback: string;
  readonly provenance?: string;
  readonly document?: LyraGenView;
  readonly diagnostics: readonly LyraGenDiagnostic[];
}
export interface LyraGenChatSnapshot {
  readonly status: LyraGenChatStatus;
  /** Standard text/data parts; no new Lyra UI wire type is required. */
  readonly parts: readonly MessagePart[];
  readonly islands: readonly LyraGenChatIsland[];
  readonly diagnostics: readonly LyraGenDiagnostic[];
  readonly resumable: boolean;
}
export type LyraGenChatAskResult = 'accepted' | 'duplicate' | 'disabled' | 'unknown' | 'failed';

const identity = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const issue = (code: string, message: string): LyraGenDiagnostic => ({ code, message, path: '', severity: 'error' });

/** Streaming adapter for the existing message-parts renderPart hook. Closed islands validate
 * before publication; source authorization and provenance stay under host ownership. */
export class LyraGenChatController {
  private parser: IslandParser | undefined;
  private result: IslandResult = { parts: [], diagnostics: [] };
  private retryResult?: IslandResult;
  private status: LyraGenChatStatus = 'streaming';
  private sourceText = '';
  private disposed = false;
  private sourceReleased = false;
  private resumable = false;
  private interruptionReason?: string;
  private readonly options: LyraGenChatOptions;
  private parsedViews = new WeakMap<LyraGenView, LyraGenResult<LyraGenView>>();
  private readonly rawViews = new Map<string, LyraGenView>();
  private readonly islands = new Map<string, LyraGenChatIsland>();
  private readonly partCache = new Map<string, MessagePart>();
  private readonly suggestions = new Map<string, LyraGenChatSuggestion>();
  private readonly activations = new Set<string>();
  private readonly requests = new Set<AbortController>();
  private current: LyraGenChatSnapshot;

  constructor(options: LyraGenChatOptions) {
    if (!identity.test(options.messageId) || !identity.test(options.surfaceId)) throw new TypeError('Chat identities must be short explicit identifiers.');
    this.options = { ...options, strings: { ...options.strings } };
    if ((options.suggestions?.length ?? 0) > 128) throw new TypeError('Too many chat suggestions.');
    for (const suggestion of options.suggestions ?? []) {
      if (!/^ask:[A-Za-z0-9_.:-]{1,64}$/.test(suggestion.id) || this.suggestions.has(suggestion.id)
        || !suggestion.label.trim() || !suggestion.question.trim() || suggestion.question.length > 4096) throw new TypeError('Invalid host chat suggestion.');
      const context = snapshotJson(suggestion.context ?? null);
      if (!context.ok) throw new TypeError('Invalid host suggestion context.');
      this.suggestions.set(suggestion.id, Object.freeze({ ...suggestion, ...(suggestion.context !== undefined ? { context: context.value } : {}) }));
    }
    this.parser = this.newParser();
    this.current = this.project();
  }

  private newParser(): IslandParser {
    return createIslandParser({ catalog: this.options.catalog, surfaceId: this.options.surfaceId,
      revision: this.options.revision ?? 0, allowedTags: Object.keys(this.options.catalog.components),
      ...(this.options.limits ? { limits: this.options.limits } : {}) });
  }

  get snapshot(): LyraGenChatSnapshot { return this.current; }
  get asking(): boolean { return this.requests.size > 0; }
  /** Logical source length, counted once; this is not a heap or backing-store measurement. */
  get retainedSourceCharacters(): number { return this.sourceText.length; }
  get sourceAvailable(): boolean { return !this.disposed && !this.sourceReleased; }
  islandForPart(partId: string): LyraGenChatIsland | undefined { return this.islands.get(partId); }

  push(chunk: string): LyraGenChatSnapshot {
    if (this.disposed) return this.current;
    if (this.sourceReleased) return this.rejectReleasedSource();
    if (this.status !== 'streaming') return this.current;
    const previous = this.result;
    this.result = this.parser!.push(chunk);
    if (!this.result.diagnostics.some(diagnostic => diagnostic.severity === 'error')) this.sourceText += chunk;
    else this.retryResult = previous;
    if (this.result.diagnostics.some(diagnostic => diagnostic.severity === 'error')) this.status = 'error';
    return this.current = this.project();
  }
  finish(): LyraGenChatSnapshot {
    if (this.disposed) return this.current;
    if (this.sourceReleased) return this.rejectReleasedSource();
    if (this.status !== 'streaming') return this.current;
    this.result = this.parser!.finish();
    this.status = this.result.diagnostics.some(diagnostic => diagnostic.severity === 'error') ? 'error' : 'complete';
    return this.current = this.project();
  }
  /** Pause transport in the application; the retained scanner can continue only after resume. */
  interrupt(resumable: boolean, reason?: string): LyraGenChatSnapshot {
    if (this.disposed) return this.current;
    if (this.sourceReleased) return this.rejectReleasedSource();
    if (this.status !== 'streaming') return this.current;
    this.status = 'interrupted'; this.resumable = resumable; this.interruptionReason = reason;
    this.abortRequests();
    if (!resumable) this.result = this.parser!.cancel();
    return this.current = this.project();
  }
  resume(): LyraGenChatSnapshot {
    if (this.disposed) return this.current;
    if (this.sourceReleased) return this.rejectReleasedSource();
    if (this.status !== 'interrupted' || !this.resumable) return this.current;
    this.status = 'streaming'; this.resumable = false; this.interruptionReason = undefined;
    return this.current = this.project();
  }
  cancel(): LyraGenChatSnapshot {
    if (this.disposed || this.status === 'cancelled') return this.current;
    this.status = 'cancelled'; this.resumable = false;
    if (this.sourceReleased) { this.abortRequests(); return this.current = Object.freeze({ ...this.current, status: 'cancelled', resumable: false }); }
    this.result = this.parser!.cancel();
    this.abortRequests();
    return this.current = this.project();
  }
  /** Retry replaces the unfinished/invalid tail, starting at its opening fence (or the final
   * prose segment). The host supplies that tail again, including its fence; completed islands
   * preceding it keep their identities. This does not reconnect the provider transport. */
  retry(): LyraGenChatSnapshot {
    if (this.disposed) return this.current;
    if (this.sourceReleased) return this.rejectReleasedSource();
    if (this.status === 'streaming') return this.current;
    const last = (this.retryResult ?? this.result).parts.at(-1);
    this.retryResult = undefined;
    const lastInvalid = last?.kind === 'island'
      && this.islands.get(`${this.options.messageId}:island:${last.start}`)?.status !== 'ready';
    const truncate = last && (last.kind === 'prose' || lastInvalid) ? last.start : this.sourceText.length;
    this.sourceText = this.sourceText.slice(0, truncate);
    this.abortRequests(); this.parser = this.newParser(); this.result = this.parser.push(this.sourceText);
    this.status = 'streaming'; this.resumable = false; this.interruptionReason = undefined;
    return this.current = this.project();
  }

  /** Revalidate viewer source availability without reparsing or replacing unrelated control ids. */
  refreshSources(): LyraGenChatSnapshot {
    if (this.disposed) return this.current;
    for (const [partId, raw] of this.rawViews) this.admit(partId, raw, true);
    return this.current = this.sourceReleased ? this.projectReleased() : this.project();
  }

  resolveCitation(surfaceId: string, nodeId: string): LyraGenChatSource | undefined {
    const raw = [...this.rawViews.values()].find(view => view.surfaceId === surfaceId);
    if (!raw) return undefined;
    const pending = [raw.root];
    while (pending.length) {
      const node = pending.pop()!;
      if (node.id === nodeId && (node.type === 'citation' || node.type === 'source-card')) {
        return this.source(node.props?.['sourceId']);
      }
      if (node.children) pending.push(...node.children);
    }
    return undefined;
  }

  /** One host callback per activation id, bounded over the controller's lifetime. The caller
   * chooses activation ids; generated payloads cannot supply questions or grant permission. */
  async requestSuggestion(id: string, activationId: string): Promise<LyraGenChatAskResult> {
    if (this.disposed) return 'disabled';
    const suggestion = this.suggestions.get(id);
    if (!suggestion || !identity.test(activationId)) return 'unknown';
    if (this.activations.has(activationId)) return 'duplicate';
    if (!this.options.onAsk || this.options.canAsk?.() === false || this.status === 'streaming'
      || this.status !== 'complete' || this.disposed || this.asking || this.activations.size >= 256) return 'disabled';
    this.activations.add(activationId);
    const request = new AbortController(); this.requests.add(request);
    try {
      await this.options.onAsk({ ...suggestion, signal: request.signal });
      return request.signal.aborted ? 'disabled' : 'accepted';
    } catch { return request.signal.aborted ? 'disabled' : 'failed'; }
    finally { this.requests.delete(request); }
  }
  /** Drop raw transport/fence text after the host has persisted or otherwise finished with it.
   * Admitted documents, prose presentation, edits owned by views, and source authorization stay
   * available. Resume/retry require a new controller after release and report a diagnostic. */
  releaseSource(): LyraGenChatSnapshot {
    if (this.disposed || this.sourceReleased) return this.current;
    this.abortRequests(); this.parser?.cancel(); this.parser = undefined;
    this.sourceText = ''; this.result = { parts: [], diagnostics: [] }; this.retryResult = undefined;
    this.parsedViews = new WeakMap(); this.partCache.clear(); this.sourceReleased = true; this.resumable = false;
    const parts = this.current.parts.some(part => part.interruption?.resumable)
      ? Object.freeze(this.current.parts.map(part => part.interruption?.resumable
        ? Object.freeze({ ...part, interruption: Object.freeze({ ...part.interruption, resumable: false }) }) : part))
      : this.current.parts;
    return this.current = Object.freeze({ ...this.current, parts: Object.freeze(parts), resumable: false });
  }
  dispose(): void {
    this.disposed = true; this.abortRequests(); this.parser?.cancel(); this.parser = undefined;
    this.sourceText = ''; this.result = { parts: [], diagnostics: [] }; this.retryResult = undefined;
    this.parsedViews = new WeakMap();
    this.islands.clear(); this.rawViews.clear(); this.partCache.clear(); this.suggestions.clear(); this.activations.clear();
    this.current = Object.freeze({ status: 'cancelled', parts: [], islands: [], diagnostics: [], resumable: false });
  }
  private rejectReleasedSource(): LyraGenChatSnapshot {
    const diagnostic = issue('chat.source-released', 'Source was released. Create a new chat controller to resume or retry.');
    return this.current = Object.freeze({ ...this.current,
      diagnostics: Object.freeze([...this.current.diagnostics.filter(item => item.code !== diagnostic.code), diagnostic]) });
  }
  private projectReleased(): LyraGenChatSnapshot {
    const parts = this.current.parts.map((part): MessagePart => {
      const island = this.islands.get(part.id);
      if (!island || part.type !== 'data' || part.name !== 'lyra-gen-island' || part.data === island) return part;
      return Object.freeze({ id: part.id, type: 'data', name: 'lyra-gen-island', data: island,
        ...(part.state !== undefined ? { state: part.state } : {}),
        ...(part.interruption ? { interruption: part.interruption } : {}),
        ...(part.metadata ? { metadata: part.metadata } : {}) });
    });
    return Object.freeze({ ...this.current, parts: Object.freeze(parts),
      islands: Object.freeze(this.current.islands.map(island => this.islands.get(island.partId) ?? island)) });
  }

  private abortRequests(): void { for (const request of this.requests) request.abort(); this.requests.clear(); }
  private source(id: unknown): LyraGenChatSource | undefined {
    if (typeof id !== 'string') return undefined;
    try {
      const source = this.options.sources?.get(id);
      return source && source.id === id && typeof source.label === 'string' && source.label.trim()
        ? Object.freeze({ id, label: source.label }) : undefined;
    } catch { return undefined; }
  }
  private admit(partId: string, raw: LyraGenView, refresh = false): LyraGenChatIsland {
    const previous = this.islands.get(partId);
    if (!refresh && this.rawViews.get(partId) === raw && previous) return previous;
    const rewrite = (node: LyraGenNode): LyraGenNode => {
      if (node.type === 'citation' || node.type === 'source-card') {
        const source = this.source(node.props?.['sourceId']);
        if (!source) {
          if (node.type === 'source-card' && this.options.catalog.components['source-card']?.properties['disabled']) {
            return { id: node.id, type: 'source-card', props: { sourceId: node.props?.['sourceId'] ?? '',
              heading: this.options.strings.sourceUnavailable, disabled: true }, ...(node.slot ? { slot: node.slot } : {}) };
          }
          return { id: node.id, type: 'text', text: this.options.strings.sourceUnavailable,
            ...(node.slot ? { slot: node.slot } : {}) };
        }
        const props = Object.fromEntries(Object.entries(node.props ?? {}).filter(([key]) => !['status', 'href'].includes(key)));
        return { ...node, props: { ...props, sourceId: source.id,
          [node.type === 'citation' ? 'label' : 'heading']: source.label },
          ...(node.children ? { children: node.children.map(rewrite) } : {}) };
      }
      return node.children ? { ...node, children: node.children.map(rewrite) } : node;
    };
    const root = rewrite(raw.root);
    const changed = previous?.document && JSON.stringify(previous.document.root) !== JSON.stringify(root);
    const revision = refresh && changed ? previous!.document!.revision + 1 : previous?.document?.revision ?? raw.revision;
    const admitted = validateView({ ...raw, root, revision }, this.options.catalog);
    const island: LyraGenChatIsland = Object.freeze({ kind: 'lyra-gen-island', partId, surfaceId: raw.surfaceId,
      status: admitted.ok ? 'ready' : 'error', fallback: admitted.ok ? '' : this.options.strings.invalid,
      ...(this.options.provenance ? { provenance: this.options.provenance } : {}),
      ...(admitted.ok ? { document: !changed && previous?.document ? previous.document : admitted.value } : {}), diagnostics: admitted.diagnostics });
    this.rawViews.set(partId, raw); this.islands.set(partId, island);
    return island;
  }

  private project(): LyraGenChatSnapshot {
    const parts: MessagePart[] = [];
    const live = new Set<string>();
    const diagnostics = [...this.result.diagnostics];
    const use = (part: MessagePart): void => {
      const cached = this.partCache.get(part.id);
      const same = cached && cached.state === part.state
        && cached.interruption?.resumable === part.interruption?.resumable
        && cached.interruption?.reason === part.interruption?.reason
        && (cached.type === 'text' && part.type === 'text' && cached.text === part.text
          || cached.type === 'data' && part.type === 'data' && cached.data === part.data);
      const owned = same ? cached : Object.freeze(part);
      this.partCache.set(part.id, owned); parts.push(owned); live.add(part.id);
    };
    let islandIndex = 0;
    for (const [index, part] of this.result.parts.entries()) {
      if (part.kind === 'prose') {
        const tail = index === this.result.parts.length - 1;
        use({ id: `${this.options.messageId}:prose:${part.start}`, type: 'text', text: part.source,
          state: tail && this.status === 'streaming' ? 'streaming' : tail && this.status === 'interrupted' ? 'interrupted' : 'complete',
          ...(tail && this.status === 'interrupted' ? { interruption: { resumable: this.resumable,
            ...(this.interruptionReason ? { reason: this.interruptionReason } : {}) } } : {}) });
        continue;
      }
      const surfaceId = `${this.options.surfaceId}:island-${islandIndex++}`;
      const partId = `${this.options.messageId}:island:${part.start}`;
      let island: LyraGenChatIsland;
      if (part.closed && part.result.status === 'complete' && part.result.view) {
        let checked = this.parsedViews.get(part.result.view);
        if (!checked) {
          checked = validateView(part.result.view, this.options.catalog);
          this.parsedViews.set(part.result.view, checked);
        }
        const old = this.rawViews.get(partId);
        if (old && checked.ok && old !== checked.value && JSON.stringify(old) !== JSON.stringify(checked.value)) {
          island = Object.freeze({ kind: 'lyra-gen-island', partId, surfaceId: old.surfaceId, status: 'error',
            fallback: this.options.strings.invalid, ...(this.options.provenance ? { provenance: this.options.provenance } : {}), diagnostics: [issue('chat.identity-conflict', 'A replay changed an already published island.')] });
        } else if (checked.ok) island = this.admit(partId, old ?? checked.value);
        else island = Object.freeze({ kind: 'lyra-gen-island', partId, surfaceId: part.result.view.surfaceId,
          status: 'error', fallback: this.options.strings.invalid, ...(this.options.provenance ? { provenance: this.options.provenance } : {}), diagnostics: checked.diagnostics });
      } else {
        island = Object.freeze({ kind: 'lyra-gen-island', partId, surfaceId,
          status: part.closed || part.result.status === 'error' ? 'error' : this.status === 'streaming' ? 'loading' : 'incomplete',
          fallback: part.closed || part.result.status === 'error' ? this.options.strings.invalid
            : this.status === 'streaming' ? this.options.strings.loading : this.options.strings.incomplete,
          ...(this.options.provenance ? { provenance: this.options.provenance } : {}), diagnostics: Object.freeze([...part.result.diagnostics]) });
      }
      this.islands.set(partId, island); diagnostics.push(...island.diagnostics);
      use({ id: partId, type: 'data', name: 'lyra-gen-island', data: island,
        state: island.status === 'loading' ? 'streaming' : island.status === 'incomplete' ? 'interrupted' : 'complete',
        ...(island.status === 'incomplete' ? { interruption: { resumable: this.resumable } } : {}) });
    }
    for (const id of this.islands.keys()) {
      if (live.has(id)) continue;
      if (!this.rawViews.has(id)) this.islands.delete(id);
    }
    for (const id of this.partCache.keys()) if (!live.has(id)) this.partCache.delete(id);
    return Object.freeze({ status: this.status, parts: Object.freeze(parts),
      islands: Object.freeze([...live].map(id => this.islands.get(id)).filter((island): island is LyraGenChatIsland => !!island)),
      diagnostics: Object.freeze(diagnostics), resumable: this.resumable });
  }
}

export function createChatStream(options: LyraGenChatOptions): LyraGenChatController { return new LyraGenChatController(options); }

/** Move the existing host-owned shell, never reconstruct its generated view. This preserves
 * element identity; pending loads/approvals may cancel on browsers using disconnect/reconnect.
 * Browser focus, panel accessibility and transcript scroll still need composition qualification. */
export function moveChatSurface(surface: HTMLElement, host: HTMLElement, before: Node | null = null): void {
  if (surface.parentNode === host && surface.nextSibling === before) return;
  let focused: Element | null = surface.ownerDocument.activeElement;
  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
  let owner: Node | null = focused;
  let restore = false;
  while (owner) {
    if (owner === surface) { restore = true; break; }
    const root = owner.getRootNode();
    owner = owner.parentNode ?? (root instanceof ShadowRoot ? root.host : null);
  }
  const target = host as HTMLElement & { moveBefore?: (node: Node, child: Node | null) => void };
  if (target.moveBefore && surface.isConnected && host.isConnected && surface.ownerDocument === host.ownerDocument) target.moveBefore(surface, before);
  else host.insertBefore(surface, before);
  if (restore && focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true });
}
