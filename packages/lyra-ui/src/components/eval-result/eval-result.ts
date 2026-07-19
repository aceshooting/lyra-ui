export * from './eval-result.class.js';
import { LyraEvalResult } from './eval-result.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../rubric-form/rubric-form.js';
import '../data-grid/data-grid.js';
import '../diff-view/diff-view.js';

defineElement('eval-result', LyraEvalResult);
