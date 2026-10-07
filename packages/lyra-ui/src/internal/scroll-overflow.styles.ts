import { css, unsafeCSS } from 'lit';
import type { CSSResult } from 'lit';

/**
 * The edge fade that `ScrollOverflowController` gates, keyed on the attributes the controller
 * writes on the tracked element alone (`data-scroll-overflow` plus the logical `data-scroll-start`
 * and `data-scroll-end`), so a component adds this sheet to its `static styles` instead of copying
 * the rules for its own part. The mask paints only while the track really overflows, fades only the
 * edge with more to reach, and mirrors under RTL; `--lr-scroll-fade-size` sizes it. Every fade rule
 * sits in `:where()` at the bare attribute's specificity, so a component's own state override (a
 * vertical placement or orientation) and the forced-colors reset at the end win without
 * `!important`.
 */
export function scrollOverflowFade(selector = '[data-scroll-overflow]', rtlSelector = ':host(:dir(rtl)) [data-scroll-overflow]'): CSSResult {
  const track = unsafeCSS(selector);
  const rtlTrack = unsafeCSS(rtlSelector);
  return css`
  ${track}:where([data-scroll-start][data-scroll-end]) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  ${track}:where([data-scroll-end]:not([data-scroll-start])),
  ${rtlTrack}:where([data-scroll-start]:not([data-scroll-end])) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  ${track}:where([data-scroll-start]:not([data-scroll-end])),
  ${rtlTrack}:where([data-scroll-end]:not([data-scroll-start])) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  @media (forced-colors: active) {
    ${track},
    ${rtlTrack} {
      -webkit-mask-image: none;
      mask-image: none;
    }
  }
`;
}

export const scrollOverflowFadeStyles = scrollOverflowFade();
