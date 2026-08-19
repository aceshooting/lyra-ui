import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraEntity } from '../../retrieval/entity-card/entity-card.class.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
export type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import { styles } from './drilldown-panel.styles.js';
import '../breadcrumb/breadcrumb.class.js';
import '../breadcrumb/breadcrumb-item.class.js';
import type {
  LyraTabGroup,
  LyraTabGroupEventMap,
} from '../tab-group/tab-group.class.js';
import '../tab-group/tab-group.class.js';
import '../tab-group/tab.class.js';
import '../tab-group/tab-panel.class.js';
import '../../viewers/document-preview/document-preview.class.js';
import '../../retrieval/entity-card/entity-card.class.js';
import '../../retrieval/source-card/source-card.class.js';
import '../../forms/button/button.class.js';
import '../../overlays/empty/empty.class.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_drilldownDocuments, LYRA_DEFAULT_drilldownEmpty, LYRA_DEFAULT_drilldownRuns, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_items, LYRA_DEFAULT_next, LYRA_DEFAULT_noData, LYRA_DEFAULT_paginationLabel, LYRA_DEFAULT_paginationSummary, LYRA_DEFAULT_previous, LYRA_DEFAULT_provenanceEntities, LYRA_DEFAULT_sourceListDefaultLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type LyraDrilldownCategory =
  | 'evidence'
  | 'documents'
  | 'entities'
  | 'runs';

/** One immutable citation/source excerpt in a drilldown node. */
export interface LyraDrilldownEvidenceItem {
  readonly evidenceId: string;
  readonly title: string;
  readonly page?: string | number;
  readonly href?: string;
  readonly excerpt?: string;
  readonly full?: string;
}

/** One immutable document reference in a drilldown node. */
export interface LyraDrilldownDocument {
  readonly documentId: string;
  readonly name: string;
  readonly mimeType?: string;
  readonly uri?: string;
  readonly version?: string;
}

/** One immutable entity record in a drilldown node. */
export interface LyraDrilldownEntity {
  readonly entityId: string;
  readonly label: string;
  readonly type?: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, string | number>>;
  readonly degree?: number;
  readonly communityId?: string;
}

/** A node-type style forwarded to the composed entity cards. */

/** One immutable level of the controlled drilldown path. */
export interface LyraDrilldownNode {
  readonly nodeId: string;
  readonly label: string;
  readonly evidence?: readonly LyraDrilldownEvidenceItem[];
  readonly documents?: readonly LyraDrilldownDocument[];
  readonly entities?: readonly LyraDrilldownEntity[];
}

/** `detail` for `lr-drilldown-navigate`. */
export interface LyraDrilldownNavigateDetail {
  readonly nodeId: string;
  readonly index: number;
}

/** `detail` for the controlled `lr-drilldown-category-change` request. */
export interface LyraDrilldownCategoryChangeDetail {
  readonly nodeId: string;
  readonly category: LyraDrilldownCategory;
  readonly previousCategory: LyraDrilldownCategory;
}

export interface LyraDrilldownEvidenceExpandDetail {
  readonly nodeId: string;
  readonly evidenceId: string;
  readonly expanded: boolean;
}

export interface LyraDrilldownEvidenceOpenDetail {
  readonly nodeId: string;
  readonly evidenceId: string;
  readonly href?: string;
}

export interface LyraDrilldownDocumentDownloadDetail {
  readonly nodeId: string;
  readonly documentId: string;
  readonly src: string;
  readonly filename: string;
}

export interface LyraDrilldownDocumentRenderErrorDetail {
  readonly nodeId: string;
  readonly documentId: string;
  readonly error: unknown;
}

export interface LyraDrilldownDocumentHighlightActivateDetail {
  readonly nodeId: string;
  readonly documentId: string;
  readonly highlightId: string;
}

export interface LyraDrilldownEntityActivateDetail {
  readonly nodeId: string;
  readonly entityId: string;
}

export interface LyraDrilldownPanelEventMap {
  'lr-drilldown-navigate': CustomEvent<LyraDrilldownNavigateDetail>;
  'lr-drilldown-category-change': CustomEvent<LyraDrilldownCategoryChangeDetail>;
  'lr-drilldown-evidence-expand': CustomEvent<LyraDrilldownEvidenceExpandDetail>;
  'lr-drilldown-evidence-open': CustomEvent<LyraDrilldownEvidenceOpenDetail>;
  'lr-drilldown-document-download': CustomEvent<LyraDrilldownDocumentDownloadDetail>;
  'lr-drilldown-document-render-error': CustomEvent<LyraDrilldownDocumentRenderErrorDetail>;
  'lr-drilldown-document-highlight-activate': CustomEvent<LyraDrilldownDocumentHighlightActivateDetail>;
  'lr-drilldown-entity-activate': CustomEvent<LyraDrilldownEntityActivateDetail>;
}

interface DrilldownCategoryDefinition {
  readonly key: LyraDrilldownCategory;
  readonly label: string;
}

interface NormalizedCollection<T> {
  readonly items: readonly T[];
  readonly sourceCount: number;
}

