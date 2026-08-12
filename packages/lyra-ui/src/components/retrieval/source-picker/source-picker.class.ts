import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import '../../media/file-icon/file-icon.class.js';
import '../../forms/input/input.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './source-picker.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { activeElementIn } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_fileSizeUnitB, LYRA_DEFAULT_fileSizeUnitGb, LYRA_DEFAULT_fileSizeUnitKb, LYRA_DEFAULT_fileSizeUnitMb, LYRA_DEFAULT_fileSizeUnitTb, LYRA_DEFAULT_noData, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_open, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_selectAllSources, LYRA_DEFAULT_sourceListDefaultLabel, LYRA_DEFAULT_sourcePickerSelection } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraSourceEntry {
  id: string;
  label: string;
  /** Drives the `lr-file-icon` badge. */
  mimeType?: string;
  /** Filename fallback for icon detection. */
  name?: string;
  /** Presence makes this a group/folder row. */
  children?: LyraSourceEntry[];
}

export interface LyraSourcePickerEventMap {
  'lr-sources-change': CustomEvent<{ selectedIds: string[] }>;
}

interface SourceRow {
  entry: LyraSourceEntry;
  depth: number;
  hasChildren: boolean;
}

/**
 * `<lr-source-picker>` — a checkbox tree/list scoping which sources ground the next answer:
 * tri-state folders, select-all, type icons, search. **Not `FormAssociated`, deliberately**: this
 * is a scoping panel, not a form control — the selection is immediate app state consumed by the
 * next retrieval call, exactly the stance `lr-tool-select-dialog` already takes.
 *
 * @customElement lr-source-picker
 * @event lr-sources-change - `detail: { selectedIds }` — the complete updated leaf-id array,
 * fired after every toggle including select-all.
 * @csspart base - The root wrapper.
 * @csspart search - The built-in filter `lr-input`, only rendered when `searchable`.
 * @csspart select-all - The header select-all row, only rendered when `showSelectAll`.
 * @csspart summary - The "{selected} of {total} selected" text.
 * @csspart tree - The `role="tree"` container.
 * @csspart item - One `role="treeitem"` row. Its selection state is exposed only through
 *   tri-state `aria-checked`; `aria-selected` is intentionally absent because it would duplicate
 *   that same state.
 * @csspart disclosure - A folder row's pointer-only expand/collapse indicator. Keyboard
 * expansion remains owned by the surrounding treeitem.
 * @csspart checkbox - The tri-state checkbox glyph.
 * @csspart icon - The `lr-file-icon` type badge.
 * @csspart label - The entry's label text.
 * @csspart empty - The empty state (`noData` when `sources` is empty, `noMatches` when a filter
 * empties the tree).
 * @cssprop [--lr-source-picker-checked-bg] - Background of a fully-checked selection control:
 *   the `select-all` pill (defaults to `var(--lr-color-brand-quiet)`) and a fully-selected entry's
 *   `[part="checkbox"]` (defaults to `var(--lr-color-brand)`). The two keep their distinct resting
 *   defaults; setting this prop unifies both.
 * @cssprop [--lr-source-picker-checked-border=var(--lr-color-brand)] - Border color of every
 *   checked or mixed selection control.
 * @cssprop [--lr-source-picker-mixed-bg=color-mix(in srgb, var(--lr-color-brand) 50%, var(--lr-color-surface))] -
 *   Background of a partially-selected entry's `[part="checkbox"]`.
 * @cssprop [--lr-source-picker-indent-size=var(--lr-size-1-25rem)] - Indent step added to
 *   `[part="item"]`'s `padding-inline-start` per nesting level. The total indent is capped at
 *   `--lr-size-8rem` so a deeply nested tree cannot push its labels out of view.
 * @cssprop [--lr-source-picker-depth=0] - Internal indent plumbing, not a retheming knob: the row's
 *   own nesting depth, written inline onto `[part="item"]` as a plain number and multiplied by
 *   `--lr-source-picker-indent-size` to produce the indent.
 * @status stable
 * @since 4.0.0
 */
