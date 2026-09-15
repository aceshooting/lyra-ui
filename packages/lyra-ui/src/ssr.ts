import {
  ROOT_BARREL_OPTIONAL_PEER_TAGS,
  ROOT_BARREL_TAGS,
} from './internal/root-registration-allowlist.js';
import { tag } from './internal/prefix.js';

/** How a Lyra component participates in the initial server response. */
export type LyraSsrMode = 'render-and-hydrate' | 'client-render';

/** Why a component defers its initial shadow render to the browser. */
export type LyraSsrClientRenderReasonCode =
  | 'browser-constructor'
  | 'browser-global'
  | 'computed-style'
  | 'document-focus'
  | 'layout-measurement'
  | 'mutation-observer'
  | 'shadow-dom-query';

export interface LyraSsrClientRenderReason {
  code: LyraSsrClientRenderReasonCode;
  detail: string;
}

/** Runtime readiness reported by {@link diagnoseLyraHydration}. */
export type LyraHydrationStatus =
  | 'ready'
  | 'unregistered'
  | 'missing-shadow-root'
  | 'update-failed';

export interface LyraHydrationDiagnostic {
  element: Element;
  tag: string;
  mode: LyraSsrMode;
  /** Runtime readiness only; the diagnostic does not infer whether server markup was hydrated. */
  status: LyraHydrationStatus;
  error?: unknown;
}

/** A browser capability whose use makes a `render-and-hydrate` tag's initial output incomplete
 *  or stale until hydration JavaScript actually runs. */
export type LyraSsrCapabilityName =
  | 'canvas'
  | 'layoutMeasurement'
  | 'mediaPlayback'
  | 'observers'
  | 'remoteContent';

/** `'after-hydration'` self-corrects once hydration runs; `'client-only'` has no server-renderable
 *  content at all until then. Both make a tag `'hydration-required'`. */
export type LyraSsrCapabilityLevel = 'after-hydration' | 'client-only';

/** Per-tag capability usage feeding {@link deriveLyraSsrStaticSafety}. A tag absent here, or
 *  present with an empty record, is not thereby `'static-safe'` -- see
 *  {@link LYRA_SSR_AUDITED_STATIC_SAFE_TAGS}, which records that the absence was itself reviewed. */
export type LyraSsrTagCapabilities = Readonly<Partial<Record<LyraSsrCapabilityName, LyraSsrCapabilityLevel>>>;

/** Whether a `render-and-hydrate` tag's declarative-shadow-DOM output is guaranteed to remain
 *  visually and functionally complete indefinitely when hydration JavaScript never runs at all
 *  (`'static-safe'`), or is only ever promised once hydration executes (`'hydration-required'`). */
export type LyraSsrStaticSafety = 'static-safe' | 'hydration-required';

const reason = (
  code: LyraSsrClientRenderReasonCode,
  detail: string,
): Readonly<LyraSsrClientRenderReason> => Object.freeze({ code, detail });

/**
 * Evidence-backed exceptions to declarative-shadow-DOM rendering. Every entry names the browser
 * capability its first render currently requires; `pnpm test:ssr` rejects unknown, duplicate, or
 * unclassified inventory tags. Remove an entry as soon as the component no longer needs it.
 */
