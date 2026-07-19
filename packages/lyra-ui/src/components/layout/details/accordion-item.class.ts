import { LyraDetails } from './details.class.js';

/** `<lr-accordion-item>` — an accordion-compatible disclosure panel.
 *
 * @customElement lr-accordion-item
 */
export class LyraAccordionItem extends LyraDetails {}
declare global { interface HTMLElementTagNameMap { 'lr-accordion-item': LyraAccordionItem; } }
