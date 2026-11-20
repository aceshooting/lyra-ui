import './lr-pagination.js';
export * from './agent-tools/test-results/test-results.class.js';
import './lr-empty.js';
import './lr-spinner.js';
import './lr-live-region.js';
import { LyraTestResults } from './agent-tools/test-results/test-results.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('test-results', LyraTestResults);