export const LYRA_SSR_CLIENT_RENDER_REASONS = Object.freeze({
  [tag('app-rail')]: reason('layout-measurement', 'reads window dimensions while deriving its initial rail size'),
  [tag('date-input')]: reason('shadow-dom-query', 'coordinates a rendered slot listener during its first update'),
  [tag('dock-panel')]: reason('layout-measurement', 'reads window dimensions while deriving its initial panel size'),
  [tag('eval-dataset')]: reason('shadow-dom-query', 'queries a nested export menu during its initial render'),
  [tag('eval-run')]: reason('shadow-dom-query', 'derives progress text from rendered shadow content'),
  [tag('export-button')]: reason('shadow-dom-query', 'queries its rendered menu items during its first update'),
  [tag('file-tree')]: reason('document-focus', 'reads document focus while constructing its initial tree state'),
  [tag('mind-map')]: reason('computed-style', 'resolves live computed token units for its initial SVG geometry'),
  [tag('page-rail')]: reason('browser-constructor', 'checks rendered nodes against HTMLElement during its first update'),
  [tag('progress-bar')]: reason('shadow-dom-query', 'derives its visible label from rendered shadow content'),
  [tag('radio')]: reason('browser-constructor', 'resolves a composed radio-group ancestor in its constructor'),
  [tag('radio-button')]: reason('browser-constructor', 'resolves a composed radio-group ancestor in its constructor'),
  [tag('realtime-session')]: reason('browser-constructor', 'checks a rendered root against ShadowRoot during its first update'),
  [tag('source-list')]: reason('mutation-observer', 'creates its slotted-source observer in the constructor'),
  [tag('source-picker')]: reason('shadow-dom-query', 'queries rendered source controls during its first update'),
  [tag('tree')]: reason('document-focus', 'reads document focus while constructing its initial tree state'),
  [tag('video')]: reason('browser-constructor', 'checks slotted controls against HTMLElement during its initial render'),
  [tag('word-cloud')]: reason('computed-style', 'resolves live font tokens before calculating its initial layout'),
} satisfies Record<string, Readonly<LyraSsrClientRenderReason>>);

const allTags = [...ROOT_BARREL_TAGS, ...ROOT_BARREL_OPTIONAL_PEER_TAGS];
const allTagSet = new Set<string>(allTags);
const clientRenderTagSet = new Set<string>(Object.keys(LYRA_SSR_CLIENT_RENDER_REASONS));
const unknownClientRenderTags = [...clientRenderTagSet].filter((tagName) => !allTagSet.has(tagName));
if (unknownClientRenderTags.length > 0) {
  throw new Error(`Invalid Lyra SSR client-render reasons: ${unknownClientRenderTags.join(', ')}`);
}

/** Tags whose shadow DOM is rendered on the server and hydrated in place in the browser. */
export const LYRA_SSR_RENDER_AND_HYDRATE_TAGS = Object.freeze(
  allTags.filter((tagName) => !clientRenderTagSet.has(tagName)),
);

/** Tags emitted as stable light-DOM hosts and rendered when their definitions upgrade client-side. */
export const LYRA_SSR_CLIENT_RENDER_TAGS = Object.freeze(
  allTags.filter((tagName) => clientRenderTagSet.has(tagName)),
);

/**
 * Evidence-backed per-tag capability usage for every `render-and-hydrate` tag whose initial
 * declarative-shadow-DOM output is NOT guaranteed to stay correct if hydration JavaScript never
 * runs. `pnpm test:ssr` rejects an inventory tag classified in neither this record nor
 * {@link LYRA_SSR_AUDITED_STATIC_SAFE_TAGS}. Remove an entry once the component no longer
 * depends on the capability.
 */
