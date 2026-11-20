import { css, unsafeCSS, type CSSResult } from 'lit';
import {
  activeFill,
  disabledControl,
  focusRing,
  hoverFill,
  iconHitTarget,
  interactiveTransition,
} from './interactive-control.styles.js';

// Hover and press mix from the public resting fill when a theme sets one, so a retuned
// `--lr-icon-button-bg` keeps its identity under the pointer.
const restingFill = 'var(--lr-icon-button-bg, var(--lr-color-surface))';

export const iconAction = css`
  font: inherit; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: var(--lr-icon-button-border, var(--_lr-icon-button-border-default, 0)); border-radius: var(--lr-icon-button-radius, var(--_lr-icon-button-radius-default, var(--lr-radius))); background: var(--lr-icon-button-bg, var(--_lr-icon-button-background-default, transparent)); color: var(--lr-icon-button-color, var(--_lr-icon-button-color-default, inherit)); cursor: pointer; text-decoration: none;
  ${interactiveTransition}
`;

export const iconActionHover = css`
  border: var(--lr-icon-button-border-hover, var(--_lr-icon-button-border-hover-default, var(--lr-icon-button-border, 0))); background: var(--lr-icon-button-bg-hover, var(--_lr-icon-button-background-hover-default, ${hoverFill(restingFill)})); color: var(--lr-icon-button-color-hover, var(--_lr-icon-button-color-hover-default, var(--lr-icon-button-color, inherit)));
  @media (forced-colors: active) { background: Highlight; color: HighlightText; }
`;

export const iconActionActive = css`
  border: var(--lr-icon-button-border-active, var(--_lr-icon-button-border-active-default, var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0)))); background: var(--lr-icon-button-bg-active, var(--_lr-icon-button-background-active-default, ${activeFill(restingFill)})); color: var(--lr-icon-button-color-active, var(--_lr-icon-button-color-active-default, var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit))));
  @media (forced-colors: active) { background: Highlight; color: HighlightText; }
`;

/**
 * The private defaults that give a hand-rendered icon action a bordered, surface-filled resting
 * look: a thin border, surface fill and text colour at rest, the same border held through hover and
 * press, and a hover fill given by `hoverBackground` (the component's own public hover token with its
 * fallback, written as a `var()` expression) with the press fill mixed from the effective hover fill. Compose
 * beside {@link iconAction}.
 */
export function outlinedIconActionDefaults(hoverBackground: string): CSSResult {
  return unsafeCSS(`--_lr-icon-button-border-default: var(--lr-border-width-thin) solid var(--lr-color-border);
    --_lr-icon-button-background-default: var(--lr-color-surface);
    --_lr-icon-button-color-default: var(--lr-color-text);
    --_lr-icon-button-border-hover-default: var(--lr-icon-button-border, var(--_lr-icon-button-border-default));
    --_lr-icon-button-border-active-default: var(--lr-icon-button-border-hover, var(--_lr-icon-button-border-hover-default));
    --_lr-icon-button-background-hover-default: ${hoverBackground};
    --_lr-icon-button-background-active-default: ${activeFill('var(--lr-icon-button-bg-hover, var(--_lr-icon-button-background-hover-default))').cssText};`);
}

/** Per-control fallbacks for {@link iconActionStyles}; each yields to the public
 *  `--lr-icon-button-*` token of the same state. */
export interface IconActionFallbacks {
  readonly background?: string;
  readonly color?: string;
  readonly hoverBackground?: string;
  readonly hoverColor?: string;
  readonly activeBackground?: string;
  readonly activeColor?: string;
}

const ICON_ACTION_DEFAULTS: ReadonlyArray<readonly [keyof IconActionFallbacks, string]> = [
  ['background', '--_lr-icon-button-background-default'],
  ['color', '--_lr-icon-button-color-default'],
  ['hoverBackground', '--_lr-icon-button-background-hover-default'],
  ['hoverColor', '--_lr-icon-button-color-hover-default'],
  ['activeBackground', '--_lr-icon-button-background-active-default'],
  ['activeColor', '--_lr-icon-button-color-active-default'],
];

/**
 * The complete hand-rendered icon action recipe for `selector`: shared hit area, the
 * `--lr-icon-button-*` resting/hover/press tokens (the fragments above), focus ring and
 * disabled state, with optional per-control fallbacks written to the private default tier. Hover
 * and press skip disabled controls. `selector` and fallbacks are author-controlled CSS.
 */
export function iconActionStyles(selector: string, fallbacks: IconActionFallbacks = {}): CSSResult {
  const defaults = ICON_ACTION_DEFAULTS
    .filter(([key]) => fallbacks[key] !== undefined)
    .map(([key, property]) => `${property}: ${fallbacks[key]};`)
    .join(' ');
  const enabled = `${selector}:not(:disabled):not([aria-disabled='true'])`;
  return unsafeCSS(`${selector} { ${defaults} ${iconHitTarget.cssText} ${iconAction.cssText} }
  ${enabled}:hover { ${iconActionHover.cssText} }
  ${enabled}:active { ${iconActionActive.cssText} }
  ${selector}:focus-visible { ${focusRing.cssText} }
  ${selector}:disabled, ${selector}[aria-disabled='true'] { ${disabledControl.cssText} }`);
}

/** Options for {@link outlinedActionStyles}; all are author-controlled CSS. */
export interface OutlinedActionOptions {
  /** Padding of the action (default: the compact text-action padding); `false` leaves the native padding. */
  readonly padding?: string | false;
  /** Extra declarations for the resting rule, for example a one-axis padding. */
  readonly extra?: string;
  /** Corner radius (default: `var(--lr-radius)`). */
  readonly radius?: string;
  /** Hover fill (default: the surface mixed toward the theme partner). */
  readonly hoverBackground?: string;
  /** Pressed fill (default: the surface mixed toward the theme partner by the press step). */
  readonly activeBackground?: string;
}

/**
 * The bordered, surface-filled text or glyph action for `selector` (pagination, clear, navigator
 * and reset controls): shared hit area, thin border, surface fill, the shared hover/press mix,
 * focus ring and disabled state. Hover and press skip disabled controls. Unlike
 * {@link iconActionStyles} it does not follow the `--lr-icon-button-*` tokens, because these are
 * labelled text actions, not icon buttons. `selector` and the options are author-controlled CSS.
 */
export function outlinedActionStyles(selector: string, options: OutlinedActionOptions = {}): CSSResult {
  const {
    padding = 'var(--lr-space-2xs) var(--lr-space-xs)',
    radius = 'var(--lr-radius)',
    extra = '',
    hoverBackground = hoverFill('var(--lr-color-surface)').cssText,
    activeBackground = activeFill('var(--lr-color-surface)').cssText,
  } = options;
  const enabled = `${selector}:where(:not(:disabled):not([aria-disabled='true']))`;
  return unsafeCSS(`${selector} { ${iconHitTarget.cssText} ${padding === false ? '' : `padding: ${padding};`} border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: ${radius}; background: var(--lr-color-surface); color: var(--lr-color-text); font: inherit; cursor: pointer; ${interactiveTransition.cssText} ${extra} }
  ${enabled}:hover { background: ${hoverBackground}; }
  ${enabled}:active { background: ${activeBackground}; }
  ${selector}:focus-visible { ${focusRing.cssText} }
  ${selector}:disabled, ${selector}[aria-disabled='true'] { ${disabledControl.cssText} }`);
}
