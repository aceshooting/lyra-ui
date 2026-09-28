/** @deprecated Import @aceshooting/lyra-ui/components/lr-policy-summary.js to register this component. */
export * from './policy-summary.class.js';
import { LyraPolicySummary } from './policy-summary.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/badge/badge.js';
import '../../layout/details/details.js';
import '../../overlays/empty/empty.js';
defineElement('policy-summary', LyraPolicySummary);
