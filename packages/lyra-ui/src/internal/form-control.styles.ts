import { css } from 'lit';
import { focusRing } from './interactive-control.styles.js';

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
 * The one per-appearance fill and border pairing every text-field sibling paints, resolved onto the
 * private `--_lr-form-control-fill` / `--_lr-form-control-border-color`; adopters map their own
 * `--_lr-<tag>-fill-default` / `-border-color-default` to these.
 */
export const formControlAppearance = css`
  :host {
    --_lr-form-control-fill: var(--lr-color-surface);
    --_lr-form-control-border-color: var(--lr-color-border);
  }
  :host([appearance='filled-outlined']) {
    --_lr-form-control-fill: var(--lr-color-surface-raised);
  }
  :host([appearance='filled']),
  :host([filled]) {
    --_lr-form-control-fill: var(--lr-color-surface-raised);
    --_lr-form-control-border-color: transparent;
  }
  :host([appearance='plain']) {
    --_lr-form-control-fill: transparent;
    --_lr-form-control-border-color: transparent;
  }
  :host([appearance='accent']) {
    --_lr-form-control-fill: var(--lr-color-brand-quiet);
    --_lr-form-control-border-color: var(--lr-color-brand);
  }
`;

/** Supporting form text, using part tokens so compatibility aliases retain the same styling. */
export const formControlSupportingText = css`
  [part~='hint'], [part~='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }
  [part~='hint'] { color: var(--lr-color-text-quiet); }
  [part~='error'] { color: var(--lr-color-danger); }
  [part~='hint'][hidden], [part~='error'][hidden] { display: none; }
`;

/** Field label and supporting text; component-specific layout remains in the adopting sheet. */
export const formControlChrome = css`
  [part~='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part~='form-control-label'][hidden] { display: none; }
  ${formControlSupportingText}
`;

/** Allow form chrome to shrink and wrap within its allocated inline space. */
export const formControlTextWrap = css`
  min-inline-size: 0;
  max-inline-size: 100%;
  overflow-wrap: anywhere;
`;

/**
 * Preset-button paint shared by the quick-range rows. The adopter's `:host` resolves its public
 * `--lr-<tag>-preset-*` tokens (no fallback) into the private `--_lr-preset-hover-bg`, `-hover-border-color`,
 * `-pressed-bg`, `-pressed-border-color`, `-selected-bg`, `-selected-border-color` and `-selected-color`;
 * unset ones fall through to the defaults here. Geometry stays with the adopter.
 */
export const formControlPresetButton = css`
  [part~='preset-button'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  /* The selected preset keeps its own fill through hover and press; only its own rules below tint it. */
  [part~='preset-button']:not([data-active]):hover:not(:disabled) {
    background: var(--_lr-preset-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(--_lr-preset-hover-border-color, var(--lr-color-brand));
  }
  [part~='preset-button']:not([data-active]):active:not(:disabled) {
    background: var(
      --_lr-preset-pressed-bg,
      color-mix(in oklab, var(--_lr-preset-pressed-base, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
    border-color: var(
      --_lr-preset-pressed-border-color,
      color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part~='preset-button'][data-active] {
    background: var(--_lr-preset-selected-bg, var(--lr-color-brand));
    border-color: var(--_lr-preset-selected-border-color, var(--lr-color-brand));
    color: var(--_lr-preset-selected-color, var(--lr-color-on-brand));
  }
  [part~='preset-button'][data-active]:hover:not(:disabled) {
    background-image: linear-gradient(
      color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-hover)),
      color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-hover))
    );
  }
  /* Pressed selected preset: by default its fill mixes toward the press partner; an adopter that keeps
     the selected fill and darkens it with an overlay supplies --_lr-preset-selected-pressed-bg and
     --_lr-preset-selected-pressed-image instead, and may keep the selected border. */
  [part~='preset-button'][data-active]:active:not(:disabled) {
    background-color: var(
      --_lr-preset-selected-pressed-bg,
      color-mix(
        in oklab,
        var(--_lr-preset-selected-bg, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    background-image: var(--_lr-preset-selected-pressed-image, none);
    border-color: var(
      --_lr-preset-selected-pressed-border-color,
      color-mix(
        in oklab,
        var(--_lr-preset-selected-border-color, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part~='preset-button']:focus-visible {
    ${focusRing}
  }
  [part~='preset-button']:disabled {
    cursor: not-allowed;
  }
`;
