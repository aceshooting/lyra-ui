import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';

export interface D3SimulationNodeDatum {
  index?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface D3SimulationLinkDatum<Node extends D3SimulationNodeDatum> {
  source: Node | string | number;
  target: Node | string | number;
  index?: number;
}

export interface D3ForceManyBody<Node extends D3SimulationNodeDatum> {
  strength(value: number | ((node: Node) => number)): this;
}

export interface D3ForceLink<
  Node extends D3SimulationNodeDatum,
  Link extends D3SimulationLinkDatum<Node>,
> {
  distance(value: number | ((link: Link) => number)): this;
}

export interface D3ForceCollide<Node extends D3SimulationNodeDatum> {
  radius(value: number | ((node: Node) => number)): this;
}

export interface D3ForceCenter {
  initialize?(nodes: D3SimulationNodeDatum[]): void;
}

export interface D3Simulation<
  Node extends D3SimulationNodeDatum,
  Link extends D3SimulationLinkDatum<Node>,
> {
  force(
    name: string,
    force:
      | D3ForceLink<Node, Link>
      | D3ForceManyBody<Node>
      | D3ForceCollide<Node>
      | D3ForceCenter,
  ): this;
  on(type: 'tick', listener: () => void): this;
  alphaTarget(value: number): this;
  restart(): this;
  stop(): this;
  alpha(): number;
  alpha(value: number): this;
  alphaMin(): number;
  tick(iterations?: number): this;
}

export interface D3ZoomTransform {
  readonly k: number;
  readonly x: number;
  readonly y: number;
  translate(x: number, y: number): D3ZoomTransform;
  scale(k: number): D3ZoomTransform;
  toString(): string;
}

export interface D3Selection<ElementType extends Element, Datum> {
  call(behavior: unknown): this;
  node?(): ElementType | null;
  datum?(): Datum;
}

export interface D3ZoomBehavior<ElementType extends Element, Datum> {
  scaleExtent(extent: [number, number]): this;
  on(type: 'start' | 'end', listener: () => void): this;
  on(type: 'zoom', listener: (event: { transform: D3ZoomTransform }) => void): this;
  transform(selection: D3Selection<ElementType, Datum>, transform: D3ZoomTransform): void;
}

export interface D3DragBehavior<ElementType extends Element, Datum> {
  on(type: 'start' | 'drag' | 'end', listener: (event: {
    active: number;
    x: number;
    y: number;
    sourceEvent?: unknown;
    subject?: Datum;
    container?: ElementType;
  }) => void): this;
}

export interface D3Modules {
  forceSimulation<
    Node extends D3SimulationNodeDatum,
    Link extends D3SimulationLinkDatum<Node>,
  >(nodes: Node[]): D3Simulation<Node, Link>;
  forceLink<
    Node extends D3SimulationNodeDatum,
    Link extends D3SimulationLinkDatum<Node>,
  >(links: Link[]): D3ForceLink<Node, Link>;
  forceManyBody<Node extends D3SimulationNodeDatum>(): D3ForceManyBody<Node>;
  forceCenter(x?: number, y?: number): D3ForceCenter;
  forceCollide<Node extends D3SimulationNodeDatum>(): D3ForceCollide<Node>;
  drag<ElementType extends Element, Datum>(): D3DragBehavior<ElementType, Datum>;
  zoom<ElementType extends Element, Datum>(): D3ZoomBehavior<ElementType, Datum>;
  /** The identity transform (`k=1, x=0, y=0`) — the starting point for constructing an absolute
   *  camera transform via `.translate(x, y).scale(k)`, used by `focusNode()`/`fit()`. */
  zoomIdentity: D3ZoomTransform;
  /** Reads the transform currently bound to a DOM node via d3-zoom (its internal `__zoom`
   *  datum) — used to read the current scale/position before tweening to a new one. */
  zoomTransform(node: Element): D3ZoomTransform;
  select<ElementType extends Element, Datum>(node: ElementType): D3Selection<ElementType, Datum>;
}

function optionalPeerRecord(value: unknown): Record<string, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
    ? value as Record<string, unknown>
    : {};
}

type CallableApi<Name extends string> = Record<Name, (...args: never[]) => unknown>;

const forceApiNames = [
  'forceSimulation',
  'forceLink',
  'forceManyBody',
  'forceCenter',
  'forceCollide',
] as const;

