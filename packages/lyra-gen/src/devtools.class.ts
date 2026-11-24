import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '@aceshooting/lyra-ui/utilities/lyra-element.js';
import { LYRA_GEN_DEVTOOLS_STRINGS, type LyraGenDevtoolsStringKey } from './devtools-strings.js';
import { DevtoolsEventLog, DEVTOOLS_EVENT_CAPACITY, branchIds, catalogRoles, flattenTree, formatJson, isSensitiveNode, nodeById, redactJson, sensitivePointers, summarizeDetail, type DevtoolsEventType, type DevtoolsTreeRow } from './devtools-model.js';
import { styles } from './devtools.styles.js';
import type { LyraGenReady, LyraGenStateChange, LyraGenViewElement } from './gen-view.class.js';
import type { JsonValue, LyraGenNode } from './types.js';

/** Inspector tabs, in display order. */
export type LyraGenDevtoolsTab = 'tree' | 'revision' | 'state' | 'live' | 'events' | 'catalog';
const TABS: readonly LyraGenDevtoolsTab[] = ['tree', 'revision', 'state', 'live', 'events', 'catalog'];
const TAB_LABELS: Readonly<Record<LyraGenDevtoolsTab, LyraGenDevtoolsStringKey>> = {
  tree: 'genDevtoolsTabTree',
  revision: 'genDevtoolsTabRevision',
  state: 'genDevtoolsTabState',
  live: 'genDevtoolsTabLive',
  events: 'genDevtoolsTabEvents',
  catalog: 'genDevtoolsTabCatalog',
};
const EVENTS: readonly DevtoolsEventType[] = ['lr-gen-ready', 'lr-gen-state-change', 'lr-gen-action', 'lr-gen-error'];
/** Temporary attribute on the inspected generated element; removed on deselect and disconnect. */
export const LYRA_GEN_INSPECTED_ATTRIBUTE = 'data-gen-inspected';

interface Highlight { readonly top: number; readonly left: number; readonly width: number; readonly height: number }

/**
 * A read-only developer inspector for one `lr-gen-view`: its view tree, current and last ready
 * revision, binding state with dirty pointers, live data, a bounded event log and the catalog
 * roles. It never dispatches actions, edits state or sets generated properties; selecting a node
 * draws an outline over it and marks it with a temporary `data-gen-inspected` attribute. Values
 * bound by password, one-time code, payment card and secret fields are always masked.
 *
 * Load it from its own entry point (`@aceshooting/lyra-gen/devtools.js`) in development builds
 * only; nothing else in the package imports it, so production bundles leave it out.
 *
 * @tag lr-gen-devtools
 * @csspart base - The inspector container.
 * @csspart header - Title row with the refresh control.
 * @csspart title - The inspector heading.
 * @csspart action - Header and panel buttons.
 * @csspart tabs - The tab list.
 * @csspart tab - Each tab; the selected one also has `tab-selected`.
 * @csspart panel - The active tab panel.
 * @csspart tree-row - A view tree row; the selected one also has `tree-row-selected`.
 * @csspart twisty - A tree row's expansion glyph.
 * @csspart node-type - A tree row's catalog type.
 * @csspart highlight - The outline drawn over the selected generated element.
 * @cssprop [--lr-gen-devtools-panel-max-block-size=28rem] - Panel height before it scrolls.
 * @cssprop [--lr-gen-devtools-intrinsic-inline-size=20rem] - Intrinsic inline size for container sizing.
 */
