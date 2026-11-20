export * from './overlays/skeleton/skeleton.class.js';
import { LyraSkeleton } from './overlays/skeleton/skeleton.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('skeleton', LyraSkeleton);
