import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
export type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import { styles } from './agent-trace.styles.js';
import type { LyraSpan } from '../trace-tree/span.js';
import { projectLyraSpans } from '../trace-tree/span-projection.js';
import type { LyraTraceTree, TraceTreeSource } from '../trace-tree/trace-tree.class.js';
export type { TraceTreeSource } from '../trace-tree/trace-tree.class.js';
import type { LyraGraphLegendVisibilityDetail } from '../../retrieval/graph-legend/graph-legend.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentTraceFilterLabel, LYRA_DEFAULT_spanKindAgent, LYRA_DEFAULT_spanKindEmbedding, LYRA_DEFAULT_spanKindLlm, LYRA_DEFAULT_spanKindOther, LYRA_DEFAULT_spanKindRetriever, LYRA_DEFAULT_spanKindTool, LYRA_DEFAULT_spanProjectionLimit } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_handoffFromToAgent, LYRA_DEFAULT_handoffToAgent, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_open, LYRA_DEFAULT_tokensIn, LYRA_DEFAULT_tokensOut } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraSpan } from '../trace-tree/span.js';

/**
 * Canonical span-kind order for the filter legend and the "which kinds are present" scan --
 * matches `<lr-trace-tree>`'s own internal kind iteration order so a kind lands in the same
 * visual position across both components.
 */
const EMPTY_SPANS: readonly LyraSpan[] = Object.freeze([]);
const KIND_ORDER: LyraSpan['kind'][] = ['agent', 'llm', 'tool', 'retriever', 'embedding', 'other'];

/**
 * Maps each `LyraSpan.kind` onto the message key `<lr-trace-tree>`/`<lr-span-waterfall>` already
 * localize their own kind label through -- reused verbatim (not redefined with new wording) so a
 * translation registered for one of those components applies identically here. This component
 * composes retrieval (`retriever` + `embedding`), tool (`tool`), model (`llm`), and handoff
 * (`agent`) spans; the filter itself operates one level more granular, directly on
 * `LyraSpan.kind`, so it never drifts from the exact field `<lr-trace-tree>` already keys its own
 * rendering off of.
 */
const KIND_LABEL_KEY: Record<LyraSpan['kind'], string> = {
  agent: 'spanKindAgent',
  llm: 'spanKindLlm',
  tool: 'spanKindTool',
  retriever: 'spanKindRetriever',
  embedding: 'spanKindEmbedding',
  other: 'spanKindOther',
};

export interface LyraAgentTraceEventMap {
  /** Bubbles, composed, from the composed `<lr-trace-tree>` (identical `{ spanId }` detail), or is
   *  fired directly when a handoff quick-jump entry is activated -- a host handles both origins
   *  through this one event. */
  'lr-span-select': CustomEvent<{ spanId: string }>;
  /** Bubbles, composed, from the composed `<lr-trace-tree>`, unchanged. */
  'lr-span-toggle': CustomEvent<{ spanId: string; expanded: boolean }>;
  /** Timeline-owned translation of the composed graph legend's visibility event. */
  'lr-span-visibility-change': CustomEvent<LyraEventDetailSnapshot<{ hiddenKinds: LyraSpan['kind'][] }>>;
}

