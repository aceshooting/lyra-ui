import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { isRtl } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import type { LyraEntity } from '../entity-card/entity-card.class.js';
import '../../layout/scroller/scroller.class.js';
import { styles } from './path-strip.styles.js';

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
 */
export class LyraPathStrip extends LyraElement<LyraPathStripEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  /** Rendered in array order; alternation is the intended shape but not enforced. */
  @property({ attribute: false }) path: LyraPathElement[] = [];
  /** Accessible name; falls back to the localized `pathStripLabel`. */
  @property() label = '';

  @state() private activeIndex = 0;
  @state() private liveText = '';

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
    this.liveText =
      el?.kind === 'node'
        ? this.localize('pathNodeStatus', undefined, { label: el.node.label || el.node.id, position: index + 1, total })
        : el
          ? this.localize('pathRelationStatus', undefined, { relation: el.relation })
          : '';
  }

  private focusIndex(index: number): void {
    this.activeIndex = index;
    void this.updateComplete.then(() => {
      const controls = this.renderRoot.querySelectorAll('[part="node"], [part="relation"]');
      const el = controls[index] as HTMLElement | undefined;
      el?.focus();
      el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', inline: 'nearest', block: 'nearest' });
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

  render(): TemplateResult {
    if (this.path.length === 0) {
      return html`<div part="base"><div part="empty">${this.localize('noData')}</div></div>`;
    }
    const label = this.label || this.localize('pathStripLabel');
    return html`
      <div part="base" @keydown=${this.onKeyDown}>
        <lr-scroller orientation="horizontal" controls label=${label}>
          ${this.path.map((el, i) => (el.kind === 'node' ? this.renderNode(el.node, i) : this.renderEdge(el, i)))}
        </lr-scroller>
        <div class="sr-only" role="status" aria-live="polite">${this.liveText}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-path-strip': LyraPathStrip;
  }
}
