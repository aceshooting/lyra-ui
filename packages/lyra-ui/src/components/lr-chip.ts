export * from './overlays/chip/chip.class.js';
import { LyraChip } from './overlays/chip/chip.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('chip', LyraChip);
