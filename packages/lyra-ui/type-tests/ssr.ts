import { LitElementRenderer } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr/lib/render-value.js';
import {
  LYRA_SSR_CLIENT_RENDER_TAGS,
  LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
  LYRA_SSR_SUPPORT_MATRIX,
  LyraSsrFallbackRenderer,
  diagnoseLyraHydration,
  getLyraSsrMode,
  lyraSsrElementRenderers,
  type LyraHydrationDiagnostic,
  type LyraHydrationStatus,
  type LyraSsrMode,
} from '../src/ssr.js';

const renderers = lyraSsrElementRenderers(LitElementRenderer);
// The documented `render(template, { elementRenderers })` call: the result must be assignable to
// the mutable `RenderInfo['elementRenderers']` array, not a readonly tuple.
const renderInfo: Partial<RenderInfo> = { elementRenderers: lyraSsrElementRenderers(LitElementRenderer) };
const mutableRenderers: RenderInfo['elementRenderers'] = lyraSsrElementRenderers(LitElementRenderer);
mutableRenderers.push(LitElementRenderer);

const fallback: typeof LyraSsrFallbackRenderer = renderers[0];
const mode: LyraSsrMode | undefined = getLyraSsrMode('lr-page');
const diagnostics: Promise<readonly LyraHydrationDiagnostic[]> = diagnoseLyraHydration(document);
const readiness: LyraHydrationStatus = 'ready';
// @ts-expect-error readiness does not claim that hydration was observed
const observedHydration: LyraHydrationStatus = 'hydrated';
const imports: 'server-safe' = LYRA_SSR_SUPPORT_MATRIX.imports.root;
const renderTag: string | undefined = LYRA_SSR_RENDER_AND_HYDRATE_TAGS[0];
const fallbackTag: string | undefined = LYRA_SSR_CLIENT_RENDER_TAGS[0];

void [renderInfo, fallback, mode, diagnostics, readiness, observedHydration, imports, renderTag, fallbackTag];
