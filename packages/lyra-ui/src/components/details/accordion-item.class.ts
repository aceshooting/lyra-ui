import { LyraDetails } from './details.class.js';

/** `<lyra-accordion-item>` — an accordion-compatible disclosure panel.
 *
 * @customElement lyra-accordion-item
 */
export class LyraAccordionItem extends LyraDetails {}
declare global { interface HTMLElementTagNameMap { 'lyra-accordion-item': LyraAccordionItem; } }
