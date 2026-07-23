export * from './grounding-summary.class.js';
import { LyraGroundingSummary } from './grounding-summary.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../data/stat/stat.js';
import '../citation-badge/citation-badge.js';
import '../../overlays/empty/empty.js';
import '../claim-evidence/claim-evidence.js';
defineElement('grounding-summary', LyraGroundingSummary);
