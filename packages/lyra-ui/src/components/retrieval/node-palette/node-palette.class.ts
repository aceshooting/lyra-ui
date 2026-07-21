import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { Announcer } from '../../../internal/announcer.js';
import { FLOW_PALETTE_MIME_TYPE } from '../../data/flow-canvas/flow-canvas.class.js';
import { styles } from './node-palette.styles.js';

export interface PaletteItem {
  /** The `FlowNode.type` a placement/drop creates. */
  type: string;
  label: string;
  description?: string;
  /** Items group under localized-by-host category headings, in first-appearance array order. */
  category?: string;
  keywords?: string[];
  /** Optional TemplateResult glyph (`TreeItem.icon` precedent). */
  icon?: unknown;
  /** Visible but not draggable/placeable. */
  disabled?: boolean;
}

export interface LyraNodePaletteEventMap {
  'lr-palette-place': CustomEvent<{ type: string }>;
  'lr-select': CustomEvent<{ item: PaletteItem }>;
}

/**
 * `<lr-node-palette>` — the searchable, categorized node library for workflow editors: drag an
 * item onto a canvas, or place it by keyboard. Never creates nodes or touches a canvas's data
 * itself — the drop/place handshake ends at `lr-node-add`/`lr-palette-place`; the host mutates
 * `nodes`. Fully decoupled from `lr-flow-canvas` (no `for` resolution, unlike
 * `lr-flow-minimap`/`lr-flow-controls`/`lr-flow-run-overlay`) — it only needs to agree with a
 * `droppable` canvas on the `FLOW_PALETTE_MIME_TYPE` drag payload shape.
 *
 * @customElement lr-node-palette
 * @slot header - Content above the search field (e.g. a heading or tabs).
 * @slot footer - Content below the list.
 * @event lr-palette-place - An item was placed (pointer click or Enter/Space — the click/keyboard
 *   alternative to dragging). `detail: { type }`.
 * @event lr-select - Emitted alongside `lr-palette-place` on both gestures, carrying the full
 *   item. `detail: { item }`.
 * @event focus - Re-dispatched when the internal search field gains focus.
 * @event blur - Re-dispatched when the internal search field loses focus.
 * @csspart base - The root wrapper.
 * @csspart search - The search input.
 * @csspart list - The listbox.
 * @csspart group-header - A category heading (`role="presentation"`).
 * @csspart item - A single option row.
 * @csspart item-icon - An item's icon wrapper.
 * @csspart item-label - An item's label text.
 * @csspart item-description - An item's description text.
 * @csspart empty - The no-results message.
 * @csspart live-region - The result-count announcement.
 */
export class LyraNodePalette extends LyraElement<LyraNodePaletteEventMap> {
  static override styles = [LyraElement.styles, styles, srOnly];

  @property({ attribute: false }) items: PaletteItem[] = [];
  @property() label = '';
  /** Overrides the listbox's computed accessible name. Wins over `label` and the localized
   *  default. Attribute-reflects from a host-level `aria-label` so a plain-markup consumer gets
   *  ARIA-name forwarding without setting a JS property. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private queryText = '';
  @state() private activeIndex = 0;
  @state() private liveText = '';

  private readonly listId = nextId('node-palette-list');
  private readonly hintId = nextId('node-palette-hint');
  private readonly announcer = new Announcer({ onFlush: (text) => (this.liveText = text) });
  /** Gates the item-count announcement so a freshly-mounted palette (or one that receives its
   *  initial `items` before/at connect) never announces its own starting count -- mirrors
   *  `<lr-chat-message>`/`<lr-branch-picker>`'s identical `isMounting` gate. */
  private isMounting = true;

  private get filtered(): PaletteItem[] {
    const q = this.queryText.trim().toLocaleLowerCase(this.effectiveLocale);
    if (!q) return this.items;
    return this.items.filter((item) =>
      [item.label, item.category ?? '', ...(item.keywords ?? [])]
        .join(' ')
        .toLocaleLowerCase(this.effectiveLocale)
        .includes(q),
    );
  }

  private categorized(): { category: string | null; items: PaletteItem[] }[] {
    const groups = new Map<string | null, PaletteItem[]>();
    for (const item of this.filtered) {
      const key = item.category ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups, ([category, groupItems]) => ({ category, items: groupItems }));
  }

  private rovingList(): PaletteItem[] {
    return this.filtered.filter((i) => !i.disabled);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (!wasMounting && (changed.has('queryText') || changed.has('items'))) {
      const count = this.filtered.length;
      this.announcer.announce(`${count} ${count === 1 ? this.localize('item') : this.localize('items')}`);
    }
  }

