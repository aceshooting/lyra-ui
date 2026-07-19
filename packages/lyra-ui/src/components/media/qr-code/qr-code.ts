export * from './qr-code.class.js';
import { LyraQrCode } from './qr-code.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('qr-code', LyraQrCode);
