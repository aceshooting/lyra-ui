import type * as ForceModule from 'd3-force';
import type * as DragModule from 'd3-drag';
import type * as ZoomModule from 'd3-zoom';
import type * as SelectionModule from 'd3-selection';

export interface D3Modules {
  forceSimulation: typeof ForceModule.forceSimulation;
  forceLink: typeof ForceModule.forceLink;
  forceManyBody: typeof ForceModule.forceManyBody;
  forceCenter: typeof ForceModule.forceCenter;
  forceCollide: typeof ForceModule.forceCollide;
  drag: typeof DragModule.drag;
  zoom: typeof ZoomModule.zoom;
  select: typeof SelectionModule.select;
}

/**
 * Resolves the optional peer dependencies `d3-force`/`d3-drag`/`d3-zoom`/
 * `d3-selection` via the given importers (real dynamic imports by default).
 * Uncached and dependency-injectable so both the success path and the
 * caught-error warning path are directly testable without needing to
 * actually uninstall any of the four packages.
 */
export async function loadD3Modules(
  importForce: () => Promise<typeof ForceModule> = () => import('d3-force'),
  importDrag: () => Promise<typeof DragModule> = () => import('d3-drag'),
  importZoom: () => Promise<typeof ZoomModule> = () => import('d3-zoom'),
  importSelection: () => Promise<typeof SelectionModule> = () => import('d3-selection'),
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
