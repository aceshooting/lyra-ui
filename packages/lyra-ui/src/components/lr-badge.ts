export type { SemanticVariant } from '../internal/semantic-variant.js';
export * from './overlays/badge/badge.class.js';
import { LyraBadge } from './overlays/badge/badge.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('badge', LyraBadge);
