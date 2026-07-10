import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { css } from 'lit';
import type { TreeItem } from './tree.js';

const styles = css`
  :host {
    display: block;
  }
  [part='row'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    padding-inline-start: calc(var(--lyra-space-s) + var(--lyra-tree-depth, 0) * 1rem);
    cursor: pointer;
    border-radius: var(--lyra-radius);
  }
  [part='row']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='toggle'] {
    inline-size: 1rem;
    block-size: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
    flex: 0 0 auto;
  }
  [part='toggle']:empty {
    visibility: hidden;
  }
  [part='label'] {
    flex: 1 1 auto;
  }
  [part='badge'] {
    font-size: 0.75rem;
    color: var(--lyra-color-text-quiet);
    background: var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: 0 0.35rem;
  }
`;

/**
 * `<lyra-tree-node>` — internal recursive renderer for `<lyra-tree>`. Each
 * instance owns its own `expanded` state, so toggling one node never
 * re-renders siblings/ancestors (a separate custom element per node makes
 * this free with Lit's own update scheduling).
 *
 * @customElement lyra-tree-node
 * @csspart row, toggle, label, badge
 */
export class LyraTreeNode extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) item!: TreeItem;
  @property({ type: Number }) depth = 0;
  @property({ type: Boolean, reflect: true }) expanded = false;

  private get hasChildren(): boolean {
    return Boolean(this.item.children?.length);
  }

  private toggle(): void {
    if (!this.hasChildren) return;
    this.expanded = !this.expanded;
    this.emit('lyra-node-toggle', { id: this.item.id, expanded: this.expanded });
  }

  private select(): void {
    this.emit('lyra-node-select', { id: this.item.id });
  }

  render(): TemplateResult {
    return html`
      <div part="row" style=${`--lyra-tree-depth:${this.depth}`} role="treeitem" aria-expanded=${
        this.hasChildren ? String(this.expanded) : nothing
      }>
        <button
          part="toggle"
          type="button"
          tabindex=${this.hasChildren ? nothing : '-1'}
          aria-hidden=${this.hasChildren ? nothing : 'true'}
          @click=${(e: Event) => {
            e.stopPropagation();
            this.toggle();
          }}
        >
          ${this.hasChildren ? (this.expanded ? '▾' : '▸') : ''}
        </button>
        <span part="label" @click=${() => this.select()}>${this.item.label}</span>
        ${this.item.badge != null ? html`<span part="badge">${this.item.badge}</span>` : nothing}
      </div>
      ${this.expanded && this.hasChildren
        ? html`<div role="group">
            ${this.item.children!.map(
              (child) => html`<lyra-tree-node .item=${child} .depth=${this.depth + 1}></lyra-tree-node>`,
            )}
          </div>`
        : nothing}
    `;
  }
}

defineElement('tree-node', LyraTreeNode);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-tree-node': LyraTreeNode;
  }
}
