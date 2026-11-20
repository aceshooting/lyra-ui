export type { LyraAccordionAppearance, LyraAccordionHeadingLevel, LyraAccordionIconPlacement } from './layout/details/accordion-types.js';
export { LyraAccordionItem } from './layout/details/accordion-item.class.js';
import { LyraAccordionItem } from './layout/details/accordion-item.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('accordion-item', LyraAccordionItem);
