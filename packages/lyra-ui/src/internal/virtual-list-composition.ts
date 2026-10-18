/** The contiguous mounted interval and its separately retained focus row. @internal */
export interface VirtualListRenderDemand {
  readonly start: number;
  readonly endExclusive: number;
  readonly pinnedIndex: number | null;
}

/** Library composition policy; public virtual-list roles and defaults are unchanged. @internal */
export interface VirtualListCompositionProfile {
  readonly maxRows: number;
  readonly beforeRender?: (demand: Readonly<VirtualListRenderDemand>) => void;
}

interface CompositionState {
  profile?: Readonly<VirtualListCompositionProfile>;
  changed?: () => void;
}
const compositions = new WeakMap<object, CompositionState>();

/** Installs transparent structural semantics and a hard mounted-row budget. @internal */
export function setVirtualListCompositionProfile(host: object, profile: VirtualListCompositionProfile | undefined): void {
  const maxRows = profile?.maxRows;
  if (profile !== undefined && (typeof maxRows !== 'number' || !Number.isInteger(maxRows) || maxRows < 1 || maxRows > 500))
    throw new RangeError('Invalid virtual list composition row limit');
  const current = compositions.get(host) ?? {};
  if (current.profile?.maxRows === maxRows && current.profile?.beforeRender === profile?.beforeRender) return;
  current.profile = profile === undefined ? undefined : Object.freeze({ maxRows: maxRows!, beforeRender: profile.beforeRender });
  compositions.set(host, current);
  current.changed?.();
}

/** One observer per virtual-list instance; WeakMap ownership follows the element. @internal */
export class VirtualListCompositionController {
  constructor(private readonly host: object, changed: () => void) {
    const current = compositions.get(host) ?? {};
    current.changed = changed;
    compositions.set(host, current);
  }

  get profile(): Readonly<VirtualListCompositionProfile> | undefined {
    return compositions.get(this.host)?.profile;
  }
}
