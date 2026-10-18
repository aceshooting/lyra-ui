import type { LyraHierarchySource, LyraHierarchyQuery, LyraHierarchyRow } from '../../../data-sources.js';
import { HierarchySourceController, hierarchyField, hierarchyKey, hierarchyText } from '../../../internal/hierarchy-source-controller.js';
import { hierarchySourceView } from '../../../internal/hierarchy-source-view.js';
import { hierarchySourceStyles } from '../../../internal/hierarchy-source-view.styles.js';
import { snapshotMindMapTopics } from './mind-map-model.js';
import {
  html,
  nothing,
  svg,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { isRtl } from '../../../internal/rtl.js';
import { finiteCount } from '../../../internal/numbers.js';
import { resolveCssTokenLength } from '../../../internal/css-token-length.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import {
  decimateMindMapLayout,
  createMindMapLayout,
  type LyraTopic,
  type MindMapLayoutResult,
  type PlacedTopic,
} from './mind-map-layout.js';
import { styles } from './mind-map.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_mindMapCollapsed, LYRA_DEFAULT_mindMapExpanded, LYRA_DEFAULT_mindMapInputLimit, LYRA_DEFAULT_mindMapLabel, LYRA_DEFAULT_mindMapLeafStatus, LYRA_DEFAULT_mindMapNodeLimit, LYRA_DEFAULT_mindMapTopicStatus } from '../../../internal/default-strings/retrieval.generated.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_expand, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_retry, LYRA_DEFAULT_treeSourceError, LYRA_DEFAULT_treeSourceSummary } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraTopic };
export type MindMapSource = LyraHierarchySource<LyraTopic, LyraHierarchyQuery>;

export interface LyraMindMapEventMap {
  'lr-topic-select': CustomEvent<{ topicId: string }>;
  'lr-topic-toggle': CustomEvent<{ topicId: string; expanded: boolean }>;
}

const DEFAULT_RING_GAP_PX = 96; // 6rem at the default 16px root font size
/** Render-scale ceiling for the currently-visible (per expand state) topic set. Above this,
 *  `decimateMindMapLayout()` keeps a deterministic, connectivity-preserving, subtree-size-weighted
 *  sample rather than rendering every node, bounding DOM node/listener count while keeping the
 *  radial layout's branch proportions representative. */
const MAX_RENDERED_MIND_MAP_NODES = 500;
const NAV_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Enter',
  ' ',
]);

/**
 * `<lr-mind-map>` — a radial expandable topic tree (NotebookLM Mind Maps): a spatial overview of
 * a topic hierarchy where activating a topic drills in or hands the topic to the chat. Hierarchy,
 * not network — no cross-links, no force simulation, no communities, no edge labels (that's
 * `lr-graph`). Zero-dependency SVG; the radial layout is closed-form arithmetic, in its own
 * `mind-map-layout.ts` module, mirroring `lr-word-cloud`'s dependency-free precedent.
 *
 * Node-position transitions use `--lr-transition-base`, which already collapses to near-zero
 * under `prefers-reduced-motion: reduce` globally (`tokens.styles.ts`), so expansion snaps rather
 * than tweening for a reduced-motion user with no extra branching in this component.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-mind-map
 * @event lr-topic-select - A *leaf* topic was activated. `detail: { topicId }`.
 * @event lr-topic-toggle - A parent topic was activated (or auto-expanded by keyboard descent).
 * `detail: { topicId, expanded }`.
 * Provider treeSource is authoritative for topology, expansion and selection. Its complete
 * preorder navigator reaches every key. The diagram is one connected subtree of currently
 * mounted rows (at most301), and its notice discloses clipping; it never implies a clipped parent
 * is a leaf. expandDepth and local expansion overrides apply only to legacy topics.
 *
 * @csspart source-diagram - The bounded connected subtree diagram in provider mode.
 * @csspart source-list - The complete virtualized source navigator.
 * @csspart source-row - An exact hierarchy row with global positional metadata.
 * @csspart source-toggle - A source expand, collapse or retry action.
 * @csspart source-label - A source topic label.
 * @csspart source-status - Source loading, empty and global-count status.
 * @csspart source-error - Source failure and retry status.
 * @csspart base - The wrapper.
 * @csspart svg - The single-tab-stop SVG focus target.
 * @csspart node - A topic node group.
 * @csspart node-label - A topic's label text.
 * @csspart link - A parent-child connector.
 * @csspart focus-ring - The keyboard focus ring, drawn from the moment the svg takes focus (the
 * first placed topic is seeded as the keyboard cursor) rather than only after the first arrow key.
 * @csspart live-region - The visually hidden announcement region.
 * @csspart input-limit - A localized notice when the input safety boundary omits topics.
 * @csspart empty - The empty-state message, shown when `topics` is empty.
 * @csspart limit - The "showing N of M" notice, present only once the currently-visible topic
 *   count exceeds the render cap. The rendered subset is a deterministic, connectivity-preserving,
 *   subtree-size-weighted sample of the full visible set (never floating nodes with no path back
 *   to the root), so both the SVG and the parallel sr-only tree stay representative above the cap.
 * @cssprop [--lr-mind-map-ring-gap=6rem] - Radius step per depth ring.
 * @cssprop [--lr-mind-map-node-hover-halo=var(--lr-color-brand-quiet)] - Stroke color of the
 * hover halo drawn around a topic node's dot, giving mouse users the same "this is clickable"
 * feedback keyboard users get from the drawn focus ring.
 * @status stable
 * @since 4.0.0
 */
