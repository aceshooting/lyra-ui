import { css } from 'lit';

/**
 * The one floating-surface treatment every overlay in this library paints itself with.
 *
 * Before this sheet existed each floating surface reached for the base tokens directly, and they
 * did not even agree on which base tokens: `overlay.styles.ts`'s popup, `menu.styles.ts`'s host and
 * submenu, `select.styles.ts`'s and `locale-picker.styles.ts`'s listboxes and `combobox.styles.ts`'s
 * popup all painted `--lr-color-surface`, while `dialog.styles.ts`'s panel painted
 * `--lr-color-surface-overlay`. Both families are also declared on every component's own `:host` by
 * `tokens.styles.ts`, so an application could not retint *popups* at all: setting
 * `--lr-color-surface` on an ancestor loses to the host declaration, and setting the
 * `--lr-theme-*` input behind it repaints every card, panel and input in the page along with the
 * popups. "A popup surface is not a control surface" was genuinely inexpressible.
 *
 * Three consumer-settable custom properties replace that, each read through an inline `var()`
 * fallback so the default needs no `:host` declaration and no token registration — which is
 * precisely what makes the family a real cascade point: an undeclared custom property inherits, so
 * one declaration on `:root` (or on any ancestor, to scope it to one subtree) reaches every
 * overlay in that subtree. Declaring them on `:host` here would take that away, exactly as
 * `tokens.styles.ts`'s REQUIRED_MARKER note records for the required-field marker.
 *
 * - `--lr-overlay-surface` — the fill. Defaults to `--lr-color-surface-overlay`, the surface a
 *   panel floating over the page paints itself with. In light mode that resolves to the page
 *   surface, unchanged; in dark mode it is a distinctly lighter near-black than the page, so an
 *   anchored popup reads as a raised object instead of a hole.
 * - `--lr-overlay-border` — the surface's own edge, defaulting to `--lr-color-border`. Content
 *   separators *inside* an overlay (a menu's header rule, a slotted `hr`) are deliberately not
 *   part of this: they divide content, they do not draw the surface.
 * - `--lr-overlay-radius` — the corner radius, defaulting to `--lr-radius`.
 *
 * Elevation is deliberately NOT here. It is the one property of a floating surface that differs by
 * kind rather than by theme, so it resolves through two sibling names declared at each point of
 * use, never one shared one:
 *
 * - `--lr-overlay-shadow-anchored` (default `--lr-shadow-m`) — a positioner-placed popup, listbox,
 *   menu or submenu floating over page content on all four edges.
 * - `--lr-overlay-shadow-modal` (default `--lr-shadow-xl`) — a dialog or drawer panel, which sits
 *   on the top layer over a scrim and carries the top step of the elevation scale.
 *
 * Keeping those two out of this file also keeps the manifest honest: every consumer hook a shared
 * sheet reads is advertised on every component that composes it
 * (`scripts/check-manifest-coverage.mjs`), so a modal tier declared here would be advertised on
 * every listbox, and an anchored tier on every dialog.
 *
 * A component whose surface already publishes its own radius hook keeps it as the outer arm and
 * takes `overlaySurfaceFill` alone — `var(--lr-locale-picker-radius, var(--lr-overlay-radius, …))`,
 * so a component-scoped override still wins over the family, per the alias-not-rename rule.
 *
 * Adopt it by interpolating into the component's own rule, the way
 * `form-control.styles.ts`'s required marker is adopted: these are declarations, not a rule set, so
 * they land inside the selector that owns the surface and the component's whole rendered surface
 * stays readable in one file.
 */
export const overlaySurfaceFill = css`
  background: var(--lr-overlay-surface, var(--lr-color-surface-overlay));
  border: var(--lr-border-width-thin) solid
    var(--lr-overlay-border, var(--lr-color-border));
`;

/**
 * `overlaySurfaceFill` plus the family's corner radius — the whole treatment, for the surfaces that
 * do not publish a radius hook of their own.
 */
export const overlaySurface = css`
  ${overlaySurfaceFill}
  border-radius: var(--lr-overlay-radius, var(--lr-radius));
`;
