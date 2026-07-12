import { css } from 'lit';

export const styles = css`
  :host {
    display: flex;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-l);
    color: var(--lyra-color-text-quiet);
    inline-size: 100%;
  }
  :host([compact]) [part='base'] {
    align-items: flex-start;
    text-align: start;
    padding: var(--lyra-space-xs);
  }
  [part='icon'] {
    font-size: 2rem;
    line-height: 1;
    color: var(--lyra-color-border);
  }
  [part='icon'][hidden] {
    display: none;
  }
  [part='heading'] {
    font-weight: 600;
    color: var(--lyra-color-text);
    margin: 0;
  }
  [part='heading']:empty {
    display: none;
  }
  :host([compact]) [part='heading'] {
    font-weight: 400;
  }
  [part='description'] {
    font-size: 0.875rem;
    margin: 0;
  }
  [part='description']:empty {
    display: none;
  }
  [part='actions'] {
    margin-block-start: var(--lyra-space-s);
  }
  [part='actions'][hidden] {
    display: none;
  }
`;
