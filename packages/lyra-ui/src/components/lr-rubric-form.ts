export * from './forms/rubric-form/rubric-form.class.js';
import { LyraRubricForm } from './forms/rubric-form/rubric-form.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-segmented.js';
import './lr-slider.js';
import './lr-textarea.js';

defineElement('rubric-form', LyraRubricForm);
