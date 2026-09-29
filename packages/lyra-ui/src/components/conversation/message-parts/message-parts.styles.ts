import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }

  [part~='part'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  /* De-emphasises this part's OWN text while an answer streams. A colour change, not an opacity on
     the subtree: a streaming part can nest a component (an <lr-thinking-panel>, a tool-call chip)
     sitting at the contrast floor, and a container opacity multiplies that down through it -- a
     WCAG 1.4.3 failure the nested component cannot see or defend against. color only reaches text
     that inherits it. */
  [part~='part-streaming'] {
    color: var(--lr-message-parts-streaming-color, var(--lr-color-text-quiet));
  }

  [part~='tool-call'],
  [part~='citation'],
  [part~='attachment'] {
    align-self: flex-start;
    max-inline-size: 100%;
  }

  /* A tool-call block spans the message instead of shrink-wrapping like a chip. */
  :host(:where([tool-display='block'])) [part~='tool-call'] {
    align-self: stretch;
  }

  [part~='tool-result'],
  [part~='data'] {
    overflow: auto;
  }

  [part='tool-disclosure'] {
    inline-size: 100%;
    max-inline-size: 100%;
  }

  [part='tool-header'] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='tool-status'] {
    color: var(--lr-color-text-quiet);
  }

  [part='tool-args'],
  [part='tool-result'] {
    min-inline-size: 0;
    overflow-wrap: break-word;
  }

  [part='tool-error'] {
    margin-block: var(--lr-space-xs) 0;
    color: var(--lr-color-danger);
    overflow-wrap: break-word;
  }

  [part='tool-result-error'] {
    display: grid;
    gap: var(--lr-space-xs);
    color: var(--lr-color-danger);
  }

  [part='audio-control'] {
    max-inline-size: 100%;
  }

  [part~='audio'] {
    inline-size: 100%;
  }

  [part~='audio-transcript'] {
    margin-block: var(--lr-space-xs) 0;
    color: var(--lr-message-parts-audio-transcript-color, var(--lr-color-text-quiet));
  }

  [part~='error'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-message-parts-error-border-color, var(--lr-color-danger));
    border-radius: var(--lr-radius);
    background: var(--lr-message-parts-error-bg, var(--lr-color-danger-quiet));
    color: var(--lr-message-parts-error-color, var(--lr-color-danger));
  }

  [part~='error'] > span {
    flex: 1 1 0;
    min-inline-size: 0;
    overflow-wrap: break-word;
  }

  [part='retry'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  @container (max-inline-size: 319.98px) {
    [part='base'] {
      gap: var(--lr-space-xs);
    }
  }
  [part='interruption'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    margin-block-start: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    white-space: normal;
    overflow-wrap: anywhere;
  }

  [part='resume'] {
    --_lr-message-parts-resume-hover-bg: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
    --_lr-message-parts-resume-active-bg: color-mix(in oklab, var(--_lr-message-parts-resume-hover-bg), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }

  [part='resume']:hover:where(:not(:disabled)) {
    background: var(--_lr-message-parts-resume-hover-bg);
  }

  [part='resume']:active:where(:not(:disabled)) {
    background: var(--_lr-message-parts-resume-active-bg);
  }

  [part='resume']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='resume']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

`;