export class LyraMindMap extends LyraElement<LyraMindMapEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    expand: LYRA_DEFAULT_expand,
    loading: LYRA_DEFAULT_loading,
    mindMapCollapsed: LYRA_DEFAULT_mindMapCollapsed,
    mindMapExpanded: LYRA_DEFAULT_mindMapExpanded,
    mindMapInputLimit: LYRA_DEFAULT_mindMapInputLimit,
    mindMapLabel: LYRA_DEFAULT_mindMapLabel,
    mindMapLeafStatus: LYRA_DEFAULT_mindMapLeafStatus,
    mindMapNodeLimit: LYRA_DEFAULT_mindMapNodeLimit,
    mindMapTopicStatus: LYRA_DEFAULT_mindMapTopicStatus,
    noData: LYRA_DEFAULT_noData,
    retry: LYRA_DEFAULT_retry,
    treeSourceError: LYRA_DEFAULT_treeSourceError,
    treeSourceSummary: LYRA_DEFAULT_treeSourceSummary,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, hierarchySourceStyles, styles, srOnly];
  static override get observedAttributes(): string[] {
    return [...new Set([...super.observedAttributes, 'dir', 'lang'])];
  }

  private _treeSource?: MindMapSource;
  private sourceVersion = 0;
  private sourceWrapper?: MindMapSource;
  private readonly sourceViewAuthority = new WeakMap<object, () => boolean>();
  private sourcePaint = 0;
  private sourceDiagramScheduled = false;
  private sourceDiagramRows = new Map<string, LyraHierarchyRow<LyraTopic>>();
  private sourceDiagramCurrent: () => boolean = () => false;
  private readonly sourceControl = new HierarchySourceController<LyraTopic>(this, {
    normalize: (value, key) => {
      const current = this.sourceAuthority();
      const field = (name: string) => {
        if (!current()) throw new Error('Topic source changed');
        const result = hierarchyField(value, name);
        if (!current()) throw new Error('Topic source changed');
        return result;
      };
      const id = hierarchyKey(field('id'));
      if (id !== key) throw new TypeError('Topic key mismatch');
      return Object.freeze({ id, label: hierarchyText(field('label')) });
    },
    payload: { maxUnits: 2_000_000, maxRowUnits: 65_536, unitsOf: topic => topic.id.length + topic.label.length },
    onChange: () => {
      if (this._treeSource !== undefined) this.clearSourceDiagram();
      const old = this.sourcePaint++; this.requestUpdate('sourcePaint', old);
    },
    accepted: (action, row, _state, current) => {
      if (!current() || this.treeSource === undefined) return;
      if (action.type === 'toggle') this.emit('lr-topic-toggle', { topicId: action.key, expanded: action.expanded });
      else if (action.type === 'select' && row?.childCount === 0) this.emit('lr-topic-select', { topicId: action.key });
    },
  });

  /** Complete immutable provider preorder. Four 100-row pages and one focused row are retained;
   * at most 301 navigator rows mount. The diagram shows one connected subtree from those rows,
   * with provider child counts and expansion metadata. Nested value.children is never read.
   * Reassign even the same source or call requestUpdate() to refresh. Unset restores topics.
   * @default undefined */
  @property({ attribute: false })
  get treeSource(): MindMapSource | undefined { return this._treeSource; }
  set treeSource(value: MindMapSource | undefined) {
    const old = this._treeSource; this._treeSource = value; this.sourceVersion++;
    this.sourceWrapper = value === undefined ? undefined : this.wrapSource(value);
    this.clearSourceDiagram(); this.sourceControl?.update(this.sourceWrapper, this.effectiveLocale, true);
    this.layoutInvalidated = true; this.requestUpdate('treeSource', old);
  }

  /** Reveal and focus any full-source key without emitting a topic event. */
  revealSourceKey(key: string): Promise<boolean> {
    return this.treeSource === undefined ? Promise.resolve(false) : this.sourceControl.reveal(key);
  }

  private sourceAuthority(): () => boolean {
    const source = this.treeSource, version = this.sourceVersion, owner = this.ownerDocument;
    const epoch = this.sourceControl.epoch, projection = this.sourceControl.projection;
    const accepted = projection ? this.sourceViewAuthority.get(projection.rows) : undefined;
    const owned = () => this.isConnected && this.ownerDocument === owner && this.treeSource === source &&
      this.sourceVersion === version && this.sourceControl.epoch === epoch && this.sourceControl.projection === projection &&
      (source === undefined || !this.sourceControl.loading);
    return () => owned() && (source === undefined || Boolean(accepted?.())) && owned();
  }
  private wrapSource(source: MindMapSource): MindMapSource {
    const host = this;
    const wrapper: MindMapSource = {
      get revision() { return source.revision; },
      async project(request) {
        const version = host.sourceVersion, owner = host.ownerDocument;
        const owned = () => host.isConnected && host.ownerDocument === owner && host.treeSource === source &&
          host.sourceWrapper === wrapper && host.sourceVersion === version && !request.signal.aborted;
        const current = () => {
          if (!owned()) return false;
          try { const revision = source.revision; return owned() && revision === request.revision; }
          catch { return false; }
        };
        const check = () => { if (!current()) throw new Error('Topic source changed'); };
        check(); const project = source.project; check();
        const result = await project.call(source, request); check();
        const rows = result.rows; check();
        if (rows === null || typeof rows !== 'object') throw new TypeError('Invalid topic source rows');
        host.sourceViewAuthority.set(rows, current);
        return result;
      },
    };
    return wrapper;
  }
  private clearSourceDiagram(): void {
    this.sourceDiagramRows = new Map(); this.sourceDiagramCurrent = () => false;
    this.cachedLayout = { placed: [], links: [], width: 0, height: 0, centerX: 0, centerY: 0 };
  }
  override requestUpdate(name?: PropertyKey, oldValue?: unknown): void {
    if (this._treeSource !== undefined && name === undefined) {
      this.sourceVersion++; this.sourceWrapper = this.wrapSource(this._treeSource);
      this.clearSourceDiagram(); this.sourceControl?.update(this.sourceWrapper, this.effectiveLocale, true);
    }
    super.requestUpdate(name, oldValue);
  }
  private selectSourceRow(row: LyraHierarchyRow<LyraTopic>): void {
    if (row.disabled || this.sourceControl.loading || this.sourceControl.error) return;
    const current = this.sourceAuthority();
    const index = this.sourceControl.adapter.indexOfKey?.(row.key);
    if (!current() || typeof index !== 'number' || index < 0) return;
    const slot = this.sourceControl.slot(index);
    if (!current() || slot.state !== 'ready' || slot.value !== row) return;
    void this.sourceControl.project(row.childCount ? { type: 'toggle', key: row.key, expanded: !row.expanded } :
      { type: 'select', key: row.key, selected: true, scope: 'item' }, true, row);
  }
  private scheduleSourceDiagram(): void {
    if (this.sourceDiagramScheduled) return;
    this.sourceDiagramScheduled = true;
    queueMicrotask(() => {
      this.sourceDiagramScheduled = false;
      if (this.treeSource === undefined || !this.isConnected) return;
      const current = this.sourceAuthority(), control = this.sourceControl;
      const rows = new Map<string, LyraHierarchyRow<LyraTopic>>();
      if (!control.loading && !control.error) for (const element of control.list?.projectedRows ?? []) {
        if (rows.size === 301) break;
        const key = element.querySelector<HTMLElement>('[data-source-key]')?.dataset['sourceKey'];
        if (!key) continue;
        const slot = control.slot(Number(element.dataset['rowIndex']));
        if (!current()) return;
        if (slot.state === 'ready' && slot.value.key === key) rows.set(key, slot.value);
      }
      const previous = this.sourceDiagramRows;
      const root = [...rows.values()].find(row => row.parentKey === null || !rows.has(row.parentKey));
      const connected = new Map<string, LyraHierarchyRow<LyraTopic>>();
      const topics = new Map<string, LyraTopic & { children: LyraTopic[] }>();
      if (root) for (const row of rows.values()) {
        if (row !== root && (!row.parentKey || !connected.has(row.parentKey))) continue;
        const topic = { id: row.key, label: row.value.label, children: [] as LyraTopic[] };
        connected.set(row.key, row); topics.set(row.key, topic);
        if (row !== root) topics.get(row.parentKey!)!.children.push(topic);
      }
      if (!this.layoutInvalidated && connected.size === previous.size && [...connected].every(([key, row]) => previous.get(key) === row) && this.sourceDiagramCurrent()) return;
      const layout = createMindMapLayout(root ? [topics.get(root.key)!] : [])(this.label ?? this.localize('mindMapLabel'), {
        ringGap: this.ringGapPx(), rtl: isRtl(this), isExpanded: id => connected.get(id)?.expanded ?? false,
      });
      if (!current()) return;
      this.sourceDiagramRows = connected; this.sourceDiagramCurrent = current;
      this.cachedLayout = { ...layout, placed: layout.placed.map(node => ({ ...node,
        hasChildren: Boolean(connected.get(node.id)?.childCount), expanded: connected.get(node.id)?.expanded ?? false })) };
      this.layoutInvalidated = false;
      this.requestUpdate('sourceDiagram', false);
    });
  }

  private _topics: readonly LyraTopic[] = Object.freeze([]);
  private topicsSource: unknown = this._topics;
  private inputTruncated = false;

  /** A single root sits at the center; multiple roots hang off an implicit center hub whose
   *  visible text is `label`. A tree too large for one collection snapshot keeps its first
   *  50,000 inspected positions, shallowest first, with at most 64 descendant levels, as
   *  descriptor-safe `{ id, label, children }` records. A separate input notice reports omitted
   *  branches without counting descendants beyond the boundary. */
  @property({ attribute: false })
  get topics(): readonly LyraTopic[] {
    return this._topics;
  }
  set topics(value: readonly LyraTopic[]) {
    if (Object.is(value, this.topicsSource) || Object.is(value, this._topics)) return;
    const previous = this._topics;
    const snapshot = snapshotMindMapTopics(value);
    this.topicsSource = value;
    this._topics = snapshot.topics;
    this.inputTruncated = snapshot.truncated;
    this.requestUpdate('topics', previous);
  }
  /** Accessible name for the SVG group *and* the implicit hub's text; falls back to the localized
   *  `mindMapLabel` when omitted. An explicitly empty override stays empty. */
  @property() label?: string;
  /** Initial expansion depth (root + first ring). Expansion state is component-managed
   *  afterward, keyed by topic id, and survives `topics` reassignment. */
  @property({ type: Number, attribute: 'expand-depth' }) expandDepth = 1;

  @query('[part="svg"]') private svgEl?: SVGSVGElement;

  /** Explicit user overrides only -- the default (`depth < expandDepth`) is computed at read time
   *  in `isExpanded()`, so a user can override in either direction without losing the override on
   *  a later `topics` reassignment that reintroduces the same id. */
  @state() private expandedOverrides = new Map<string, boolean>();
  @state() private focusedId: string | null = null;
  @state() private liveText = '';

  private cachedLayout: MindMapLayoutResult = {
    placed: [],
    links: [],
    width: 0,
    height: 0,
    centerX: 0,
    centerY: 0,
  };
  /** The currently-visible (per expand state) topic count before `MAX_RENDERED_MIND_MAP_NODES`
   *  decimation -- the "of M" half of the truncation notice. */
  private totalTopicCount = 0;
  private topicsTruncated = false;
  private resizeObserver?: ResizeObserver;
  private resizeObserverDocument?: Document;
  private resizeRafId?: number;
  private resizeRafOwner?: Window;
  private resizeRafDocument?: Document;
  private ownerRealmGeneration = 0;
  private observedSize = '';
  private layoutInvalidated = true;
  private layoutContext = '';
  private announcementSink?: AnnouncementSink;

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.layoutInvalidated = true;
    this.armResizeObserver();
  }

  private armResizeObserver(): void {
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!this.isConnected || !ownerWindow?.ResizeObserver) return;
    if (this.resizeObserver && this.resizeObserverDocument === ownerDocument)
      return;
    this.resetResizeWork();
    const generation = this.ownerRealmGeneration;
    const observer = new ownerWindow.ResizeObserver((entries) => {
      if (
        this.resizeObserver !== observer ||
        this.resizeObserverDocument !== ownerDocument ||
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      const rect = entries[0]?.contentRect;
      const size = rect ? `${rect.width}:${rect.height}` : '';
      if (size && size === this.observedSize) return;
      this.observedSize = size;
      if (this.resizeRafId != null)
        this.resizeRafOwner?.cancelAnimationFrame(this.resizeRafId);
      const handle = ownerWindow.requestAnimationFrame(() => {
        if (
          this.resizeRafId !== handle ||
          this.resizeRafOwner !== ownerWindow ||
          this.resizeRafDocument !== ownerDocument ||
          this.ownerRealmGeneration !== generation ||
          !this.isConnected ||
          this.ownerDocument !== ownerDocument
        ) {
          return;
        }
        this.resizeRafId = undefined;
        this.resizeRafOwner = undefined;
        this.resizeRafDocument = undefined;
        this.layoutInvalidated = true;
        this.requestUpdate('layout', false);
      });
      this.resizeRafId = handle;
      this.resizeRafOwner = ownerWindow;
      this.resizeRafDocument = ownerDocument;
    });
    this.resizeObserver = observer;
    this.resizeObserverDocument = ownerDocument;
    observer.observe(this);
  }

  override disconnectedCallback(): void {
    this.sourceVersion++; this.clearSourceDiagram();
    this.resetResizeWork();
    this.announcementSink?.release();
    this.announcementSink = undefined;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.sourceControl.adopted();
    this.sourceVersion++; this.clearSourceDiagram();
    this.resetResizeWork();
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private resetResizeWork(): void {
    this.ownerRealmGeneration += 1;
    if (this.resizeRafId != null)
      this.resizeRafOwner?.cancelAnimationFrame(this.resizeRafId);
    this.resizeRafId = undefined;
    this.resizeRafOwner = undefined;
    this.resizeRafDocument = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeObserverDocument = undefined;
    this.observedSize = '';
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    value: string | null
  ): void {
    super.attributeChangedCallback(name, oldValue, value);
    if ((name === 'dir' || name === 'lang') && oldValue !== value) {
      this.layoutInvalidated = true;
      this.requestUpdate('layout', false);
    }
  }

  /** `expandDepth`, normalized to a finite non-negative integer (falling back to the property's own
   *  default of `1`) -- a raw `NaN` (e.g. an invalid `expand-depth` attribute) would otherwise make
   *  every `depth < expandDepth` comparison false, silently collapsing every ring instead of just
   *  falling back to the default. */
  private get effectiveExpandDepth(): number {
    return finiteCount(this.expandDepth, 1);
  }

  private isExpanded(id: string, depth: number): boolean {
    return this.expandedOverrides.get(id) ?? depth < this.effectiveExpandDepth;
  }

  /** Resolves `--lr-mind-map-ring-gap` to a real used pixel value for whatever unit it carries --
   *  a live root/host font-size read for rem/em (a hardcoded `* 16` gets ring spacing wrong on any
   *  page whose root font-size isn't the browser default 16px), delegated to the shared
   *  `resolveCssTokenLength()` so every unit-resolving component agrees on what a length means. A value
   *  with no usable pixel length (including a percentage with no base) falls back to the default
   *  gap rather than being read as raw pixels. CSS math uses the host's theme scope. */
  private ringGapPx(): number {
    const ownerWindow = this.ownerDocument.defaultView;
    const hostStyle = ownerWindow?.getComputedStyle(this) ?? this.style;
    const raw =
      hostStyle.getPropertyValue('--lr-mind-map-ring-gap').trim() ||
      hostStyle.getPropertyValue('--_lr-mind-map-ring-gap').trim();
    return resolveCssTokenLength(raw, { host: this }) ?? DEFAULT_RING_GAP_PX;
  }

  private laidOutInputs?: readonly unknown[];
  private layoutInputs(): readonly unknown[] {
    return [this.topics, this.expandDepth, this.expandedOverrides, this.label, this.strings, this.effectiveLocale];
  }
  private topicLayout?: { source: readonly LyraTopic[]; compute: ReturnType<typeof createMindMapLayout> };
  private relayout(): void {
    if (this.topicLayout?.source !== this.topics) this.topicLayout = { source: this.topics, compute: createMindMapLayout(this.topics) };
    const hubLabel =
      this.label == null ? this.localize('mindMapLabel') : this.label;
    const fullLayout = this.topicLayout.compute(hubLabel, {
      ringGap: this.ringGapPx(),
      rtl: isRtl(this),
      isExpanded: (id, depth) => this.isExpanded(id, depth),
    });
    this.laidOutInputs = this.layoutInputs();
    const decimated = decimateMindMapLayout(
      fullLayout.placed,
      fullLayout.links,
      MAX_RENDERED_MIND_MAP_NODES
    );
    this.totalTopicCount = decimated.totalCount;
    this.topicsTruncated = decimated.truncated;
    this.cachedLayout = {
      ...fullLayout,
      placed: [...decimated.placed],
      links: [...decimated.links],
    };
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.sourceControl.update(this.sourceWrapper, this.effectiveLocale);
    if (this.treeSource !== undefined) {
      if (changed.has('label') || changed.has('strings') || changed.has('locale')) this.layoutInvalidated = true;
      this.scheduleSourceDiagram(); return;
    }
    if (this.hasUpdated && changed.has('topics') && this.inputTruncated)
      this.announcementSink?.announce(this.localize('mindMapInputLimit'));
    const hubLabel =
      this.label == null ? this.localize('mindMapLabel') : this.label;
    // The ring gap is re-read only by a relayout (connect, resize, dir/lang, structural change).
    const context = `${hubLabel}\u0000${isRtl(this) ? 'rtl' : 'ltr'}`;
    const structuralChange =
      changed.has('topics') ||
      changed.has('expandDepth') ||
      changed.has('expandedOverrides') ||
      changed.has('label') ||
      changed.has('strings') ||
      changed.has('locale');
    if (
      this.layoutInvalidated ||
      (structuralChange && (!this.laidOutInputs || this.layoutInputs().some((value, index) => value !== this.laidOutInputs![index]))) ||
      context !== this.layoutContext
    ) {
      this.relayout();
      this.layoutContext = context;
      this.layoutInvalidated = false;
      if (
        this.focusedId &&
        !this.cachedLayout.placed.some((topic) => topic.id === this.focusedId)
      ) {
        this.focusedId = this.cachedLayout.placed[0]?.id ?? null;
      }
    }
  }

  private setAnnouncement(text: string): void {
    this.liveText = text;
    this.announcementSink?.announce(text);
  }

  private toggle(node: PlacedTopic, announce = true): void {
    if (this.treeSource !== undefined) {
      const row = this.sourceDiagramRows.get(node.id);
      if (row && this.sourceDiagramCurrent()) this.selectSourceRow(row);
      return;
    }
    const expanded = !this.isExpanded(node.id, node.depth);
    const next = new Map(this.expandedOverrides);
    next.set(node.id, expanded);
    this.expandedOverrides = next;
    this.emit('lr-topic-toggle', { topicId: node.id, expanded });
    if (announce) {
      this.setAnnouncement(
        this.localize(
          expanded ? 'mindMapExpanded' : 'mindMapCollapsed',
          undefined,
          { label: node.label }
        )
      );
    }
  }

  private activate(node: PlacedTopic): void {
    if (this.treeSource !== undefined) {
      const row = this.sourceDiagramRows.get(node.id);
      if (row && this.sourceDiagramCurrent()) this.selectSourceRow(row);
      return;
    }
    if (node.hasChildren) this.toggle(node);
    else this.emit('lr-topic-select', { topicId: node.id });
  }

  private siblingsOf(node: PlacedTopic): PlacedTopic[] {
    return this.cachedLayout.placed.filter((p) => p.parentId === node.parentId);
  }

  private childrenOf(id: string): PlacedTopic[] {
    return this.cachedLayout.placed.filter((p) => p.parentId === id);
  }

  private announce(node: PlacedTopic): void {
    const numberFormat = getNumberFormat(this.effectiveLocale);
    this.setAnnouncement(
      node.hasChildren
        ? this.localize('mindMapTopicStatus', undefined, {
            label: node.label,
            level: numberFormat.format(node.depth + 1),
            count: numberFormat.format(this.childrenOf(node.id).length),
          })
        : this.localize('mindMapLeafStatus', undefined, {
            label: node.label,
            level: numberFormat.format(node.depth + 1),
          })
    );
  }

  private focusNodeById(id: string): void {
    this.focusedId = id;
    const node = this.cachedLayout.placed.find((p) => p.id === id);
    if (node) this.announce(node);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.treeSource !== undefined) {
      if (!this.sourceDiagramCurrent()) return;
      const row = this.sourceDiagramRows.get(this.focusedId ?? '') ?? this.sourceDiagramRows.values().next().value;
      if (!row) return;
      const index = this.sourceControl.window.source.indexOfKey?.(row.key);
      if (typeof index === 'number' && index >= 0) this.sourceControl.keydown(e, row, index, isRtl(this), selected => this.selectSourceRow(selected));
      return;
    }
    const placed = this.cachedLayout.placed;
    if (placed.length === 0 || !NAV_KEYS.has(e.key)) return;
    e.preventDefault();
    if (this.focusedId === null) {
      this.focusNodeById(placed[0]!.id);
      return;
    }
    const current = placed.find((p) => p.id === this.focusedId);
    if (!current) return;

    if (e.key === 'Enter' || e.key === ' ') {
      if (!e.repeat) this.activate(current);
      return;
    }
    if (e.key === 'ArrowUp') {
      if (current.parentId) this.focusNodeById(current.parentId);
      return;
    }
    if (e.key === 'ArrowDown') {
      if (!current.hasChildren) return;
      // The destination topic status is the useful announcement for this single gesture. The old
      // shadow live region batched the intermediate expansion text away in the same Lit update.
      if (!this.isExpanded(current.id, current.depth)) {
        this.toggle(current, false);
        this.relayout();
      }
      const child = this.childrenOf(current.id)[0];
      if (child) this.focusNodeById(child.id);
      return;
    }
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (
      e.key === forwardKey ||
      e.key === backwardKey ||
      e.key === 'Home' ||
      e.key === 'End'
    ) {
      const siblings = this.siblingsOf(current);
      const index = siblings.findIndex((s) => s.id === current.id);
      let next = index;
      if (e.key === forwardKey) next = Math.min(siblings.length - 1, index + 1);
      else if (e.key === backwardKey) next = Math.max(0, index - 1);
      else if (e.key === 'Home') next = 0;
      else next = siblings.length - 1;
      const target = siblings[next];
      if (target) this.focusNodeById(target.id);
    }
  };

  // Tabbing into the single-tab-stop svg has to show something: the drawn focus ring only renders
  // once focusedId is non-null, and the svg's own outline is suppressed, so a bare Tab used to land
  // with no visible focus state at all until the first arrow press. Seeding the first placed topic
  // here draws the ring immediately. Native "focus" does not bubble, so it can never be caught by a
  // delegated listener -- "focusin" does, and covers focus landing on the svg or on anything the
  // layout ever nests inside it.
  private onFocusIn = (): void => {
    if (this.focusedId !== null) return;
    const first = this.cachedLayout.placed[0];
    if (first) this.focusedId = first.id;
  };

  private onNodeClick(node: PlacedTopic): void {
    if (this.treeSource !== undefined) { this.activate(node); return; }
    this.focusedId = node.id;
    this.svgEl?.focus();
    // A parent activation ends in its expanded/collapsed state; a leaf has no toggle text, so its
    // positional status remains the announcement. This preserves the old single-update behavior.
    if (!node.hasChildren) this.announce(node);
    this.activate(node);
  }

  private connectorControlPoint(
    from: PlacedTopic,
    to: PlacedTopic
  ): { x: number; y: number } {
    const layout = this.cachedLayout;
    const parentR = Math.hypot(
      from.x - layout.centerX,
      from.y - layout.centerY
    );
    const dir = isRtl(this) ? -1 : 1;
    return {
      x: layout.centerX + dir * parentR * Math.sin(to.angle),
      y: layout.centerY - parentR * Math.cos(to.angle),
    };
  }

  private renderSemanticNode(
    node: PlacedTopic,
    childrenByParent: Map<string | null, PlacedTopic[]>
  ): TemplateResult {
    const children = childrenByParent.get(node.id) ?? [];
    return html`
      <div
        role="treeitem"
        aria-level=${node.depth + 1}
        aria-expanded=${node.hasChildren
          ? node.expanded
            ? 'true'
            : 'false'
          : nothing}
      >
        <span>${node.label}</span>
        ${children.length
          ? html`<div role="group">
              ${children.map((child) =>
                this.renderSemanticNode(child, childrenByParent)
              )}
            </div>`
          : nothing}
      </div>
    `;
  }

  private renderInputLimit(): TemplateResult | typeof nothing {
    return this.inputTruncated
      ? html`<p part="input-limit" role="note">${this.localize('mindMapInputLimit')}</p>`
      : nothing;
  }

  override render(): TemplateResult {
    if (this.treeSource === undefined) return this.renderDiagram();
    const projection = this.sourceControl.projection;
    return html`${hierarchySourceView(this.sourceControl, {
      label: this.label ?? this.localize('mindMapLabel'), rtl: this.effectiveDirection === 'rtl', multiple: false,
      loading: this.localize('loading'), error: this.localize('treeSourceError'), empty: this.localize('noData'),
      retry: this.localize('retry'), expand: this.localize('expand'), collapse: this.localize('collapse'),
      summary: projection ? this.localize('treeSourceSummary', undefined, {
        visible: getNumberFormat(this.effectiveLocale).format(projection.rows.count), total: getNumberFormat(this.effectiveLocale).format(projection.total),
      }) : '', content: topic => { this.scheduleSourceDiagram(); return topic.label; }, name: topic => topic.label,
      select: row => this.selectSourceRow(row),
    })}<div part="source-diagram">${this.renderDiagram()}</div>
      <p part="limit" role="note">${this.localize('mindMapNodeLimit', undefined, {
        shown: getNumberFormat(this.effectiveLocale).format(this.cachedLayout.placed.length),
        total: getNumberFormat(this.effectiveLocale).format(projection?.rows.count ?? 0),
      })}</p>`;
  }

  private renderDiagram(): TemplateResult {
    const sourceMode = this.treeSource !== undefined;
    const current = this.sourceAuthority();
    const layout = this.cachedLayout;
    if (layout.placed.length === 0) {
      if (sourceMode) return html``;
      return html`<div part="base">
        <div part="empty">${this.localize('noData')}</div>
        ${sourceMode ? nothing : this.renderInputLimit()}
      </div>`;
    }
    // A host aria-label names the complete component. The interactive SVG keeps
    // a purpose-specific name and the parallel semantic tree is unnamed so each
    // representation has one distinct semantic owner.
    const ariaLabel =
      this.label == null ? this.localize('mindMapLabel') : this.label;
    const byId = new Map(layout.placed.map((p) => [p.id, p]));
    const childrenByParent = new Map<string | null, PlacedTopic[]>();
    for (const topic of layout.placed) {
      const siblings = childrenByParent.get(topic.parentId);
      if (siblings) siblings.push(topic);
      else childrenByParent.set(topic.parentId, [topic]);
    }
    const focused = this.focusedId ? byId.get(this.focusedId) : undefined;
    return html`
      <div part="base">
        <svg
          part="svg"
          role="group"
          aria-label=${ariaLabel}
          aria-describedby="mind-map-live"
          tabindex="0"
          viewBox="0 0 ${layout.width} ${layout.height}"
          @keydown=${(event: KeyboardEvent) => { if (current()) this.onKeyDown(event); }}
          @focusin=${this.onFocusIn}
        >
          ${layout.links.map((link) => {
            const from = byId.get(link.fromId);
            const to = byId.get(link.toId);
            if (!from || !to) return nothing;
            const control = this.connectorControlPoint(from, to);
            return svg`<path part="link" d="M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}" fill="none"></path>`;
          })}
          ${layout.placed.map(
            (node) => svg`
              <g part="node" data-id=${node.id} style=${`transform: translate(${node.x}px, ${node.y}px)`} @click=${() =>
              current() && this.onNodeClick(node)}>
                <line
                  class="node-hit"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="0"
                  aria-hidden="true"
                  focusable="false"
                  vector-effect="non-scaling-stroke"
                ></line>
                <circle r="4" aria-hidden="true"></circle>
                <text part="node-label" aria-hidden="true" text-anchor="middle" dy="-8">${
                  node.label
                }</text>
              </g>
            `
          )}
          ${focused
            ? svg`<circle part="focus-ring" cx=${focused.x} cy=${focused.y} r="10"></circle>`
            : nothing}
        </svg>
        ${sourceMode ? nothing : this.renderInputLimit()}
        ${!sourceMode && this.topicsTruncated
          ? html`<p part="limit" role="note">${this.localize('mindMapNodeLimit', undefined, {
                shown: getNumberFormat(this.effectiveLocale).format(layout.placed.length),
                total: getNumberFormat(this.effectiveLocale).format(this.totalTopicCount),
              })}</p>`
          : nothing}
        ${sourceMode ? nothing : html`<div class="sr-only" role="tree">
          ${(childrenByParent.get(null) ?? []).map((topic) =>
            this.renderSemanticNode(topic, childrenByParent)
          )}
        </div>
        `}
        <div id="mind-map-live" part="live-region" class="sr-only">
          ${this.liveText}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-mind-map': LyraMindMap;
  }
}
