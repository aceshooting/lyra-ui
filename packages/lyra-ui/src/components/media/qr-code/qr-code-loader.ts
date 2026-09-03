import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';

const QR_CODE_PEER_WARNING_KEY = 'lyra-qr-code-peer-unavailable';
const QR_CODE_PEER_WARNING = '<lr-qr-code> could not load its optional qrcode peer.';

/** Opaque `qrcode` (soldair/node-qrcode) surface kept optional for core-package consumers --
 *  narrowed by an application that installs the peer to that peer's own types. */
export interface QrCodeApi {
  create(value: string, options?: Record<string, unknown>): unknown;
}

function isQrCodeApi(value: unknown): value is QrCodeApi {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'create' in value &&
    typeof value.create === 'function'
  );
}

let cached: Promise<QrCodeApi | null> | undefined;

/** Uncached worker -- `importQrCode` is injectable for tests. Tolerates either a `{ default }`
 *  ESM interop shape or the module itself already being the API, matching `papaparse`'s own
 *  dual-shape tolerance (`qrcode`, like `papaparse`, is a CJS package resolved differently by
 *  different bundlers/test harnesses). */
export async function loadQrCode(
  importQrCode: () => Promise<unknown> = () => import('qrcode'),
): Promise<QrCodeApi | null> {
  try {
    const module = await importQrCode();
    return resolveOptionalPeerCapability(module, isQrCodeApi);
  } catch {
    devWarnOnce(QR_CODE_PEER_WARNING_KEY, QR_CODE_PEER_WARNING);
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
