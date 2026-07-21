import { html, nothing, type TemplateResult, type ComplexAttributeConverter } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { DocumentRef } from '../../../ai/types.js';
import type { LyraEntity } from '../../retrieval/entity-card/entity-card.class.js';
import { styles } from './drilldown-panel.styles.js';
import '../breadcrumb/breadcrumb.class.js';
import '../breadcrumb/breadcrumb-item.class.js';
import '../tabs/tabs.class.js';
import '../../viewers/document-preview/document-preview.class.js';
import '../../retrieval/entity-card/entity-card.class.js';
import '../../retrieval/source-card/source-card.class.js';
import '../../overlays/empty/empty.class.js';

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Duplicated locally rather than imported,
 *  matching this exact converter's repeated per-component convention elsewhere in this library
 *  (see e.g. `<lr-agent-run>`'s own `trueDefaultBooleanConverter`). */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

/** The exact `lr-graph.nodeTypes` entry shape -- see `lr-entity-card`'s, `lr-provenance-panel`'s,
 *  and `lr-entity-dossier`'s identical local aliases for why this isn't imported from `lr-graph`
 *  itself. Shared verbatim here since it's forwarded to `lr-entity-card` below with no mapping. */
type NodeTypeStyle = { id: string; label: string; color?: string; shape?: 'circle' | 'square' | 'diamond' };

/**
 * One "evidence" item in a drilldown node -- a citation/source excerpt. Field names deliberately
 * mirror `lr-source-card`'s own `source-id`/`title`/`page`/`href` properties and `excerpt`/`full`
 * slots field-for-field, so an item composes directly into a card with no transform.
 */
export interface DrilldownEvidenceItem {
  id: string;
  title: string;
  page?: string | number;
  href?: string;
  /** Rendered into the card's always-visible `excerpt` slot. */
  excerpt?: string;
  /** Rendered into the card's collapsible `full` slot. Omitted entirely when unset, matching
   *  `lr-source-card`'s own "no toggle when there's no full slot content" behavior. */
  full?: string;
}

/**
 * One level of a drilldown path: the datum that was drilled into, plus whatever related content
 * is available for it, grouped into up to three data-driven categories -- evidence (rendered via
 * `lr-source-card`), documents (rendered via `lr-document-preview`, `DocumentRef` reused verbatim
 * from `src/ai/types.ts` since its `name`/`mimeType` fields already match that component's own
 * `filename`/`mime-type` field-for-field), and entities (rendered via `lr-entity-card`, `LyraEntity`
 * reused verbatim from that component). A fourth category, agent runs, has no dedicated
 * "render one run" primitive yet in this library -- see the `runs` slot on `<lr-drilldown-panel>`
 * itself, which every node currently shares (see the class doc's "Agent runs" section).
 */
export interface DrilldownNode {
  id: string;
  /** Breadcrumb label for this level. */
  label: string;
  evidence?: DrilldownEvidenceItem[];
  documents?: DocumentRef[];
  entities?: LyraEntity[];
}

/** `detail` for `lr-drilldown-navigate`. */
export interface DrilldownNavigateDetail {
  id: string;
  index: number;
}

export interface LyraDrilldownPanelEventMap {
  'lr-drilldown-navigate': CustomEvent<DrilldownNavigateDetail>;
}

/** One resolved tab/category ready to render, or (when only one category has content) the sole
 *  category rendered directly with no `lr-tabs` chrome around it. */
interface DrilldownCategory {
  key: 'evidence' | 'documents' | 'entities' | 'runs';
  label: string;
  content: TemplateResult;
}

/**
 * `<lr-drilldown-panel>` — controlled navigation from a chart/table datum to its related evidence,
 * documents, entities, or agent runs. This is a navigation *shell*: it never re-renders any of that
 * content itself, only a breadcrumb trail (`lr-breadcrumb`) over `path` plus, for whichever
 * categories the current (last) node actually has content for, the one existing primitive that
 * already renders that content type (`lr-source-card` for evidence, `lr-document-preview` for
 * documents, `lr-entity-card` for entities) -- wrapped in an `lr-tabs` strip only when more than one
 * category has content, so a single-category node renders that category directly with no tab
 * chrome.
 *
 * Controlled, like every other Lyra component: `path` is the full breadcrumb trail (oldest first,
 * current node last) and is owned entirely by the host. Activating a *non-current* breadcrumb step
 * fires `lr-drilldown-navigate` with that step's `id`/`index` — this component never mutates `path`
 * itself; a listener typically responds with `this.path = this.path.slice(0, e.detail.index + 1)`
 * (truncate back to that level) or replaces `path` outright with newly fetched levels. An empty
 * `path` renders the shared `lr-empty` "no selection" state; a non-empty `path` whose current node
 * has no content in any category renders the shared `lr-empty` `noData` state instead.
 *
 * **Agent runs.** Unlike evidence/documents/entities, this library has no existing "render one
 * agent run" primitive yet (a future orchestration-level component, not part of this layer, is the
 * natural home for that once it exists) — so, rather than inventing bespoke run-rendering here, the
 * `runs` slot is this component's escape hatch: whatever a host projects into it renders as the
 * "Agent runs" category tab (shown only while the slot actually has assigned content), exactly the
 * same tradeoff `<lr-document-preview>`'s own `unsupported` slot makes. Because slot content is
 * ordinary light DOM, not part of the `path` data model, a host drilling into different agent-run
 * content per level re-projects new content into the slot whenever the current node changes — the
 * same thing a `<lr-document-preview>` consumer already does for its `unsupported` slot.
 *
 * @customElement lr-drilldown-panel
 * @slot runs - Host-rendered agent-run content for the current node's "Agent runs" category — see
 *   the class doc's "Agent runs" section. The category (and its tab, once more than one category is
 *   present) only appears while this slot has assigned content.
 * @event lr-drilldown-navigate - A non-current breadcrumb step was activated. `detail: { id, index }`.
 * @csspart base - The root wrapper.
 * @csspart breadcrumb - The nested `lr-breadcrumb` trail, hidden entirely while `path` is empty.
 * @csspart breadcrumb-item - One nested `lr-breadcrumb-item`.
 * @csspart breadcrumb-button - The clickable label of a non-current breadcrumb step.
 * @csspart content - The wrapper around the current node's category content (or an empty state).
 * @csspart tabs - The nested `lr-tabs` strip, only rendered when the current node has content in
 *   more than one category.
 * @csspart category - The wrapper around one category's rendered items — used both as the sole
 *   direct child of `content` (single-category node) and inside each `lr-tabs` panel (multi-category
 *   node).
 * @csspart evidence-item - One nested `lr-source-card`.
 * @csspart document-item - One nested `lr-document-preview`.
 * @csspart entity-item - One nested `lr-entity-card`.
 * @csspart empty - The empty state, shown when `path` is empty or the current node has no content
 *   in any category.
 */
export class LyraDrilldownPanel extends LyraElement<LyraDrilldownPanelEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The full breadcrumb trail, oldest first, current node last. Host-owned — see the class doc. */
  @property({ attribute: false }) path: DrilldownNode[] = [];

  /** `lr-graph.nodeTypes` pass-through, forwarded to every nested `lr-entity-card` so each
   *  entity's type badge resolves identically to however a paired graph view resolves it. */
  @property({ attribute: false }) types: NodeTypeStyle[] = [];

  /** Forwarded to every nested `lr-entity-card`'s own `communityLabel`. */
  @property({ attribute: 'community-label' }) communityLabel = '';

  /** Forwarded to every nested `lr-entity-card`'s own `showFocusButton`. */
  @property({ type: Boolean, attribute: 'show-focus-button', converter: trueDefaultBooleanConverter })
  showFocusButton = true;

  /** Accessible name forwarded to the internal `lr-tabs` strip (only rendered while the current
   *  node has more than one populated category). Unset, the tab strip renders without an
   *  `aria-label`, matching `lr-tabs`' own unset-default behavior. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  // Tracked in JS, not via CSS `:empty` (a `[part]` always contains a literal `<slot>` child
  // regardless of assigned content, so `:empty` never matches) -- same presence-tracking
  // convention as `<lr-source-card>`'s `hasFullSlot`/`hasExcerptSlot`. Recomputed from the light
  // DOM directly (not from `slotchange`) via a `MutationObserver`, the same technique `<lr-tabs>`
  // uses for its own child-driven tab set: unlike `<lr-document-preview>`'s `unsupported` slot
  // (whose containing branch is already reachable independently of slot occupancy, so slotchange
  // alone suffices), whether the `runs` slot even gets rendered here depends on this state itself
  // -- a `slotchange` listener on a `<slot>` that doesn't exist yet until *after* this flips true
  // would never observe the very mutation that should flip it.
  @state() private hasRunsSlot = false;

  private mutationObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncRunsSlot();
    this.mutationObserver = new MutationObserver(this.syncRunsSlot);
    this.mutationObserver.observe(this, { childList: true, attributes: true, attributeFilter: ['slot'] });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
  }

  private syncRunsSlot = (): void => {
    this.hasRunsSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'runs');
  };

  private get currentNode(): DrilldownNode | undefined {
    return this.path[this.path.length - 1];
  }

  private navigateTo(node: DrilldownNode, index: number): void {
    this.emit<DrilldownNavigateDetail>('lr-drilldown-navigate', { id: node.id, index });
  }

  private renderEvidence(items: DrilldownEvidenceItem[]): TemplateResult {
    return html`${repeat(
      items,
      (item) => item.id,
      (item) => html`
        <lr-source-card
          part="evidence-item"
          source-id=${item.id}
          title=${item.title}
          .page=${item.page}
          href=${item.href ?? nothing}
        >
          ${item.excerpt ? html`<span slot="excerpt">${item.excerpt}</span>` : nothing}
          ${item.full ? html`<span slot="full">${item.full}</span>` : nothing}
        </lr-source-card>
      `,
    )}`;
  }

  private renderDocuments(docs: DocumentRef[]): TemplateResult {
    return html`${repeat(
      docs,
      (doc) => doc.id,
      (doc) => html`
        <lr-document-preview
          part="document-item"
          src=${doc.uri ?? ''}
          mime-type=${doc.mimeType ?? ''}
          filename=${doc.name}
        ></lr-document-preview>
      `,
    )}`;
  }

  private renderEntities(entities: LyraEntity[]): TemplateResult {
    return html`${repeat(
      entities,
      (entity) => entity.id,
      (entity) => html`
        <lr-entity-card
          part="entity-item"
          .entity=${entity}
          .types=${this.types}
          .communityLabel=${this.communityLabel}
          .showFocusButton=${this.showFocusButton}
        ></lr-entity-card>
      `,
    )}`;
  }

  private categoriesFor(node: DrilldownNode): DrilldownCategory[] {
    const categories: DrilldownCategory[] = [];
    const evidence = node.evidence ?? [];
    const documents = node.documents ?? [];
    const entities = node.entities ?? [];
    if (evidence.length > 0) {
      categories.push({ key: 'evidence', label: this.localize('sourceListDefaultLabel'), content: this.renderEvidence(evidence) });
    }
    if (documents.length > 0) {
      categories.push({ key: 'documents', label: this.localize('drilldownDocuments'), content: this.renderDocuments(documents) });
    }
    if (entities.length > 0) {
      categories.push({ key: 'entities', label: this.localize('provenanceEntities'), content: this.renderEntities(entities) });
    }
    if (this.hasRunsSlot) {
      categories.push({
        key: 'runs',
        label: this.localize('drilldownRuns'),
        content: html`<slot name="runs"></slot>`,
      });
    }
    return categories;
  }

  private renderBreadcrumb(): TemplateResult | typeof nothing {
    if (this.path.length === 0) return nothing;
    const lastIndex = this.path.length - 1;
    return html`
      <lr-breadcrumb part="breadcrumb">
        ${repeat(
          this.path,
          (node) => node.id,
          (node, index) => {
            const isCurrent = index === lastIndex;
            return html`<lr-breadcrumb-item part="breadcrumb-item" ?current=${isCurrent}>
              ${isCurrent
                ? node.label
                : html`<button
                    type="button"
                    part="breadcrumb-button"
                    @click=${() => this.navigateTo(node, index)}
                  >${node.label}</button>`}
            </lr-breadcrumb-item>`;
          },
        )}
      </lr-breadcrumb>
    `;
  }

  private renderContent(): TemplateResult {
    const node = this.currentNode;
    if (!node) {
      return html`<lr-empty part="empty" heading=${this.localize('drilldownEmpty')}></lr-empty>`;
    }
    const categories = this.categoriesFor(node);
    if (categories.length === 0) {
      return html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`;
    }
    if (categories.length === 1) {
      const only = categories[0]!; // safe: categories.length === 1 checked above
      return html`<div part="category" role="region" aria-label=${only.label}>${only.content}</div>`;
    }
    return html`
      <lr-tabs part="tabs" aria-label=${this.accessibleLabel || nothing}>
        ${repeat(
          categories,
          (category) => category.key,
          (category) => html`<div slot=${category.key} label=${category.label} part="category">${category.content}</div>`,
        )}
      </lr-tabs>
    `;
  }

  override render(): TemplateResult {
    return html`
      <div part="base">
        ${this.renderBreadcrumb()}
        <div part="content">${this.renderContent()}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-drilldown-panel': LyraDrilldownPanel;
  }
}
