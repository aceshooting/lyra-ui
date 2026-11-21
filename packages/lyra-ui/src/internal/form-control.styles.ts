import { css, type CSSResult } from 'lit';
import { visuallyHidden } from './a11y.js';

/**
 * The one required-field marker every labelled form control in this library renders.
 *
 * Before this sheet existed the same three declarations were copy-pasted into fourteen component
 * stylesheets (and hand-rolled a third way, as a literal `<span>` in three templates), which had
 * already drifted: several controls that accept `required` and render a `form-control-label` part
 * shipped no marker at all. Just as importantly, a hardcoded `content: ' *'` is a dead end for a
 * consumer — a form that marks its *optional* fields instead, or a locale that prefers a word to a
 * glyph, has nowhere to say so, and the colour cannot be retuned without also moving every other
 * danger-coloured surface in the page.
 *
 * Three consumer-settable custom properties replace that, each consumed through an inline `var()`
 * fallback so the default needs no `:host` declaration and no token registration:
 *
 * - `--lr-form-control-required-content` — the marker itself. Defaults to `' *'` (the leading space
 *   is part of the glyph, so an unset offset still reads correctly). Set it to `''` to suppress the
 *   marker entirely, or to any other quoted string (`' (required)'`, `' ٭'`, a localized word) to
 *   replace it. Caller-supplied content, so it is never localized here.
 * - `--lr-form-control-required-color` — the marker colour, defaulting to `--lr-color-danger` so an
 *   unset control looks exactly as it did before. Independently themeable: retuning it does not
 *   touch error text, invalid borders, or any other danger surface.
 * - `--lr-form-control-required-offset` — inline space between the label text and the marker,
 *   defaulting to `0` (the glyph's own leading space is the historical spacing).
 *
 * Two selectors, because the library has exactly two required-marker shapes:
 *
 * - `:host([required]) [part~='form-control-label']::after` — the standard labelled control, where
 *   the whole host is the required field. `~=` rather than `=` because several components render
 *   the part alongside a second token (`part="label form-control-label"`).
 * - `[part='field'][data-required] [part='label']::after` — a composite form that renders many
 *   fields inside one host (`<lr-tool-param-form>`), where "required" is per field and the host has
 *   no `required` attribute of its own.
 *
 * Adopt it by interpolating this sheet into the component's own `css` template rather than by
 * appending it to `static styles`: the marker belongs to the stylesheet that owns the label part,
 * and keeping the composition there means a component's whole rendered surface stays readable in
 * one file.
 */
export const formControlRequiredMarker = css`
  :host([required]) [part~='form-control-label']::after,
  [part='field'][data-required] [part='label']::after {
    content: var(--lr-form-control-required-content, ' *');
    color: var(--lr-form-control-required-color, var(--lr-color-danger));
    margin-inline-start: var(--lr-form-control-required-offset, 0);
  }
`;

/**
 * The one focus halo every field-shaped form control in this library can paint.
 *
 * `lr-input`, `lr-textarea`, `lr-select`, `lr-combobox`, `lr-locale-picker`, `lr-date-input`,
 * `lr-file-input`, `lr-phone-input`, `lr-token-input`, `lr-time-input`, `lr-model-select`,
 * `lr-voice-picker`, `lr-code-editor`, `lr-emoji-picker` and `lr-color-picker` each already answer
 * focus with an outline or a brand border, and that stays: the outline is the accessibility
 * contract (WCAG 2.4.7), not decoration, and nothing here replaces or removes it. What none of them
 * had was a way to add the soft ring a design system usually draws *outside* that edge. Writing one
 * meant a `::part()` rule per control, per state, and keeping fifteen of them in step by hand.
 *
 * `lr-otp-input` is the one field-shaped control deliberately left out, and the reason is mechanical
 * rather than editorial: its focused segment already paints
 * `box-shadow: 0 0 0 var(--lr-focus-ring-width) …` as its focus ring. `box-shadow` is a single
 * property, so a declaration-only partial would REPLACE that ring rather than sit outside it.
 * Haloing that control means composing both shadows into one value, which is a change to its focus
 * treatment rather than an adoption of this one.
 *
 * `--lr-form-control-focus-shadow` is that one knob. It defaults to `none`, so an unset control
 * renders exactly as it did before, and it sits in the same `--lr-form-control-*` family as the
 * shared size ladder — the vocabulary a consumer already reaches for when retuning every field at
 * once.
 *
 * Adoption is two lines, and the split between them is deliberate:
 *
 * 1. the adopting stylesheet resolves the public name into the private one on its own `:host`,
 *    `--_lr-form-control-focus-shadow: var(--lr-form-control-focus-shadow, none);`
 * 2. every rule that marks this control focused (or open) interpolates this sheet.
 *
 * Step 1 lives in the adopting component rather than here on purpose. Twenty-two components compose
 * this file for the required marker, and a `var(--lr-form-control-focus-shadow…)` read in *this*
 * file would make every one of them advertise the hook in `custom-elements.json` and in the editor
 * data — including the seven that never paint a field surface and would honour nothing. A hook is
 * advertised where it works. The private property keeps the paint itself in one place, so the
 * fifteen controls that do adopt it cannot drift apart.
 *
 * Declaring the private on `:host` also leaves the public name undeclared everywhere, which is what
 * keeps it a real cascade point: one declaration on `:root`, or on any ancestor to scope it to a
 * subtree, reaches every adopting control inside it.
 */
