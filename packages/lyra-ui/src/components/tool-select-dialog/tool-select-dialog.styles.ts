import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --wa-*-overlay token exists in the design system to resolve through,
       same rationale as lyra-dialog's --lyra-dialog-overlay-color and
       lyra-tool-result-dialog's --lyra-tool-result-dialog-overlay-color). */
    --lyra-tool-select-dialog-overlay-color: rgb(0 0 0 / 0.5);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lyra-overlay-stack-index, 1000);
    align-items: center;
    justify-content: center;
    padding: var(--lyra-space-l);
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lyra-tool-select-dialog-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(30rem, 100%);
    block-size: min(38rem, 100%);
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    overflow: hidden;
  }
  [part='header'] {
    padding: var(--lyra-space-l) var(--lyra-space-l) 0;
  }
  [part='title'] {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }
  [part='subtitle'] {
    margin: var(--lyra-space-xs) 0 0;
    font-size: 0.8125rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='subtitle'][hidden] {
    display: none;
  }

  [part='search-row'] {
    padding: var(--lyra-space-m) var(--lyra-space-l) 0;
  }
  [part='search-input'] {
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: inherit;
    font: inherit;
  }
  [part='search-input']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='defaults-row'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-end: 1px solid var(--lyra-color-border);
  }
  [part='defaults-hint'] {
    margin: 0;
    /* Lines the hint up under the switch's label text, not its track --
       lyra-switch's own [part="base"] uses a fixed 2.25rem track
       inline-size plus a --lyra-space-s gap before its label (both defined
       in switch.styles.ts, not exposed as tokens), so this indent is
       coupled to that fixed geometry rather than derived from an unrelated
       component's token. */
    padding-inline-start: calc(2.25rem + var(--lyra-space-s));
    font-size: 0.75rem;
    color: var(--lyra-color-text-quiet);
  }

  [part='body'] {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow: auto;
    padding: var(--lyra-space-m) var(--lyra-space-l) var(--lyra-space-l);
  }
  [part='empty'] {
    margin: 0;
    padding: var(--lyra-space-l) 0;
    color: var(--lyra-color-text-quiet);
    font-size: 0.875rem;
    text-align: center;
  }

  [part='category'] {
    margin-block-end: var(--lyra-space-l);
  }
  [part='category']:last-child {
    margin-block-end: 0;
  }
  [part='category-heading'] {
    display: flex;
    align-items: baseline;
    gap: var(--lyra-space-xs);
    margin: 0 0 var(--lyra-space-s);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--lyra-color-text-quiet);
  }
  [part='category-count'] {
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
  }
  [part='category-list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  [part='tool-row'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  [part='tool-row'][data-disabled] [part='tool-checkbox'] {
    opacity: var(--lyra-opacity-disabled);
  }
  [part='tool-checkbox'] {
    align-items: flex-start;
  }
  [part='tool-checkbox']::part(label) {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  [part='tool-name'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--lyra-color-text);
  }
  [part='tool-icon'] {
    line-height: 1;
  }
  [part='tool-description'] {
    display: block;
    font-size: 0.8125rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='tool-disabled-reason'] {
    /* Slotted into lyra-checkbox's default slot alongside tool-name/
       tool-description (see tool-select-dialog.ts's renderTool()), so it
       inherits its indent for free from ::part(label)'s column layout
       above instead of needing its own guessed padding. */
    display: block;
    font-size: 0.75rem;
    color: var(--lyra-color-warning);
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-start: 1px solid var(--lyra-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
