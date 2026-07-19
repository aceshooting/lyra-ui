export * from './policy-summary.class.js';
import { LyraPolicySummary } from './policy-summary.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../badge/badge.js';
import '../callout/callout.js';
import '../details/details.js';
import '../empty/empty.js';
defineElement('policy-summary', LyraPolicySummary);