/**
 * `<lr-agent-trace>` — a provider-neutral agent/LLM trace view: a span-kind filter row, a
 * handoff quick-jump list, and the full trace hierarchy, all driven by one shared `LyraSpan[]`
 * array (the same shape `<lr-trace-tree>` and `<lr-span-waterfall>` already consume).
 *
 * The actual trace rendering -- hierarchy, expand/collapse, roving-tabindex keyboard navigation,
 * duration bars, the empty state -- is entirely `<lr-trace-tree>`'s own: this component only ever
 * passes it a (possibly filtered) `spans` array plus a handful of pass-through properties, never
 * building its own row markup. `<lr-trace-tree>` was chosen over `<lr-span-waterfall>` because a
 * trace is fundamentally the hierarchy relationship between spans (which agent called which tool,
 * which handed off to which sub-agent) -- exactly what `parentId`-derived `aria-level` nesting
 * conveys and a flat, `startMs`-ordered timeline does not.
 *
 * This component's own contribution is the multi-domain filter layer on top of that: a filter
 * row composing `<lr-graph-legend>` -- the same abstract type/visibility-toggle legend pattern
 * that component already establishes for `<lr-graph>`'s node types, reused here (it neither
 * reads nor writes an actual graph) for `LyraSpan.kind` visibility instead -- and a handoff
 * quick-jump list composing `<lr-handoff-divider>` for each visible `'agent'`-kind span (an
 * agent invocation is, in trace terms, a handoff of control to that agent). Hidden kinds are
 * simply excluded from the array handed to `<lr-trace-tree>`; a span whose parent got filtered
 * out is promoted to a root by `<lr-trace-tree>`'s own existing orphan handling, never dropped.
 *
 * Selection is controlled end-to-end for deep-linking: `activeSpanId` flows down into
 * `<lr-trace-tree>` verbatim, and both activation paths -- a row click inside the tree, or a
 * handoff quick-jump entry -- update it and fire the identical `lr-span-select` `{ spanId }`
 * shape, so
 * a host can encode the current span id in a URL and feed it straight back in.
 *
 * Public collection properties take bounded readonly snapshots. `spans` keeps its admitted item
 * identities only long enough for the shared descriptor-safe projection to copy its fields; later
 * rendering never re-reads an admitted source row. Create a new collection and reassign it after
 * changes; mutating the assigned array does not update the view.
 *
 * With treeSource defined, the child owns the complete provider preorder and global timing
 * summary. The filter offers all six known kinds; the legacy handoff quick-jump list is omitted.
 * No source rows are copied into spans or scanned to discover kinds or handoffs.
 *
 * @customElement lr-agent-trace
 * @event lr-span-select - `detail: { spanId }` — a span was activated, from the tree or the handoff list.
 * @event lr-span-toggle - `detail: { spanId, expanded }` — a tree row was expanded or collapsed.
 * @event lr-span-visibility-change - `detail: { hiddenKinds }` — the span-kind filter changed.
 * @csspart base - The root wrapper.
 * @csspart filter - The composed `<lr-graph-legend>` filter row; all six kinds in provider mode, otherwise the kinds present in `spans`.
 * @csspart handoffs - The handoff quick-jump list wrapper, only rendered while at least one visible span has `kind: 'agent'`.
 * @csspart handoff - One handoff quick-jump entry (a `<button>` wrapping an `<lr-handoff-divider>`); carries `data-active`.
 * @csspart limit - Source admission limit notice when the composed tree has no projection notice.
 * @csspart tree - The composed `<lr-trace-tree>`.
 * @cssprop [--lr-agent-trace-handoff-active-bg=var(--lr-color-brand-quiet)] - Background of the active
 *   (`activeSpanId`) handoff quick-jump entry. Shadow Parts forbids an attribute selector after
 *   `::part()`, so the active entry could otherwise only be restyled by hijacking the library-wide
 *   `--lr-color-brand-quiet` token.
 * @status stable
 * @since 4.1.0
 */
