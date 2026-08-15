import { GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';

// pdf-loader.ts deliberately never turns a bare `pdfjs-dist/...` specifier into a workerSrc
// itself (see its `fails closed instead of assigning an unresolved or active-content worker URL`
// test) -- `import.meta.resolve()` has no import map to consult for an npm specifier in a bundled
// Vite output, so it always returns null there, and <lr-pdf-viewer> is documented to leave
// GlobalWorkerOptions.workerSrc for the *consumer's own bundler* to resolve rather than guess at
// one that might not exist or might be attacker-influenced. Storybook is exactly that consumer:
// resolve the real worker chunk through Vite's own `?worker&url` (the same mechanism
// maplibre-worker.js already uses for maplibre-gl) before any pdf-viewer story constructs a
// document, mirroring what a real integrating app is expected to do.
GlobalWorkerOptions.workerSrc = workerUrl;
