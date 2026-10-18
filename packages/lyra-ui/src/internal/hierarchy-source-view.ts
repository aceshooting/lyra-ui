import { html, nothing, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import type { LyraHierarchyRow } from '../data-sources.js';
import type { LyraVirtualList } from '../components/layout/virtual-list/virtual-list.class.js';
import type { HierarchySourceController } from './hierarchy-source-controller.js';
import { setVirtualListCompositionProfile, type VirtualListRenderDemand } from './virtual-list-composition.js';

export interface HierarchySourceViewOptions<T> {
  readonly label: string;
  readonly rtl: boolean;
  readonly multiple: boolean;
  readonly loading: string;
  readonly error: string;
  readonly empty: string;
  readonly retry: string;
  readonly expand: string;
  readonly collapse: string;
  readonly summary: string;
  readonly content: (value: T) => unknown;
  readonly name: (value: T) => string;
  readonly select: (row: LyraHierarchyRow<T>) => void;
}

const demandCallbacks = new WeakMap<object, (demand: Readonly<VirtualListRenderDemand>) => void>();
function demandCallback<T>(control: HierarchySourceController<T>): (demand: Readonly<VirtualListRenderDemand>) => void {
  let callback = demandCallbacks.get(control);
  if (!callback) {
    callback = demand => control.requestRange(demand.start, demand.endExclusive);
    demandCallbacks.set(control, callback);
  }
  return callback;
}

/** Flat semantic tree; virtual-list remains the sole owner of window and scroll geometry. */
export function hierarchySourceView<T>(control: HierarchySourceController<T>, options: HierarchySourceViewOptions<T>): TemplateResult {
  const epoch = control.epoch;
  const projection = control.projection;
  let tree: Element | undefined;
  let owner: Document | undefined;
  const current = (event: Event): boolean => {
    const target = event.currentTarget as Element | null;
    return Boolean(tree?.isConnected && tree.ownerDocument === owner && target?.isConnected && tree.contains(target) &&
      target.getRootNode() === tree.getRootNode() && epoch === control.epoch && projection === control.projection && !control.loading);
  };
  const render = (_input: unknown, index: number) => {
    const slot = control.slot(index);
    if (slot.state !== 'ready') return html`<div part=${slot.state === 'error' ? 'source-error' : 'source-status'}>
      ${slot.state === 'error' ? options.error : options.loading}
      ${slot.state === 'error' ? html`<button type="button" part="source-toggle" @click=${(event: Event) => { if (current(event) && control.slot(index).state === 'error') void control.window.ensure(index); }}>${options.retry}</button>` : nothing}
    </div>`;
    const row = slot.value;
    const currentRow = (event: Event): boolean => {
      if (!current(event) || row.disabled || control.error) return false;
      const slot = control.slot(index);
      return slot.state === 'ready' && slot.value === row && epoch === control.epoch && projection === control.projection;
    };
    return html`<div part="source-row" role="treeitem" data-source-key=${row.key}
      style=${`--source-depth: ${Math.min(32, row.level - 1)}`}
      aria-label=${options.name(row.value)} aria-level=${row.level} aria-posinset=${row.position} aria-setsize=${row.setSize}
      aria-expanded=${row.childCount ? String(row.expanded) : nothing} aria-selected=${String(row.selected)}
      aria-checked=${row.selectionState === 'partial' ? 'mixed' : nothing} aria-disabled=${String(Boolean(row.disabled || control.error))}
      tabindex=${!row.disabled && !control.error && control.activeKey === row.key ? '0' : '-1'}
      @focusin=${(event: Event) => { if (currentRow(event)) control.focusRow(index, row); }}
      @click=${(event: Event) => { if (currentRow(event)) { control.focusRow(index, row); if (currentRow(event)) options.select(row); } }}
      @keydown=${(event: KeyboardEvent) => { event.stopPropagation(); if (currentRow(event)) control.keydown(event, row, index, options.rtl, options.select); }}>
      ${row.childCount ? html`<button part="source-toggle" type="button" tabindex="-1"
        aria-label=${row.expanded ? options.collapse : options.expand} ?disabled=${row.disabled || control.loading || control.error}
        @click=${(event: Event) => { event.stopPropagation(); if (currentRow(event)) void control.project({ type: 'toggle', key: row.key, expanded: !row.expanded }, true, row); }}
      ><span aria-hidden="true">${row.expanded ? '−' : '+'}</span></button>` : html`<span class="source-toggle-space" aria-hidden="true"></span>`}
      <span part="source-label">${options.content(row.value)}</span>
    </div>`;
  };
  return html`<div ${ref((element?: Element) => { tree = element; owner = element?.ownerDocument; })} part="base tree" class="source-tree" role="tree" aria-label=${options.label}
    aria-multiselectable=${String(options.multiple)} aria-busy=${String(control.loading)}
    tabindex=${control.mountedActive ? '-1' : '0'}
    @keydown=${(event: KeyboardEvent) => { if (current(event)) control.keydown(event, undefined, control.firstMountedIndex - 1, options.rtl, options.select); }}>
    ${control.error ? html`<div part="source-error">${options.error}<button part="source-toggle" type="button" @click=${(event: Event) => { if (current(event) && control.error) control.retry(); }}>${options.retry}</button></div>` : nothing}
    ${control.loading ? html`<div part="source-status">${options.loading}</div>` : nothing}
    ${control.projection ? html`<div part="source-status">${options.summary}</div>
      ${control.projection.rows.count === 0 ? html`<div part="source-status">${options.empty}</div>` : html`
        <lr-virtual-list part="source-list" row-projection="light" row-height="auto"
          .source=${control.adapter} .renderItem=${render} .overscan=${5}
          ${ref((element?: Element) => {
            control.list = element as LyraVirtualList | undefined;
            if (element) setVirtualListCompositionProfile(element, { maxRows: 301, beforeRender: demandCallback(control) });
          })}></lr-virtual-list>`}` : nothing}
  </div>`;
}
