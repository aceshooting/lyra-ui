import { LitElementRenderer } from '@lit-labs/ssr';
import {
  LYRA_SSR_CLIENT_RENDER_TAGS,
  LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
  LYRA_SSR_SUPPORT_MATRIX,
  LyraSsrFallbackRenderer,
  diagnoseLyraHydration,
  getLyraSsrMode,
  lyraSsrElementRenderers,
  type LyraHydrationDiagnostic,
  type LyraSsrMode,
} from '../src/ssr-loader.js';

const renderers = lyraSsrElementRenderers(LitElementRenderer);
const fallback: typeof LyraSsrFallbackRenderer = renderers[0];
const mode: LyraSsrMode | undefined = getLyraSsrMode('lr-page');
const diagnostics: Promise<readonly LyraHydrationDiagnostic[]> = diagnoseLyraHydration(document);
const imports: 'server-safe' = LYRA_SSR_SUPPORT_MATRIX.imports.root;
const renderTag: string | undefined = LYRA_SSR_RENDER_AND_HYDRATE_TAGS[0];
const fallbackTag: string | undefined = LYRA_SSR_CLIENT_RENDER_TAGS[0];

void [fallback, mode, diagnostics, imports, renderTag, fallbackTag];
