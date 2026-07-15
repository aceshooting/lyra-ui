import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    vertical-align: middle;
  }

  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--lyra-space-2xs);
    max-inline-size: 100%;
  }

  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
    align-items: stretch;
  }

  ::slotted(*) {
    min-inline-size: 0;
  }

  @media (max-width: 20rem) {
    [part='base'] {
      inline-size: 100%;
    }
  }
`;