export class LyraAgentTrace extends LyraElement<LyraAgentTraceEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    agentTraceFilterLabel: LYRA_DEFAULT_agentTraceFilterLabel,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    handoffFromToAgent: LYRA_DEFAULT_handoffFromToAgent,
    handoffToAgent: LYRA_DEFAULT_handoffToAgent,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    open: LYRA_DEFAULT_open,
    spanKindAgent: LYRA_DEFAULT_spanKindAgent,
    spanKindEmbedding: LYRA_DEFAULT_spanKindEmbedding,
    spanKindLlm: LYRA_DEFAULT_spanKindLlm,
    spanKindOther: LYRA_DEFAULT_spanKindOther,
    spanKindRetriever: LYRA_DEFAULT_spanKindRetriever,
    spanKindTool: LYRA_DEFAULT_spanKindTool,
    spanProjectionLimit: LYRA_DEFAULT_spanProjectionLimit,
    tokensIn: LYRA_DEFAULT_tokensIn,
    tokensOut: LYRA_DEFAULT_tokensOut,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['spans', 'hiddenKinds']);
  /** Span sources can carry opaque provider metadata; the shared normalizer copies only its closed
   * display schema once, so cloning each whole source record would both lose opaque identity and
   * create an unsafe second traversal. */
  protected static override readonly identityCollectionProperties = Object.freeze(['spans']);

  static override styles = [LyraElement.styles, styles];

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-span-visibility-change',
  ]);

  private _treeSource: TraceTreeSource | undefined = undefined;
  private sourceVersion = 0;
  private sourceTree?: LyraTraceTree;
  private forwardedTree?: LyraTraceTree;
  private forwardedKinds?: readonly LyraSpan['kind'][];

  /** Immutable full-source preorder, forwarded to the single trace-tree child.
   * Defined sources override legacy spans. Provider mode offers all six kind filters and omits
   * the legacy handoff list; expansion, selection, global timing summary and bounded rows belong
   * to the child. Reassign or requestUpdate() after changing the provider revision.
   * @default undefined */
  @property({ attribute: false })
  get treeSource(): TraceTreeSource | undefined { return this._treeSource; }
  set treeSource(value: TraceTreeSource | undefined) {
    const previous = this._treeSource;
    this._treeSource = value;
    this.sourceVersion++;
    const tree = this.sourceTree;
    if (tree) tree.treeSource = value;
    this.requestUpdate('treeSource', previous);
  }

  /** Reveals and focuses a full-source span using the child; false if absent or superseded. */
  async revealSourceKey(key: string): Promise<boolean> {
    const source = this.treeSource;
    if (source === undefined) return false;
    const version = this.sourceVersion;
    const owner = this.ownerDocument;
    const current = () => this.isConnected && this.ownerDocument === owner &&
      this.treeSource === source && this.sourceVersion === version;
    await this.updateComplete;
    const tree = this.sourceTree;
    if (!current() || !tree || tree.treeSource !== source) return false;
    const revealed = await tree.revealSourceKey(key);
    return current() && this.sourceTree === tree && tree.treeSource === source && revealed;
  }

  private forwardKinds(tree: LyraTraceTree): void {
    if (this.forwardedTree !== tree || this.forwardedKinds !== this.hiddenKinds) {
      this.forwardedTree = tree;
      this.forwardedKinds = this.hiddenKinds;
      tree.hiddenKinds = this.hiddenKinds;
    }
  }

  private bindTree = (element?: Element): void => {
    const tree = element as LyraTraceTree | undefined;
    this.sourceTree = tree;
    if (!tree) return;
    const version = this.sourceVersion;
    const source = this.treeSource;
    this.forwardKinds(tree);
    if (this.sourceTree !== tree || this.sourceVersion !== version || this.treeSource !== source) return;
    if (tree.treeSource !== source) tree.treeSource = source;
  };

  override requestUpdate(name?: PropertyKey, oldValue?: unknown): void {
    if (name === 'hiddenKinds' && this.sourceTree) this.forwardKinds(this.sourceTree);
    if (name === undefined && this._treeSource !== undefined) {
      this.sourceVersion++;
      this.sourceTree?.requestUpdate();
    }
    super.requestUpdate(name, oldValue);
  }

  override disconnectedCallback(): void {
    this.sourceVersion++;
    super.disconnectedCallback();
  }

  /** The full, unfiltered span array -- identical contract to `<lr-trace-tree>.spans`. Controlled
   *  and never mutated by this component; `activeSpanId` and its ancestor path reserve positions
   *  inside the maxNodes projection (default 500) before kind filtering. Assign a new array to update: mutating an array and assigning it again does not. */
  @property({ attribute: false }) spans: readonly LyraSpan[] = [];
  /** Maximum projected rows, from 1 to 5000. Invalid or unset values use 500.
   * Source admission keeps the first 10000 outer entries without cloning opaque metadata. */
  @property({ type: Number, attribute: 'max-nodes' }) maxNodes = 500;
  private get effectiveMaxNodes(): number {
    return Math.max(1, Math.min(5000, finiteCount(this.maxNodes, 500)));
  }
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private sourceNotice = false;
  private previousSourceNotice = false;
  private noticeInitialized = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.noticeInitialized = this.hasUpdated;
    this.previousSourceNotice = this.sourceNotice;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.sourceVersion++;
    this.announcements.adopted();
  }

  private limitMessage(): string {
    return this.localize('spanProjectionLimit', undefined, {
      count: getNumberFormat(this.effectiveLocale).format(this.effectiveMaxNodes),
    });
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.treeSource !== undefined) return;
    const version = this.sourceVersion;
    const owner = this.ownerDocument;
    const notice = this.sourceNotice;
    const current = () => this.isConnected && this.ownerDocument === owner && this.sourceVersion === version &&
      this.treeSource === undefined && this.sourceNotice === notice;
    if (this.noticeInitialized && notice && !this.previousSourceNotice) {
      const message = this.limitMessage();
      if (!current()) return;
      this.announcements.announcePolite(message);
      if (!current()) return;
    }
    this.noticeInitialized = true;
    this.previousSourceNotice = notice;
  }

  /** Controlled selection, forwarded verbatim into the composed `<lr-trace-tree>`. Updated
   *  locally (and re-emitted as `lr-span-select`) whenever a span is activated from either the
   *  tree or the handoff quick-jump list, so a host can also treat it as a two-way binding. */
  @property({ attribute: 'active-span-id' }) activeSpanId: string | null = null;

  /** Span kinds currently hidden from the tree. Empty (the default) shows every kind. Controlled
   *  -- a host may pre-set this (e.g. to hide `retriever`/`embedding` spans by default) or read it
   *  back after `lr-span-visibility-change`. */
  @property({ attribute: false }) hiddenKinds: readonly LyraSpan['kind'][] = [];

  /** Optional accessible-name override forwarded to the composed `<lr-trace-tree>`. Omission
   *  leaves the composed tree's own `label` unset, so it localizes its own default; any supplied
   *  string, including `''`, is forwarded verbatim. See `<lr-trace-tree>`'s own `label` property. */
  @property() label?: string;

  /** Adds the tokens-in/tokens-out columns; forwarded verbatim to the composed `<lr-trace-tree>`. */
  @property({ type: Boolean, attribute: 'with-tokens' }) withTokens = false;

  /** Adds the cost column; forwarded verbatim to the composed `<lr-trace-tree>`. */
  @property({ type: Boolean, attribute: 'with-cost' }) withCost = false;

  /** Suppresses the inline duration bar on the composed `<lr-trace-tree>`, for dense/narrow
   *  embeddings. */
  @property({ type: Boolean, attribute: 'without-bars' }) withoutBars = false;

  private projectionLimit = 0;
  private projectionSource?: readonly LyraSpan[];
  private projectionActiveSpanId: string | null = null;
  private projectionCache?: ReturnType<typeof projectLyraSpans>;
  private filteredSource?: readonly LyraSpan[];
  private filteredKinds?: readonly LyraSpan['kind'][];
  private filteredCache: LyraSpan[] = [];
  private presentKindsSource?: readonly LyraSpan[];
  private presentKindsCache: LyraSpan['kind'][] = [];
  private handoffsSource?: readonly LyraSpan[];
  private handoffsCache: LyraSpan[] = [];
  private legendKinds?: readonly LyraSpan['kind'][];
  private legendLabels: string[] = [];
  private legendTypes: LyraNodeTypeStyle[] = [];

  private projectedSpans(): ReturnType<typeof projectLyraSpans> {
    if (this.projectionSource !== this.spans || this.projectionActiveSpanId !== this.activeSpanId || this.projectionLimit !== this.effectiveMaxNodes) {
      this.projectionSource = this.spans;
      this.projectionActiveSpanId = this.activeSpanId;
      this.projectionLimit = this.effectiveMaxNodes;
      this.projectionCache = projectLyraSpans(this.spans, this.activeSpanId, this.effectiveMaxNodes);
    }
    return this.projectionCache!;
  }

  private presentKinds(spans: readonly LyraSpan[]): LyraSpan['kind'][] {
    if (this.presentKindsSource !== spans) {
      this.presentKindsSource = spans;
      const present = new Set(spans.map((span) => span.kind));
      this.presentKindsCache = KIND_ORDER.filter((kind) => present.has(kind));
    }
    return this.presentKindsCache;
  }

  private filteredSpans(spans: readonly LyraSpan[]): LyraSpan[] {
    if (this.filteredSource !== spans || this.filteredKinds !== this.hiddenKinds) {
      this.filteredSource = spans;
      this.filteredKinds = this.hiddenKinds;
      const hidden = new Set(this.hiddenKinds);
      this.filteredCache = hidden.size === 0 ? [...spans] : spans.filter((span) => !hidden.has(span.kind));
    }
    return this.filteredCache;
  }

  private handoffSpans(spans: readonly LyraSpan[]): LyraSpan[] {
    if (this.handoffsSource !== spans) {
      this.handoffsSource = spans;
      this.handoffsCache = spans.filter((span) => span.kind === 'agent');
    }
    return this.handoffsCache;
  }

  /** The handed-off-from agent's name, resolved against the full (unfiltered) `spans` array so a
   *  hidden/filtered-out parent's name still renders -- empty when `parentId` is unset or
   *  unresolvable, mirroring `<lr-handoff-divider>`'s own "from is optional" contract. */
  private handoffFromAgent(span: LyraSpan, byId: ReadonlyMap<string, LyraSpan>): string {
    if (!span.parentId) return '';
    const parent = byId.get(span.parentId);
    return parent?.kind === 'agent' ? parent.name : '';
  }

  /** Same computation `<lr-handoff-divider>` performs internally for its own `aria-label`, reused
   *  here (not reimplemented with different wording) for this button's accessible name. */
  private handoffAccessibleLabel(span: LyraSpan, fromAgent: string): string {
    return fromAgent
      ? this.localize('handoffFromToAgent', undefined, { from: fromAgent, to: span.name })
      : this.localize('handoffToAgent', undefined, { agent: span.name });
  }

  private onVisibilityChange = (e: CustomEvent<LyraGraphLegendVisibilityDetail>): void => {
    e.stopPropagation();
    const version = this.sourceVersion;
    const source = this.treeSource;
    this.hiddenKinds = e.detail.hiddenTypes as LyraSpan['kind'][];
    if (!this.isConnected || this.sourceVersion !== version || this.treeSource !== source) return;
    this.emit('lr-span-visibility-change', { hiddenKinds: [...this.hiddenKinds] });
  };

  /** Keeps the composed legend's canonical cancelable proposal within this wrapper without
   * changing its default-prevented state. The child still owns the proposal, commit, and
   * announcement. */
  private onVisibilityChangeProposal = (event: Event): void => {
    event.stopPropagation();
  };

  /** Keeps `activeSpanId` (and therefore the handoff list's own highlighting) in sync when
   *  selection originates inside the composed `<lr-trace-tree>` rather than the handoff quick-jump
   *  list. The original event is never stopped here, so it still reaches a host listener on this
   *  element unchanged. */
  private onTreeSpanSelect = (e: CustomEvent<{ spanId: string }>): void => {
    if (!this.isConnected || e.currentTarget !== this.sourceTree || this.sourceTree.treeSource !== this.treeSource) return;
    this.activeSpanId = e.detail.spanId;
  };

  private selectSpan(id: string): void {
    if (this.treeSource !== undefined || !this.isConnected) return;
    this.activeSpanId = id;
    this.emit('lr-span-select', { spanId: id });
  }

  private renderFilter(spans: readonly LyraSpan[]): TemplateResult | typeof nothing {
    const version = this.sourceVersion;
    const hiddenKinds = this.hiddenKinds;
    const kinds = this.treeSource !== undefined ? KIND_ORDER : this.presentKinds(spans);
    if (kinds.length === 0) return nothing;
    const labels = kinds.map((kind) => this.localize(KIND_LABEL_KEY[kind]));
    const label = this.localize('agentTraceFilterLabel');
    if (version !== this.sourceVersion || hiddenKinds !== this.hiddenKinds) return nothing;
    if (this.legendKinds !== kinds || labels.some((label, index) => label !== this.legendLabels[index])) {
      this.legendKinds = kinds;
      this.legendLabels = labels;
      this.legendTypes = kinds.map((kind, index) => ({ id: kind, label: labels[index]! }));
    }
    const current = (event: Event) => this.isConnected && this.sourceVersion === version && this.hiddenKinds === hiddenKinds &&
      (event.currentTarget as Element | null)?.getRootNode() === this.renderRoot;
    return html`
      <lr-graph-legend
        part="filter"
        .label=${label}
        .types=${this.legendTypes}
        .hiddenTypes=${this.hiddenKinds}
        @lr-visibility-change-request=${(event: Event) => {
          this.onVisibilityChangeProposal(event); if (!current(event)) event.preventDefault();
        }}
        @lr-visibility-change=${(event: CustomEvent<LyraGraphLegendVisibilityDetail>) => {
          event.stopPropagation(); if (current(event)) this.onVisibilityChange(event);
        }}
      ></lr-graph-legend>
    `;
  }

  private renderHandoff(span: LyraSpan, byId: ReadonlyMap<string, LyraSpan>): TemplateResult {
    const version = this.sourceVersion;
    const spans = this.spans;
    const fromAgent = this.handoffFromAgent(span, byId);
    const isActive = this.activeSpanId === span.id;
    return html`
      <button
        part="handoff"
        type="button"
        aria-label=${this.handoffAccessibleLabel(span, fromAgent)}
        aria-current=${isActive ? 'true' : 'false'}
        ?data-active=${isActive}
        @click=${(event: Event) => {
          if (this.treeSource === undefined && this.sourceVersion === version && this.spans === spans &&
            (event.currentTarget as Element | null)?.getRootNode() === this.renderRoot) this.selectSpan(span.id);
        }}
      >
        <lr-handoff-divider aria-hidden="true" to-agent=${span.name} from-agent=${fromAgent}></lr-handoff-divider>
      </button>
    `;
  }

  private renderHandoffs(spans: readonly LyraSpan[], byId: ReadonlyMap<string, LyraSpan>): TemplateResult | typeof nothing {
    const handoffs = this.handoffSpans(spans);
    if (handoffs.length === 0) return nothing;
    return html`<div part="handoffs">${repeat(handoffs, (span) => span.id, (span) => this.renderHandoff(span, byId))}</div>`;
  }

  override render(): TemplateResult {
    const sourceMode = this.treeSource !== undefined;
    const projection = sourceMode ? undefined : this.projectedSpans();
    const filteredSpans = projection ? this.filteredSpans(projection.spans) : EMPTY_SPANS;
    this.sourceNotice = !!projection && !!publicCollectionTruncation(this, 'spans') && !projection.truncated;
    return html`
      <div part="base">
        ${this.renderFilter(projection?.spans ?? EMPTY_SPANS)} ${projection ? this.renderHandoffs(filteredSpans, projection.byId) : nothing}
        <lr-trace-tree
          part="tree"
          .maxNodes=${this.effectiveMaxNodes}
          .spans=${sourceMode ? EMPTY_SPANS : this.spans}
          .activeSpanId=${this.activeSpanId}
          .label=${this.label}
          .strings=${this.strings}
          ?with-tokens=${this.withTokens}
          ?with-cost=${this.withCost}
          ?without-bars=${this.withoutBars}
          @lr-span-select=${this.onTreeSpanSelect}
          ${ref(this.bindTree)}
        ></lr-trace-tree>
        ${this.sourceNotice ? html`<p part="limit" role="note">${this.limitMessage()}</p>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-agent-trace': LyraAgentTrace;
  }
}
