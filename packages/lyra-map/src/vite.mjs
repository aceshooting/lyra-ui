import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const workerBridgeToken = '__LYRA_MODULAR_WORKER_BRIDGE__';
// The generated companion carries this token only in defaultWorkerUrl's URL constructor.
// A single consumer graph owns the renderer, module worker, and their shared chunks.
export function lyraMapWorkerPlugin({
  workerEntry = new URL('./worker.mjs', import.meta.url),
  packageName = '@aceshooting/lyra-map'
} = {}) {
  let reference,
    hits = 0,
    command;
  const workerPath = workerEntry instanceof URL ? fileURLToPath(workerEntry) : resolve(workerEntry);
  return {
    name: 'modular-worker-same-consumer-graph',
    // A shared renderer/worker chunk must not acquire document-only Vite preload helpers.
    // Exclusion covers the companion package and its subpaths, keeping the bridge
    // visible to the dev transform instead of copying it into optimizer output.
    config() {
      return { build: { modulePreload: false }, optimizeDeps: { exclude: packageName ? [packageName] : [] } };
    },
    configResolved(config) {
      command = config.command;
    },
    configureServer(server) {
      // Linked/generated companions can be outside the consumer workspace.
      // Extend the resolved allowlist so Vite serves and transforms this ESM graph.
      const directory = dirname(workerPath);
      if (!server.config.server.fs.allow.includes(directory)) server.config.server.fs.allow.push(directory);
    },
    transform(code) {
      const pattern = /new URL\((['"])__LYRA_MODULAR_WORKER_BRIDGE__\1\s*,\s*import\.meta\.url\)/g;
      if (!pattern.test(code)) return;
      if (command === 'serve') {
        pattern.lastIndex = 0;
        return {
          code:
            `import __lyraModularDevWorkerUrl from ${JSON.stringify(workerPath + '?worker&url')};\n` +
            code.replace(pattern, 'new URL(__lyraModularDevWorkerUrl, import.meta.url)'),
          map: null
        };
      }
      if (!reference) reference = this.emitFile({ type: 'chunk', id: workerPath, name: 'map-worker' });
      hits++;
      pattern.lastIndex = 0;
      return {
        code: code.replace(pattern, `new URL(import.meta.ROLLUP_FILE_URL_${reference}, import.meta.url)`),
        map: null
      };
    },
    generateBundle() {
      if (hits > 1) throw new Error(`Expected at most one modular worker URL bridge, found ${hits}`);
    }
  };
}
