import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* Card chrome behind inline var() fallbacks, same convention as the compact density below. The
     background fallback is transparent, which is what this card has always painted -- it takes
     the surface it sits on -- so an unset card renders unchanged while a consumer can now give it
     its own fill without a ::part(base) override. */
  [part='base'] {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    border: var(--lr-border-width-thin) solid
      var(--lr-commit-card-border-color, var(--lr-color-border));
    border-radius: var(--lr-commit-card-radius, var(--lr-radius));
    background: var(--lr-commit-card-background, transparent);
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
     frame="plain". plain is the stronger statement -- no chrome at all -- so it goes last.

     background: transparent is NOT redundant with the hook's transparent fallback above: it is
     what makes plain mean the same thing here as on every sibling card. Without it a consumer who
     sets --lr-commit-card-background still gets a filled "plain" card, while lr-activity-feed,
     lr-agent-run, lr-result-card, lr-stack-trace, lr-task-list, lr-terminal, lr-thinking-panel and
     lr-chat-composer all drop the fill. */
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
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
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
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
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
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
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    cursor: pointer;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
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
