import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-space-m);
  }
  /* Density escape -- same convention as lr-agent-run's compact. The tuned value sits behind an
     inline var() fallback (rather than a :host declaration, which every instance would re-declare
     and so shadow any ancestor value) so a consumer can retune it from outside without restating
     the whole rule; the fallback is the pre-existing value, so an unset card renders unchanged. */
  :host([compact]) [part='base'] {
    padding: var(--lr-commit-card-compact-padding, var(--lr-space-s));
  }
  /* MUST stay after :host([compact]): both selectors are :host([x]) [part='base'], i.e. equal
     specificity, so source order alone decides which padding wins when a card is both compact and
     plain. plain is the stronger statement ("no chrome at all"), so it goes last. */
  :host([appearance='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
  }
  [part='subject'] {
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='body'] {
    white-space: pre-wrap;
    color: var(--lr-color-text-quiet);
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }
  [part='meta'] {
    display: flex;
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
  [part='files-toggle']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='file'] {
    display: flex;
    justify-content: space-between;
    inline-size: 100%;
    background: none;
    border: none;
    font: inherit;
    font-family: var(--lr-font-mono);
    text-align: start;
    cursor: pointer;
    padding: var(--lr-space-2xs) 0;
  }
  [part='file']:hover {
    background: var(--lr-color-brand-quiet);
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
`;