function hasRequiredCallables<Name extends string>(
  value: unknown,
  names: readonly Name[],
): value is CallableApi<Name> {
  const candidate = optionalPeerRecord(value);
  return names.every((name) => typeof candidate[name] === 'function');
}

function isD3ForceApi(value: unknown): value is CallableApi<(typeof forceApiNames)[number]> {
  return hasRequiredCallables(value, forceApiNames);
}

function isD3DragApi(value: unknown): value is CallableApi<'drag'> {
  return hasRequiredCallables(value, ['drag']);
}

type D3ZoomApi = CallableApi<'zoom' | 'zoomTransform'> & {
  zoomIdentity: {
    translate: (...args: never[]) => unknown;
    scale: (...args: never[]) => unknown;
  };
};

function isD3ZoomApi(value: unknown): value is D3ZoomApi {
  if (!hasRequiredCallables(value, ['zoom', 'zoomTransform'])) return false;
  const identity = optionalPeerRecord(optionalPeerRecord(value)['zoomIdentity']);
  return typeof identity['translate'] === 'function' && typeof identity['scale'] === 'function';
}

function isD3SelectionApi(value: unknown): value is CallableApi<'select'> {
  return hasRequiredCallables(value, ['select']);
}

/**
 * Resolves the optional peer dependencies `d3-force`/`d3-drag`/`d3-zoom`/
 * `d3-selection` via the given importers (real dynamic imports by default).
 * Uncached and dependency-injectable so both the success path and the
 * caught-error warning path are directly testable without needing to
 * actually uninstall any of the four packages.
 */
export async function loadD3Modules(
  importForce: () => Promise<unknown> = () => import('d3-force'),
  importDrag: () => Promise<unknown> = () => import('d3-drag'),
  importZoom: () => Promise<unknown> = () => import('d3-zoom'),
  importSelection: () => Promise<unknown> = () => import('d3-selection'),
): Promise<D3Modules | null> {
  try {
    const [force, dragMod, zoomMod, selectionMod] = await Promise.all([
      importForce(),
      importDrag(),
      importZoom(),
      importSelection(),
    ]);
    const forceApi = optionalPeerRecord(
      resolveOptionalPeerCapability(force, isD3ForceApi),
    );
    const dragApi = optionalPeerRecord(resolveOptionalPeerCapability(dragMod, isD3DragApi));
    const zoomApi = optionalPeerRecord(resolveOptionalPeerCapability(zoomMod, isD3ZoomApi));
    const selectionApi = optionalPeerRecord(
      resolveOptionalPeerCapability(selectionMod, isD3SelectionApi),
    );
    const modules = {
      forceSimulation: forceApi['forceSimulation'],
      forceLink: forceApi['forceLink'],
      forceManyBody: forceApi['forceManyBody'],
      forceCenter: forceApi['forceCenter'],
      forceCollide: forceApi['forceCollide'],
      drag: dragApi['drag'],
      zoom: zoomApi['zoom'],
      zoomIdentity: zoomApi['zoomIdentity'],
      zoomTransform: zoomApi['zoomTransform'],
      select: selectionApi['select'],
    };
    const callableNames = [
      'forceSimulation',
      'forceLink',
      'forceManyBody',
      'forceCenter',
      'forceCollide',
      'drag',
      'zoom',
      'zoomTransform',
      'select',
    ] as const;
    const missing = callableNames.find((name) => typeof modules[name] !== 'function');
    const identity = modules.zoomIdentity;
    if (
      missing ||
      !identity ||
      typeof (identity as { translate?: unknown }).translate !== 'function' ||
      typeof (identity as { scale?: unknown }).scale !== 'function'
    ) {
      throw new TypeError(
        missing
          ? `The optional d3 peers do not provide the required ${missing}() function.`
          : 'The optional d3-zoom peer does not provide a usable zoomIdentity transform.',
      );
    }
    return modules as unknown as D3Modules;
  } catch (err) {
    console.warn(
      '<lr-graph> needs the optional peer dependencies `d3-force`, `d3-drag`, ' +
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
 * `<lr-flag>`'s peer-dependency pattern.
 */
export function loadD3(): Promise<D3Modules | null> {
  if (!d3Modules) {
    d3Modules = loadD3Modules();
  }
  return d3Modules;
}
