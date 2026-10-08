import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='limit'] { margin: 0; color: var(--lr-color-text-quiet); }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='add-button'],
  [part='remove-button'] {
    display: inline-flex;
    align-items: center;
  }
  /* Keep the dataset's border cue alongside the shared action hover fill. */
  button[data-agent-action][part='add-button']:where(:hover):where(:not(:disabled)),
  button[data-agent-action][part='remove-button']:where(:hover):where(:not(:disabled)) {
    border-color: var(--lr-color-brand);
  }
  button[data-agent-action][part='add-button']:where(:active):where(:not(:disabled)),
  button[data-agent-action][part='remove-button']:where(:active):where(:not(:disabled)) {
    border-color: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='import'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: var(--lr-size-14rem);
    /* The tight dropzone density, through the file input's documented dropzone hooks. Each still
       honours the file input's own density hooks when a consumer retunes them from outside. */
    --lr-file-input-dropzone-padding: var(--lr-file-input-compact-padding, var(--lr-space-s));
    --lr-file-input-dropzone-font-size: var(--lr-file-input-compact-font-size, var(--lr-font-size-sm));
    --lr-file-input-gap: var(--lr-file-input-compact-gap, var(--lr-space-2xs));
  }
  [part='search'] {
    display: block;
  }
  [part='search-input'] {
    inline-size: 100%;
  }
  [part='tag-filter'] {
    display: block;
  }
  [part='grid'] {
    display: block;
    min-inline-size: 0;
  }
`;
