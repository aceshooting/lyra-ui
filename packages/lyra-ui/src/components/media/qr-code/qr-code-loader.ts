import { createOptionalPeerLoader } from '../../../internal/optional-peer-capabilities.js';

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

const qrCode = /* @__PURE__ */ createOptionalPeerLoader<QrCodeApi>({
  load: () => import('qrcode'),
  // A hostile interop wrapper can throw from the capability getter; that fails closed too.
  isCapability: (candidate): candidate is QrCodeApi => {
    try { return isQrCodeApi(candidate); } catch { return false; }
  },
  warningKey: QR_CODE_PEER_WARNING_KEY,
  warning: QR_CODE_PEER_WARNING,
});

/** Uncached worker -- `importQrCode` is injectable for tests. */
export function loadQrCode(importQrCode?: () => Promise<unknown>): Promise<QrCodeApi | null> {
  return qrCode.loadWith(importQrCode);
}

/** Cached accessor -- one `import('qrcode')` shared across every caller. */
export function loadQrCodeCached(): Promise<QrCodeApi | null> {
  return qrCode.get();
}

/** @internal Test-only cache reset. */
export function clearQrCodeCache(): void {
  qrCode.clear();
}