export class LyraSourcePicker extends LyraElement<LyraSourcePickerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    fileSizeUnitB: LYRA_DEFAULT_fileSizeUnitB,
    fileSizeUnitGb: LYRA_DEFAULT_fileSizeUnitGb,
    fileSizeUnitKb: LYRA_DEFAULT_fileSizeUnitKb,
    fileSizeUnitMb: LYRA_DEFAULT_fileSizeUnitMb,
    fileSizeUnitTb: LYRA_DEFAULT_fileSizeUnitTb,
    noData: LYRA_DEFAULT_noData,
    noMatches: LYRA_DEFAULT_noMatches,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    selectAllSources: LYRA_DEFAULT_selectAllSources,
    sourceListDefaultLabel: LYRA_DEFAULT_sourceListDefaultLabel,
    sourcePickerSelection: LYRA_DEFAULT_sourcePickerSelection,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Flat (no `children`) or a tree. */
  @property({ attribute: false }) sources: LyraSourceEntry[] = [];
  /** Leaf ids only. Duplicates and ids absent from `sources` are discarded. The picker updates
   * its own copy on toggle *then* emits; reassign to control. */
  @property({ attribute: false }) selectedIds: string[] = [];
  @property({ type: Boolean, attribute: 'show-select-all', converter: trueDefaultBooleanConverter }) showSelectAll = true;
  @property({ type: Boolean, converter: trueDefaultBooleanConverter }) searchable = true;
  @property() label = '';
  /** Overrides the tree's computed accessible name. Wins over `label` and the localized
   *  default. Attribute-reflects from a host-level `aria-label` so a plain-markup consumer
   *  gets ARIA-name forwarding without setting a JS property. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private expandedIds = new Set<string>();
  @state() private query = '';
  @state() private activeId: string | null = null;
  private pendingFocusIndex: number | 'search' | 'base' | undefined;
  private keyboardFocusGeneration = 0;

  private allLeafIds(entries: LyraSourceEntry[] = this.sources): string[] {
    const acc: string[] = [];
    const walk = (list: LyraSourceEntry[]): void => {
      for (const e of list) {
        if (e.children?.length) walk(e.children);
        else acc.push(e.id);
      }
    };
    walk(entries);
    return [...new Set(acc)];
  }

  private descendantLeafIds(entry: LyraSourceEntry): string[] {
    if (!entry.children?.length) return [entry.id];
    return [...new Set(entry.children.flatMap((c) => this.descendantLeafIds(c)))];
  }

  private normalizedSelectedIds(): string[] {
    const valid = new Set(this.allLeafIds());
    const seen = new Set<string>();
    return this.selectedIds.filter((id) => {
      if (!valid.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  private checkedState(entry: LyraSourceEntry): 'true' | 'false' | 'mixed' {
    const leaves = this.descendantLeafIds(entry);
    const selected = leaves.filter((id) => this.selectedIds.includes(id));
    if (selected.length === 0) return 'false';
    if (selected.length === leaves.length) return 'true';
    return 'mixed';
  }

  private matchesQuery(entry: LyraSourceEntry): boolean {
    return entry.label
      .toLocaleLowerCase(this.effectiveLocale)
      .includes(this.query.trim().toLocaleLowerCase(this.effectiveLocale));
  }

  private entryMatchesOrHasMatch(entry: LyraSourceEntry): boolean {
    if (this.matchesQuery(entry)) return true;
    return (entry.children ?? []).some((c) => this.entryMatchesOrHasMatch(c));
  }

  private isFiltering(): boolean {
    return this.searchable && this.query.trim().length > 0;
  }

  private visibleRows(): SourceRow[] {
    const rows: SourceRow[] = [];
    const seenIds = new Set<string>();
    const filtering = this.isFiltering();
    const walk = (list: LyraSourceEntry[], depth: number): void => {
      for (const entry of list) {
        if (seenIds.has(entry.id)) continue;
        seenIds.add(entry.id);
        if (filtering && !this.entryMatchesOrHasMatch(entry)) continue;
        const hasChildren = !!entry.children?.length;
        rows.push({ entry, depth, hasChildren });
        if (hasChildren && (filtering || this.expandedIds.has(entry.id))) walk(entry.children!, depth + 1);
      }
    };
    walk(this.sources, 0);
    return rows;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('sources') || changed.has('selectedIds')) {
      const normalized = this.normalizedSelectedIds();
      if (
        normalized.length !== this.selectedIds.length ||
        normalized.some((id, index) => id !== this.selectedIds[index])
      ) {
        this.selectedIds = normalized;
      }
    }
    if (!changed.has('sources') && !changed.has('query') && !changed.has('expandedIds')) return;

    const renderedRows = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[part~="item"]'));
    const focusedIndex = renderedRows.indexOf(activeElementIn(this.shadowRoot) as HTMLElement);
    const rows = this.visibleRows();
    const retainedIndex = rows.findIndex((row) => row.entry.id === this.activeId);
    const nextIndex =
      retainedIndex >= 0
        ? retainedIndex
        : rows.length
          ? Math.min(Math.max(focusedIndex, 0), rows.length - 1)
          : -1;
    this.activeId = nextIndex >= 0 ? rows[nextIndex]!.entry.id : null;

    if (focusedIndex >= 0) {
      this.pendingFocusIndex =
        nextIndex >= 0
          ? nextIndex
          : this.sources.length === 0 || !this.searchable
            ? 'base'
            : 'search';
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const pending = this.pendingFocusIndex;
    if (pending === undefined) return;
    this.pendingFocusIndex = undefined;
    if (pending === 'search') {
      (this.renderRoot.querySelector('[part~="search"]') as HTMLElement | null)?.focus();
      return;
    }
    if (pending === 'base') {
      this.renderRoot.querySelector<HTMLElement>('[part="base"]')?.focus();
      return;
    }
    const rows = this.renderRoot.querySelectorAll<HTMLElement>('[part~="item"]');
    rows[pending]?.focus();
  }

  private commitSelection(next: string[]): void {
    this.selectedIds = next;
    this.emit('lr-sources-change', { selectedIds: next });
  }

  private toggleEntry(entry: LyraSourceEntry): void {
    const leaves = this.descendantLeafIds(entry);
    const willSelect = this.checkedState(entry) !== 'true';
    const set = new Set(this.selectedIds);
    for (const id of leaves) {
      if (willSelect) set.add(id);
      else set.delete(id);
    }
    this.commitSelection([...set]);
  }

  private toggleSelectAll(): void {
    const all = this.allLeafIds();
    const allSelected = all.length > 0 && all.every((id) => this.selectedIds.includes(id));
    this.commitSelection(allSelected ? [] : all);
  }

  private focusRowByIndex(index: number, rows: SourceRow[]): void {
    const targetId = rows[index]?.entry.id;
    if (!targetId) return;
    this.activeId = targetId;
    const generation = ++this.keyboardFocusGeneration;
    void this.updateComplete.then(() => {
      if (!this.isConnected || generation !== this.keyboardFocusGeneration) return;
      const currentIndex = this.visibleRows().findIndex((row) => row.entry.id === targetId);
      if (currentIndex < 0) return;
      const items = this.renderRoot.querySelectorAll('[part~="item"]');
      (items[currentIndex] as HTMLElement | undefined)?.focus();
    });
  }

  private onTreeKeyDown = (e: KeyboardEvent): void => {
    const rows = this.visibleRows();
    if (rows.length === 0) return;
    const currentIndex = Math.max(0, rows.findIndex((r) => r.entry.id === this.activeId));
    const current = rows[currentIndex]!;
    const rtl = isRtl(this);
    const expandKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusRowByIndex(Math.min(rows.length - 1, currentIndex + 1), rows);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusRowByIndex(Math.max(0, currentIndex - 1), rows);
        break;
      case 'Home':
        e.preventDefault();
        this.focusRowByIndex(0, rows);
        break;
      case 'End':
        e.preventDefault();
        this.focusRowByIndex(rows.length - 1, rows);
        break;
      case expandKey:
        e.preventDefault();
        if (current.hasChildren && !this.expandedIds.has(current.entry.id)) {
          this.expandedIds = new Set(this.expandedIds).add(current.entry.id);
        } else if (current.hasChildren) {
          const next = this.visibleRows()[currentIndex + 1];
          if (next && next.depth > current.depth) this.focusRowByIndex(currentIndex + 1, this.visibleRows());
        }
        break;
      case collapseKey:
        e.preventDefault();
        if (current.hasChildren && this.expandedIds.has(current.entry.id)) {
          const set = new Set(this.expandedIds);
          set.delete(current.entry.id);
          this.expandedIds = set;
        } else {
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (rows[i]!.depth < current.depth) {
              this.focusRowByIndex(i, rows);
              break;
            }
          }
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.toggleEntry(current.entry);
        break;
      default:
        return;
    }
  };

  private renderRow(row: SourceRow, active: boolean): TemplateResult {
    const state = this.checkedState(row.entry);
    const expanded = row.hasChildren && (this.expandedIds.has(row.entry.id) || this.isFiltering());
    return html`
      <div
        part="item"
        role="treeitem"
        tabindex=${active ? '0' : '-1'}
        aria-checked=${state}
        aria-expanded=${row.hasChildren ? (expanded ? 'true' : 'false') : nothing}
        aria-level=${row.depth + 1}
        style=${styleMap({ '--lr-source-picker-depth': String(row.depth) })}
        @click=${() => {
          this.activeId = row.entry.id;
          this.toggleEntry(row.entry);
        }}
        @focus=${() => {
          this.activeId = row.entry.id;
        }}
      >
        ${row.hasChildren
          ? html`<span
              part="disclosure"
              aria-hidden="true"
              @click=${(event: MouseEvent) => {
                event.stopPropagation();
                const next = new Set(this.expandedIds);
                if (expanded) next.delete(row.entry.id);
                else next.add(row.entry.id);
                this.expandedIds = next;
              }}
            >${expanded ? '−' : '+'}</span>`
          : nothing}
        <span part="checkbox" aria-hidden="true" data-state=${state}></span>
        <lr-file-icon part="icon" decorative mime-type=${row.entry.mimeType ?? ''} name=${row.entry.name ?? row.entry.label}></lr-file-icon>
        <span part="label">${row.entry.label}</span>
      </div>
    `;
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('sourceListDefaultLabel');
    if (this.sources.length === 0) {
      return html`<div part="base" tabindex="-1"><lr-empty part="empty" heading=${this.localize('noData')}></lr-empty></div>`;
    }
    const rows = this.visibleRows();
    const activeId = this.activeId ?? rows[0]?.entry.id ?? null;
    const allLeaves = this.allLeafIds();
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const selectAllState: 'true' | 'false' | 'mixed' =
      this.selectedIds.length === 0
        ? 'false'
        : allLeaves.length > 0 && allLeaves.every((id) => this.selectedIds.includes(id))
          ? 'true'
          : 'mixed';

    return html`
      <div part="base" tabindex="-1">
        ${this.searchable
          ? html`<lr-input
              part="search"
              placeholder=${this.localize('search')}
              .value=${this.query}
              @lr-input=${(e: CustomEvent<{ value: string }>) => {
                e.stopPropagation();
                this.query = e.detail.value;
              }}
            ></lr-input>`
          : nothing}
        ${this.showSelectAll
          ? html`<div part="select-all">
              <span
                role="checkbox"
                tabindex="0"
                aria-checked=${selectAllState}
                @click=${() => this.toggleSelectAll()}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault(); // Space must not scroll the panel
                  this.toggleSelectAll();
                }}
                >${this.localize('selectAllSources')}</span
              >
              <span part="summary">${this.localize('sourcePickerSelection', undefined, {
                selected: numberFormat.format(this.selectedIds.length),
                total: numberFormat.format(allLeaves.length),
              })}</span>
            </div>`
          : nothing}
        ${rows.length === 0
          ? html`<div part="empty">${this.localize('noMatches')}</div>`
          : html`<div part="tree" role="tree" aria-multiselectable="true" aria-label=${label} @keydown=${this.onTreeKeyDown}>
              ${rows.map((row) => this.renderRow(row, row.entry.id === activeId))}
            </div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-source-picker': LyraSourcePicker;
  }
}
