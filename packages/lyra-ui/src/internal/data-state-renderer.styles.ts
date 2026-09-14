import { css, unsafeCSS, type CSSResult } from 'lit';

/**
 * The retry control rendered by `renderDataState()`'s failure branch
 * (`src/internal/data-state-renderer.ts`).
 *
 * Adopt it by interpolating this sheet into the component's own `css` template, the way
 * `form-control.styles.ts`'s required marker is adopted, rather than appending it to
 * `static styles`: the rules belong beside the stylesheet that owns the surrounding surface, and
 * keeping the composition there leaves a component's whole rendered surface readable in one file.
 *
 * The part name is deliberately NOT parameterized. Unlike the state wrapper below, the retry
 * control is named by the renderer itself, not by the host, so every adopting component publishes
 * the same `retry-button` part — one name a consumer can style once across the whole library. The
 * declarations are `lr-table`'s shipped ones value for value — including the hover/pressed/focus
 * triad `check-interaction-states.mjs` requires — so a component migrating onto the shared renderer
 * keeps the same resting, hovered, pressed and focused paint. The one addition is the shared
 * `--lr-transition-interactive`, which eases the hover and pressed repaints the same way every
 * other interactive part in the library now does.
 */
export const dataStateRetryStyles = css`
  [part='retry-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--lr-space-2xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: none;
    color: var(--lr-color-brand);
    font: inherit;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  [part='retry-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='retry-button']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='retry-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;

/**
 * A part prefix is an author-written, build-time constant naming a CSS part, never consumer data.
 * It is still validated before interpolation because `unsafeCSS` performs no escaping at all: a
 * value carrying a quote, a brace or a semicolon would silently close the attribute selector and
 * reopen the stylesheet somewhere else entirely, which is the shape of bug that never shows up in a
 * rendered diff.
 */
const PART_PREFIX_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Rejects a prefix that is not a lowercase kebab-case part name, naming `caller` in the message.
 *
 * Shared with `renderDataState()` rather than kept private here so both entry points accept exactly
 * the same set of strings. A host names the part once for the markup and once for the selector that
 * paints it, and nothing else ties the two calls together: a prefix one entry point accepted and
 * the other refused would leave `part='Results Error'` in the DOM and a `TypeError` — or, worse,
 * a silently unmatched selector — in the stylesheet, with no layer reporting the mismatch.
 *
 * @throws TypeError when `partPrefix` is not a lowercase kebab-case part name.
 */
export function assertPartPrefix(partPrefix: string, caller: string): void {
  if (!PART_PREFIX_PATTERN.test(partPrefix)) {
    throw new TypeError(
      `${caller}(): '${partPrefix}' is not a lowercase kebab-case part-name prefix.`
    );
  }
}

/**
 * The surface a grid-shaped host paints behind a full-width state row, parameterized by the same
 * part prefix the host passes to `renderDataState()`.
 *
 * `lr-table`'s `error-row`/`error-cell` pair is the naming convention: the structural full-width
 * row is deliberately not the host's data-row part, so it picks up none of the hover, selected,
 * stripe or roving-focus treatment a real row carries. A host that renders its state inline,
 * with no row wrapper, needs only {@link dataStateRetryStyles}; the rules below simply match
 * nothing.
 *
 * @throws TypeError when `partPrefix` is not a lowercase kebab-case part name.
 */
export function dataStateSurfaceStyles(partPrefix: string): CSSResult {
  assertPartPrefix(partPrefix, 'dataStateSurfaceStyles');
  const prefix = unsafeCSS(partPrefix);
  return css`
    [part='${prefix}-row'] [part='${prefix}-cell'] {
      padding: var(--lr-space-s);
      border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
      background: var(--lr-color-surface);
    }
  `;
}