export const LYRA_SSR_TAG_CAPABILITIES = Object.freeze({
  [tag('bar-chart')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('box-plot')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('bubble-chart')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('chart')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('doughnut-chart')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('histogram')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('line-chart')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('lite-chart')]: {
    // Renders real SVG, not canvas -- unlike every other chart in this family. Its default
    // layout="fit" mode needs the SVG's ResizeObserver-measured allocated size before it can draw
    // coordinate-based geometry; the pre-measurement render is a structurally-identical fallback,
    // not the final content, so it self-corrects only once hydration JavaScript actually runs.
    layoutMeasurement: 'after-hydration',
    observers: 'after-hydration',
  },
  [tag('pie-chart')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('polar-area-chart')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('radar-chart')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('scatter-chart')]: {
    canvas: 'after-hydration', // paints its series onto a 2D canvas surface
  },
  [tag('graph')]: {
    canvas: 'after-hydration', // paints nodes and edges onto a 2D canvas surface
  },
  [tag('knowledge-graph-explorer')]: {
    canvas: 'after-hydration', // composes lr-graph, whose canvas renderer owns the visible node/edge content
  },
  [tag('heatmap')]: {
    canvas: 'after-hydration', // paints its matrix cells onto a 2D canvas surface
  },
  [tag('audio-visualizer')]: {
    canvas: 'after-hydration', // paints its waveform onto a 2D canvas surface
  },
  [tag('qr-code')]: {
    canvas: 'after-hydration', // paints its QR modules onto a 2D canvas surface
  },
  [tag('map')]: {
    canvas: 'after-hydration', // paints tiles and overlays onto a 2D canvas surface
  },
  [tag('animated-image')]: {
    canvas: 'after-hydration', // decodes and paints animation frames onto a 2D canvas surface
  },
  [tag('av-player')]: {
    canvas: 'after-hydration', // paints a waveform onto a 2D canvas surface
    mediaPlayback: 'after-hydration', // drives a custom timeline and transport UI from native media element playback events, not the native controls UI
  },
  [tag('video-playlist')]: {
    mediaPlayback: 'after-hydration', // orchestrates playback state and now-playing selection across nested lr-video instances, which are themselves client-render
  },
  [tag('pdf-viewer')]: {
    canvas: 'after-hydration', // paints decoded page content onto a 2D canvas surface
    remoteContent: 'client-only', // the document bytes are fetched from the src document
  },
  [tag('pptx-viewer')]: {
    remoteContent: 'client-only', // renders slide content fetched and parsed from the src document
  },
  [tag('docx-viewer')]: {
    remoteContent: 'client-only', // renders document content fetched and parsed from the src document
  },
  [tag('email-viewer')]: {
    remoteContent: 'client-only', // renders message content fetched and parsed from the src document
  },
  [tag('spreadsheet-viewer')]: {
    remoteContent: 'client-only', // renders cell content fetched and parsed from the src document
  },
  [tag('xml-viewer')]: {
    remoteContent: 'client-only', // renders document content fetched and parsed from the src document
  },
  [tag('calendar-viewer')]: {
    remoteContent: 'client-only', // renders calendar entries fetched and parsed from the src document
  },
  [tag('ebook-viewer')]: {
    remoteContent: 'client-only', // renders book content fetched and parsed from the src document
  },
  [tag('svg-viewer')]: {
    remoteContent: 'client-only', // renders sanitized markup fetched from the src document
  },
  [tag('csv-viewer')]: {
    remoteContent: 'client-only', // renders table content fetched and parsed from the src document
  },
  [tag('include')]: {
    remoteContent: 'client-only', // renders sanitized markup fetched from the src document
  },
  [tag('contact-viewer')]: {
    remoteContent: 'client-only', // renders contact fields fetched and parsed from the src document
  },
  [tag('archive-viewer')]: {
    remoteContent: 'client-only', // renders an entry listing fetched and parsed from the src document
  },
  [tag('dataset-viewer')]: {
    remoteContent: 'client-only', // renders row content fetched and parsed from the src document
  },
  [tag('document-preview')]: {
    remoteContent: 'client-only', // renders document content fetched and parsed from the src document
  },
  [tag('html-viewer')]: {
    remoteContent: 'client-only', // renders sanitized markup fetched from the src document
  },
  [tag('notebook-viewer')]: {
    remoteContent: 'client-only', // renders cell content fetched and parsed from the src document
  },
  [tag('geojson-viewer')]: {
    remoteContent: 'client-only', // renders feature geometry fetched and parsed from the src document
  },
  [tag('geojson-view')]: {
    remoteContent: 'client-only', // extends lr-geojson-viewer and shares its fetched-content dependency
  },
  [tag('document-viewer')]: {
    remoteContent: 'client-only', // lazily loads and composes the renderer matching the requested document, so its body has no content until that load resolves
  },
  [tag('document-compare')]: {
    remoteContent: 'client-only', // composes lr-document-preview for each pane, whose own content depends on a fetch
  },
  [tag('icon')]: {
    remoteContent: 'client-only', // an icon referencing a remote sprite source is fetched, sanitized, and inlined by name
  },
  [tag('intersection-observer')]: {
    observers: 'after-hydration', // reports IntersectionObserver entries for its observed targets; there is nothing to report before an observer runs
  },
  [tag('resize-observer')]: {
    observers: 'after-hydration', // reports ResizeObserver entries for its observed targets; there is nothing to report before an observer runs
  },
  [tag('mutation-observer')]: {
    observers: 'after-hydration', // reports MutationObserver records for its observed targets; there is nothing to report before an observer runs
  },
  [tag('virtual-list')]: {
    layoutMeasurement: 'after-hydration', // renders only the row window a measured container size selects
    observers: 'after-hydration', // a ResizeObserver drives which rows are in that window
  },
  [tag('flow-canvas')]: {
    layoutMeasurement: 'after-hydration', // recomputes rendered node/edge geometry from measured container size
  },
} satisfies Record<string, LyraSsrTagCapabilities>);

