import type { Plugin } from 'vite';

export interface LyraMapWorkerPluginOptions {
  /** Advanced override for a compatible generated worker entry. */
  workerEntry?: string | URL;
  /** Package to exclude from development dependency optimization. */
  packageName?: string;
}

/** Bundles the renderer and module worker into one content-addressed module graph. */
export declare function lyraMapWorkerPlugin(options?: LyraMapWorkerPluginOptions): Plugin;
