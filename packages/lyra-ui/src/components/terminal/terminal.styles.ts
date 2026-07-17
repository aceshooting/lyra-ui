import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface-raised);
    overflow: hidden;
  }
  [part='toolbar'] {
    display: flex;
    justify-content: flex-end;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-block-end: var(--lyra-size-1px) solid var(--lyra-color-border);
  }
  [part='copy-button'],
  [part='download-button'] {
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
    background: none;
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    padding: var(--lyra-space-2xs) var(--lyra-space-xs);
    cursor: pointer;
  }
  [part='viewport'] {
    position: relative;
    block-size: var(--lyra-terminal-height, var(--lyra-size-20rem));
  }
  lyra-virtual-list {
    display: block;
    block-size: 100%;
    font-family: var(--lyra-font-mono);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text);
  }
  /* renderItem's returned content is committed inside <lyra-virtual-list>'s own shadow root (Lit
     renders a function-supplied template into whichever root is currently updating, regardless of
     which module the function was defined in), so a plain [part='line'] rule here -- scoped to this
     component's own shadow root -- would never match anything. Reaching one shadow level in through
     a part attribute set by content this component doesn't itself template statically is exactly
     what ::part() is for; see <lyra-lightbox>'s lyra-zoomable-frame[part='frame']::part(base) rule
     for the same technique used against a statically-templated child instead of a renderItem one. */
  lyra-virtual-list::part(line) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding-inline: var(--lyra-space-s);
    line-height: var(--lyra-line-height-normal);
  }
  :host(:not([wrap])) lyra-virtual-list::part(line) {
    white-space: pre;
    overflow-wrap: normal;
  }
  [part='jump-to-latest'] {
    position: absolute;
    inset-block-end: var(--lyra-space-s);
    inset-inline-end: var(--lyra-space-s);
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-surface);
    background: var(--lyra-color-brand);
    border: none;
    border-radius: var(--lyra-radius-pill);
    padding: var(--lyra-space-2xs) var(--lyra-space-s);
    box-shadow: var(--lyra-shadow);
    cursor: pointer;
    z-index: var(--lyra-layer-content);
    transition: opacity var(--lyra-transition-fast);
  }
`;
