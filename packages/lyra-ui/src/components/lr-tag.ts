export { LyraTag } from './overlays/badge/tag.class.js';
export type { LyraTagEventMap, TagVariant } from './overlays/badge/tag.class.js';
import { LyraTag } from './overlays/badge/tag.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('tag', LyraTag);
