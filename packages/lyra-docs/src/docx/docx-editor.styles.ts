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

  [part='editing-tools'] {
    display: flex;
    flex: 1 1 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    padding-block-start: var(--lr-space-xs);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  [part='alignment-actions'], [part='list-actions'], [part='link-actions'],
  [part='table-tools'], [part='table-actions'], [part='table-dialog-actions'],
  [part='image-tools'], [part='image-resize-actions'], [part='image-description-actions'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='paragraph-style'], [part='font-family'] {
    flex: 0 1 var(--lr-size-12rem);
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='font-size'] {
    flex: 0 1 var(--lr-size-12rem);
    min-inline-size: min(var(--lr-size-12rem), 100%);
    max-inline-size: 100%;
  }

  [part='text-color'] {
    flex: none;
  }

  [part='color-state'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='link-fields'], [part='table-fields'], [part='image-resize-fields'], [part='image-description-fields'] {
    display: grid;
    box-sizing: border-box;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    inline-size: min(var(--lr-size-20rem), 100%);
    padding: var(--lr-space-s);
  }

  [part='table-tools'], [part='image-tools'] { flex: 1 1 100%; }
  [part='table-context'], [part='table-hint'], [part='image-context'],
  [part='image-resize-hint'], [part='image-description-hint'], [part='image-navigation-status'] {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='image-width'], [part='image-height'], [part='image-title'], [part='image-description'], [part='image-ratio'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='image-previous'], [part='image-next'], [part='image-resize-trigger'], [part='image-description-trigger'], [part='image-delete'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='image-resize-popover'], [part='image-description-popover'] {
    --lr-overlay-max-inline-size: min(var(--lr-size-20rem), calc(100vw - var(--lr-space-s) * 2));
    min-inline-size: 0;
  }

  [part='find'] {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }

  [part='find-query'], [part='find-replace'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }

  [part='find-count'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
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

  [part='document']:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border);
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }

  [part='document']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
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

  [part='error'], [part='edit-error'] {
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
    [part='editing-tools'] { inline-size: 100%; }
    [part='paragraph-style'], [part='font-family'] { flex-basis: var(--lr-size-8rem); }
    [part='find-query'], [part='find-replace'] { flex-basis: 100%; }
  }
`;
