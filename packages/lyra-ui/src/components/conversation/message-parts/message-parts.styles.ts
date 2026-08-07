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

  /* De-emphasises this part's OWN text while an answer is still streaming. Deliberately a colour
     change rather than an opacity on the subtree: a streaming part can contain a nested component
     (an <lr-thinking-panel>, a tool-call chip) that sets its own colour at the contrast floor, and
     a container opacity multiplies that down through it — which is a WCAG 1.4.3 failure the nested
     component cannot see or defend against. color only reaches text that actually inherits it. */
  [part~='part-streaming'] {
    color: var(--lr-color-text-quiet);
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

  [part~='audio'] {
    inline-size: 100%;
  }

  [part~='audio-transcript'] {
    margin-block: var(--lr-space-xs) 0;
    color: var(--lr-color-text-quiet);
  }

  [part~='error'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-danger);
    border-radius: var(--lr-radius);
    background: var(--lr-color-danger-quiet);
    color: var(--lr-color-danger);
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
