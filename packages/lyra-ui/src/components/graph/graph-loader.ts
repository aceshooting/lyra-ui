import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

type D3Module = OptionalPeerApi;

export interface D3Modules {
  forceSimulation: <Node extends D3Module = D3Module>(nodes?: Iterable<Node>) => D3Module;
  forceLink: <Node extends D3Module = D3Module, Link extends D3Module = D3Module>(
    links?: Iterable<Link>,
  ) => D3Module;
  forceManyBody: <Node extends D3Module = D3Module>() => D3Module;
  forceCenter: (x?: number, y?: number) => D3Module;
  forceCollide: <Node extends D3Module = D3Module>(radius?: number | ((node: Node) => number)) => D3Module;
  drag: <Element extends D3Module = D3Module, Datum extends D3Module = D3Module>() => D3Module;
  zoom: <Element extends D3Module = D3Module, Datum extends D3Module = D3Module>() => D3Module;
  /** The identity transform (`k=1, x=0, y=0`) — the starting point for constructing an absolute
   *  camera transform via `.translate(x, y).scale(k)`, used by `focusNode()`/`fit()`. */
  zoomIdentity: D3Module;
  /** Reads the transform currently bound to a DOM node via d3-zoom (its internal `__zoom`
   *  datum) — used to read the current scale/position before tweening to a new one. */
  zoomTransform: (node: Element) => D3Module;
  select: <Element extends D3Module = D3Module, Datum extends D3Module = D3Module>(node?: Element) => D3Module;
}

/**
 * Resolves the optional peer dependencies `d3-force`/`d3-drag`/`d3-zoom`/
 * `d3-selection` via the given importers (real dynamic imports by default).
 * Uncached and dependency-injectable so both the success path and the
 * caught-error warning path are directly testable without needing to
 * actually uninstall any of the four packages.
 */
export async function loadD3Modules(
  importForce: () => Promise<D3Module> = () => import('d3-force') as Promise<D3Module>,
  importDrag: () => Promise<D3Module> = () => import('d3-drag') as Promise<D3Module>,
  importZoom: () => Promise<D3Module> = () => import('d3-zoom') as Promise<D3Module>,
  importSelection: () => Promise<D3Module> = () => import('d3-selection') as Promise<D3Module>,
): Promise<D3Modules | null> {
  try {
    const [force, dragMod, zoomMod, selectionMod] = await Promise.all([
      importForce(),
      importDrag(),
      importZoom(),
      importSelection(),
    ]);
    return {
      forceSimulation: force.forceSimulation,
      forceLink: force.forceLink,
      forceManyBody: force.forceManyBody,
      forceCenter: force.forceCenter,
      forceCollide: force.forceCollide,
      drag: dragMod.drag,
      zoom: zoomMod.zoom,
      zoomIdentity: zoomMod.zoomIdentity,
      zoomTransform: zoomMod.zoomTransform,
      select: selectionMod.select,
    };
  } catch (err) {
    console.warn(
      '<lyra-graph> needs the optional peer dependencies `d3-force`, `d3-drag`, ' +
        '`d3-zoom`, and `d3-selection` — install them with `pnpm add d3-force d3-drag d3-zoom d3-selection`:',
      err,
    );
    return null;
  }
}

let d3Modules: Promise<D3Modules | null> | undefined;

/**
 * Lazily loads the d3 peer dependencies (see `loadD3Modules()`) once per
 * page. Resolves to `null` if they aren't installed — mirrors
 * `<lyra-flag>`'s peer-dependency pattern.
 */
export function loadD3(): Promise<D3Modules | null> {
  if (!d3Modules) {
    d3Modules = loadD3Modules();
  }
  return d3Modules;
}
