export * from './policy-summary.class.js';
import { LyraPolicySummary } from './policy-summary.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/badge/badge.js';
import '../../overlays/callout/callout.js';
import '../../layout/details/details.js';
import '../../overlays/empty/empty.js';
defineElement('policy-summary', LyraPolicySummary);
