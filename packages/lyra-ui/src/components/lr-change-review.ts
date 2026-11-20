export * from './agent-tools/change-review/change-review.class.js';
import { LyraChangeReview } from './agent-tools/change-review/change-review.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-diff-view.js';
defineElement('change-review', LyraChangeReview);
