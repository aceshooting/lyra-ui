import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  /* Card chrome behind inline var() fallbacks, same convention as the compact density below: each
     fallback is the pre-existing token, so an unset card paints exactly as before while a
     transcript can retune the nested card without a ::part(base) override. */
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lr-border-width-thin) solid
      var(--lr-result-card-border-color, var(--lr-color-border-subtle));
    border-radius: var(--lr-result-card-radius, var(--lr-radius));
    background: var(--lr-result-card-background, var(--lr-color-surface));
    overflow: hidden;
    font-size: var(--lr-font-size-sm);
  }
  /* Density escape -- same convention as lr-agent-run's compact. The tuned values sit behind
     inline var() fallbacks, not a :host declaration, which every instance would re-declare and so
     shadow any ancestor value; the fallbacks are the pre-existing values, so an unset card renders
     unchanged. */
  :host([compact]) [part='header'] {
    padding: var(--lr-result-card-compact-header-padding, var(--lr-space-xs));
    gap: var(--lr-result-card-compact-header-gap, var(--lr-space-xs));
  }
  :host([compact]) [part='body'] {
    padding: var(--lr-result-card-compact-body-padding, var(--lr-space-xs));
    gap: var(--lr-result-card-compact-body-gap, var(--lr-space-2xs));
  }
  /* 'plain' removes the chrome entirely rather than just tightening it -- see the class doc for
     why it wins over compact when both are set. */
  :host([frame='plain']) [part='base'] {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-xs) var(--lr-space-s);
    /* The header divider is the same chrome the outer border is, so it follows the same hook
       rather than stranding a mismatched rule inside a retuned card. */
    border-block-end: var(--lr-border-width-thin) solid
      var(--lr-result-card-border-color, var(--lr-color-border-subtle));
  }
  :host([frame='plain']) [part='header'] {
    border-block-end: 0;
  }
  [part='header'][hidden] {
    display: none;
  }
  [part='heading'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 1 auto;
    min-inline-size: 0;
    flex-wrap: wrap;
  }
  [part='actions'][hidden] {
    display: none;
  }
  [part='body'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
  }
`;