/**
 * Every `render-and-hydrate` tag reviewed and confirmed to have NO entry in
 * {@link LYRA_SSR_TAG_CAPABILITIES} -- i.e. its initial declarative-shadow-DOM output is complete
 * and correct on its own, indefinitely, whether or not hydration JavaScript ever runs. A tag
 * belongs in exactly one of this list or `LYRA_SSR_TAG_CAPABILITIES`; membership in neither means
 * the tag was never reviewed, which `pnpm test:ssr` treats as a failure rather than an implicit
 * `'static-safe'` default.
 */
export const LYRA_SSR_AUDITED_STATIC_SAFE_TAGS = Object.freeze([
  'lr-accordion',
  'lr-accordion-item',
  'lr-activity-feed',
  'lr-agent-eval-dashboard',
  'lr-agent-run',
  'lr-agent-trace',
  'lr-agent-workspace',
  'lr-alert',
  'lr-animation',
  'lr-app-rail-group',
  'lr-app-rail-item',
  'lr-approval-queue',
  'lr-artifact-panel',
  'lr-attachment-chip',
  'lr-attachment-trigger',
  'lr-avatar',
  'lr-avatar-group',
  'lr-badge',
  'lr-branch-picker',
  'lr-breadcrumb',
  'lr-breadcrumb-item',
  'lr-browser-frame',
  'lr-button',
  'lr-button-group',
  'lr-calendar',
  'lr-callout',
  'lr-card',
  'lr-carousel',
  'lr-carousel-item',
  'lr-chat-composer',
  'lr-chat-message',
  'lr-chat-viewport',
  'lr-checkbox',
  'lr-checkbox-group',
  'lr-checkpoint',
  'lr-chip',
  'lr-chip-group',
  'lr-chunk-inspector',
  'lr-citation-badge',
  'lr-claim-evidence',
  'lr-code-block',
  'lr-code-block-core',
  'lr-code-editor',
  'lr-color-picker',
  'lr-combobox',
  'lr-command-palette',
  'lr-commit-card',
  'lr-community-card',
  'lr-compare-panel',
  'lr-condition-builder',
  'lr-confirm-bar',
  'lr-context-inspector',
  'lr-context-meter',
  'lr-control-group',
  'lr-conversation-item',
  'lr-copy-button',
  'lr-dashboard-grid',
  'lr-data-grid',
  'lr-date-picker',
  'lr-details',
  'lr-dialog',
  'lr-diff-view',
  'lr-divider',
  'lr-document-library',
  'lr-drawer',
  'lr-drilldown-panel',
  'lr-dropdown',
  'lr-dropdown-item',
  'lr-embedding-explorer',
  'lr-emoji-picker',
  'lr-empty',
  'lr-entity-card',
  'lr-entity-chip',
  'lr-entity-dossier',
  'lr-env-list',
  'lr-eval-result',
  'lr-file-icon',
  'lr-file-input',
  'lr-filter-bar',
  'lr-flag',
  'lr-flow-controls',
  'lr-flow-minimap',
  'lr-flow-node',
  'lr-flow-run-status',
  'lr-format-bytes',
  'lr-format-date',
  'lr-format-number',
  'lr-funnel',
  'lr-gauge',
  'lr-generation-metrics',
  'lr-graph-legend',
  'lr-graph-query-builder',
  'lr-grounding-summary',
  'lr-handoff-divider',
  'lr-highlight-layer',
  'lr-icon-button',
  'lr-image-comparer',
  'lr-image-viewer',
  'lr-ingestion-queue',
  'lr-input',
  'lr-json-schema-viewer',
  'lr-json-viewer',
  'lr-kbd',
  'lr-knowledge-base',
  'lr-knowledge-base-admin',
  'lr-known-date',
  'lr-lightbox',
  'lr-live-region',
  'lr-locale-picker',
  'lr-markdown',
  'lr-markdown-core',
  'lr-mcp-app',
  'lr-media-card',
  'lr-memory-panel',
  'lr-mention-popover',
  'lr-menu',
  'lr-menu-item',
  'lr-menu-label',
  'lr-message-actions',
  'lr-message-feedback',
  'lr-message-parts',
  'lr-model-select',
  'lr-model-settings-panel',
  'lr-multi-split',
  'lr-native-time-input',
  'lr-neighbor-list',
  'lr-node-palette',
  'lr-number-input',
  'lr-option',
  'lr-otp-input',
  'lr-page',
  'lr-pagination',
  'lr-pan-zoom',
  'lr-path-strip',
  'lr-phone-input',
  'lr-policy-summary',
  'lr-poll-status',
  'lr-popover',
  'lr-popup',
  'lr-progress-ring',
  'lr-prompt-input',
  'lr-prompt-queue',
  'lr-prompt-studio',
  'lr-provenance-panel',
  'lr-push-to-talk',
  'lr-radio-group',
  'lr-rag-answer',
  'lr-rag-eval-dashboard',
  'lr-random-content',
  'lr-rating',
  'lr-relative-time',
  'lr-reorder-item',
  'lr-reorder-list',
  'lr-responsive-panel',
  'lr-result-card',
  'lr-result-field',
  'lr-retrieval-compare',
  'lr-retrieval-results',
  'lr-retrieval-search',
  'lr-retrieval-trace',
  'lr-rubric-form',
  'lr-scroller',
  'lr-segmented',
  'lr-select',
  'lr-selection-toolbar',
  'lr-sequence-playback',
  'lr-sequence-strip',
  'lr-skeleton',
  'lr-slider',
  'lr-source-card',
  'lr-span-waterfall',
  'lr-sparkline',
  'lr-spinner',
  'lr-split-panel',
  'lr-stack-trace',
  'lr-stat',
  'lr-stepper',
  'lr-stream-status',
  'lr-streaming-text',
  'lr-subagent-panel',
  'lr-suggestion-chips',
  'lr-swatch-picker',
  'lr-switch',
  'lr-tab',
  'lr-tab-group',
  'lr-tab-panel',
  'lr-table',
  'lr-tag',
  'lr-task-list',
  'lr-terminal',
  'lr-test-results',
  'lr-textarea',
  'lr-thinking-panel',
  'lr-thread-list',
  'lr-time-input',
  'lr-time-range',
  'lr-timeline',
  'lr-timeline-item',
  'lr-toast',
  'lr-toast-item',
  'lr-token-input',
  'lr-tool-approval-dialog',
  'lr-tool-call-chip',
  'lr-tool-param-form',
  'lr-tool-result-dialog',
  'lr-tool-result-view',
  'lr-tool-select-dialog',
  'lr-tool-timeline',
  'lr-tooltip',
  'lr-tour',
  'lr-trace-tree',
  'lr-transcript-feed',
  'lr-tree-item',
  'lr-typing-indicator',
  'lr-usage-badge',
  'lr-visually-hidden',
  'lr-voice-picker',
  'lr-widget',
  'lr-widget-renderer',
  'lr-zoomable-frame',
]);

