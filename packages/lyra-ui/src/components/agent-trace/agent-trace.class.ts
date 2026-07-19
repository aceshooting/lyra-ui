import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './agent-trace.styles.js';
// The registering barrels (not the bare *.class.js modules) -- this is what actually defines
// <lr-trace-tree>/<lr-graph-legend>/<lr-handoff-divider> as custom elements by the time this
// component's render() references them, regardless of whether a consumer imports this bare
// *.class.js module directly or the full agent-trace.js barrel. See this file's own regression
// test ("registers ... as a side effect of importing agent-trace.js") for why this matters.
import '../trace-tree/trace-tree.js';
import '../graph-legend/graph-legend.js';
import '../handoff-divider/handoff-divider.js';
import type { LyraSpan } from '../trace-tree/span.js';
import type { LyraGraphLegendType, LyraGraphLegendVisibilityDetail } from '../graph-legend/graph-legend.class.js';

export type { LyraSpan } from '../trace-tree/span.js';

/**
 * Canonical span-kind order for the filter legend and the "which kinds are present" scan --
 * matches `<lr-trace-tree>`'s own internal kind iteration order so a kind lands in the same
 * visual position across both components.
 */
const KIND_ORDER: LyraSpan['kind'][] = ['agent', 'llm', 'tool', 'retriever', 'embedding', 'other'];

/**
 * Maps each `LyraSpan.kind` onto the message key `<lr-trace-tree>`/`<lr-span-waterfall>` already
 * localize their own kind label through -- reused verbatim (not redefined with new wording) so a
 * translation registered for one of those components applies identically here. In the roadmap's
 * own vocabulary this component composes retrieval (`retriever` + `embedding`), tool (`tool`),
 * model (`llm`), and handoff (`agent`) spans; the filter itself operates one level more granular,
 * directly on `LyraSpan.kind`, so it never drifts from the exact field `<lr-trace-tree>` already
 * keys its own rendering off of.
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
  /** Bubbles, composed, from the composed `<lr-trace-tree>` (identical `{ id }` detail), or is
   *  fired directly when a handoff quick-jump entry is activated -- a host handles both origins
   *  through this one event. */
  'lr-span-select': CustomEvent<{ id: string }>;
  /** Bubbles, composed, from the composed `<lr-trace-tree>`, unchanged. */
  'lr-span-toggle': CustomEvent<{ id: string; expanded: boolean }>;
  /** Bubbles, composed, from the composed filter `<lr-graph-legend>`. Despite the property name
   *  (inherited verbatim from that component's own event contract), `hiddenTypes` here holds
   *  `LyraSpan['kind']` values, not graph node-type ids. */
  'lr-visibility-change': CustomEvent<LyraGraphLegendVisibilityDetail>;
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
 * handoff quick-jump entry -- update it and fire the identical `lr-span-select` `{ id }` shape, so
 * a host can encode the current span id in a URL and feed it straight back in.
 *
 * @customElement lr-agent-trace
 * @event lr-span-select - `detail: { id }` — a span was activated, from the tree or the handoff list.
 * @event lr-span-toggle - `detail: { id, expanded }` — a tree row was expanded or collapsed.
 * @event lr-visibility-change - `detail: { hiddenTypes }` — the span-kind filter changed; `hiddenTypes` holds `LyraSpan['kind']` values.
 * @csspart base - The root wrapper.
 * @csspart filter - The composed `<lr-graph-legend>` filter row, only rendered while `spans` has at least one span.
 * @csspart handoffs - The handoff quick-jump list wrapper, only rendered while at least one visible span has `kind: 'agent'`.
 * @csspart handoff - One handoff quick-jump entry (a `<button>` wrapping an `<lr-handoff-divider>`); carries `data-active`.
 * @csspart tree - The composed `<lr-trace-tree>`.
 */