export const formControlFocusHalo = css`
  box-shadow: var(--_lr-form-control-focus-shadow, none);
`;

/**
 * The one resting invalid border every field-shaped form control paints.
 *
 * Matches `:state(user-invalid)` — invalid after the user has interacted with the control, after
 * `reportValidity()` or after a failed submit — so a pristine required field never paints red. The
 * colour resolves the optional component-specific token first, then the shared
 * `--lr-form-control-invalid-border-color`, then `--lr-color-danger`, so one declaration on `:root`
 * retunes every field at once.
 *
 * The rule yields while the surface holds focus or the host is `[open]`: the brand focus edge is
 * the control's focus indicator (WCAG 2.4.7), and an invalid edge that out-ranked it would leave a
 * focused invalid field with no visible focus change. A barred control (disabled, readonly)
 * publishes no `user-invalid` and therefore never matches.
 *
 * Interpolate it after every resting, appearance and hover rule for the surface, so the invalid
 * edge wins the cascade tie on source order.
 *
 * @param surface - Selector of the bordered element, written as a `css` literal.
 * @param componentToken - Optional component-specific custom property name that outranks the shared
 *   token, written as a `css` literal.
 */
export function formControlInvalidBorder(surface: CSSResult, componentToken?: CSSResult): CSSResult {
  const shared = css`var(--lr-form-control-invalid-border-color, var(--lr-color-danger))`;
  const color = componentToken ? css`var(${componentToken}, ${shared})` : shared;
  return css`
    :host(:state(user-invalid):where(:not([open]))) ${surface}:where(:not(:focus-within)) {
      border-color: ${color};
    }
  `;
}

/** The hint and error text colours (muted hint, danger error) that every form control shares. */
export const formControlSupportingColor = css`
  [part~='hint'] { color: var(--lr-color-text-quiet); }
  [part~='error'] { color: var(--lr-color-danger); }
`;

/** The hint and error text tone (muted hint, danger error, small size) that every form control shares. */
export const formControlSupportingTone = css`
  ${formControlSupportingColor}
  [part~='hint'], [part~='error'] { font-size: var(--lr-font-size-sm); }
`;

/** Supporting form text, using part tokens so compatibility aliases retain the same styling. */
export const formControlSupportingText = css`
  [part~='hint'], [part~='error'] {
    margin-block-start: var(--lr-space-xs);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  ${formControlSupportingTone}
  [part~='hint'][hidden], [part~='error'][hidden] { display: none; }
`;

/**
 * The shared `label-display="hidden"` rule: the `form-control-label` box leaves the layout and the
 * eye but stays in the accessibility tree, so the `<label for>` association (and the required
 * marker that rides on it) keeps naming the control. The hint and error parts are untouched.
 * Uses the library's one `visuallyHidden` declaration block, never a re-typed copy, and is written
 * once here for every control that renders the part. The attribute reflects from each adopting
 * control's `labelDisplay` property, so the selector needs no per-component state.
 */
export const formControlLabelDisplay = css`
  :host([label-display='hidden']) [part~='form-control-label'] {
    ${visuallyHidden}
  }
`;

/** Label typography shared by native field labels, legends and named group labels. */
export function formControlLabelTypography({
  size = css`var(--lr-font-size-md-sm)`,
  weight = css`var(--lr-font-weight-semibold)`,
  color = css`inherit`,
} = {}) {
  return css`
    font-size: var(--lr-form-control-label-font-size, ${size});
    font-weight: var(--lr-form-control-label-font-weight, ${weight});
    color: var(--lr-form-control-label-color, ${color});
  `;
}

/** Allow form chrome to shrink and wrap within its allocated inline space. */
export const formControlTextWrap = css`
  min-inline-size: 0;
  max-inline-size: 100%;
  overflow-wrap: anywhere;
`;

// Kept in its own module so data surfaces (pager, grid, table, palette) adopt it without this sheet.
export { formControlTouchFontFloor } from './form-control/touch-font-floor.styles.js';
