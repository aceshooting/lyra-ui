export * from './grounding-summary.class.js';
import { LyraGroundingSummary } from './grounding-summary.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../stat/stat.js';
import '../citation-badge/citation-badge.js';
import '../empty/empty.js';
defineElement('grounding-summary', LyraGroundingSummary);
