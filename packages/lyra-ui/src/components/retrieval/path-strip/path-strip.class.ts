import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { isRtl } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import '../../layout/scroller/scroller.class.js';
import { styles } from './path-strip.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_pathNodeStatus, LYRA_DEFAULT_pathRelationStatus, LYRA_DEFAULT_pathStripLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraPathElement =
  | { kind: 'node'; node: LyraEntity }
  | { kind: 'edge'; relation: string; directed?: boolean; reverse?: boolean };

export interface LyraPathStripEventMap {
  'lr-entity-activate': CustomEvent<{ id: string }>;
  'lr-relation-activate': CustomEvent<{ relation: string; sourceId?: string; targetId?: string }>;
}

/**
 * `<lr-path-strip>` — a linear node -> relation -> node chain rendering "why A connects to B"
 * (GraphRAG local-search reasoning paths) as a compact, horizontally scrollable strip.
 * One-dimensional and presentational: no path finding, no branching, no per-element popovers.
 *
 * @customElement lr-path-strip
 * @event lr-entity-activate - A node element activated. `detail: { id }`.
 * @event lr-relation-activate - An edge element activated. `detail: { relation, sourceId?,
 * targetId? }` — source/target resolved from the adjacent node elements, `undefined` when the
 * path is malformed at that position.
 * @csspart base - The root wrapper, hosting the delegated roving-tabindex keydown handler.
 * @csspart node - One `node`-kind element (a `<button>`).
 * @csspart relation - One `edge`-kind element's relation label (a `<button>`).
 * @csspart arrow - The `aria-hidden` directed-edge arrow glyph, logical (mirrors under RTL).
 * @csspart empty - The empty-state message, shown when `path` is empty.
 * @status stable
 * @since 4.0.0
 */
export class LyraPathStrip extends LyraElement<LyraPathStripEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    pathNodeStatus: LYRA_DEFAULT_pathNodeStatus,
    pathRelationStatus: LYRA_DEFAULT_pathRelationStatus,
    pathStripLabel: LYRA_DEFAULT_pathStripLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** Rendered in array order; alternation is the intended shape but not enforced. */
  @property({ attribute: false }) path: LyraPathElement[] = [];
  /** Accessible-name fallback when the host has no `aria-label`; otherwise falls back to the
   *  localized `pathStripLabel`. */
  @property() label = '';

  @state() private activeIndex = 0;
  @state() private liveText = '';
  private restoreFocusAfterPathChange = false;
  private announcementSink?: AnnouncementSink;

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!changed.has('path')) return;
    this.restoreFocusAfterPathChange = activeElementIn(this.shadowRoot)?.matches(
      '[part="node"], [part="relation"]',
    ) ?? false;
    this.activeIndex = Math.min(this.activeIndex, Math.max(0, this.path.length - 1));
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (!changed.has('path') || !this.restoreFocusAfterPathChange) return;
    this.restoreFocusAfterPathChange = false;
    // Focusing dispatches the control's focus handler, which updates the live-region text.
    // Run it after this update completes so that reactive announcement does not schedule another
    // update from inside updated() and trigger Lit's change-in-update warning.
    this.scheduleAfterUpdate(() => {
      if (this.path.length === 0) {
        this.shadowRoot?.querySelector<HTMLElement>('[part="base"]')?.focus();
        return;
      }
      const controls = this.shadowRoot?.querySelectorAll<HTMLElement>('[part="node"], [part="relation"]');
      controls?.[this.activeIndex]?.focus();
    }, 'restore-path-focus');
  }

  private activate(index: number): void {
    const el = this.path[index];
    if (!el) return;
    if (el.kind === 'node') {
      this.emit('lr-entity-activate', { id: el.node.id });
      return;
    }
    const source = this.path[index - 1];
    const target = this.path[index + 1];
    this.emit('lr-relation-activate', {
      relation: el.relation,
      sourceId: source?.kind === 'node' ? source.node.id : undefined,
      targetId: target?.kind === 'node' ? target.node.id : undefined,
    });
  }

  private onElementFocus(index: number): void {
    this.activeIndex = index;
    const el = this.path[index];
    const total = this.path.length;
    const numberFormat = getNumberFormat(this.effectiveLocale);
    this.liveText =
      el?.kind === 'node'
        ? this.localize('pathNodeStatus', undefined, {
            label: el.node.label || el.node.id,
            position: numberFormat.format(index + 1),
            total: numberFormat.format(total),
          })
        : el
          ? this.localize('pathRelationStatus', undefined, { relation: el.relation })
          : '';
    this.announcementSink?.announce(this.liveText);
  }

  private focusIndex(index: number): void {
    this.activeIndex = index;
    void this.updateComplete.then(() => {
      const controls = this.renderRoot.querySelectorAll('[part="node"], [part="relation"]');
      const el = controls[index] as HTMLElement | undefined;
      el?.focus();
      if (el) {
        const ownerWindow = el.ownerDocument.defaultView;
        const reducedMotion = !ownerWindow || prefersReducedMotion(ownerWindow);
        el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', inline: 'nearest', block: 'nearest' });
      }
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const count = this.path.length;
    if (count === 0) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activate(this.activeIndex);
      return;
    }
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = this.activeIndex;
    if (e.key === forwardKey) next = Math.min(count - 1, this.activeIndex + 1);
    else if (e.key === backwardKey) next = Math.max(0, this.activeIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else return;
    e.preventDefault();
    this.focusIndex(next);
  };

  private renderNode(node: LyraEntity, index: number): TemplateResult {
    return html`<button
      part="node"
      type="button"
      tabindex=${this.activeIndex === index ? '0' : '-1'}
      @click=${() => {
        this.activeIndex = index;
        this.activate(index);
      }}
      @focus=${() => this.onElementFocus(index)}
    >
      ${node.label || node.id}
    </button>`;
  }

  private renderEdge(el: Extract<LyraPathElement, { kind: 'edge' }>, index: number): TemplateResult {
    const rtl = isRtl(this);
    const glyph = el.directed ? (el.reverse ? (rtl ? '→' : '←') : rtl ? '←' : '→') : '';
    return html`<span class="element-group">
      ${glyph ? html`<span part="arrow" aria-hidden="true">${glyph}</span>` : nothing}
      <button
        part="relation"
        type="button"
        tabindex=${this.activeIndex === index ? '0' : '-1'}
        @click=${() => {
          this.activeIndex = index;
          this.activate(index);
        }}
        @focus=${() => this.onElementFocus(index)}
      >
        ${el.relation}
      </button>
    </span>`;
  }

  override render(): TemplateResult {
    if (this.path.length === 0) {
      return html`<div part="base" tabindex="-1"><div part="empty">${this.localize('noData')}</div></div>`;
    }
    const label =
      this.getAttribute('aria-label') || this.label || this.localize('pathStripLabel');
    return html`
      <div part="base" @keydown=${this.onKeyDown}>
        <lr-scroller orientation="horizontal" controls label=${label}>
          ${this.path.map((el, i) => (el.kind === 'node' ? this.renderNode(el.node, i) : this.renderEdge(el, i)))}
        </lr-scroller>
        <div class="sr-only" aria-hidden="true">${this.liveText}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-path-strip': LyraPathStrip;
  }
}
