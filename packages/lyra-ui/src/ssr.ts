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
  | 'optional-peer'
  | 'shadow-dom-query';

export interface LyraSsrClientRenderReason {
  code: LyraSsrClientRenderReasonCode;
  detail: string;
}

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

const reason = (
  code: LyraSsrClientRenderReasonCode,
  detail: string,
): Readonly<LyraSsrClientRenderReason> => Object.freeze({ code, detail });

/**
 * `LyraChart` and its subclasses, plus `<lr-box-plot>`, all start at `loading = true` and render a
 * `<lr-skeleton>` until a lazily imported `chart.js` resolves; only then do they swap in the
 * `<canvas>` that Chart.js paints. That swap replaces the whole shadow tree, and the canvas itself
 * has no server-side representation at all — the same mechanism in every one of them, which is why
 * they share this sentence rather than each paraphrasing it.
 */
const CHART_JS_PEER_RENDER =
  'renders a skeleton until its lazily imported chart.js peer resolves in the browser and paints its canvas';

/**
 * Evidence-backed exceptions to declarative-shadow-DOM rendering. Every entry names the browser
 * capability its first render currently requires; `pnpm test:ssr` rejects unknown, duplicate, or
 * unclassified inventory tags. Remove an entry as soon as the component no longer needs it.
 */
export const LYRA_SSR_CLIENT_RENDER_REASONS = Object.freeze({
  [tag('app-rail')]: reason('layout-measurement', 'reads window dimensions while deriving its initial rail size'),
  [tag('bar-chart')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('box-plot')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('bubble-chart')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('chart')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('date-input')]: reason('shadow-dom-query', 'coordinates a rendered slot listener during its first update'),
  [tag('dock-panel')]: reason('layout-measurement', 'reads window dimensions while deriving its initial panel size'),
  [tag('doughnut-chart')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('eval-dataset')]: reason('shadow-dom-query', 'queries a nested export menu during its initial render'),
  [tag('evaluation-run')]: reason('shadow-dom-query', 'derives progress text from rendered shadow content'),
  [tag('export-button')]: reason('shadow-dom-query', 'queries its rendered menu items during its first update'),
  [tag('file-tree')]: reason('document-focus', 'reads document focus while constructing its initial tree state'),
  [tag('graph')]: reason('optional-peer', 'renders a skeleton until its lazily imported d3 peers resolve in the browser and lay its nodes out'),
  [tag('histogram')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('line-chart')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('mind-map')]: reason('computed-style', 'resolves live computed token units for its initial SVG geometry'),
  [tag('page-rail')]: reason('browser-constructor', 'checks rendered nodes against HTMLElement during its first update'),
  [tag('pie-chart')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('polar-area-chart')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('progress-bar')]: reason('shadow-dom-query', 'derives its visible label from rendered shadow content'),
  [tag('progress-ring')]: reason('shadow-dom-query', 'derives its visible label from rendered shadow content'),
  [tag('radar-chart')]: reason('optional-peer', CHART_JS_PEER_RENDER),
  [tag('radio')]: reason('browser-constructor', 'resolves a composed radio-group ancestor in its constructor'),
  [tag('radio-button')]: reason('browser-constructor', 'resolves a composed radio-group ancestor in its constructor'),
  [tag('realtime-session')]: reason('browser-constructor', 'checks a rendered root against ShadowRoot during its first update'),
  [tag('scatter-chart')]: reason('optional-peer', CHART_JS_PEER_RENDER),
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