const tagCapabilitiesKeys = Object.keys(LYRA_SSR_TAG_CAPABILITIES);
const unknownCapabilityTags = tagCapabilitiesKeys.filter((tagName) => !allTagSet.has(tagName));
if (unknownCapabilityTags.length > 0) {
  throw new Error(`Invalid Lyra SSR tag capabilities: ${unknownCapabilityTags.join(', ')}`);
}
const auditedStaticSafeTagSet = new Set<string>(LYRA_SSR_AUDITED_STATIC_SAFE_TAGS);
const unknownAuditedTags = [...auditedStaticSafeTagSet].filter((tagName) => !allTagSet.has(tagName));
if (unknownAuditedTags.length > 0) {
  throw new Error(`Invalid Lyra SSR audited static-safe tags: ${unknownAuditedTags.join(', ')}`);
}
const doublyClassifiedTags = tagCapabilitiesKeys.filter((tagName) => auditedStaticSafeTagSet.has(tagName));
if (doublyClassifiedTags.length > 0) {
  throw new Error(
    `Lyra SSR tags classified both capability-bearing and audited static-safe: ${doublyClassifiedTags.join(', ')}`,
  );
}

/**
 * Derives static safety from one tag's capability record: any `'after-hydration'`/`'client-only'`
 * entry makes it `'hydration-required'`; an empty record defaults to `'static-safe'`. The empty-
 * record default is deliberately available to callers that already know the record reflects a
 * completed review (as `LYRA_SSR_TAG_CAPABILITIES` entries do) -- {@link buildLyraSsrStaticSafety}
 * does NOT rely on it for a tag missing from that record entirely, which is a different, unreviewed
 * case handled by requiring {@link LYRA_SSR_AUDITED_STATIC_SAFE_TAGS} membership instead.
 */
