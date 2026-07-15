import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: var(--lyra-space-s); padding: var(--lyra-space-m); border: var(--lyra-border-width-thin) solid var(--lyra-callout-border, var(--lyra-color-border)); border-radius: var(--lyra-radius-xs); background: var(--lyra-callout-background, var(--lyra-color-surface)); color: var(--lyra-callout-color, var(--lyra-color-text)); }
  :host([variant='brand']) { --lyra-callout-background: var(--lyra-color-brand-quiet); --lyra-callout-color: var(--lyra-color-brand); --lyra-callout-border: var(--lyra-color-brand); }
  :host([variant='success']) { --lyra-callout-background: var(--lyra-color-success-quiet); --lyra-callout-color: var(--lyra-color-success); --lyra-callout-border: var(--lyra-color-success); }
  :host([variant='warning']) { --lyra-callout-background: var(--lyra-color-warning-quiet); --lyra-callout-color: var(--lyra-color-warning); --lyra-callout-border: var(--lyra-color-warning); }
  :host([variant='danger']) { --lyra-callout-background: var(--lyra-color-danger-quiet); --lyra-callout-color: var(--lyra-color-danger); --lyra-callout-border: var(--lyra-color-danger); }
  [part='icon'] { display: inline-flex; font-size: var(--lyra-font-size-lg); line-height: var(--lyra-line-height-none); }
  [part='icon'][hidden], [part='close-button'][hidden] { display: none; }
  [part='heading'] { margin-block-end: var(--lyra-space-xs); font-weight: var(--lyra-font-weight-semibold); }
  [part='content'] { min-inline-size: 0; }
  [part='close-button'] { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lyra-icon-button-size); min-block-size: var(--lyra-icon-button-size); border: 0; border-radius: var(--lyra-radius-pill); background: transparent; color: inherit; cursor: pointer; }
  [part='close-button']:focus-visible { outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: var(--lyra-focus-ring-offset); }
  :host([inline]) [part='base'] {
    gap: var(--lyra-space-xs);
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  :host([inline]) [part='icon'] { font-size: var(--lyra-font-size-md); }
  :host([inline]) [part='heading'] { margin-block-end: 0; }
  :host([inline]) [part='close-button'] {
    min-inline-size: var(--lyra-size-1-5rem);
    min-block-size: var(--lyra-size-1-5rem);
  }
`;
