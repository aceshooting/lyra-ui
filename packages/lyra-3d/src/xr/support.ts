interface XrSupportEnvironment {
  readonly isSecureContext?: unknown;
  readonly navigator?: unknown;
}

/** Queries immersive-vr support without requesting permission or creating a session. */
export async function isLyra3dXrSupported(): Promise<boolean> {
  try {
    const environment: XrSupportEnvironment = globalThis;
    if (environment.isSecureContext !== true) return false;
    const navigator = environment.navigator;
    if (!isObject(navigator)) return false;
    const xr: unknown = (navigator as { readonly xr?: unknown }).xr;
    if (!isObject(xr)) return false;
    const query: unknown = (xr as { readonly isSessionSupported?: unknown }).isSessionSupported;
    if (typeof query !== 'function') return false;
    return await (query as (this: object, mode: string) => unknown).call(xr, 'immersive-vr') === true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
