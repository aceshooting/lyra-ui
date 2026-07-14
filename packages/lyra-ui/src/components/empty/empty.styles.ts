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
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-l);
    color: var(--lyra-color-text-quiet);
    inline-size: 100%;
  }
  :host([compact]) [part='base'] {
    /* One custom property feeds both declarations from different fallback literals (today's exact
       flex-start/start pair). Works because 'center' -- the one realistic override -- is a valid
       value for both align-items and text-align; a consumer sets this once and both pick it up. */
    align-items: var(--lyra-empty-compact-align, flex-start);
    text-align: var(--lyra-empty-compact-align, start);
    padding: var(--lyra-empty-compact-padding, var(--lyra-space-xs));
  }
  [part='icon'] {
    font-size: var(--lyra-font-size-3xl);
    line-height: var(--lyra-line-height-none);
    color: var(--lyra-color-border);
  }
  [part='icon'][hidden] {
    display: none;
  }
  [part='heading'] {
    font-weight: var(--lyra-font-weight-semibold);
    color: var(--lyra-color-text);
    margin: 0;
  }
  [part='heading'][hidden] {
    display: none;
  }
  :host([compact]) [part='heading'] {
    font-weight: var(--lyra-font-weight-normal);
  }
  [part='description'] {
    font-size: var(--lyra-font-size-md-sm);
    margin: 0;
  }
  [part='description'][hidden] {
    display: none;
  }
  [part='actions'][hidden] {
    display: none;
  }
`;
