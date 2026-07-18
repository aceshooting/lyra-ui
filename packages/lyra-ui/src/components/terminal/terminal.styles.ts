import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    overflow: hidden;
  }
  [part='toolbar'] {
    display: flex;
    justify-content: flex-end;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-size-1px) solid var(--lr-color-border);
  }
  [part='copy-button'],
  [part='download-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    background: none;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    cursor: pointer;
  }
  [part='viewport'] {
    position: relative;
    block-size: var(--lr-terminal-height, var(--lr-size-20rem));
  }
  lr-virtual-list {
    display: block;
    block-size: 100%;
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }
  /* renderItem's returned content is committed inside <lr-virtual-list>'s own shadow root (Lit
     renders a function-supplied template into whichever root is currently updating, regardless of
     which module the function was defined in), so a plain [part='line'] rule here -- scoped to this
     component's own shadow root -- would never match anything. Reaching one shadow level in through
     a part attribute set by content this component doesn't itself template statically is exactly
     what ::part() is for; see <lr-lightbox>'s lr-zoomable-frame[part='frame']::part(base) rule
     for the same technique used against a statically-templated child instead of a renderItem one. */
  lr-virtual-list::part(line) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding-inline: var(--lr-space-s);
    line-height: var(--lr-line-height-normal);
  }
  :host(:not([wrap])) lr-virtual-list::part(line) {
    white-space: pre;
    overflow-wrap: normal;
  }
  [part='jump-to-latest'] {
    position: absolute;
    inset-block-end: var(--lr-space-s);
    inset-inline-end: var(--lr-space-s);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-surface);
    background: var(--lr-color-brand);
    border: none;
    border-radius: var(--lr-radius-pill);
    padding: var(--lr-space-2xs) var(--lr-space-s);
    box-shadow: var(--lr-shadow);
    cursor: pointer;
    z-index: var(--lr-layer-content);
    transition: opacity var(--lr-transition-fast);
  }
`;
