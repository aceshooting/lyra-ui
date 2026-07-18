import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

/** Opaque `qrcode` (soldair/node-qrcode) surface kept optional for core-package consumers --
 *  narrowed by an application that installs the peer to that peer's own types. */
export type QrCodeApi = OptionalPeerApi;

let cached: Promise<QrCodeApi | null> | undefined;

/** Uncached worker -- `importQrCode` is injectable for tests. Tolerates either a `{ default }`
 *  ESM interop shape or the module itself already being the API, matching `papaparse`'s own
 *  dual-shape tolerance (`qrcode`, like `papaparse`, is a CJS package resolved differently by
 *  different bundlers/test harnesses). */
export async function loadQrCode(
  importQrCode: () => Promise<QrCodeApi | { default: QrCodeApi }> = () => import('qrcode'),
): Promise<QrCodeApi | null> {
  try {
    const module = await importQrCode();
    const candidate = (module as { default?: QrCodeApi }).default;
    return candidate && typeof candidate.create === 'function' ? candidate : (module as QrCodeApi);
  } catch (error) {
    console.warn(
      '<lr-qr-code> needs the optional peer dependency `qrcode` to render QR codes — install it with `pnpm add qrcode`:',
      error,
    );
    return null;
  }
}

/** Cached accessor -- the actual dynamic `import('qrcode')` and its resolved API are shared
 *  across every caller instead of each instance maintaining its own independent cache. */
export function loadQrCodeCached(): Promise<QrCodeApi | null> {
  if (!cached) cached = loadQrCode();
  return cached;
}

/** @internal Test-only cache reset. */
export function clearQrCodeCache(): void {
  cached = undefined;
}
