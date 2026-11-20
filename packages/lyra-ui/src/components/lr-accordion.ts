export * from './layout/details/accordion.class.js';
import { LyraAccordion } from './layout/details/accordion.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('accordion', LyraAccordion);
