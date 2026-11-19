import { activeFill, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { nativeControlSurface } from '../../../internal/native-control-surface.styles.js';
import { highlightToneStyles } from '../../../internal/text-highlight.styles.js';

export const styles = css`
  :host {
    display: block;
  }

  [part="body"] {
    box-sizing: border-box;
    overflow: auto;
    max-block-size: var(--lr-docx-viewer-max-height, none);
    padding: var(--lr-space-l);
  }

  [part="content"] {
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-normal);
    overflow-wrap: break-word;
  }

  [part="content"] > :first-child {
    margin-block-start: 0;
  }

  [part="content"] > :last-child {
    margin-block-end: 0;
  }

  [part="content"] h1,
  [part="content"] h2,
  [part="content"] h3,
  [part="content"] h4,
  [part="content"] h5,
  [part="content"] h6 {
    line-height: var(--lr-line-height-compact);
    margin-block: var(--lr-space-l) var(--lr-space-s);
  }

  [part="content"] p,
  [part="content"] ul,
  [part="content"] ol {
    margin-block: 0 var(--lr-space-s);
  }

  [part="content"] img {
    max-inline-size: 100%;
    block-size: auto;
  }

  [part="content"] table {
    border-collapse: collapse;
    margin-block: 0 var(--lr-space-s);
    inline-size: 100%;
  }

  [part="content"] th,
  [part="content"] td {
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    padding: var(--lr-space-xs) var(--lr-space-s);
    text-align: start;
  }

  [part="content"] th {
    background: var(
      --lr-docx-viewer-table-header-bg,
      var(--lr-color-brand-quiet)
    );
    font-weight: var(--lr-font-weight-semibold);
  }

  .empty-note {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }

  [part="error"] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }

  [part="highlight-actions"] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    margin-block-start: var(--lr-space-m);
  }

  [part="highlight-action"] {
    ${iconHitTarget}
    ${nativeControlSurface}
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius-xs);
    cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }

  [part="highlight-action"]:hover {
    background: var(--lr-color-surface-raised);
  }

  [part="highlight-action"]:active {
    background: ${activeFill('var(--lr-color-surface-raised)')};
  }

  [part="highlight-action"]:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }

  ${highlightToneStyles('docx-viewer', {
    interactive: true,
    activeOutlineToken: '--lr-docx-viewer-highlight-active-outline',
  })}

  [part="content"] mark[part~="search-match"] {
    background: var(
      --lr-docx-viewer-search-match-bg,
      var(--lr-color-warning-quiet)
    );
    color: inherit;
    border-radius: var(--lr-radius-xs);
  }
  [part="content"] mark[part~="search-match-active"] {
    background: var(
      --lr-docx-viewer-search-match-active-bg,
      var(--lr-color-warning)
    );
    color: var(
      --lr-docx-viewer-search-match-active-color,
      var(--lr-color-on-warning)
    );
  }
`;
