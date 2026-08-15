import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import '../../media/file-icon/file-icon.class.js';
import '../../forms/input/input.class.js';
import '../../forms/checkbox/checkbox.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './source-picker.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { activeElementIn } from '../../../internal/active-element.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_fileSizeUnitB, LYRA_DEFAULT_fileSizeUnitGb, LYRA_DEFAULT_fileSizeUnitKb, LYRA_DEFAULT_fileSizeUnitMb, LYRA_DEFAULT_fileSizeUnitTb, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_selectAllSources, LYRA_DEFAULT_sourceListDefaultLabel, LYRA_DEFAULT_sourcePickerSelection, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraSourceEntry {
  id: string;
  label: string;
  /** Drives the `lr-file-icon` badge. */
  mimeType?: string;
  /** Filename fallback for icon detection. */
  name?: string;
  /** Presence makes this a group/folder row. */
  children?: readonly LyraSourceEntry[];
}

export interface LyraSourcePickerEventMap {
  'lr-sources-change': CustomEvent<LyraEventDetailSnapshot<{ selectedIds: string[] }>>;
}

interface SourceRow {
  entry: LyraSourceEntry;
  depth: number;
  hasChildren: boolean;
}

interface NormalizedSourceNode {
  entry: LyraSourceEntry;
  depth: number;
  children: NormalizedSourceNode[];
  leafIds: string[];
}

interface NormalizedSourceModel {
  roots: NormalizedSourceNode[];
  nodes: NormalizedSourceNode[];
  byEntry: WeakMap<LyraSourceEntry, NormalizedSourceNode>;
  leafIds: string[];
  limited: boolean;
}

const MAX_SOURCE_NODES = 2_000;
const MAX_SOURCE_DEPTH = 64;

