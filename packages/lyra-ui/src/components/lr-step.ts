export * from './layout/stepper/step.class.js';
import { LyraStep } from './layout/stepper/step.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('step', LyraStep);