interface NormalizedNode {
  readonly node: LyraDrilldownNode;
  readonly sourceCounts: Readonly<
    Record<'evidence' | 'documents' | 'entities', number>
  >;
}

interface NormalizedPath {
  readonly path: readonly LyraDrilldownNode[];
  readonly sourceCount: number;
  readonly categorySourceCounts: ReadonlyMap<
    string,
    Readonly<Record<'evidence' | 'documents' | 'entities', number>>
  >;
}

const MAX_PATH_NODES = 256;
const MAX_CATEGORY_ITEMS = 1_000;
const MAX_NODE_TYPES = 256;
const MAX_ENTITY_PROPERTIES = 128;
const MAX_ID_LENGTH = 256;
const MAX_LABEL_LENGTH = 4_096;
const MAX_TEXT_LENGTH = 65_536;
const MAX_URL_LENGTH = 8_192;
const ACTIVE_PAGE_SIZE = 8;

const EMPTY_PATH: readonly LyraDrilldownNode[] = Object.freeze([]);
const EMPTY_TYPES: readonly LyraNodeTypeStyle[] = Object.freeze([]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  } catch {
    return false;
  }
}

function ownDataValue(record: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function safeArrayLength(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = descriptor && 'value' in descriptor ? descriptor.value : 0;
    return typeof length === 'number' && Number.isFinite(length)
      ? Math.max(0, Math.floor(length))
      : 0;
  } catch {
    return 0;
  }
}

function arrayItem(value: readonly unknown[], index: number): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length <= maxLength
    ? value
    : undefined;
}

function domainId(value: unknown): string | undefined {
  const id = boundedString(value, MAX_ID_LENGTH);
  return id && id === id.trim() ? id : undefined;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  maxLength = MAX_TEXT_LENGTH
): string | undefined {
  return boundedString(ownDataValue(record, key), maxLength);
}

function normalizeUniqueCollection<T>(
  value: unknown,
  limit: number,
  normalize: (candidate: unknown) => readonly [string, T] | undefined,
  startIndex = 0
): NormalizedCollection<T> {
  const sourceCount = safeArrayLength(value);
  if (!Array.isArray(value) || sourceCount === 0) {
    return { items: Object.freeze([]), sourceCount };
  }

  const items: T[] = [];
  const seen = new Set<string>();
  const end = Math.min(sourceCount, startIndex + limit);
  for (let index = startIndex; index < end; index += 1) {
    const normalized = normalize(arrayItem(value, index));
    if (!normalized || seen.has(normalized[0])) continue;
    seen.add(normalized[0]);
    items.push(normalized[1]);
  }
  return { items: Object.freeze(items), sourceCount };
}

function normalizeEvidence(
  candidate: unknown
): readonly [string, LyraDrilldownEvidenceItem] | undefined {
  if (!isPlainRecord(candidate)) return undefined;
  const evidenceId = domainId(ownDataValue(candidate, 'evidenceId'));
  const title = boundedString(
    ownDataValue(candidate, 'title'),
    MAX_LABEL_LENGTH
  );
  if (!evidenceId || title === undefined) return undefined;

  const rawPage = ownDataValue(candidate, 'page');
  const page =
    typeof rawPage === 'number' && Number.isFinite(rawPage)
      ? rawPage
      : boundedString(rawPage, MAX_LABEL_LENGTH);
  const item = Object.freeze({
    evidenceId,
    title,
    ...(page !== undefined ? { page } : {}),
    ...(optionalString(candidate, 'href', MAX_URL_LENGTH) !== undefined
      ? { href: optionalString(candidate, 'href', MAX_URL_LENGTH) }
      : {}),
    ...(optionalString(candidate, 'excerpt') !== undefined
      ? { excerpt: optionalString(candidate, 'excerpt') }
      : {}),
    ...(optionalString(candidate, 'full') !== undefined
      ? { full: optionalString(candidate, 'full') }
      : {}),
  });
  return [evidenceId, item];
}

function normalizeDocument(
  candidate: unknown
): readonly [string, LyraDrilldownDocument] | undefined {
  if (!isPlainRecord(candidate)) return undefined;
  const documentId = domainId(ownDataValue(candidate, 'documentId'));
  const name = boundedString(ownDataValue(candidate, 'name'), MAX_LABEL_LENGTH);
  if (!documentId || name === undefined) return undefined;
  const document = Object.freeze({
    documentId,
    name,
    ...(optionalString(candidate, 'mimeType', MAX_LABEL_LENGTH) !== undefined
      ? { mimeType: optionalString(candidate, 'mimeType', MAX_LABEL_LENGTH) }
      : {}),
    ...(optionalString(candidate, 'uri', MAX_URL_LENGTH) !== undefined
      ? { uri: optionalString(candidate, 'uri', MAX_URL_LENGTH) }
      : {}),
    ...(optionalString(candidate, 'version', MAX_LABEL_LENGTH) !== undefined
      ? { version: optionalString(candidate, 'version', MAX_LABEL_LENGTH) }
      : {}),
  });
  return [documentId, document];
}

