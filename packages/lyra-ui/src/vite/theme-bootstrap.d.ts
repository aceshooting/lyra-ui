/** A style axis the bootstrap can restore, or `'all'`. */
export type LyraThemeBootstrapRestoreAxis = 'all' | 'look' | 'surface' | 'density' | 'mode' | 'accent';

export interface LyraThemeBootstrapPluginOptions {
  /** Written as `data-lr-theme-storage-key`; default: the bootstrap's `lyra-theme` key. */
  storageKey?: string;
  /** Written as `data-lr-theme-restore`; unknown axes are dropped. Default: the whole profile. */
  restore?: LyraThemeBootstrapRestoreAxis | readonly LyraThemeBootstrapRestoreAxis[];
  /** Written as `data-lr-theme-attributes`, the attributes that receive the resolved mode. */
  modeAttributes?: readonly string[];
  /** Advanced override for the bootstrap source file; default: this package's `theme-bootstrap.js`. */
  src?: string | URL;
  /** Public file name below the Vite `base`; default `lyra-theme-bootstrap.js`. */
  fileName?: string;
}

/** The Vite hooks this plugin implements, typed structurally so Vite stays an application dependency. */
export interface LyraThemeBootstrapPlugin {
  name: string;
  configResolved(config: { base?: string; build?: { ssr?: unknown } }): void;
  configureServer(server: {
    middlewares: {
      use(handler: (
        request: { url?: string },
        response: { setHeader(name: string, value: string): unknown; end(body: string): unknown },
        next: () => void,
      ) => void): unknown;
    };
  }): void;
  transformIndexHtml(html: string): string | {
    html: string;
    tags: { tag: 'script'; attrs: Record<string, string>; injectTo: 'head-prepend' }[];
  };
  generateBundle(this: { emitFile(file: { type: 'asset'; fileName: string; source: string }): string }): void;
}

/**
 * Inserts `<script src="<base>lyra-theme-bootstrap.js">` right after `<meta charset>`, serves the
 * asset during development and emits it into the build, for a strict Content-Security-Policy
 * without inline scripts.
 */
export declare function lyraThemeBootstrapPlugin(options?: LyraThemeBootstrapPluginOptions): LyraThemeBootstrapPlugin;
