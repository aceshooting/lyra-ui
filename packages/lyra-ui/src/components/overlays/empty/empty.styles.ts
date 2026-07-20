import { css } from 'lit';

export const styles = css`
  :host {
    display: flex;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-l);
    color: var(--lr-color-text-quiet);
    inline-size: 100%;
  }
  :host([compact]) [part='base'] {
    /* One custom property feeds both declarations from different fallback literals (today's exact
       flex-start/start pair). Works because 'center' -- the one realistic override -- is a valid
       value for both align-items and text-align; a consumer sets this once and both pick it up. */
    align-items: var(--lr-empty-compact-align, flex-start);
    text-align: var(--lr-empty-compact-align, start);
    padding: var(--lr-empty-compact-padding, var(--lr-space-xs));
    /* Same density-reduction convention as lr-file-input's :host([compact]) rule (which explicitly
       models itself on this one): compact must shrink every dimension the base rule sets for this
       part, not just padding -- otherwise the icon/heading/description gap stays pinned at the
       spacious default and compact reads as internally inconsistent. */
    gap: var(--lr-empty-compact-gap, var(--lr-space-2xs));
  }
  [part='icon'] {
    font-size: var(--lr-font-size-3xl);
    line-height: var(--lr-line-height-none);
    color: var(--lr-color-border);
  }
  [part='icon'][hidden] {
    display: none;
  }
  [part='heading'] {
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
    margin: 0;
  }
  [part='heading'][hidden] {
    display: none;
  }
  :host([compact]) [part='heading'] {
    font-weight: var(--lr-font-weight-normal);
  }
  [part='description'] {
    font-size: var(--lr-font-size-md-sm);
    margin: 0;
  }
  [part='description'][hidden] {
    display: none;
  }
  [part='actions'][hidden] {
    display: none;
  }
`;