function normalizeProperties(
  value: unknown
): Readonly<Record<string, string | number>> | undefined {
  if (!isPlainRecord(value)) return undefined;
  let keys: string[];
  try {
    keys = Object.getOwnPropertyNames(value).slice(0, MAX_ENTITY_PROPERTIES);
  } catch {
    return undefined;
  }
  const properties: Record<string, string | number> = {};
  for (const key of keys) {
    if (!key || key.length > MAX_ID_LENGTH) continue;
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      continue;
    }
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      continue;
    }
    const entry = descriptor.value;
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      properties[key] = entry;
    } else {
      const text = boundedString(entry, MAX_TEXT_LENGTH);
      if (text !== undefined) properties[key] = text;
    }
  }
  return Object.keys(properties).length > 0
    ? Object.freeze(properties)
    : undefined;
}

function normalizeEntity(
  candidate: unknown
): readonly [string, LyraDrilldownEntity] | undefined {
  if (!isPlainRecord(candidate)) return undefined;
  const entityId = domainId(ownDataValue(candidate, 'entityId'));
  const label = boundedString(
    ownDataValue(candidate, 'label'),
    MAX_LABEL_LENGTH
  );
  if (!entityId || label === undefined) return undefined;
  const rawDegree = ownDataValue(candidate, 'degree');
  const degree =
    typeof rawDegree === 'number' && Number.isFinite(rawDegree)
      ? Math.max(0, Math.floor(rawDegree))
      : undefined;
  const properties = normalizeProperties(ownDataValue(candidate, 'properties'));
  const entity = Object.freeze({
    entityId,
    label,
    ...(optionalString(candidate, 'type', MAX_ID_LENGTH) !== undefined
      ? { type: optionalString(candidate, 'type', MAX_ID_LENGTH) }
      : {}),
    ...(optionalString(candidate, 'description') !== undefined
      ? { description: optionalString(candidate, 'description') }
      : {}),
    ...(properties ? { properties } : {}),
    ...(degree !== undefined ? { degree } : {}),
    ...(optionalString(candidate, 'communityId', MAX_ID_LENGTH) !== undefined
      ? { communityId: optionalString(candidate, 'communityId', MAX_ID_LENGTH) }
      : {}),
  });
  return [entityId, entity];
}

function normalizeNode(candidate: unknown): NormalizedNode | undefined {
  if (!isPlainRecord(candidate)) return undefined;
  const nodeId = domainId(ownDataValue(candidate, 'nodeId'));
  const label = boundedString(
    ownDataValue(candidate, 'label'),
    MAX_LABEL_LENGTH
  );
  if (!nodeId || label === undefined) return undefined;

  const evidence = normalizeUniqueCollection(
    ownDataValue(candidate, 'evidence'),
    MAX_CATEGORY_ITEMS,
    normalizeEvidence
  );
  const documents = normalizeUniqueCollection(
    ownDataValue(candidate, 'documents'),
    MAX_CATEGORY_ITEMS,
    normalizeDocument
  );
  const entities = normalizeUniqueCollection(
    ownDataValue(candidate, 'entities'),
    MAX_CATEGORY_ITEMS,
    normalizeEntity
  );
  const node = Object.freeze({
    nodeId,
    label,
    ...(evidence.items.length > 0 ? { evidence: evidence.items } : {}),
    ...(documents.items.length > 0 ? { documents: documents.items } : {}),
    ...(entities.items.length > 0 ? { entities: entities.items } : {}),
  });
  return {
    node,
    sourceCounts: Object.freeze({
      evidence: evidence.sourceCount,
      documents: documents.sourceCount,
      entities: entities.sourceCount,
    }),
  };
}

function normalizePath(value: unknown): NormalizedPath {
  const sourceCount = safeArrayLength(value);
  if (!Array.isArray(value) || sourceCount === 0) {
    return {
      path: EMPTY_PATH,
      sourceCount,
      categorySourceCounts: new Map(),
    };
  }
  const startIndex = Math.max(0, sourceCount - MAX_PATH_NODES);
  const path: LyraDrilldownNode[] = [];
  const seen = new Set<string>();
  const categorySourceCounts = new Map<
    string,
    Readonly<Record<'evidence' | 'documents' | 'entities', number>>
  >();
  for (let index = startIndex; index < sourceCount; index += 1) {
    const normalized = normalizeNode(arrayItem(value, index));
    if (!normalized || seen.has(normalized.node.nodeId)) continue;
    seen.add(normalized.node.nodeId);
    path.push(normalized.node);
    categorySourceCounts.set(normalized.node.nodeId, normalized.sourceCounts);
  }
  return {
    path: Object.freeze(path),
    sourceCount,
    categorySourceCounts,
  };
}

function normalizeNodeType(
  candidate: unknown
): readonly [string, LyraNodeTypeStyle] | undefined {
  if (!isPlainRecord(candidate)) return undefined;
  const id = domainId(ownDataValue(candidate, 'id'));
  const label = boundedString(
    ownDataValue(candidate, 'label'),
    MAX_LABEL_LENGTH
  );
  if (!id || label === undefined) return undefined;
  const rawShape = ownDataValue(candidate, 'shape');
  const shape =
    rawShape === 'circle' || rawShape === 'square' || rawShape === 'diamond'
      ? rawShape
      : undefined;
  const color = optionalString(candidate, 'color', MAX_LABEL_LENGTH);
  return [
    id,
    Object.freeze({
      id,
      label,
      ...(color !== undefined ? { color } : {}),
      ...(shape !== undefined ? { shape } : {}),
    }),
  ];
}

