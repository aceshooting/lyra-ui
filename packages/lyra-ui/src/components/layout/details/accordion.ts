/** @deprecated Import @aceshooting/lyra-ui/components/lr-accordion.js to register this component. */
export * from './accordion.class.js';
import { LyraAccordion } from './accordion.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('accordion', LyraAccordion);
