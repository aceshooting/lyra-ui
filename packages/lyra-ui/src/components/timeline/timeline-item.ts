export * from './timeline-item.class.js';
import { LyraTimelineItem } from './timeline-item.class.js';
import { defineElement } from '../../internal/prefix.js';
// Registers <lyra-relative-time>, rendered internally as the default timestamp fallback -- see the
// class doc's "Timestamp rendering" note. Kept out of timeline-item.class.ts so that module stays
// side-effect free per AGENTS.md's tree-shaking rule; mirrors <lyra-chat-message>'s identical
// dependency-registration split (chat-message.ts imports live-region.js the same way).
import '../format/relative-time.js';
defineElement('timeline-item', LyraTimelineItem);
