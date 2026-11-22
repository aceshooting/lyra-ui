import { Worker } from 'node:worker_threads';

export const SSR_RENDER_COMMAND = 'lyra-ssr-render';
export const SSR_WARM_COMMAND = 'lyra-ssr-warm';

/**
 * Renders a serialized Lit template with @lit-labs/ssr and the built Lyra registrations, for the
 * browser-side `ssrFixture()` helper (test/wtr-ssr-fixture.ts). One worker serves the whole run:
 * loading the complete registration graph once costs seconds, each later render milliseconds.
 */
export function ssrFixturePlugin() {
  let worker;
  let ready;
  let nextId = 0;
  const pending = new Map();

  const failAll = (error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };

  const start = () => {
    ready ??= new Promise((resolve, reject) => {
      worker = new Worker(new URL('./wtr-ssr-render-worker.mjs', import.meta.url));
      worker.unref();
      worker.on('message', (message) => {
        if (message.ready) return resolve();
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error));
        else request.resolve(message.result);
      });
      worker.on('error', (error) => {
        reject(error);
        failAll(error);
      });
      worker.on('exit', (code) => {
        const error = new Error(`SSR fixture worker exited with code ${code}`);
        reject(error);
        failAll(error);
        ready = undefined;
      });
    });
    return ready;
  };

  return {
    name: 'lyra-ssr-fixture',
    async executeCommand({ command, payload }) {
      if (command === SSR_WARM_COMMAND) {
        await start();
        return true;
      }
      if (command !== SSR_RENDER_COMMAND) return;
      if (!payload || typeof payload !== 'object' || payload.template?.kind !== 'template') {
        throw new Error(`${SSR_RENDER_COMMAND} expects a serialized template payload.`);
      }
      await start();
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, template: payload.template });
      });
    },
    async serverStop() {
      await worker?.terminate();
    },
  };
}
