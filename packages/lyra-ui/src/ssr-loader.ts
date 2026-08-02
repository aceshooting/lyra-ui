// Lit's hydration hook must be evaluated before any module that imports `lit`. Keep this import
// first: moving it below the Lyra barrel makes declarative shadow roots upgrade as fresh client
// renders instead of being hydrated in place.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

import {
  ROOT_BARREL_OPTIONAL_PEER_TAGS,
  ROOT_BARREL_TAGS,
} from './internal/root-registration-allowlist.js';
import { tag } from './internal/prefix.js';

export * from './lyra.js';

/** How a Lyra component participates in the initial server response. */
export type LyraSsrMode = 'render-and-hydrate' | 'client-render';

/** Runtime readiness reported by {@link diagnoseLyraHydration}. */
export type LyraHydrationStatus =
  | 'hydrated'
  | 'client-rendered'
  | 'unregistered'
  | 'missing-shadow-root'
  | 'update-failed';

export interface LyraHydrationDiagnostic {
  element: Element;
  tag: string;
  mode: LyraSsrMode;
  status: LyraHydrationStatus;
  error?: unknown;
}

/**
 * Components whose first render depends on browser DOM that Lit's deliberately small server DOM
 * does not emulate. The fallback renderer below preserves their host attributes and light DOM;
 * the normal component definition creates the shadow root when the browser upgrades the host.
 *
 * Keep this list evidence-based. `pnpm test:ssr` renders every inventory tag and fails if a tag is
 * in the declarative-shadow-DOM tier but cannot complete its server render.
 */
const CLIENT_RENDER_COMPONENT_NAMES = [
  'accordion-item',
  'agent-run',
  'agent-trace',
  'agent-workspace',
  'app-rail',
  'artifact-panel',
  'avatar',
  'avatar-group',
  'badge',
  'bar-chart',
  'box-plot',
  'bubble-chart',
  'button',
  'card',
  'chart',
  'chat-composer',
  'chat-message',
  'chat-viewport',
  'checkbox',
  'chip',
  'chip-group',
  'chunk-inspector',
  'citation-badge',
  'claim-evidence',
  'code-editor',
  'color-picker',
  'combobox',
  'community-card',
  'confirm-bar',
  'context-inspector',
  'conversation-item',
  'dashboard-grid',
  'date-input',
  'details',
  'dialog',
  'dock-panel',
  'document-library',
  'document-preview',
  'document-viewer',
  'doughnut-chart',
  'drawer',
  'drilldown-panel',
  'emoji-picker',
  'empty',
  'entity-card',
  'entity-chip',
  'entity-dossier',
  'env-list',
  'eval-dataset',
  'evaluation-run',
  'export-button',
  'file-tree',
  'filter-bar',
  'flow-canvas',
  'flow-node',
  'graph',
  'graph-query-builder',
  'grounding-summary',
  'handoff-divider',
  'heatmap',
  'histogram',
  'icon',
  'ingestion-queue',
  'input',
  'kbd',
  'knowledge-base',
  'knowledge-base-admin',
  'known-date',
  'lightbox',
  'line-chart',
  'locale-picker',
  'memory-panel',
  'mind-map',
  'model-select',
  'model-settings-panel',
  'native-time-input',
  'neighbor-list',
  'number-input',
  'page-rail',
  'phone-input',
  'pie-chart',
  'policy-summary',
  'polar-area-chart',
  'progress-bar',
  'progress-ring',
  'prompt-input',
  'provenance-panel',
  'radio',
  'radio-button',
  'radar-chart',
  'rag-answer',
  'rag-eval-dashboard',
  'realtime-session',
  'reorder-list',
  'responsive-panel',
  'result-card',
  'result-field',
  'retrieval-compare',
  'retrieval-results',
  'retrieval-search',
  'retrieval-trace',
  'schema-viewer',
  'scatter-chart',
  'select',
  'source-card',
  'source-list',
  'source-picker',
  'span-waterfall',
  'stat',
  'stream-status',
  'subagent-panel',
  'switch',
  'table',
  'tag',
  'test-results',
  'textarea',
  'thread-list',
  'time-input',
  'timeline',
  'toast-item',
  'token-input',
  'tool-approval-dialog',
  'tool-call-chip',
  'tool-result-dialog',
  'tool-select-dialog',
  'tool-timeline',
  'tooltip',
  'tour',
  'trace-tree',
  'tree',
  'tree-item',
  'usage-badge',
  'video',
  'voice-picker',
  'widget',
  'word-cloud',
] as const;