export function deriveLyraSsrStaticSafety(capabilities: LyraSsrTagCapabilities): LyraSsrStaticSafety {
  const hasHydrationDependentCapability = (Object.keys(capabilities) as LyraSsrCapabilityName[]).some(
    (capabilityName) => capabilities[capabilityName] !== undefined,
  );
  return hasHydrationDependentCapability ? 'hydration-required' : 'static-safe';
}

export interface LyraSsrStaticSafetyResult {
  /** One entry per classified tag; a tag absent here was neither capability-bearing nor audited. */
  classification: Readonly<Record<string, LyraSsrStaticSafety>>;
  /** Every supplied tag classified in neither source -- non-empty means the check must fail closed. */
  unaudited: readonly string[];
}

/**
 * Classifies every supplied tag as `'static-safe'` or `'hydration-required'`, fail-closed: a tag
 * present in neither `tagCapabilities` (non-empty record) nor `auditedStaticSafeTags` is reported
 * in `unaudited` instead of silently defaulting to `'static-safe'`. Pure and fixture-friendly --
 * `scripts/check-ssr.mjs` calls it with the real inventory; tests call it with small fixture lists.
 */
export function buildLyraSsrStaticSafety(
  tags: readonly string[],
  tagCapabilities: Readonly<Record<string, LyraSsrTagCapabilities>>,
  auditedStaticSafeTags: readonly string[],
): LyraSsrStaticSafetyResult {
  const auditedSet = new Set(auditedStaticSafeTags);
  const classification: Record<string, LyraSsrStaticSafety> = {};
  const unaudited: string[] = [];
  for (const tagName of tags) {
    const capabilities = tagCapabilities[tagName];
    if (capabilities && Object.keys(capabilities).length > 0) {
      classification[tagName] = deriveLyraSsrStaticSafety(capabilities);
    } else if (auditedSet.has(tagName)) {
      classification[tagName] = 'static-safe';
    } else {
      unaudited.push(tagName);
    }
  }
  return { classification: Object.freeze(classification), unaudited: Object.freeze(unaudited) };
}

const lyraSsrStaticSafetyResult = buildLyraSsrStaticSafety(
  LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
  LYRA_SSR_TAG_CAPABILITIES,
  LYRA_SSR_AUDITED_STATIC_SAFE_TAGS,
);
if (lyraSsrStaticSafetyResult.unaudited.length > 0) {
  throw new Error(
    `Lyra SSR static safety is unaudited for: ${lyraSsrStaticSafetyResult.unaudited.join(', ')}`,
  );
}

/** Explicit `'static-safe'` / `'hydration-required'` classification for every `render-and-hydrate`
 *  tag; see {@link LyraSsrStaticSafety}. */
export const LYRA_SSR_STATIC_SAFETY: Readonly<Record<string, LyraSsrStaticSafety>> =
  lyraSsrStaticSafetyResult.classification;

/** Returns the static-safety classification for a `render-and-hydrate` Lyra tag, or `undefined`
 *  for a tag outside that tier (including every `client-render` tag, which is hydration-dependent
 *  by construction and carries no separate classification here). */
export function getLyraSsrStaticSafety(tagName: string): LyraSsrStaticSafety | undefined {
  return LYRA_SSR_STATIC_SAFETY[tagName];
}

