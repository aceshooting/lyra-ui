import { css, unsafeCSS, type CSSResult } from 'lit';

/**
 * Opt-in treatment for a component's chrome surface. Content panels must not compose this sheet.
 * Selectors are library-owned constants. The fill stays local so look and accent inheritance are
 * resolved on the painted surface, including inside shadow roots. Descendant guards capture their
 * values on this surface before passing them through slots and nested component hosts. The caller
 * positions the surface and reserves its before pseudo-element for decorative filtering. The fill
 * paints on the surface itself so scrolling cannot expose an unpainted part of the scrollport.
 * Filtering the pseudo-element avoids a containing block for fixed-positioned descendant overlays.
 */
export function glassSurface(selector: string, fill: CSSResult, restingFill: CSSResult = fill, scrolling = false): CSSResult {
  const surface = unsafeCSS(selector);
  const selectors = selector.split(',').map(part => part.trim());
  const children = unsafeCSS(selectors.map(part => `${part} > *`).join(', '));
  const layer = unsafeCSS(selectors.map(part => `${part}${scrolling ? ' > .glass-scroll-layer' : ''}::before`).join(', '));
  return css`
    :host([data-lr-surface='solid']) {
      --_lr-surface-enabled: 0;
      --_lr-glass-blocker: none;
      --_lr-surface-content: none;
      --_lr-surface-isolation: auto;
      --_lr-surface-child-filter: initial;
      --_lr-surface-child-opacity: 0;
      --_lr-glass-parent-opacity: 0;
    }
    ${surface} {
      background: ${restingFill};
      --_lr-glass-filter-value: blur(calc(clamp(0px, var(--lr-theme-surface-blur, var(--_lr-surface-default-blur)), var(--_lr-surface-maximum-blur, var(--_lr-surface-default-maximum-blur))) * (1 - var(--_lr-glass-parent-opacity, 0)))) saturate(calc(1 + (clamp(0, var(--lr-theme-surface-saturation, 1.1), 2) - 1) * (1 - var(--_lr-glass-parent-opacity, 0))));
      --_lr-glass-current-filter: var(--_lr-preference-glass-filter, var(--_lr-glass-blocker, var(--_lr-glass-filter-value, none)));
      --_lr-glass-foreground-weight: initial;
      --_lr-next-glass-blocker: var(--_lr-surface-child-filter, none);
      --_lr-next-glass-opacity: var(--_lr-surface-child-opacity, 1);
    }
    ${children} {
      --_lr-glass-blocker: var(--_lr-next-glass-blocker, initial);
      --_lr-glass-parent-opacity: var(--_lr-next-glass-opacity, initial);
    }
    @supports ((backdrop-filter: blur(0)) or (-webkit-backdrop-filter: blur(0))) {
      :host {
        /* Resolve the default on the host where public focus aliases and the shorthand are
           composed. Resetting either public token on the surface would mask host overrides. */
        --_lr-glass-qualified-focus-ring-color: color-mix(
          in srgb,
          var(--_lr-glass-original-focus-ring-color, var(--lr-color-text)),
          var(--lr-color-text) calc(var(--_lr-surface-foreground-weight, 80%) * var(--_lr-surface-enabled, 1) * (1 - var(--_lr-glass-parent-opacity, 0)) * (1 - var(--_lr-preference-glass-opacity, 0)))
        );
      }
      ${surface} {
        isolation: var(--_lr-surface-isolation, isolate);
        --_lr-glass-foreground-weight: calc(var(--_lr-surface-foreground-weight, 80%) * var(--_lr-surface-enabled, 1) * (1 - var(--_lr-glass-parent-opacity, 0)) * (1 - var(--_lr-preference-glass-opacity, 0)));
        --_lr-glass-qualified-text-quiet: color-mix(in srgb, var(--_lr-glass-original-text-quiet, var(--lr-color-text)), var(--lr-color-text) var(--_lr-glass-foreground-weight));
        --lr-color-text-quiet: var(--_lr-glass-qualified-text-quiet, var(--_lr-glass-original-text-quiet));
        --_lr-glass-qualified-border: color-mix(in srgb, var(--_lr-glass-original-border, var(--lr-color-text)), var(--lr-color-text) var(--_lr-glass-foreground-weight));
        --lr-color-border: var(--_lr-glass-qualified-border, var(--_lr-glass-original-border));
        --_lr-glass-brand-text: color-mix(in srgb, var(--lr-color-brand), var(--lr-color-text) var(--_lr-glass-foreground-weight));
        --_lr-glass-danger-text: color-mix(in srgb, var(--lr-color-danger), var(--lr-color-text) var(--_lr-glass-foreground-weight));
        --_lr-glass-background: color-mix(
          in srgb,
          ${restingFill} calc((1 - var(--_lr-surface-enabled, 1) * (1 - var(--_lr-preference-glass-opacity, 0))) * 100%),
          color-mix(
            in srgb,
            ${fill} calc(var(--_lr-preference-glass-opacity, max(var(--_lr-glass-parent-opacity, 0), clamp(var(--_lr-surface-min-opacity, 0.8), var(--lr-theme-surface-opacity, 0.8), 1))) * 100%),
            transparent
          )
        );
        background: var(--_lr-glass-background, ${restingFill});
      }
      ${layer} {
        content: var(--_lr-surface-content, '');
        position: absolute;
        inset: 0;
        inline-size: ${scrolling ? css`var(--_lr-glass-viewport-width, 100%)` : css`auto`};
        block-size: ${scrolling ? css`var(--_lr-glass-viewport-height, 100%)` : css`auto`};
        /* The filter layer sits one shared content level below the surface. */
        z-index: calc(var(--lr-layer-base) - var(--lr-layer-content));
        pointer-events: none;
        border-radius: inherit;
        -webkit-backdrop-filter: var(--_lr-glass-current-filter);
        backdrop-filter: var(--_lr-glass-current-filter);
        box-shadow: inset 0 var(--lr-border-width-thin) 0 var(--lr-theme-surface-highlight, var(--_lr-surface-default-highlight));
      }
    }
    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active) {
      ${surface} {
        background: ${restingFill};
        --_lr-glass-foreground-weight: initial;
      }
      ${layer} {
        content: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
    }
    @media (forced-colors: active) {
      ${surface} { background: Canvas; }
    }
  `;
}