export class LyraAgentTrace extends LyraElement<LyraAgentTraceEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The full, unfiltered span array -- identical contract to `<lr-trace-tree>.spans`. Controlled
   *  and never mutated by this component. */
  @property({ attribute: false }) spans: LyraSpan[] = [];

  /** Controlled selection, forwarded verbatim into the composed `<lr-trace-tree>`. Updated
   *  locally (and re-emitted as `lr-span-select`) whenever a span is activated from either the
   *  tree or the handoff quick-jump list, so a host can also treat it as a two-way binding. */
  @property({ attribute: 'active-span-id' }) activeSpanId: string | null = null;

  /** Span kinds currently hidden from the tree. Empty (the default) shows every kind. Controlled
   *  -- a host may pre-set this (e.g. to hide `retriever`/`embedding` spans by default) or read it
   *  back after `lr-visibility-change`. */
  @property({ attribute: false }) hiddenKinds: LyraSpan['kind'][] = [];

  /** Accessible name forwarded to the composed `<lr-trace-tree>`. See its own `label` property. */
  @property() label = '';

  /** Forwarded verbatim to the composed `<lr-trace-tree>`. */
  @property({ type: Boolean, attribute: 'show-tokens' }) showTokens = false;

  /** Forwarded verbatim to the composed `<lr-trace-tree>`. */
  @property({ type: Boolean, attribute: 'show-cost' }) showCost = false;

  /** Forwarded verbatim to the composed `<lr-trace-tree>`. */
  @property({ type: Boolean, attribute: 'hide-bars' }) hideBars = false;

  private presentKinds(): LyraSpan['kind'][] {
    const present = new Set(this.spans.map((s) => s.kind));
    return KIND_ORDER.filter((k) => present.has(k));
  }

  private get filteredSpans(): LyraSpan[] {
    return this.hiddenKinds.length === 0 ? this.spans : this.spans.filter((s) => !this.hiddenKinds.includes(s.kind));
  }

  private handoffSpans(): LyraSpan[] {
    return this.filteredSpans.filter((s) => s.kind === 'agent');
  }

  /** The handed-off-from agent's name, resolved against the full (unfiltered) `spans` array so a
   *  hidden/filtered-out parent's name still renders -- empty when `parentId` is unset or
   *  unresolvable, mirroring `<lr-handoff-divider>`'s own "from is optional" contract. */
  private handoffFromAgent(span: LyraSpan): string {
    if (!span.parentId) return '';
    return this.spans.find((s) => s.id === span.parentId)?.name ?? '';
  }

  /** Same computation `<lr-handoff-divider>` performs internally for its own `aria-label`, reused
   *  here (not reimplemented with different wording) for this button's accessible name. */
  private handoffAccessibleLabel(span: LyraSpan, fromAgent: string): string {
    return fromAgent
      ? this.localize('handoffFromToAgent', undefined, { from: fromAgent, to: span.name })
      : this.localize('handoffToAgent', undefined, { agent: span.name });
  }

  private onVisibilityChange = (e: CustomEvent<LyraGraphLegendVisibilityDetail>): void => {
    this.hiddenKinds = e.detail.hiddenTypes as LyraSpan['kind'][];
  };

  /** Keeps `activeSpanId` (and therefore the handoff list's own highlighting) in sync when
   *  selection originates inside the composed `<lr-trace-tree>` rather than the handoff quick-jump
   *  list. The original event is never stopped here, so it still reaches a host listener on this
   *  element unchanged. */
  private onTreeSpanSelect = (e: CustomEvent<{ id: string }>): void => {
    this.activeSpanId = e.detail.id;
  };

  private selectSpan(id: string): void {
    this.activeSpanId = id;
    this.emit('lr-span-select', { id });
  }

  private renderFilter(): TemplateResult | typeof nothing {
    const kinds = this.presentKinds();
    if (kinds.length === 0) return nothing;
    const types: LyraGraphLegendType[] = kinds.map((k) => ({ id: k, label: this.localize(KIND_LABEL_KEY[k]) }));
    // <lr-graph-legend> keeps its own default accessible name (its localized "Graph legend"
    // string) rather than a component-specific override here -- every visible label a user
    // actually reads (each item's own kind name) is already correct and localized via `types`
    // above; only the outer group's landmark name is generic.
    return html`
      <lr-graph-legend
        part="filter"
        .types=${types}
        .hiddenTypes=${this.hiddenKinds}
        @lr-visibility-change=${this.onVisibilityChange}
      ></lr-graph-legend>
    `;
  }

  private renderHandoff(span: LyraSpan): TemplateResult {
    const fromAgent = this.handoffFromAgent(span);
    const isActive = this.activeSpanId === span.id;
    return html`
      <button
        part="handoff"
        type="button"
        aria-label=${this.handoffAccessibleLabel(span, fromAgent)}
        aria-current=${isActive ? 'true' : nothing}
        ?data-active=${isActive}
        @click=${() => this.selectSpan(span.id)}
      >
        <lr-handoff-divider aria-hidden="true" agent=${span.name} from-agent=${fromAgent}></lr-handoff-divider>
      </button>
    `;
  }

  private renderHandoffs(): TemplateResult | typeof nothing {
    const handoffs = this.handoffSpans();
    if (handoffs.length === 0) return nothing;
    return html`<div part="handoffs">${handoffs.map((span) => this.renderHandoff(span))}</div>`;
  }

  render(): TemplateResult {
    return html`
      <div part="base">
        ${this.renderFilter()} ${this.renderHandoffs()}
        <lr-trace-tree
          part="tree"
          .spans=${this.filteredSpans}
          .activeSpanId=${this.activeSpanId}
          .label=${this.label}
          ?show-tokens=${this.showTokens}
          ?show-cost=${this.showCost}
          ?hide-bars=${this.hideBars}
          @lr-span-select=${this.onTreeSpanSelect}
        ></lr-trace-tree>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-agent-trace': LyraAgentTrace;
  }
}
