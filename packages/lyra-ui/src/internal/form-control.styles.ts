import { css } from 'lit';

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
