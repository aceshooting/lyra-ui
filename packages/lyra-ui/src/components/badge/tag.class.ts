import { LyraBadge } from './badge.class.js';

/** `<lr-tag>` — a semantic alias for the compact badge treatment.
 *
 * @customElement lr-tag
 */
export class LyraTag extends LyraBadge {}
declare global { interface HTMLElementTagNameMap { 'lr-tag': LyraTag; } }
