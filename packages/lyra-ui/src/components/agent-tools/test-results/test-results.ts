export * from './test-results.class.js';
import { LyraTestResults } from './test-results.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('test-results', LyraTestResults);
