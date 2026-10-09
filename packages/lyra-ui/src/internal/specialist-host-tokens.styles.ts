import { unsafeCSS } from 'lit';
import { SPECIALIST_TOKEN_CSS } from './document-tokens.generated.js';

/**
 * The chart, graph and terminal palettes, adopted per host by the components that draw with them
 * (after `LyraElement.styles`, before their own sheet). Generated from tokens/canonical-tokens.json:
 * each value picks its light or dark branch from the inherited mode switches, so the palettes follow
 * the nearest mode scope in every engine, and their --lr-theme-* inputs keep working on any wrapper.
 * `specialist-tokens.styles.ts` is the per-mode record the palette generators edit.
 */
export const specialistTokens = unsafeCSS(SPECIALIST_TOKEN_CSS);