  private onSearchInput = (e: Event): void => {
    this.queryText = (e.target as HTMLInputElement).value;
    this.activeIndex = 0;
  };

  // Native focus/blur neither bubble nor cross the shadow boundary, so a host listening for
  // focus/blur directly on <lr-node-palette> (e.g. to highlight the field as active) would never
  // hear about the internal search field without this bridge.
  private onSearchFocus = (): void => {
    this.emit('focus');
  };

  private onSearchBlur = (): void => {
    this.emit('blur');
  };

  private onFieldKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.rovingList().length === 0) return;
      this.activeIndex = 0;
      this.focusItem(0);
    }
  };

  private focusItem(index: number): void {
    void this.updateComplete.then(() => {
      const els = Array.from(this.renderRoot.querySelectorAll('[part="item"]')) as HTMLElement[];
      els[index]?.focus();
    });
  }

  private onItemKeyDown(e: KeyboardEvent, rovingIndex: number, item: PaletteItem): void {
    const list = this.rovingList();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex = Math.min(list.length - 1, rovingIndex + 1);
      this.focusItem(this.activeIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rovingIndex === 0) {
        (this.renderRoot.querySelector('input') as HTMLInputElement | null)?.focus();
        return;
      }
      this.activeIndex = Math.max(0, rovingIndex - 1);
      this.focusItem(this.activeIndex);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.activeIndex = 0;
      this.focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      this.activeIndex = list.length - 1;
      this.focusItem(this.activeIndex);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.place(item);
    }
  }

  private place(item: PaletteItem): void {
    if (item.disabled) return;
    this.emit('lr-palette-place', { type: item.type });
    this.emit('lr-select', { item });
  }

  private onItemDragStart(e: DragEvent, item: PaletteItem): void {
    if (item.disabled || !e.dataTransfer) return;
    e.dataTransfer.setData(FLOW_PALETTE_MIME_TYPE, JSON.stringify({ type: item.type }));
    e.dataTransfer.setData('text/plain', item.label);
    e.dataTransfer.effectAllowed = 'copy';
  }

  private itemTemplate(item: PaletteItem, rovingIndex: number): TemplateResult {
    return html`<div
      part="item"
      role="option"
      aria-selected="false"
      aria-disabled=${item.disabled ? 'true' : 'false'}
      aria-describedby=${this.hintId}
      tabindex=${rovingIndex === this.activeIndex && !item.disabled ? '0' : '-1'}
      draggable=${item.disabled ? 'false' : 'true'}
      @click=${() => this.place(item)}
      @keydown=${(e: KeyboardEvent) => this.onItemKeyDown(e, rovingIndex, item)}
      @dragstart=${(e: DragEvent) => this.onItemDragStart(e, item)}
    >
      ${item.icon ? html`<span part="item-icon">${item.icon as TemplateResult}</span>` : nothing}
      <span part="item-label">${item.label}</span>
      ${item.description ? html`<span part="item-description">${item.description}</span>` : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    const groups = this.categorized();
    const rovingList = this.rovingList();
    return html`<div part="base">
      <slot name="header"></slot>
      <input
        part="search"
        type="search"
        aria-label=${this.localize('search')}
        aria-controls=${this.listId}
        placeholder=${this.localize('nodePalettePlaceholder')}
        .value=${this.queryText}
        @input=${this.onSearchInput}
        @keydown=${this.onFieldKeyDown}
        @focus=${this.onSearchFocus}
        @blur=${this.onSearchBlur}
      />
      <div part="list" id=${this.listId} role="listbox" aria-label=${this.accessibleLabel || this.label || this.localize('nodePaletteLabel')}>
        ${groups.length === 0
          ? html`<div part="empty">${this.localize('nodePaletteEmpty')}</div>`
          : groups.map(
              (group) => html`
                ${group.category ? html`<div part="group-header" role="presentation">${group.category}</div>` : nothing}
                ${group.items.map((item) => this.itemTemplate(item, rovingList.indexOf(item)))}
              `,
            )}
      </div>
      <div part="live-region" class="sr-only" role="status" aria-live="polite" aria-atomic="true">${this.liveText}</div>
      <span id=${this.hintId} class="sr-only">${this.localize('nodePaletteDragHint')}</span>
      <slot name="footer"></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-node-palette': LyraNodePalette;
  }
}
