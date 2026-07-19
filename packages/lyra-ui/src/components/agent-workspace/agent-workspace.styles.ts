import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    min-block-size: 0;
    block-size: 100%;
    container-type: inline-size;
  }
  [part='base'] {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-inline-size: 0;
    min-block-size: 0;
    block-size: 100%;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='heading'] {
    min-inline-size: 0;
    margin: 0;
    font-size: var(--lr-font-size-md);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }
  [part='header-actions'] {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    margin-inline-start: auto;
  }
  [part='body'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(var(--lr-size-16rem), var(--lr-size-24rem));
    min-inline-size: 0;
    min-block-size: 0;
  }
  [part='body'][data-details='false'] {
    grid-template-columns: minmax(0, 1fr);
  }
  [part='conversation'] {
    display: flex;
    min-inline-size: 0;
    min-block-size: 0;
  }
  [part='viewport'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
  }
  [part='messages'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    min-inline-size: 0;
    padding: var(--lr-space-m);
  }
  [part='messages-empty'] {
    margin-block: auto;
  }
  [part='details'] {
    min-inline-size: 0;
    min-block-size: 0;
    overflow: auto;
    padding: var(--lr-space-m);
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface-raised);
  }
  [part='details-content'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    min-inline-size: 0;
  }
  [part='section'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='section-heading'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='section'] > * {
    min-inline-size: 0;
  }
  [part='composer'] {
    min-inline-size: 0;
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }
  [part='composer-input'] {
    display: block;
    max-inline-size: var(--lr-size-48rem);
    margin-inline: auto;
  }
  @container (max-inline-size: 48rem) {
    [part='body'] {
      grid-template-columns: minmax(0, 1fr);
    }
    [part='details'] {
      max-block-size: 45%;
      border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
      border-inline-start: 0;
    }
  }
  @container (max-inline-size: 30rem) {
    [part='header'],
    [part='composer'] {
      padding-inline: var(--lr-space-s);
    }
    [part='messages'],
    [part='details'] {
      padding: var(--lr-space-s);
    }
  }
`;
