import { LyraBadge } from './badge.class.js';

/** `<lyra-tag>` — a semantic alias for the compact badge treatment.
 *
 * @customElement lyra-tag
 */
export class LyraTag extends LyraBadge {}
declare global { interface HTMLElementTagNameMap { 'lyra-tag': LyraTag; } }
