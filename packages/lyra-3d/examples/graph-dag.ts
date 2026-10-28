import type { Lyra3dHost } from '@aceshooting/lyra-3d/core';
import { createEngine } from '@aceshooting/lyra-3d/graph';
import {
  layoutGraphDagAsync,
  type GraphDagLayoutInput,
  type GraphDagLayoutOptions,
} from '@aceshooting/lyra-3d/graph-layout';

/** The application supplies localized status text and an accessible list fallback. */
export type DagExampleStatus = 'loading' | 'ready' | 'layout-error' | 'unavailable';

export interface DagExample {
  /** Keep the input columns unchanged until this promise settles. */
  replace(input: GraphDagLayoutInput, options?: GraphDagLayoutOptions): Promise<void>;
  /** Call when the owning view disconnects. */
  dispose(): void;
}

/** Mount a standalone graph engine and install a four-node diamond DAG. */
export function mountDagExample(
  container: HTMLElement,
  host: Lyra3dHost,
  onStatus: (status: DagExampleStatus) => void = () => {},
): DagExample {
  const engine = createEngine();
  let active = true;
  let generation = 0;
  let revision = 0;
  let pending: AbortController | undefined;
  let observer: ResizeObserver | undefined;

  function dispose() {
    if (!active) return;
    active = false;
    generation++;
    pending?.abort();
    pending = undefined;
    observer?.disconnect();
    observer = undefined;
    engine.dispose();
  }

  function report(status: DagExampleStatus) {
    try {
      onStatus(status);
    } catch {
      dispose();
    }
  }

  const mounted = (async () => {
    try {
      await engine.mount(container, host);
      if (!active) return false;
      observer = new ResizeObserver((entries) => {
        if (!active) return;
        const entry = entries.find((item) => item.target === container);
        if (entry) engine.resize(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(container);
      const allocation = container.getBoundingClientRect();
      engine.resize(allocation.width, allocation.height);
      return true;
    } catch {
      if (active) {
        dispose();
        report('unavailable');
      }
      return false;
    }
  })();

  async function replace(input: GraphDagLayoutInput, options?: GraphDagLayoutOptions) {
    if (!active) return;
    const currentGeneration = ++generation;
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    const { nodeCount, source, target } = input;
    const isCurrent = () => active && generation === currentGeneration && !controller.signal.aborted;
    try {
      report('loading');
      if (!isCurrent()) return;
      if (!await mounted || !isCurrent()) return;
      const result = await layoutGraphDagAsync({ nodeCount, source, target }, options, { signal: controller.signal });
      if (!isCurrent()) return;
      // Explicit positions are pinned by default; no separate force layout is requested.
      engine.setData({ nodeCount, source, target, positions: result.positions }, ++revision);
      if (!isCurrent()) return;
      engine.fit?.();
      if (isCurrent()) report('ready');
    } catch (error) {
      if (!isCurrent()) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      report('layout-error');
    } finally {
      if (pending === controller) pending = undefined;
    }
  }

  void replace({
    nodeCount: 4,
    source: new Uint32Array([0, 0, 1, 2]),
    target: new Uint32Array([1, 2, 3, 3]),
  });
  return { replace, dispose };
}
