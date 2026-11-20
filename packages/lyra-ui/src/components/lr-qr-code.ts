export * from './media/qr-code/qr-code.class.js';
import { LyraQrCode } from './media/qr-code/qr-code.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('qr-code', LyraQrCode);
