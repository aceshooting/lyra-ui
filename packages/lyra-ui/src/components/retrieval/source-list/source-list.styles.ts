import { disclosureHeader } from '../../../internal/layout-fragments.styles.js';
import { activeFill, disclosureChevron, focusRingInsetOffset, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-container);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  /* Density escape -- same convention as this list's own slotted lr-source-card children's
     dense size tier. Values sit behind inline var() fallbacks, not :host declarations that every instance
     re-declares and so shadows any ancestor value, so a transcript can retune every embedded panel
     at once; the fallbacks are the pre-existing values, so an unset panel renders unchanged. */
  :host(:is([size='2xs'], [size='xs'], [size='s'], [size='small'])) [part='header'] {
    padding: var(--lr-source-list-compact-header-padding, var(--lr-space-2xs) var(--lr-space-s));
    gap: var(--lr-source-list-compact-header-gap, var(--lr-space-2xs));
  }
  :host(:is([size='2xs'], [size='xs'], [size='s'], [size='small'])) [part='list'] {
    gap: var(--lr-source-list-compact-gap, var(--lr-space-2xs));
    padding: var(--lr-source-list-compact-list-padding, var(--lr-space-s));
  }
  /* Chrome escape -- same convention as lr-thinking-panel's/lr-task-list's frame="plain": drops
     the outer border/background/radius so a panel nested in a container that already draws a
     border (a message bubble) doesn't double it. The header/list divider is layout, not outer
     chrome, so it stays. */
  :host([frame='plain']) [part='base'] {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part='header'] {
    ${disclosureHeader}

    box-sizing: border-box;
    ${iconHitTarget}

    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-md-sm);

    transition: var(--lr-transition-interactive);
  }
  [part='header']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='header']:active {
    background: ${activeFill('var(--lr-color-brand-quiet)')};
    color: var(--lr-color-text);
  }
  [part='header']:focus-visible {
    ${focusRingInsetOffset}
  }
  ${disclosureChevron({
    glyph: "[part='toggle']",
    expanded: ":host([expanded]) [part='toggle']",
    collapsedRtl: ":host(:not([expanded]):dir(rtl)) [part='toggle']",
  })}
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: 0 var(--lr-space-m) var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    padding-block-start: var(--lr-space-m);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='list'][hidden] {
    display: none;
  }
`;
