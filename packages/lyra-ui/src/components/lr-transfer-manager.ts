export * from './utility/transfer-manager/transfer-manager.class.js';
import { LyraTransferManager } from './utility/transfer-manager/transfer-manager.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('transfer-manager', LyraTransferManager);
