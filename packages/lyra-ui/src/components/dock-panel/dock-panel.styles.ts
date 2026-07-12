import { css } from 'lit';

export const styles = css`
  /* No :host position/inset is imposed here -- unlike an overlay component,
     lyra-dock-panel deliberately stays layout-agnostic (see the class doc):
     drop it as an absolutely-positioned child of a position:relative parent,
     or as a flex item alongside your existing content, and it only manages
     its own size along the resize axis plus filling the cross axis. */
  :host {
    display: block;
    box-sizing: border-box;
    /* Themeable persistent-rail width/height while collapsed -- overridable
       from outside since it's a plain custom property, not a JS prop (see
       the class doc for why collapse hides content rather than zeroing the
       box). Reuses the shared icon-button tap-target token so the collapse
       toggle sitting on the rail stays comfortably tappable by default. */
    --lyra-dock-panel-collapsed-size: var(--lyra-icon-button-size);
    position: relative;
  }
  :host([edge='start']),
  :host([edge='end']) {
    block-size: 100%;
    min-inline-size: var(--lyra-dock-panel-collapsed-size);
  }
  :host([edge='top']),
  :host([edge='bottom']) {
    inline-size: 100%;
    min-block-size: var(--lyra-dock-panel-collapsed-size);
  }

  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    overflow: hidden;
  }

  [part='content'] {
    inline-size: 100%;
    block-size: 100%;
    overflow: auto;
  }
  [part='content'][hidden] {
    display: none;
  }

  /* The draggable edge -- always the panel's *inner* boundary (opposite the
     docked/pinned edge), positioned with logical insets so it mirrors
     automatically under RTL for the start/end edges. */
  [part='handle'] {
    position: absolute;
    background: var(--lyra-color-border);
    touch-action: none;
  }
  [part='handle']:hover,
  [part='handle']:focus-visible {
    background: var(--lyra-color-brand);
  }
  [part='handle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-width));
  }
  /* Transparent hit-slop, widening the draggable/tappable box along the
     resize axis only, without changing the handle's visible 3px thickness --
     same technique as lyra-split's divider. */
  [part='handle']::before {
    content: '';
    position: absolute;
    inset: -6px;
  }

  :host([edge='start']) [part='handle'] {
    inset-block: 0;
    inset-inline-end: 0;
    inline-size: 3px;
    cursor: col-resize;
  }
  :host([edge='end']) [part='handle'] {
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: 3px;
    cursor: col-resize;
  }
  :host([edge='top']) [part='handle'] {
    inset-inline: 0;
    inset-block-end: 0;
    block-size: 3px;
    cursor: row-resize;
  }
  :host([edge='bottom']) [part='handle'] {
    inset-inline: 0;
    inset-block-start: 0;
    block-size: 3px;
    cursor: row-resize;
  }

  [part='collapse-toggle'] {
    position: absolute;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    padding: 0;
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
    font-size: 0.75rem;
    line-height: 1;
    transition: background var(--lyra-transition-fast), color var(--lyra-transition-fast);
    z-index: 1;
  }
  [part='collapse-toggle']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='collapse-toggle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  :host([edge='start']) [part='collapse-toggle'] {
    inset-inline-end: var(--lyra-space-xs);
    inset-block-start: 50%;
    transform: translateY(-50%);
  }
  :host([edge='end']) [part='collapse-toggle'] {
    inset-inline-start: var(--lyra-space-xs);
    inset-block-start: 50%;
    transform: translateY(-50%);
  }
  :host([edge='top']) [part='collapse-toggle'] {
    inset-block-end: var(--lyra-space-xs);
    inset-inline-start: 50%;
    transform: translateX(-50%);
  }
  :host([edge='bottom']) [part='collapse-toggle'] {
    inset-block-start: var(--lyra-space-xs);
    inset-inline-start: 50%;
    transform: translateX(-50%);
  }
`;