function normalizeTypes(value: unknown): readonly LyraNodeTypeStyle[] {
  return normalizeUniqueCollection(value, MAX_NODE_TYPES, normalizeNodeType)
    .items;
}

function normalizeCategory(value: unknown): LyraDrilldownCategory | '' {
  return value === 'evidence' ||
    value === 'documents' ||
    value === 'entities' ||
    value === 'runs'
    ? value
    : '';
}

/**
 * `<lr-drilldown-panel>` — a controlled navigation and category shell for related evidence,
 * documents, entities, and host-rendered agent runs.
 *
 * `path` is normalized into a bounded, clone-owned, deeply frozen snapshot. Nodes use `nodeId`,
 * evidence uses `evidenceId`, documents use `documentId`, and entities use `entityId`; invalid or
 * later duplicate identities are ignored. Activating a non-current breadcrumb emits a frozen
 * `lr-drilldown-navigate` request and never mutates `path`.
 *
 * `activeCategory` is controlled too. The first available category is the fallback while the
 * property is empty or unavailable. A tab interaction emits `lr-drilldown-category-change`, then
 * restores the authored category unless the host accepts the request by assigning the property.
 * Only the effective category's children are mounted. Its records are paged eight at a time, so a
 * document category owns at most eight simultaneous `lr-document-preview` resource lifecycles;
 * replacement, paging, category changes, and disconnect remove obsolete previews and let each
 * preview abort its owner-realm fetch. A localized range reports every bounded page and any input
 * omitted by the schema ceiling.
 *
 * Events from composed source cards, document previews, entity cards, and tabs do not leak raw.
 * Each supported child event is either contained or translated to a drilldown event carrying the
 * current `nodeId` plus its domain item identity. Events from consumer-owned `runs` slot content
 * remain consumer-owned and continue bubbling normally.
 *
 * @customElement lr-drilldown-panel
 * @slot runs - Host-rendered agent-run content for the current node's Agent runs category.
 * @event lr-drilldown-navigate - Frozen breadcrumb request detail `{ nodeId, index }`.
 * @event lr-drilldown-category-change - Frozen controlled request detail `{ nodeId, category, previousCategory }`.
 * @event lr-drilldown-evidence-expand - Correlated evidence expansion detail.
 * @event lr-drilldown-evidence-open - Correlated evidence activation detail.
 * @event lr-drilldown-document-download - Correlated document download detail.
 * @event lr-drilldown-document-render-error - Correlated document render failure detail.
 * @event lr-drilldown-document-highlight-activate - Correlated document highlight detail.
 * @event lr-drilldown-entity-activate - Correlated entity activation detail.
 * @csspart base - The root wrapper.
 * @csspart breadcrumb - The nested breadcrumb trail.
 * @csspart breadcrumb-item - One nested breadcrumb item.
 * @csspart breadcrumb-button - A non-current breadcrumb's clickable label.
 * @csspart content - The current category content or empty state.
 * @csspart tabs - The nested tab group when multiple categories are available.
 * @csspart category - The mounted active category wrapper.
 * @csspart evidence-item - One nested source card.
 * @csspart document-item - One nested document preview.
 * @csspart entity-item - One nested entity card.
 * @csspart pagination - Controls and range summary for a bounded category page.
 * @csspart pagination-summary - The localized visible range.
 * @csspart previous-button - The previous-page button.
 * @csspart next-button - The next-page button.
 * @csspart limit - A localized range reporting schema-truncated input.
 * @csspart empty - The empty state.
 * @status stable
 * @since 4.1.0
 */