/**
 * `<lr-source-picker>` — a checkbox tree/list scoping which sources ground the next answer:
 * tri-state folders, select-all, type icons, search. **Not `FormAssociated`, deliberately**: this
 * is a scoping panel, not a form control — the selection is immediate app state consumed by the
 * next retrieval call, exactly the stance `lr-tool-select-dialog` already takes.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-source-picker
 * @event lr-sources-change - `detail: { selectedIds }` — the complete updated leaf-id array,
 * fired after every toggle including select-all.
 * @csspart base - The root wrapper.
 * @csspart search - The built-in filter `lr-input`, only rendered when `searchable`.
 * @csspart select-all - The header select-all row, only rendered when `showSelectAll`.
 * @csspart select-all-control - The shared `lr-checkbox` that owns select-all semantics.
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
 * @csspart limit - Localized fail-closed status when a cyclic, duplicate, over-depth or
 * over-budget input was truncated by the bounded source-tree normalizer.
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
  protected static override readonly ownedCollectionProperties = Object.freeze(['sources', 'selectedIds']);

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
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    noMatches: LYRA_DEFAULT_noMatches,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    selectAllSources: LYRA_DEFAULT_selectAllSources,
    sourceListDefaultLabel: LYRA_DEFAULT_sourceListDefaultLabel,
    sourcePickerSelection: LYRA_DEFAULT_sourcePickerSelection,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-sources-change',
  ]);

  /** Flat (no `children`) or a tree. */
  @property({ attribute: false }) sources: readonly LyraSourceEntry[] = [];
  /** Leaf ids only. Duplicates and ids absent from `sources` are discarded. The picker updates
   * its own copy on toggle *then* emits; reassign to control. */
  @property({ attribute: false }) selectedIds: readonly string[] = [];
  /** Whether the header exposes one control for selecting or clearing every visible leaf source. */
  @property({
    type: Boolean,
    attribute: 'show-select-all',
    converter: trueDefaultBooleanConverter,
  })
  showSelectAll = true;
  /** Whether the built-in source filter is rendered. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter })
  searchable = true;
  /** Visible/fallback accessible label for the source tree. */
  @property() label = '';
  /** JS-only accessible-name override for the tree. A markup `aria-label` names the component
   *  as a whole, so it is not cloned onto the inner tree. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private expandedIds = new Set<string>();
  @state() private query = '';
  @state() private activeId: string | null = null;
  private pendingFocusIndex: number | 'search' | 'base' | undefined;
  private keyboardFocusGeneration = 0;
  private normalizedInput?: readonly LyraSourceEntry[];
  private normalizedModel?: NormalizedSourceModel;
  private announcementSink?: AnnouncementSink;
  private isMounting = true;
  private lastFilterAnnouncement = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    this.isMounting = true;
    this.lastFilterAnnouncement = '';
    this.announcementSink?.release();
    this.announcementSink = undefined;
    super.disconnectedCallback();
  }

  /** Builds a bounded, acyclic, first-id-wins tree once per controlled `sources` identity. */
  private get sourceModel(): NormalizedSourceModel {
    if (this.normalizedInput === this.sources && this.normalizedModel)
      return this.normalizedModel;
    const roots: NormalizedSourceNode[] = [];
    const nodes: NormalizedSourceNode[] = [];
    const byEntry = new WeakMap<LyraSourceEntry, NormalizedSourceNode>();
    const seenObjects = new WeakSet<object>();
    const seenIds = new Set<string>();
    let limited = false;
    const stack: Array<{
      sources: readonly LyraSourceEntry[];
      target: NormalizedSourceNode[];
      depth: number;
      index: number;
    }> = [];
    stack.push({ sources: this.sources, target: roots, depth: 0, index: 0 });
    let inspected = 0;
    while (stack.length) {
      const frame = stack[stack.length - 1]!;
      if (frame.index >= frame.sources.length) {
        stack.pop();
        continue;
      }
      if (inspected >= MAX_SOURCE_NODES) {
        limited = true;
        break;
      }
      const source = frame.sources[frame.index++];
      inspected++;
      if (
        !source ||
        typeof source !== 'object' ||
        seenObjects.has(source) ||
        seenIds.has(source.id)
      ) {
        limited = true;
        continue;
      }
      if (nodes.length >= MAX_SOURCE_NODES || frame.depth > MAX_SOURCE_DEPTH) {
        limited = true;
        continue;
      }
      seenObjects.add(source);
      seenIds.add(source.id);
      const declaredGroup = Array.isArray(source.children);
      const entry: LyraSourceEntry = {
        id: source.id,
        label: source.label,
        ...(source.mimeType !== undefined ? { mimeType: source.mimeType } : {}),
        ...(source.name !== undefined ? { name: source.name } : {}),
        ...(declaredGroup ? { children: [] } : {}),
      };
      const node: NormalizedSourceNode = {
        entry,
        depth: frame.depth,
        children: [],
        leafIds: [],
      };
      if (declaredGroup)
        entry.children = node.children.map((child) => child.entry);
      frame.target.push(node);
      nodes.push(node);
      byEntry.set(entry, node);
      const children = source.children ?? [];
      if (children.length && frame.depth >= MAX_SOURCE_DEPTH) limited = true;
      if (children.length && frame.depth < MAX_SOURCE_DEPTH)
        stack.push({
          sources: children,
          target: node.children,
          depth: frame.depth + 1,
          index: 0,
        });
    }
    // Child arrays are populated after their parent clone was created; publish the finished clone
    // links and derive descendant leaves bottom-up without recursion.
    for (let index = nodes.length - 1; index >= 0; index--) {
      const node = nodes[index]!;
      if (node.entry.children !== undefined)
        node.entry.children = node.children.map((child) => child.entry);
      node.leafIds =
        node.entry.children === undefined
          ? [node.entry.id]
          : [...new Set(node.children.flatMap((child) => child.leafIds))];
    }
    const leafIds = [...new Set(roots.flatMap((root) => root.leafIds))];
    this.normalizedInput = this.sources;
    this.normalizedModel = { roots, nodes, byEntry, leafIds, limited };
    return this.normalizedModel;
  }

  private allLeafIds(): string[] {
    return this.sourceModel.leafIds;
  }

  private descendantLeafIds(entry: LyraSourceEntry): string[] {
    return this.sourceModel.byEntry.get(entry)?.leafIds ?? [];
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

  private isFiltering(): boolean {
    return this.searchable && this.query.trim().length > 0;
  }

  private visibleRows(): SourceRow[] {
    const rows: SourceRow[] = [];
    const filtering = this.isFiltering();
    const matches = new Set<NormalizedSourceNode>();
    if (filtering) {
      for (let index = this.sourceModel.nodes.length - 1; index >= 0; index--) {
        const node = this.sourceModel.nodes[index]!;
        if (
          this.matchesQuery(node.entry) ||
          node.children.some((child) => matches.has(child))
        )
          matches.add(node);
      }
    }
    const stack = [...this.sourceModel.roots].reverse();
    while (stack.length) {
      const node = stack.pop()!;
      if (filtering && !matches.has(node)) continue;
      const hasChildren = node.entry.children !== undefined;
      rows.push({ entry: node.entry, depth: node.depth, hasChildren });
      if (hasChildren && (filtering || this.expandedIds.has(node.entry.id))) {
        for (let index = node.children.length - 1; index >= 0; index--)
          stack.push(node.children[index]!);
      }
    }
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
    if (
      !changed.has('sources') &&
      !changed.has('query') &&
      !changed.has('expandedIds')
    )
      return;

    const renderedRows = Array.from(
      this.renderRoot.querySelectorAll<HTMLElement>('[part~="item"]')
    );
    const focusedIndex = renderedRows.indexOf(
      activeElementIn(this.shadowRoot) as HTMLElement
    );
    const rows = this.visibleRows();
    const retainedIndex = rows.findIndex(
      (row) => row.entry.id === this.activeId
    );
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
    if (pending !== undefined) {
      this.pendingFocusIndex = undefined;
      if (pending === 'search') {
        (
          this.renderRoot.querySelector(
            '[part~="search"]'
          ) as HTMLElement | null
        )?.focus();
      } else if (pending === 'base') {
        this.renderRoot.querySelector<HTMLElement>('[part="base"]')?.focus();
      } else {
        const rows =
          this.renderRoot.querySelectorAll<HTMLElement>('[part~="item"]');
        rows[pending]?.focus();
      }
    }

    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (wasMounting || (!changed.has('query') && !changed.has('sources')))
      return;
    if (!this.isFiltering()) {
      this.lastFilterAnnouncement = '';
      return;
    }
    const count = this.visibleRows().length;
    const signature = `${this.query
      .trim()
      .toLocaleLowerCase(this.effectiveLocale)}\u0000${count}`;
    if (signature === this.lastFilterAnnouncement) return;
    this.lastFilterAnnouncement = signature;
    if (count === 0)
      this.announcementSink?.announce(this.localize('noMatches'));
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
    const allSelected =
      all.length > 0 && all.every((id) => this.selectedIds.includes(id));
    this.commitSelection(allSelected ? [] : all);
  }

  private focusRowByIndex(index: number, rows: SourceRow[]): void {
    const targetId = rows[index]?.entry.id;
    if (!targetId) return;
    this.activeId = targetId;
    const generation = ++this.keyboardFocusGeneration;
    void this.updateComplete.then(() => {
      if (!this.isConnected || generation !== this.keyboardFocusGeneration)
        return;
      const currentIndex = this.visibleRows().findIndex(
        (row) => row.entry.id === targetId
      );
      if (currentIndex < 0) return;
      const items = this.renderRoot.querySelectorAll('[part~="item"]');
      (items[currentIndex] as HTMLElement | undefined)?.focus();
    });
  }

  private onTreeKeyDown = (e: KeyboardEvent): void => {
    const rows = this.visibleRows();
    if (rows.length === 0) return;
    const currentIndex = Math.max(
      0,
      rows.findIndex((r) => r.entry.id === this.activeId)
    );
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
          if (next && next.depth > current.depth)
            this.focusRowByIndex(currentIndex + 1, this.visibleRows());
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
    const expanded =
      row.hasChildren &&
      (this.expandedIds.has(row.entry.id) || this.isFiltering());
    return html`
      <div
        part="item"
        role="treeitem"
        tabindex=${active ? '0' : '-1'}
        aria-checked=${state}
        aria-expanded=${row.hasChildren
          ? expanded
            ? 'true'
            : 'false'
          : nothing}
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
              >${expanded ? '−' : '+'}</span
            >`
          : nothing}
        <span part="checkbox" aria-hidden="true" data-state=${state}></span>
        <lr-file-icon
          part="icon"
          decorative
          mime-type=${row.entry.mimeType ?? ''}
          name=${row.entry.name ?? row.entry.label}
        ></lr-file-icon>
        <span part="label">${row.entry.label}</span>
      </div>
    `;
  }

  override render(): TemplateResult {
    const hostLabel = hostAriaLabel(this);
    const label =
      hostLabel === null
        ? this.accessibleLabel ??
          (this.label || this.localize('sourceListDefaultLabel'))
        : this.label && this.label !== hostLabel
          ? this.label
          : this.localize('sourceListDefaultLabel');
    if (this.sources.length === 0) {
      return html`<div part="base" tabindex="-1">
        <lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>
      </div>`;
    }
    const rows = this.visibleRows();
    const activeId = this.activeId ?? rows[0]?.entry.id ?? null;
    const allLeaves = this.allLeafIds();
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const selectAllState: 'true' | 'false' | 'mixed' =
      this.selectedIds.length === 0
        ? 'false'
        : allLeaves.length > 0 &&
          allLeaves.every((id) => this.selectedIds.includes(id))
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
              <lr-checkbox
                part="select-all-control"
                aria-label=${this.localize('selectAllSources')}
                .checked=${selectAllState === 'true'}
                .indeterminate=${selectAllState === 'mixed'}
                @lr-change=${(event: Event) => {
                  event.stopPropagation();
                  this.toggleSelectAll();
                }}
                >${this.localize('selectAllSources')}</lr-checkbox
              >
              <span part="summary"
                >${this.localize('sourcePickerSelection', undefined, {
                  selected: numberFormat.format(this.selectedIds.length),
                  total: numberFormat.format(allLeaves.length),
                })}</span
              >
            </div>`
          : nothing}
        ${rows.length === 0
          ? html`<div part="empty">${this.localize('noMatches')}</div>`
          : html`<div
              part="tree"
              role="tree"
              aria-multiselectable="true"
              aria-label=${label}
              @keydown=${this.onTreeKeyDown}
            >
              ${rows.map((row) =>
                this.renderRow(row, row.entry.id === activeId)
              )}
            </div>`}
        ${this.sourceModel.limited
          ? html`<div part="limit">${this.localize('valueInvalid')}</div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-source-picker': LyraSourcePicker;
  }
}