/** Machine-readable support contract for server renderers and integration diagnostics. */
export const LYRA_SSR_SUPPORT_MATRIX = Object.freeze({
  imports: Object.freeze({
    root: 'server-safe' as const,
    granular: 'server-safe' as const,
    all: 'server-safe' as const,
    serverAll: 'server-safe' as const,
  }),
  registrations: Object.freeze({
    root: 'none' as const,
    all: 'root-included' as const,
    serverAll: 'complete-inventory' as const,
  }),
  declarativeShadowDom: Object.freeze({
    mode: 'render-and-hydrate' as const,
    tags: LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
    /** `'static-safe'` / `'hydration-required'` per tag; see {@link LyraSsrStaticSafety}. */
    staticSafety: LYRA_SSR_STATIC_SAFETY,
  }),
  browserFallback: Object.freeze({
    mode: 'client-render' as const,
    tags: LYRA_SSR_CLIENT_RENDER_TAGS,
    reasons: LYRA_SSR_CLIENT_RENDER_REASONS,
  }),
  capabilities: Object.freeze({
    layoutMeasurement: 'after-hydration',
    observers: 'after-hydration',
    canvas: 'after-hydration',
    mediaPlayback: 'after-hydration',
    remoteContent: 'client-only',
  }),
});

/** Returns the declared initial-render mode for a Lyra tag, or `undefined` for another element. */
export function getLyraSsrMode(tagName: string): LyraSsrMode | undefined {
  if (clientRenderTagSet.has(tagName)) return 'client-render';
  return allTagSet.has(tagName) ? 'render-and-hydrate' : undefined;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * An `@lit-labs/ssr`-compatible renderer for the explicit client-render tier.
 * Put it before Lit's renderer so browser-dependent constructors are not invoked on the server.
 */
export class LyraSsrFallbackRenderer {
  static matchesClass(
    _constructor: CustomElementConstructor,
    tagName: string,
    _attributes: Map<string, string>,
  ): boolean {
    return clientRenderTagSet.has(tagName);
  }

  readonly tagName: string;
  private readonly attributes = new Map<string, string>();

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  connectedCallback(): void {}
  attributeChangedCallback(_name: string, _old: string | null, _value: string | null): void {}

  setProperty(_name: string, _value: unknown): void {
    // Property bindings are not serializable. Author initial fallback state as attributes and
    // assign live properties in the application during or after browser upgrade.
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name.toLowerCase(), value);
  }

  get shadowRootOptions(): ShadowRootInit {
    return { mode: 'open' };
  }

  renderShadow(_renderInfo: unknown): undefined {
    return undefined;
  }

  renderLight(_renderInfo: unknown): undefined {
    return undefined;
  }

  renderAttributes(): string[] {
    return [...this.attributes].map(([name, value]) =>
      value === '' ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`,
    );
  }
}

export interface LyraLitElementRendererConstructor {
  new (tagName: string): object;
  readonly prototype: object;
  matchesClass(
    constructor: CustomElementConstructor,
    tagName: string,
    attributes: Map<string, string>,
  ): boolean;
}

interface SsrRenderableElement {
  children?: unknown;
  childNodes?: unknown;
  querySelector?: unknown;
  querySelectorAll?: unknown;
  closest?: unknown;
  style?: unknown;
}

const emptyElements = Object.freeze([]);

function defineSsrValue(element: object, name: string, value: unknown): void {
  Object.defineProperty(element, name, { configurable: true, value });
}

function prepareLyraElementForSsr(value: unknown): void {
  if (value == null || typeof value !== 'object') return;
  const element = value as SsrRenderableElement;
  if (element.children == null) defineSsrValue(element, 'children', emptyElements);
  if (element.childNodes == null) defineSsrValue(element, 'childNodes', emptyElements);
  if (typeof element.querySelector !== 'function') defineSsrValue(element, 'querySelector', () => null);
  if (typeof element.querySelectorAll !== 'function') defineSsrValue(element, 'querySelectorAll', () => emptyElements);
  if (typeof element.closest !== 'function') defineSsrValue(element, 'closest', () => null);
  if (element.style == null) {
    defineSsrValue(element, 'style', {
      getPropertyValue: () => '',
      removeProperty: () => '',
      setProperty: () => undefined,
    });
  }
}

function collectLyraHosts(root: ParentNode): Element[] {
  const hosts: Element[] = [];
  const seenHosts = new Set<Element>();
  const seenRoots = new Set<ParentNode>();
  const pendingRoots: ParentNode[] = [root];

  for (let rootIndex = 0; rootIndex < pendingRoots.length; rootIndex += 1) {
    const currentRoot = pendingRoots[rootIndex]!;
    if (seenRoots.has(currentRoot)) continue;
    seenRoots.add(currentRoot);

    const rootLocalName = (currentRoot as ParentNode & { localName?: unknown }).localName;
    const elements = [
      ...(typeof rootLocalName === 'string' ? [currentRoot as Element] : []),
      ...currentRoot.querySelectorAll('*'),
    ];

    for (const element of elements) {
      if (getLyraSsrMode(element.localName) !== undefined && !seenHosts.has(element)) {
        seenHosts.add(element);
        hosts.push(element);
      }
      if (element.shadowRoot && !seenRoots.has(element.shadowRoot)) {
        pendingRoots.push(element.shadowRoot);
      }
    }
  }

  return hosts;
}

/**
 * Builds the renderer list expected by `@lit-labs/ssr` without making that server package a
 * browser dependency. Lyra's adapter supplies the inert light-DOM/style methods omitted by Lit's
 * deliberately small server DOM; it does not install `window`, `document`, or other globals.
 */
export function lyraSsrElementRenderers<T extends LyraLitElementRendererConstructor>(
  litElementRenderer: T,
): readonly [typeof LyraSsrFallbackRenderer, T] {
  const parent = litElementRenderer.prototype as { connectedCallback?: () => void };
  // A class expression may only extend a type parameter whose construct signature is a single
  // rest parameter, which `LyraLitElementRendererConstructor`'s `new (tagName: string)` is not.
  // Widening locally keeps the public signature honest (`T` in, `T` out) — same idiom as the
  // `Constructor<T>` aliases the internal mixins use.
  const base = litElementRenderer as unknown as new (...args: any[]) => object;
  class LyraRenderAndHydrateRenderer extends base {
    connectedCallback(): void {
      prepareLyraElementForSsr((this as unknown as { element?: unknown }).element);
      parent.connectedCallback?.call(this);
    }
  }
  return [LyraSsrFallbackRenderer, LyraRenderAndHydrateRenderer as unknown as T] as const;
}

/**
 * Awaits registered Lyra hosts' current updates and reports their runtime readiness.
 * The search includes the supplied root and descendants of every reachable open shadow root.
 */
export async function diagnoseLyraHydration(
  root?: ParentNode,
): Promise<readonly LyraHydrationDiagnostic[]> {
  const ambientDocument = typeof document === 'undefined' ? undefined : document;
  const scope = root ?? ambientDocument;
  if (!scope) return [];
  const ownerDocument =
    (scope as ParentNode & { ownerDocument?: Document | null }).ownerDocument ??
    ((scope as ParentNode & { nodeType?: number }).nodeType === 9
      ? (scope as Document)
      : ambientDocument);
  const registry =
    ownerDocument?.defaultView?.customElements ??
    (ownerDocument === ambientDocument && typeof customElements !== 'undefined'
      ? customElements
      : undefined);

  const candidates = collectLyraHosts(scope);

  return Promise.all(
    candidates.map(async (element): Promise<LyraHydrationDiagnostic> => {
      const tagName = element.localName;
      const mode = getLyraSsrMode(tagName) ?? 'client-render';
      if (!registry?.get(tagName)) {
        return { element, tag: tagName, mode, status: 'unregistered' };
      }

      try {
        const updateComplete = (element as Element & { updateComplete?: Promise<unknown> }).updateComplete;
        if (updateComplete) await updateComplete;
      } catch (error) {
        return { element, tag: tagName, mode, status: 'update-failed', error };
      }

      if (!element.shadowRoot) {
        return { element, tag: tagName, mode, status: 'missing-shadow-root' };
      }
      return {
        element,
        tag: tagName,
        mode,
        status: 'ready',
      };
    }),
  );
}
