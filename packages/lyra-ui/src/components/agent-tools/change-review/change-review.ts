export * from './change-review.class.js';
import { LyraChangeReview } from './change-review.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../utility/diff-view/diff-view.js';
defineElement('change-review', LyraChangeReview);