export class LyraDrilldownPanel extends LyraElement<LyraDrilldownPanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    drilldownDocuments: LYRA_DEFAULT_drilldownDocuments,
    drilldownEmpty: LYRA_DEFAULT_drilldownEmpty,
    drilldownRuns: LYRA_DEFAULT_drilldownRuns,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    items: LYRA_DEFAULT_items,
    next: LYRA_DEFAULT_next,
    noData: LYRA_DEFAULT_noData,
    paginationLabel: LYRA_DEFAULT_paginationLabel,
    paginationSummary: LYRA_DEFAULT_paginationSummary,
    previous: LYRA_DEFAULT_previous,
    provenanceEntities: LYRA_DEFAULT_provenanceEntities,
    sourceListDefaultLabel: LYRA_DEFAULT_sourceListDefaultLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private effectivePath: readonly LyraDrilldownNode[] = EMPTY_PATH;
  private pathSourceCount = 0;
  private pathRevision = 0;
  private categorySourceCounts: ReadonlyMap<
    string,
    Readonly<Record<'evidence' | 'documents' | 'entities', number>>
  > = new Map();

  /** Full host-owned breadcrumb trail. Assigning snapshots valid records into bounded immutable
   * storage; invalid records and later duplicate `nodeId` values are ignored. */
  @property({ attribute: false })
  get path(): readonly LyraDrilldownNode[] {
    return this.effectivePath;
  }
  set path(value: readonly LyraDrilldownNode[]) {
    const previous = this.effectivePath;
    const normalized = normalizePath(value);
    this.effectivePath = normalized.path;
    this.pathSourceCount = normalized.sourceCount;
    this.categorySourceCounts = normalized.categorySourceCounts;
    this.pathRevision += 1;
    this.requestUpdate('path', previous);
  }

  private effectiveTypes: readonly LyraNodeTypeStyle[] = EMPTY_TYPES;

  /** Immutable node-type styling forwarded to entity cards. Invalid and duplicate entries are
   * ignored. This is structurally identical to the graph/entity node-style vocabulary. */
  @property({ attribute: false })
  get types(): readonly LyraNodeTypeStyle[] {
    return this.effectiveTypes;
  }
  set types(value: readonly LyraNodeTypeStyle[]) {
    const previous = this.effectiveTypes;
    this.effectiveTypes = normalizeTypes(value);
    this.requestUpdate('types', previous);
  }

  private activeCategoryValue: LyraDrilldownCategory | '' = '';

  /** Host-owned active category. Empty or unavailable values resolve to the first populated
   * category without changing the authored value. User interaction emits a request only. */
  @property({ attribute: 'active-category', reflect: true })
  get activeCategory(): LyraDrilldownCategory | '' {
    return this.activeCategoryValue;
  }
  set activeCategory(value: LyraDrilldownCategory | '') {
    const previous = this.activeCategoryValue;
    this.activeCategoryValue = normalizeCategory(value);
    this.requestUpdate('activeCategory', previous);
  }

  /** Forwarded to every nested entity card. */
  @property({ attribute: 'community-label' }) communityLabel = '';

  /** Forwarded to every nested entity card. */
  @property({
    type: Boolean,
    attribute: 'show-focus-button',
    converter: trueDefaultBooleanConverter,
  })
  showFocusButton = true;

  /** Accessible name forwarded to the current category owner. `null` leaves a tab strip unnamed
   * and uses the category label for a sole region; an explicit empty string is preserved. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private hasRunsSlot = false;
  @state() private categoryPage = 0;

  private pageContext = '';
  private mutationObserver?: MutationObserver;
  private mutationObserverDocument?: Document;
  private mutationObserverGeneration = 0;
  private announcementSink?: AnnouncementSink;
  private announcementsArmed = false;
  private announcedLimits = new Map<string, string>();
  /** The most recently translated `lr-entity-select`/`lr-entity-activate` detail object, by
   *  reference. `lr-entity-card` emits both events from one gesture, unsnapshotted and sharing
   *  one `detail` object -- `onEntityActivate` is bound to both names on every entity card, so
   *  this lets it recognize "already translated this gesture" and emit exactly one
   *  `lr-drilldown-entity-activate`, regardless of which of the two events reaches it first. */
  private translatedEntityGestureDetail?: { entityId: string };

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
    this.syncRunsSlot();
    this.armMutationObserver();
  }

  private armMutationObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected) return;
    if (
      this.mutationObserver &&
      this.mutationObserverDocument === ownerDocument
    ) {
      return;
    }
    this.resetMutationObserver();
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.mutationObserverGeneration;
    const observer = new MutationObserverCtor(() => {
      if (
        this.mutationObserver !== observer ||
        this.mutationObserverDocument !== ownerDocument ||
        this.mutationObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.syncRunsSlot();
    });
    this.mutationObserver = observer;
    this.mutationObserverDocument = ownerDocument;
    observer.observe(this, {
      childList: true,
      attributes: true,
      attributeFilter: ['slot'],
      subtree: true,
    });
  }

  override disconnectedCallback(): void {
    this.resetMutationObserver();
    this.releaseAnnouncementSink();
    this.announcementsArmed = false;
    this.announcedLimits.clear();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetMutationObserver();
    this.syncAnnouncementSink();
    this.armMutationObserver();
  }

  private syncAnnouncementSink(): void {
    if (!this.isConnected) {
      this.releaseAnnouncementSink();
      return;
    }
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument) {
      return;
    }
    this.releaseAnnouncementSink();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseAnnouncementSink(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private resetMutationObserver(): void {
    this.mutationObserverGeneration += 1;
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    this.mutationObserverDocument = undefined;
  }

  private syncRunsSlot = (): void => {
    this.hasRunsSlot = Array.from(this.children).some(
      (element) => element.getAttribute('slot') === 'runs'
    );
  };

  private get currentNode(): LyraDrilldownNode | undefined {
    return this.effectivePath[this.effectivePath.length - 1];
  }

  private categoriesFor(
    node: LyraDrilldownNode
  ): readonly DrilldownCategoryDefinition[] {
    const categories: DrilldownCategoryDefinition[] = [];
    if ((node.evidence?.length ?? 0) > 0) {
      categories.push({
        key: 'evidence',
        label: this.localize('sourceListDefaultLabel'),
      });
    }
    if ((node.documents?.length ?? 0) > 0) {
      categories.push({
        key: 'documents',
        label: this.localize('drilldownDocuments'),
      });
    }
    if ((node.entities?.length ?? 0) > 0) {
      categories.push({
        key: 'entities',
        label: this.localize('provenanceEntities'),
      });
    }
    if (this.hasRunsSlot) {
      categories.push({
        key: 'runs',
        label: this.localize('drilldownRuns'),
      });
    }
    return categories;
  }

  private resolvedCategory(
    categories: readonly DrilldownCategoryDefinition[]
  ): LyraDrilldownCategory | undefined {
    return (
      categories.find((category) => category.key === this.activeCategoryValue)
        ?.key ?? categories[0]?.key
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const node = this.currentNode;
    const categories = node ? this.categoriesFor(node) : [];
    const active = this.resolvedCategory(categories) ?? '';
    const context = `${this.pathRevision}:${node?.nodeId ?? ''}:${active}`;
    if (context !== this.pageContext) {
      this.pageContext = context;
      this.categoryPage = 0;
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const nextLimits = new Map(this.currentLimitAnnouncements());
    if (this.announcementsArmed) {
      for (const [key, text] of nextLimits) {
        if (this.announcedLimits.get(key) !== text) {
          this.announcementSink?.announce(text);
        }
      }
    }
    this.announcedLimits = nextLimits;
    this.announcementsArmed = true;
  }

  private navigateTo(node: LyraDrilldownNode, index: number): void {
    this.emit(
      'lr-drilldown-navigate',
      Object.freeze({ nodeId: node.nodeId, index })
    );
  }

  private stopOwnedEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private onCategoryShow = (
    event: LyraTabGroupEventMap['lr-tab-show']
  ): void => {
    event.stopPropagation();
    const node = this.currentNode;
    if (!node) return;
    const categories = this.categoriesFor(node);
    const previousCategory = this.resolvedCategory(categories);
    const category = normalizeCategory(event.detail.name);
    const tabGroup = event.currentTarget as LyraTabGroup;
    if (
      !previousCategory ||
      !category ||
      !categories.some((candidate) => candidate.key === category)
    ) {
      tabGroup.active = previousCategory ?? '';
      return;
    }
    if (category !== previousCategory) {
      this.emit(
        'lr-drilldown-category-change',
        Object.freeze({
          nodeId: node.nodeId,
          category,
          previousCategory,
        })
      );
    }
    tabGroup.active = this.resolvedCategory(categories) ?? '';
  };

  private onEvidenceExpand(
    nodeId: string,
    evidenceId: string,
    event: CustomEvent<{ expanded: boolean }>
  ): void {
    event.stopPropagation();
    this.emit(
      'lr-drilldown-evidence-expand',
      Object.freeze({ nodeId, evidenceId, expanded: event.detail.expanded })
    );
  }

  private onEvidenceOpen(
    nodeId: string,
    item: LyraDrilldownEvidenceItem,
    event: Event
  ): void {
    event.stopPropagation();
    this.emit(
      'lr-drilldown-evidence-open',
      Object.freeze({
        nodeId,
        evidenceId: item.evidenceId,
        ...(item.href !== undefined ? { href: item.href } : {}),
      })
    );
  }

  private onDocumentDownload(
    nodeId: string,
    document: LyraDrilldownDocument,
    event: CustomEvent<{ src: string; filename: string }>
  ): void {
    event.stopPropagation();
    this.emit(
      'lr-drilldown-document-download',
      Object.freeze({
        nodeId,
        documentId: document.documentId,
        src: event.detail.src,
        filename: event.detail.filename,
      })
    );
  }

  private onDocumentRenderError(
    nodeId: string,
    documentId: string,
    event: CustomEvent<{ error: unknown }>
  ): void {
    event.stopPropagation();
    this.emit(
      'lr-drilldown-document-render-error',
      Object.freeze({ nodeId, documentId, error: event.detail.error })
    );
  }

  private onDocumentHighlightActivate(
    nodeId: string,
    documentId: string,
    event: CustomEvent<{ highlightId: string }>
  ): void {
    event.stopPropagation();
    this.emit(
      'lr-drilldown-document-highlight-activate',
      Object.freeze({ nodeId, documentId, highlightId: event.detail.highlightId })
    );
  }

  /** Bound to both the canonical `lr-entity-select` and the deprecated `lr-entity-activate` on
   *  every nested `lr-entity-card` -- both fire from one gesture, so the detail-identity check
   *  below translates it into exactly one `lr-drilldown-entity-activate`, never two. */
  private onEntityActivate(
    nodeId: string,
    entityId: string,
    event: CustomEvent<{ entityId: string }>
  ): void {
    event.stopPropagation();
    if (event.detail === this.translatedEntityGestureDetail) return;
    this.translatedEntityGestureDetail = event.detail;
    this.emit(
      'lr-drilldown-entity-activate',
      Object.freeze({ nodeId, entityId })
    );
  }

  private renderEvidence(
    nodeId: string,
    items: readonly LyraDrilldownEvidenceItem[]
  ): TemplateResult {
    return html`${repeat(
      items,
      (item) => item.evidenceId,
      (item) => html`
        <lr-source-card
          part="evidence-item"
          source-id=${item.evidenceId}
          title=${item.title}
          .page=${item.page}
          href=${item.href ?? nothing}
          @lr-expand=${(event: CustomEvent<{ expanded: boolean }>) =>
            this.onEvidenceExpand(nodeId, item.evidenceId, event)}
          @lr-open=${(event: Event) => this.onEvidenceOpen(nodeId, item, event)}
        >
          ${item.excerpt
            ? html`<span slot="excerpt">${item.excerpt}</span>`
            : nothing}
          ${item.full ? html`<span slot="full">${item.full}</span>` : nothing}
        </lr-source-card>
      `
    )}`;
  }

  private renderDocuments(
    nodeId: string,
    documents: readonly LyraDrilldownDocument[]
  ): TemplateResult {
    return html`${repeat(
      documents,
      (document) => document.documentId,
      (document) => html`
        <lr-document-preview
          part="document-item"
          src=${document.uri ?? ''}
          mime-type=${document.mimeType ?? ''}
          filename=${document.name}
          @lr-download=${(
            event: CustomEvent<{ src: string; filename: string }>
          ) => this.onDocumentDownload(nodeId, document, event)}
          @lr-render-error=${(event: CustomEvent<{ error: unknown }>) =>
            this.onDocumentRenderError(nodeId, document.documentId, event)}
          @lr-highlight-activate=${(event: CustomEvent<{ highlightId: string }>) =>
            this.onDocumentHighlightActivate(
              nodeId,
              document.documentId,
              event
            )}
        ></lr-document-preview>
      `
    )}`;
  }

  private entityCardValue(entity: LyraDrilldownEntity): LyraEntity {
    return Object.freeze({
      id: entity.entityId,
      label: entity.label,
      ...(entity.type !== undefined ? { type: entity.type } : {}),
      ...(entity.description !== undefined
        ? { description: entity.description }
        : {}),
      ...(entity.properties !== undefined
        ? { properties: entity.properties as Record<string, string | number> }
        : {}),
      ...(entity.degree !== undefined ? { degree: entity.degree } : {}),
      ...(entity.communityId !== undefined
        ? { communityId: entity.communityId }
        : {}),
    });
  }

  private renderEntities(
    nodeId: string,
    entities: readonly LyraDrilldownEntity[]
  ): TemplateResult {
    return html`${repeat(
      entities,
      (entity) => entity.entityId,
      (entity) => html`
        <lr-entity-card
          part="entity-item"
          .entity=${this.entityCardValue(entity)}
          .types=${this.effectiveTypes}
          .communityLabel=${this.communityLabel}
          .showFocusButton=${this.showFocusButton}
          @lr-entity-select=${(event: CustomEvent<{ entityId: string }>) =>
            this.onEntityActivate(nodeId, entity.entityId, event)}
          @lr-entity-activate=${(event: CustomEvent<{ entityId: string }>) =>
            this.onEntityActivate(nodeId, entity.entityId, event)}
        ></lr-entity-card>
      `
    )}`;
  }

  private formatCount(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }

  private rangeSummary(
    start: number,
    end: number,
    total: number,
    itemLabel: string
  ): string {
    return this.localize('paginationSummary', undefined, {
      start: this.formatCount(start),
      end: this.formatCount(end),
      total: this.formatCount(total),
      itemLabel,
    });
  }

  private changePage(delta: number, total: number): void {
    const lastPage = Math.max(0, Math.ceil(total / ACTIVE_PAGE_SIZE) - 1);
    this.categoryPage = Math.min(
      lastPage,
      Math.max(0, this.categoryPage + delta)
    );
  }

  private currentLimitAnnouncements(): ReadonlyArray<
    readonly [string, string]
  > {
    const announcements: Array<readonly [string, string]> = [];
    if (this.pathSourceCount > MAX_PATH_NODES) {
      announcements.push(['path', this.pathLimitSummary()]);
    }

    const node = this.currentNode;
    if (!node) return announcements;
    const categories = this.categoriesFor(node);
    const category = categories.find(
      (candidate) => candidate.key === this.resolvedCategory(categories)
    );
    if (!category || category.key === 'runs') return announcements;
    const items = node[category.key] ?? [];
    const sourceCount =
      this.categorySourceCounts.get(node.nodeId)?.[category.key] ??
      items.length;
    if (sourceCount > MAX_CATEGORY_ITEMS) {
      announcements.push([
        `${node.nodeId}:${category.key}`,
        this.rangeSummary(1, items.length, sourceCount, category.label),
      ]);
    }
    return announcements;
  }

  private pathLimitSummary(): string {
    return this.rangeSummary(
      this.pathSourceCount - MAX_PATH_NODES + 1,
      this.pathSourceCount,
      this.pathSourceCount,
      this.localize('items')
    );
  }

  private renderPage<T>(
    node: LyraDrilldownNode,
    category: Exclude<LyraDrilldownCategory, 'runs'>,
    label: string,
    items: readonly T[],
    renderItems: (page: readonly T[]) => TemplateResult
  ): TemplateResult {
    const lastPage = Math.max(
      0,
      Math.ceil(items.length / ACTIVE_PAGE_SIZE) - 1
    );
    const page = Math.min(this.categoryPage, lastPage);
    const startIndex = page * ACTIVE_PAGE_SIZE;
    const visible = items.slice(startIndex, startIndex + ACTIVE_PAGE_SIZE);
    const sourceCount =
      this.categorySourceCounts.get(node.nodeId)?.[category] ?? items.length;
    const hasPages = items.length > ACTIVE_PAGE_SIZE;
    const wasLimited = sourceCount > MAX_CATEGORY_ITEMS;
    return html`
      ${renderItems(visible)}
      ${hasPages
        ? html`<nav
            part="pagination"
            aria-label=${this.localize('paginationLabel')}
          >
            <span part="pagination-summary"
              >${this.rangeSummary(
                startIndex + 1,
                startIndex + visible.length,
                items.length,
                label
              )}</span
            >
            <lr-button
              part="previous-button"
              size="s"
              ?disabled=${page === 0}
              @click=${() => this.changePage(-1, items.length)}
              >${this.localize('previous')}</lr-button
            >
            <lr-button
              part="next-button"
              size="s"
              ?disabled=${page === lastPage}
              @click=${() => this.changePage(1, items.length)}
              >${this.localize('next')}</lr-button
            >
          </nav>`
        : nothing}
      ${wasLimited
        ? html`<p part="limit">
            ${this.rangeSummary(1, items.length, sourceCount, label)}
          </p>`
        : nothing}
    `;
  }

  private renderCategory(
    node: LyraDrilldownNode,
    category: DrilldownCategoryDefinition
  ): TemplateResult {
    switch (category.key) {
      case 'evidence':
        return this.renderPage(
          node,
          category.key,
          category.label,
          node.evidence ?? [],
          (items) => this.renderEvidence(node.nodeId, items)
        );
      case 'documents':
        return this.renderPage(
          node,
          category.key,
          category.label,
          node.documents ?? [],
          (documents) => this.renderDocuments(node.nodeId, documents)
        );
      case 'entities':
        return this.renderPage(
          node,
          category.key,
          category.label,
          node.entities ?? [],
          (entities) => this.renderEntities(node.nodeId, entities)
        );
      case 'runs':
        return html`<slot name="runs"></slot>`;
    }
  }

  private renderBreadcrumb(): TemplateResult | typeof nothing {
    if (this.effectivePath.length === 0) return nothing;
    const lastIndex = this.effectivePath.length - 1;
    return html`
      <lr-breadcrumb part="breadcrumb">
        ${repeat(
          this.effectivePath,
          (node) => node.nodeId,
          (node, index) => {
            const isCurrent = index === lastIndex;
            return isCurrent
              ? html`<lr-breadcrumb-item part="breadcrumb-item" current
                  >${node.label}</lr-breadcrumb-item
                >`
              : html`<lr-breadcrumb-item
                  part="breadcrumb-item"
                  exportparts="base: breadcrumb-button"
                  @click=${() => this.navigateTo(node, index)}
                  >${node.label}</lr-breadcrumb-item
                >`;
          }
        )}
      </lr-breadcrumb>
      ${this.pathSourceCount > MAX_PATH_NODES
        ? html`<p part="limit">${this.pathLimitSummary()}</p>`
        : nothing}
    `;
  }

  private renderContent(): TemplateResult {
    const node = this.currentNode;
    if (!node) {
      return html`<lr-empty
        part="empty"
        heading=${this.localize('drilldownEmpty')}
      ></lr-empty>`;
    }
    const categories = this.categoriesFor(node);
    const active = this.resolvedCategory(categories);
    if (!active) {
      return html`<lr-empty
        part="empty"
        heading=${this.localize('noData')}
      ></lr-empty>`;
    }
    const accessibleLabel = this.accessibleLabel;
    if (categories.length === 1) {
      const only = categories[0]!;
      return html`<div
        part="category"
        role="region"
        aria-label=${accessibleLabel ?? only.label}
      >
        ${this.renderCategory(node, only)}
      </div>`;
    }
    return html`
      <lr-tab-group
        part="tabs"
        activation="manual"
        aria-label=${accessibleLabel ?? nothing}
        .active=${active}
        @lr-tab-hide=${this.stopOwnedEvent}
        @lr-tab-show=${this.onCategoryShow}
      >
        ${repeat(
          categories,
          (category) => category.key,
          (category) => html`<lr-tab panel=${category.key}
            >${category.label}</lr-tab
          >`
        )}
        ${repeat(
          categories,
          (category) => category.key,
          (category) => html`<lr-tab-panel
            name=${category.key}
            part="category"
            ?active=${category.key === active}
          >
            ${category.key === active
              ? this.renderCategory(node, category)
              : nothing}
          </lr-tab-panel>`
        )}
      </lr-tab-group>
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