const allTags = [...ROOT_BARREL_TAGS, ...ROOT_BARREL_OPTIONAL_PEER_TAGS];
const allTagSet = new Set<string>(allTags);
const clientRenderTagSet = new Set<string>(CLIENT_RENDER_COMPONENT_NAMES.map((name) => tag(name)));
const unknownClientRenderTags = [...clientRenderTagSet].filter((tagName) => !allTagSet.has(tagName));
if (
  clientRenderTagSet.size !== CLIENT_RENDER_COMPONENT_NAMES.length ||
  unknownClientRenderTags.length > 0
) {
  throw new Error(
    `Invalid Lyra SSR client-render list: ${unknownClientRenderTags.join(', ') || 'duplicate tag'}`,
  );
}

/** Tags whose shadow DOM is rendered on the server and hydrated in place in the browser. */
export const LYRA_SSR_RENDER_AND_HYDRATE_TAGS = Object.freeze(
  allTags.filter((tagName) => !clientRenderTagSet.has(tagName)),
);

/** Tags emitted as stable light-DOM hosts and rendered when their definitions upgrade client-side. */
export const LYRA_SSR_CLIENT_RENDER_TAGS = Object.freeze(
  allTags.filter((tagName) => clientRenderTagSet.has(tagName)),
);

/** Machine-readable support contract for server renderers and integration diagnostics. */
export const LYRA_SSR_SUPPORT_MATRIX = Object.freeze({
  imports: Object.freeze({ root: 'server-safe', granular: 'server-safe' }),
  declarativeShadowDom: Object.freeze({
    mode: 'render-and-hydrate' as const,
    tags: LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
  }),
  browserFallback: Object.freeze({
    mode: 'client-render' as const,
    tags: LYRA_SSR_CLIENT_RENDER_TAGS,
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
 *
 * Put this renderer before Lit's `LitElementRenderer` so browser-dependent constructors are not
 * invoked on the server. Use {@link lyraSsrElementRenderers} to preserve that ordering.
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
    // Property bindings are not serializable. Client-render components receive their live
    // properties from the application during/after upgrade; author initial SSR state as attrs.
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
  new (tagName: string): unknown;
  matchesClass(
    constructor: CustomElementConstructor,
    tagName: string,
    attributes: Map<string, string>,
  ): boolean;
}

/**
 * Builds the renderer list expected by `@lit-labs/ssr` without making that server package a
 * browser dependency. Pass its exported `LitElementRenderer` constructor.
 */
export function lyraSsrElementRenderers<T extends LyraLitElementRendererConstructor>(
  litElementRenderer: T,
): readonly [typeof LyraSsrFallbackRenderer, T] {
  return [LyraSsrFallbackRenderer, litElementRenderer] as const;
}

/** Awaits registered Lyra hosts' current updates and reports their runtime readiness. */
export async function diagnoseLyraHydration(
  root?: ParentNode,
): Promise<readonly LyraHydrationDiagnostic[]> {
  if (typeof document === 'undefined' || typeof customElements === 'undefined') return [];

  const scope = root ?? document;
  const candidates = [
    ...(typeof Element !== 'undefined' && scope instanceof Element ? [scope] : []),
    ...scope.querySelectorAll('*'),
  ].filter((element) => getLyraSsrMode(element.localName) !== undefined);

  return Promise.all(
    candidates.map(async (element): Promise<LyraHydrationDiagnostic> => {
      const tagName = element.localName;
      const mode = getLyraSsrMode(tagName) ?? 'client-render';
      if (!customElements.get(tagName)) {
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
        status: mode === 'render-and-hydrate' ? 'hydrated' : 'client-rendered',
      };
    }),
  );
}
