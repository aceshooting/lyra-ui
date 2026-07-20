import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='chunk'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    padding-block: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='chunk'][aria-current='true'] {
    background: var(--lr-chunk-inspector-current-bg, var(--lr-color-brand-quiet));
  }
  /* text-quiet's contrast ratio against brand-quiet lands at ~4.24:1 -- just under the WCAG AA
     4.5:1 floor for normal-size text -- even though it comfortably passes against the plain
     (non-current) background used the rest of the time. Same class of bug already hit and fixed in
     lr-attachment-chip's [part='size'], lr-chat-message's [part='footer'] and lr-conversation-item's
     [part='excerpt']/[part='timestamp']; same fix, full-strength text color once current. Paired
     with --lr-chunk-inspector-current-bg: a consumer that restyles one has to keep the ratio, so
     both arms of the pair are overridable. */
  [part='chunk'][aria-current='true'] [part='score'] {
    color: var(--lr-chunk-inspector-current-color, var(--lr-color-text));
  }
  [part='score'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }
  [part='score-bar'] {
    flex: 1 1 auto;
    max-inline-size: var(--lr-size-6rem);
    block-size: var(--lr-size-4px);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border);
    overflow: hidden;
  }
  [part='score-fill'] {
    display: block;
    block-size: 100%;
    background: var(--lr-color-text-quiet);
  }
  [part='score-fill'][data-tone='success'] {
    background: var(--lr-color-success);
  }
  [part='score-fill'][data-tone='warning'] {
    background: var(--lr-color-warning);
  }
  [part='score-fill'][data-tone='danger'] {
    background: var(--lr-color-danger);
  }
  [part='open-button'] {
    display: block;
    max-inline-size: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-weight: var(--lr-font-weight-medium);
    text-align: start;
    cursor: pointer;
  }
  [part='open-button']:hover {
    color: var(--lr-color-brand);
    text-decoration: underline;
  }
  [part='open-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='title'] {
    font: inherit;
  }
  [part='text'] {
    margin: 0;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='text'][data-clamped] {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  [part='toggle'] {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
  [part='toggle']:hover {
    text-decoration: underline;
  }
  [part='toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
