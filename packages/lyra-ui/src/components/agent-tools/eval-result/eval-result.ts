export * from './eval-result.class.js';
import { LyraEvalResult } from './eval-result.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../forms/rubric-form/rubric-form.js';
import '../../data/table/table.js';
import '../../utility/diff-view/diff-view.js';

defineElement('eval-result', LyraEvalResult);
