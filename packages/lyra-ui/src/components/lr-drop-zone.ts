export * from './media/drop-zone/drop-zone.class.js';
import { LyraDropZone } from './media/drop-zone/drop-zone.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('drop-zone', LyraDropZone);
