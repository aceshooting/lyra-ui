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

  [part~='tool-result'],
  [part~='data'] {
    overflow: auto;
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
    background: var(--lr-message-parts-error-background, var(--lr-color-danger-quiet));
    color: var(--lr-message-parts-error-color, var(--lr-color-danger));
  }

  [part='retry'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  @container (max-inline-size: 319.98px) {
    [part='base'] {
      gap: var(--lr-space-xs);
    }
  }
`;
