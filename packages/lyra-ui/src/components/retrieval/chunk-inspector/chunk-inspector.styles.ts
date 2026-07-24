import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  /* Two rendering paths, one presentation. Below \`virtualize-at\` a chunk row is committed into
     this component's own shadow root, where a plain [part~='x'] selector matches it. Above it the
     identical row template becomes <lr-virtual-list>'s .renderItem, and Lit commits that content
     inside *that* component's shadow root -- a different tree, which no selector scoped to this one
     can ever reach. lr-virtual-list::part(x) crosses exactly that one boundary, so both selectors
     are required for every row-level part; the pairing is the same one <lr-ingestion-queue> uses
     for its own dual-path rows.

     Row state is carried by an extra part *token* (chunk-current, score-fill-danger, ...) rather
     than by the row's own attribute, because Shadow Parts forbids an attribute selector after
     ::part(): ::part(chunk)[aria-current='true'] is invalid CSS, so the whole rule would be
     dropped. ::part() matches against the part-name list, so a second token costs nothing and is
     reachable from a consumer stylesheet too. The mirrored attributes (aria-current, data-tone,
     data-clamped) stay on the elements -- they carry the semantics, and a bare [part~=] selector
     inside this tree can still use them. */
  [part~='chunk'],
  lr-virtual-list::part(chunk) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    padding-block: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part~='chunk-current'],
  lr-virtual-list::part(chunk-current) {
    background: var(--lr-chunk-inspector-current-bg, var(--lr-color-brand-quiet));
  }
  [part~='score'],
  lr-virtual-list::part(score) {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }
  /* text-quiet's contrast ratio against brand-quiet lands at ~4.24:1 -- just under the WCAG AA
     4.5:1 floor for normal-size text -- even though it comfortably passes against the plain
     (non-current) background used the rest of the time. Same class of bug already hit and fixed in
     lr-attachment-chip's [part='size'], lr-chat-message's [part='footer'] and lr-conversation-item's
     [part='excerpt']/[part='timestamp']; same fix, full-strength text color once current. Paired
     with --lr-chunk-inspector-current-bg: a consumer that restyles one has to keep the ratio, so
     both arms of the pair are overridable. Ordered after the base score rule above, which it has to
     win on source order (both are single-token selectors of equal specificity). */
  [part~='score-current'],
  lr-virtual-list::part(score-current) {
    color: var(--lr-chunk-inspector-current-color, var(--lr-color-text));
  }
  [part~='score-bar'],
  lr-virtual-list::part(score-bar) {
    flex: 1 1 auto;
    max-inline-size: var(--lr-size-6rem);
    block-size: var(--lr-size-4px);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border);
    overflow: hidden;
  }
  [part~='score-fill'],
  lr-virtual-list::part(score-fill) {
    display: block;
    block-size: 100%;
    background: var(--lr-color-text-quiet);
  }
  [part~='score-fill-success'],
  lr-virtual-list::part(score-fill-success) {
    background: var(--lr-color-success);
  }
  [part~='score-fill-warning'],
  lr-virtual-list::part(score-fill-warning) {
    background: var(--lr-color-warning);
  }
  [part~='score-fill-danger'],
  lr-virtual-list::part(score-fill-danger) {
    background: var(--lr-color-danger);
  }
  [part~='open-button'],
  lr-virtual-list::part(open-button) {
    display: block;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
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
  [part~='open-button']:hover,
  lr-virtual-list::part(open-button):hover {
    color: var(--lr-color-brand);
    text-decoration: underline;
  }
  [part~='open-button']:focus-visible,
  lr-virtual-list::part(open-button):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='title'],
  lr-virtual-list::part(title) {
    font: inherit;
  }
  [part~='text'],
  lr-virtual-list::part(text) {
    margin: 0;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part~='text-clamped'],
  lr-virtual-list::part(text-clamped) {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  [part~='toggle'],
  lr-virtual-list::part(toggle) {
    align-self: flex-start;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
  [part~='toggle']:hover,
  lr-virtual-list::part(toggle):hover {
    text-decoration: underline;
  }
  [part~='toggle']:focus-visible,
  lr-virtual-list::part(toggle):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
