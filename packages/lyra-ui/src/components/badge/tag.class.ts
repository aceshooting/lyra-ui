import { LyraBadge } from './badge.class.js';

/** `<lyra-tag>` — a semantic alias for the compact badge treatment. */
export class LyraTag extends LyraBadge {}
declare global { interface HTMLElementTagNameMap { 'lyra-tag': LyraTag; } }
