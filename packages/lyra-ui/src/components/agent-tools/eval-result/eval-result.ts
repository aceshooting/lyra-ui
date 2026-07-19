export * from './eval-result.class.js';
import { LyraEvalResult } from './eval-result.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../forms/rubric-form/rubric-form.js';
import '../../data/data-grid/data-grid.js';
import '../../utility/diff-view/diff-view.js';

defineElement('eval-result', LyraEvalResult);
