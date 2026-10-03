import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    color: var(--lr-color-text);
    font-family: var(--lr-font);
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    min-block-size: var(--lr-size-20rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }

  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }

  [part='file-actions'], [part='format-actions'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='format-actions'] {
    padding-inline-start: var(--lr-space-s);
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  [part='file-input'] {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: calc(-1 * var(--lr-size-1px));
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  [part='document'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: var(--lr-size-20rem);
    overflow: auto;
  }

  [part='confirm'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }

  ::slotted([slot='document']) {
    display: block;
    min-inline-size: 0;
    min-block-size: 100%;
  }

  [part='status'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='error'] {
    margin: 0;
    padding: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-danger);
    background: var(--lr-color-surface);
    overflow-wrap: anywhere;
  }

  [part='filename'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='state'] {
    margin-inline-start: auto;
    text-align: end;
  }

  @container (max-width: 35rem) {
    [part='toolbar'] { align-items: stretch; }
    [part='file-actions'], [part='format-actions'] { inline-size: 100%; }
    [part='format-actions'] {
      padding-inline-start: 0;
      padding-block-start: var(--lr-space-xs);
      border-inline-start: 0;
      border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    }
  }
`;
