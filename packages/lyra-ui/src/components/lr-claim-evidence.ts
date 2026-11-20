export * from './retrieval/claim-evidence/claim-evidence.class.js';
import { LyraClaimEvidence } from './retrieval/claim-evidence/claim-evidence.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-badge.js';
import './lr-empty.js';
import './lr-citation-badge.js';

defineElement('claim-evidence', LyraClaimEvidence);

