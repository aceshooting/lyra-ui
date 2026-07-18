import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  [part='thumbs'] {
    display: flex;
    gap: var(--lyra-space-2xs);
  }
  [part='up-button'],
  [part='down-button'] {
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size -- same "small glyph, padded hit box" pattern as
       lyra-code-block's/lyra-json-viewer's [part='toggle']. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-size-1-75rem);
    block-size: var(--lyra-size-1-75rem);
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    padding: 0;
    border: var(--lyra-border-width-thin) solid transparent;
    border-radius: var(--lyra-radius);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
  }
  [part='up-button']:hover:not(:disabled),
  [part='down-button']:hover:not(:disabled) {
    background: var(--lyra-color-surface-raised);
    color: var(--lyra-color-text);
  }
  [part='up-button']:focus-visible,
  [part='down-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  /* The pressed state is never color-alone -- the icon itself swaps to a filled glyph in
     lockstep with aria-pressed. These color/background/border rules are additive emphasis
     layered on top of that shape change, not the sole signal. */
  [part='up-button'][aria-pressed='true'] {
    color: var(--lyra-color-success);
    background: var(--lyra-color-success-quiet);
    border-color: var(--lyra-color-success);
  }
  [part='down-button'][aria-pressed='true'] {
    color: var(--lyra-color-danger);
    background: var(--lyra-color-danger-quiet);
    border-color: var(--lyra-color-danger);
  }
  [part='up-button']:disabled,
  [part='down-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  /* A 0fr/1fr grid-row trick animates the disclosure's block size without measuring content --
     min-block-size: 0 on the inner wrapper plus overflow: hidden here keeps collapsed content from
     leaking through during the transition. */
  [part='panel'] {
    display: grid;
    grid-template-rows: 0fr;
    overflow: hidden;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    transition: grid-template-rows var(--lyra-transition-base);
  }
  [part='panel'][data-open] {
    grid-template-rows: 1fr;
  }
  [part='panel'] .panel-inner {
    overflow: hidden;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='panel'] {
      transition: none;
    }
  }
  [part='reasons'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-2xs);
  }
  [part='comment'] {
    box-sizing: border-box;
    inline-size: 100%;
    min-block-size: var(--lyra-size-2-5rem);
    padding: var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    resize: vertical;
  }
  [part='comment']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='submit-button'] {
    align-self: flex-end;
    padding-inline: var(--lyra-space-m);
    padding-block: var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-brand);
    color: var(--lyra-color-on-brand);
    font: inherit;
    cursor: pointer;
  }
  [part='submit-button']:hover {
    filter: brightness(1.08);
  }
  [part='submit-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  /* 320px baseline: the panel already stacks in a flex column and the comment field is full-width
     by construction, so no additional narrow-specific rule is needed. */
`;
