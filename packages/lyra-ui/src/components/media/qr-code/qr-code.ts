/** @deprecated Import @aceshooting/lyra-ui/components/lr-qr-code.js to register this component. */
export * from './qr-code.class.js';
import { LyraQrCode } from './qr-code.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('qr-code', LyraQrCode);
