export * from './claim-evidence.class.js';
import { LyraClaimEvidence } from './claim-evidence.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/badge/badge.js';
import '../../overlays/empty/empty.js';
import '../citation-badge/citation-badge.js';

defineElement('claim-evidence', LyraClaimEvidence);