export class LyraGenDevtoolsElement extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  protected static readonly defaultStrings = LYRA_GEN_DEVTOOLS_STRINGS;

  /** The generated view to inspect. */
  @property({ attribute: false }) target?: LyraGenViewElement;
  /** Event log capacity; older entries are evicted first. */
  @property({ attribute: false }) logCapacity = DEVTOOLS_EVENT_CAPACITY;
  /** The visible tab. */
  @property({ reflect: true }) tab: LyraGenDevtoolsTab = 'tree';
  /** Id of the selected generated node, if any. */
  @property({ attribute: false }) selectedNodeId?: string;

  @state() private expanded = new Set<string>();
  @state() private focusedNodeId?: string;
  @state() private highlight?: Highlight;
  @state() private revisionTick = 0;

  private log = new DevtoolsEventLog(DEVTOOLS_EVENT_CAPACITY);
  private lastReady?: LyraGenReady;
  private lastState?: { readonly change: LyraGenStateChange; readonly bindingState: JsonValue };
  private observed?: LyraGenViewElement;
  private recordsFor?: LyraGenViewElement;
  private inspected?: HTMLElement;
  private expandedFor?: LyraGenNode;
  private frame = 0;

  private readonly onTargetEvent = (event: Event): void => {
    const type = event.type as DevtoolsEventType;
    const detail = (event as CustomEvent<unknown>).detail;
    const target = this.observed;
    if (!target) return;
    if (type === 'lr-gen-ready') this.lastReady = detail as LyraGenReady;
    if (type === 'lr-gen-state-change') this.lastState = { change: detail as LyraGenStateChange, bindingState: target.bindingState };
    const state = type === 'lr-gen-state-change' ? (detail as LyraGenStateChange).values : this.currentState();
    this.log.push({ type, time: Date.now(), summary: summarizeDetail(detail, state, this.pointers(), this.localize('genDevtoolsRedacted')) });
    this.revisionTick++;
    if (type === 'lr-gen-ready') this.applyHighlight();
  };
  private readonly onViewportChange = (): void => { this.scheduleHighlight(); };

  override connectedCallback(): void {
    super.connectedCallback();
    this.observe(this.target);
    if (this.hasUpdated) this.applyHighlight();
    window.addEventListener('scroll', this.onViewportChange, { capture: true, passive: true });
    window.addEventListener('resize', this.onViewportChange, { passive: true });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observe(undefined);
    window.removeEventListener('scroll', this.onViewportChange, { capture: true });
    window.removeEventListener('resize', this.onViewportChange);
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.clearInspected();
    this.highlight = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('logCapacity')) {
      const previous = this.log.entries();
      this.log = new DevtoolsEventLog(this.logCapacity);
      for (const entry of previous) this.log.push(entry);
    }
    if (changed.has('target') && this.isConnected) this.observe(this.target);
    const root = this.target?.document?.root;
    if (root && root !== this.expandedFor) {
      // A new document starts fully expanded; ids kept from a previous revision stay as chosen.
      if (!this.expandedFor) this.expanded = new Set(branchIds(root));
      this.expandedFor = root;
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('selectedNodeId') || changed.has('target')) this.applyHighlight();
  }

  /** Re-read the target, for values such as `liveData` that change without an event. */
  refresh(): void {
    this.revisionTick++;
    this.applyHighlight();
  }

  /** Remove every recorded event. */
  clearLog(): void {
    this.log.clear();
    this.revisionTick++;
  }

  private observe(target: LyraGenViewElement | undefined): void {
    if (this.observed === target) return;
    if (this.observed) for (const type of EVENTS) this.observed.removeEventListener(type, this.onTargetEvent);
    this.clearInspected();
    if (target && target !== this.recordsFor) {
      // Records belong to one target; reconnecting to the same view keeps them.
      this.lastReady = undefined;
      this.lastState = undefined;
      this.expandedFor = undefined;
      this.log.clear();
      this.recordsFor = target;
    }
    this.observed = target;
    if (target) for (const type of EVENTS) target.addEventListener(type, this.onTargetEvent);
  }

  private pointers(): ReadonlySet<string> {
    const target = this.observed ?? this.target;
    return target ? sensitivePointers(target.document?.root, target.catalog) : new Set();
  }

  private currentState(): JsonValue {
    const target = this.target;
    if (!target) return {};
    if (!target.controlled && this.lastState && this.lastState.bindingState === target.bindingState && this.lastState.change.surfaceId === target.document?.surfaceId) return this.lastState.change.values;
    return target.bindingState;
  }

  private dirtyPointers(): readonly string[] {
    const target = this.target;
    if (!target || !this.lastState || this.lastState.bindingState !== target.bindingState || this.lastState.change.surfaceId !== target.document?.surfaceId) return [];
    return this.lastState.change.dirty;
  }

  private clearInspected(): void {
    this.inspected?.removeAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE);
    this.inspected = undefined;
  }

  private applyHighlight(): void {
    const element = this.selectedNodeId === undefined ? undefined : this.target?.elementForNode(this.selectedNodeId);
    if (element !== this.inspected) {
      this.clearInspected();
      if (element && this.isConnected) {
        element.setAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE, '');
        this.inspected = element;
      }
    }
    // Measured in a frame, never during an update, so the outline cannot re-enter the update cycle.
    this.scheduleHighlight();
  }

  private scheduleHighlight(): void {
    if (this.frame || !this.isConnected) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.measureHighlight(); });
  }

  private measureHighlight(): void {
    const element = this.inspected;
    if (!element || !element.isConnected) { if (this.highlight) this.highlight = undefined; return; }
    const box = element.getBoundingClientRect();
    const next = { top: box.top, left: box.left, width: box.width, height: box.height };
    const current = this.highlight;
    if (!current || current.top !== next.top || current.left !== next.left || current.width !== next.width || current.height !== next.height) this.highlight = next;
  }

  private select(id: string | undefined): void {
    this.selectedNodeId = id;
    if (id !== undefined) this.focusedNodeId = id;
  }

  private rows(): readonly DevtoolsTreeRow[] {
    const root = this.target?.document?.root;
    return root ? flattenTree(root, this.expanded) : [];
  }

  private toggle(id: string, open?: boolean): void {
    const next = new Set(this.expanded);
    if (open ?? !next.has(id)) next.add(id);
    else next.delete(id);
    this.expanded = next;
  }

  private focusRow(id: string): void {
    this.focusedNodeId = id;
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<HTMLElement>(`[role="treeitem"][data-node-id="${CSS.escape(id)}"]`)?.focus();
    });
  }

  private onTreeKeydown(event: KeyboardEvent): void {
    const rows = this.rows();
    if (!rows.length) return;
    const index = Math.max(0, rows.findIndex(row => row.id === (this.focusedNodeId ?? rows[0]!.id)));
    const row = rows[index]!;
    const rtl = this.effectiveDirection === 'rtl';
    const key = rtl && event.key === 'ArrowLeft' ? 'ArrowRight' : rtl && event.key === 'ArrowRight' ? 'ArrowLeft' : event.key;
    switch (key) {
      case 'ArrowDown': if (index < rows.length - 1) this.focusRow(rows[index + 1]!.id); break;
      case 'ArrowUp': if (index > 0) this.focusRow(rows[index - 1]!.id); break;
      case 'Home': this.focusRow(rows[0]!.id); break;
      case 'End': this.focusRow(rows[rows.length - 1]!.id); break;
      case 'ArrowRight':
        if (row.hasChildren && !row.expanded) this.toggle(row.id, true);
        else if (row.expanded && rows[index + 1]) this.focusRow(rows[index + 1]!.id);
        break;
      case 'ArrowLeft':
        if (row.expanded) this.toggle(row.id, false);
        else if (row.parentId !== undefined) this.focusRow(row.parentId);
        break;
      case 'Enter':
      case ' ': this.select(row.id); break;
      case 'Escape': if (this.selectedNodeId === undefined) return; this.select(undefined); break;
      default: return;
    }
    event.preventDefault();
  }

  private onTabKeydown(event: KeyboardEvent): void {
    const rtl = this.effectiveDirection === 'rtl';
    const index = TABS.indexOf(this.tab);
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = (index + ((event.key === 'ArrowRight') !== rtl ? 1 : -1) + TABS.length) % TABS.length;
    else return;
    event.preventDefault();
    this.tab = TABS[next]!;
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`#tab-${this.tab}`)?.focus());
  }

  private text(key: LyraGenDevtoolsStringKey, values?: Record<string, string | number>): string {
    return this.localize(key, undefined, values);
  }

  protected override render() {
    const target = this.target;
    return html`
      <div part="base" role="region" aria-label=${this.text('genDevtoolsLabel')}>
        <div part="header">
          <h2 part="title">${this.text('genDevtoolsLabel')}</h2>
          <button part="action" type="button" ?disabled=${!target} @click=${() => this.refresh()}>${this.text('genDevtoolsRefresh')}</button>
        </div>
        ${target ? this.renderTabs() : html`<p part="panel" class="quiet">${this.text('genDevtoolsNoTarget')}</p>`}
      </div>
      ${this.highlight ? html`<div part="highlight" aria-hidden="true" style=${`top:${this.highlight.top}px;left:${this.highlight.left}px;width:${this.highlight.width}px;height:${this.highlight.height}px`}></div>` : nothing}
    `;
  }

  private renderTabs(): TemplateResult {
    return html`
      <div part="tabs" role="tablist" aria-label=${this.text('genDevtoolsLabel')} @keydown=${this.onTabKeydown}>
        ${TABS.map(tab => html`<button part=${tab === this.tab ? 'tab tab-selected' : 'tab'} type="button" role="tab" id=${`tab-${tab}`} aria-controls="panel" aria-selected=${tab === this.tab ? 'true' : 'false'} tabindex=${tab === this.tab ? '0' : '-1'} @click=${() => { this.tab = tab; }}>${this.text(TAB_LABELS[tab])}</button>`)}
      </div>
      <div part="panel" id="panel" role="tabpanel" aria-labelledby=${`tab-${this.tab}`} tabindex="0">${this.renderPanel()}</div>
    `;
  }

  private renderPanel(): TemplateResult {
    switch (this.tab) {
      case 'tree': return this.renderTree();
      case 'revision': return this.renderRevision();
      case 'state': return this.renderState();
      case 'live': return html`<section><h3>${this.text('genDevtoolsLiveData')}</h3><pre>${formatJson(this.target!.liveData)}</pre></section>`;
      case 'events': return this.renderEvents();
      case 'catalog': return this.renderCatalog();
    }
  }

  private renderTree(): TemplateResult {
    const rows = this.rows();
    if (!rows.length) return html`<p class="quiet">${this.text('genDevtoolsEmptyView')}</p>`;
    const focused = rows.some(row => row.id === this.focusedNodeId) ? this.focusedNodeId : (rows.find(row => row.id === this.selectedNodeId) ?? rows[0]!).id;
    return html`
      <section>
        <ul role="tree" aria-label=${this.text('genDevtoolsTreeLabel')} @keydown=${this.onTreeKeydown}>
          ${rows.map(row => this.renderRow(row, row.id === focused))}
        </ul>
      </section>
      <section>${this.renderSelection()}</section>
    `;
  }

  private renderRow(row: DevtoolsTreeRow, focusable: boolean): TemplateResult {
    const selected = row.id === this.selectedNodeId;
    return html`<li role="treeitem" data-node-id=${row.id} aria-level=${row.level} aria-posinset=${row.position} aria-setsize=${row.setSize} aria-selected=${selected ? 'true' : 'false'} aria-expanded=${row.hasChildren ? (row.expanded ? 'true' : 'false') : nothing} tabindex=${focusable ? '0' : '-1'} @focus=${() => { this.focusedNodeId = row.id; }} @click=${() => this.select(row.id)}><span part=${selected ? 'tree-row tree-row-selected' : 'tree-row'} style=${`--_level:${row.level - 1}`}><span part="twisty" aria-hidden="true" ?data-collapsed=${row.hasChildren && !row.expanded} @click=${(event: Event) => { if (row.hasChildren) { event.stopPropagation(); this.toggle(row.id); this.focusedNodeId = row.id; } }}>${row.hasChildren ? (row.expanded ? '▾' : '▸') : ''}</span><code>${row.id}</code> <span part="node-type">${row.type}</span></span></li>`;
  }

  private renderSelection(): TemplateResult {
    const target = this.target!;
    const id = this.selectedNodeId;
    const node = id === undefined || !target.document ? undefined : nodeById(target.document.root, id);
    if (!node) return html`<h3>${this.text('genDevtoolsSelected')}</h3><p class="quiet">${this.text('genDevtoolsNoSelection')}</p>`;
    const component = Object.hasOwn(target.catalog.components, node.type) ? target.catalog.components[node.type] : undefined;
    const mask = this.text('genDevtoolsRedacted');
    const props: Record<string, JsonValue> = { ...(node.props ?? {}) };
    if (isSensitiveNode(node, component)) for (const name of ['value', ...Object.keys(node.bindings ?? {})]) if (Object.hasOwn(props, name)) props[name] = mask;
    return html`
      <h3>${this.text('genDevtoolsSelected')}</h3>
      <dl>
        <dt>${this.text('genDevtoolsNodeId')}</dt><dd><code>${node.id}</code></dd>
        <dt>${this.text('genDevtoolsNodeType')}</dt><dd><code>${node.type}</code></dd>
        <dt>${this.text('genDevtoolsNodeProps')}</dt><dd><pre>${formatJson(props)}</pre></dd>
        ${node.bindings ? html`<dt>${this.text('genDevtoolsNodeBindings')}</dt><dd><pre>${formatJson(node.bindings)}</pre></dd>` : nothing}
      </dl>
      ${this.inspected ? nothing : html`<p class="quiet">${this.text('genDevtoolsNotRendered')}</p>`}
      <button part="action" type="button" @click=${() => this.select(undefined)}>${this.text('genDevtoolsClearSelection')}</button>
    `;
  }

  private renderList(items: readonly string[] | undefined): TemplateResult {
    return items?.length ? html`<ul>${items.map(item => html`<li><code>${item}</code></li>`)}</ul>` : html`<span class="quiet">${this.text('genDevtoolsNone')}</span>`;
  }

  private renderRevision(): TemplateResult {
    const target = this.target!;
    const ready = this.lastReady;
    return html`
      <section>
        <dl>
          <dt>${this.text('genDevtoolsStatus')}</dt><dd><code>${target.status}</code></dd>
          <dt>${this.text('genDevtoolsSurface')}</dt><dd><code>${target.document?.surfaceId ?? '—'}</code></dd>
          <dt>${this.text('genDevtoolsRevisionNumber')}</dt><dd>${target.document ? this.formatNumber(target.document.revision) : '—'}</dd>
        </dl>
      </section>
      <section>
        <h3>${this.text('genDevtoolsLastReady')}</h3>
        ${ready ? html`
          <dl>
            <dt>${this.text('genDevtoolsSurface')}</dt><dd><code>${ready.surfaceId}</code></dd>
            <dt>${this.text('genDevtoolsRevisionNumber')}</dt><dd>${this.formatNumber(ready.revision)}</dd>
            ${ready.changes ? html`
              <dt>${this.text('genDevtoolsAdded')}</dt><dd>${this.renderList(ready.changes.added)}</dd>
              <dt>${this.text('genDevtoolsChanged')}</dt><dd>${this.renderList(ready.changes.changed)}</dd>
              <dt>${this.text('genDevtoolsRemoved')}</dt><dd>${this.renderList(ready.changes.removed)}</dd>` : nothing}
          </dl>
          ${ready.changes ? nothing : html`<p class="quiet">${this.text('genDevtoolsNoChanges')}</p>`}` : html`<p class="quiet">${this.text('genDevtoolsNoReady')}</p>`}
      </section>
    `;
  }

  private renderState(): TemplateResult {
    const pointers = this.pointers();
    return html`
      <section><h3>${this.text('genDevtoolsBindingState')}</h3><pre>${formatJson(redactJson(this.currentState(), pointers, this.text('genDevtoolsRedacted')))}</pre>
        ${pointers.size ? html`<p class="quiet">${this.text('genDevtoolsRedactionNote')}</p>` : nothing}</section>
      <section><h3>${this.text('genDevtoolsDirty')}</h3>${this.renderList(this.dirtyPointers())}</section>
    `;
  }

  private renderEvents(): TemplateResult {
    const entries = this.log.entries();
    const time = new Intl.DateTimeFormat(this.effectiveLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    return html`
      <section>
        <h3>${this.text('genDevtoolsEventLog')}</h3>
        <p class="quiet">${this.text('genDevtoolsEventCount', { count: this.formatNumber(entries.length), capacity: this.formatNumber(this.log.capacity) })}</p>
        <button part="action" type="button" ?disabled=${!entries.length} @click=${() => this.clearLog()}>${this.text('genDevtoolsClearLog')}</button>
      </section>
      <section>
        ${entries.length ? html`
          <table>
            <thead><tr><th scope="col">${this.text('genDevtoolsEventTime')}</th><th scope="col">${this.text('genDevtoolsEventType')}</th><th scope="col">${this.text('genDevtoolsEventDetail')}</th></tr></thead>
            <tbody>${[...entries].reverse().map(entry => html`<tr><td><time datetime=${new Date(entry.time).toISOString()}>${time.format(entry.time)}</time></td><td><code>${entry.type}</code></td><td><pre>${entry.summary}</pre></td></tr>`)}</tbody>
          </table>` : html`<p class="quiet">${this.text('genDevtoolsNoEvents')}</p>`}
      </section>
    `;
  }

  private renderCatalog(): TemplateResult {
    const roles = catalogRoles(this.target!.catalog);
    const yes = this.text('genDevtoolsYes');
    const no = this.text('genDevtoolsNo');
    return html`
      <section><dl><dt>${this.text('genDevtoolsCatalogId')}</dt><dd><code>${roles.id}@${roles.version}</code></dd></dl></section>
      <section>
        <h3>${this.text('genDevtoolsRoles')}</h3>
        <table>
          <thead><tr><th scope="col">${this.text('genDevtoolsRoleName')}</th><th scope="col">${this.text('genDevtoolsRoleTag')}</th><th scope="col">${this.text('genDevtoolsRolePurpose')}</th><th scope="col">${this.text('genDevtoolsRoleInteractive')}</th></tr></thead>
          <tbody>${roles.components.map(role => html`<tr><td><code>${role.name}</code></td><td><code>${role.tag}</code></td><td>${role.fieldPurpose ?? '—'}</td><td>${role.interactive ? yes : no}</td></tr>`)}</tbody>
        </table>
      </section>
      <section>
        <h3>${this.text('genDevtoolsActions')}</h3>
        ${roles.actions.length ? html`
          <table>
            <thead><tr><th scope="col">${this.text('genDevtoolsActions')}</th><th scope="col">${this.text('genDevtoolsActionConfirm')}</th></tr></thead>
            <tbody>${roles.actions.map(action => html`<tr><td><code>${action.name}</code></td><td>${action.confirm ? yes : no}</td></tr>`)}</tbody>
          </table>` : html`<p class="quiet">${this.text('genDevtoolsNone')}</p>`}
      </section>
    `;
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat(this.effectiveLocale).format(value);
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lr-gen-devtools': LyraGenDevtoolsElement }
}
