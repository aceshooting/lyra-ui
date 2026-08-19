import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-space-m);
  }
  /* Density escape -- same convention as lr-agent-run's compact. The tuned value sits behind an
     inline var() fallback, not a :host declaration, which every instance would re-declare and so
     shadow any ancestor value; the fallback is the pre-existing value, so an unset card renders
     unchanged. */
  :host([compact]) [part='base'] {
    padding: var(--lr-commit-card-compact-padding, var(--lr-space-s));
  }
  /* MUST stay after :host([compact]): both selectors are :host([x]) [part='base'] at equal
     specificity, so source order alone decides the padding when a card is both compact and
     frame="plain". plain is the stronger statement -- no chrome at all -- so it goes last. */
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
  }
  [part='subject'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='body'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    color: var(--lr-color-text-quiet);
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }
  [part='meta'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    align-items: center;
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='hash'] {
    font-family: var(--lr-font-mono);
  }
  [part='author'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part='additions'] {
    color: var(--lr-color-success);
  }
  [part='deletions'] {
    color: var(--lr-color-danger);
  }
  [part='files-toggle'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: none;
    border: none;
    color: var(--lr-color-brand);
    cursor: pointer;
    padding: var(--lr-space-xs) 0;
  }
  /* Pressed, here and on [part='file'] / [part='copy-button'] below, pushes the hovered tint a
     further --lr-color-mix-active toward --lr-color-mix-partner, which follows the text colour, so
     it reads as a distinctly deeper step than hover in both themes. */
  [part='files-toggle']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='files-toggle']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='files-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='file'] {
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--lr-space-s);
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    background: none;
    border: none;
    font: inherit;
    font-family: var(--lr-font-mono);
    text-align: start;
    cursor: pointer;
    padding: var(--lr-space-2xs) 0;
  }
  [part='file-path'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  .file-stats {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  [part='file']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='file']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='file']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='copy-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: none;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    cursor: pointer;
  }
  [part='copy-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='copy-button']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
