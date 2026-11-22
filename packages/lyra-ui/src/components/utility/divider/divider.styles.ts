import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] {
    border: 0;
    border-block-start: var(--width, var(--lr-border-width-thin)) solid
      var(--color, var(--lr-color-border-subtle));
    margin-block: var(--spacing, 0);
    margin-inline: 0;
  }
  :host(:where([orientation='vertical'], [vertical])) {
    display: inline-block;
    block-size: 100%;
    min-block-size: var(--lr-size-1em);
  }
  :host(:where([orientation='vertical'], [vertical])) [part='base'] {
    block-size: 100%;
    border-block-start: 0;
    border-inline-start: var(--width, var(--lr-border-width-thin)) solid
      var(--color, var(--lr-color-border-subtle));
    margin-block: 0;
    margin-inline: var(--spacing, 0);
  }
  :host([with-label]) [part='base'] {
    display: flex;
    align-items: center;
    border: 0;
  }
  :host([with-label]) [part~='line'] {
    flex: 1 1 0;
    min-inline-size: 0;
    border-block-start: var(--width, var(--lr-border-width-thin)) solid
      var(--color, var(--lr-color-border-subtle));
  }
  :host([with-label]) [part='label'] {
    flex: 0 1 auto;
    padding-inline: var(--label-spacing, var(--lr-space-s));
  }
  :host([with-label][label-placement='start']) [part~='line-start'],
  :host([with-label][label-placement='end']) [part~='line-end'] {
    flex: 0 0 var(--label-offset, 2em);
  }
  :host([with-label]:where([orientation='vertical'], [vertical])) [part='base'] {
    flex-direction: column;
    border: 0;
    margin-block: 0;
    margin-inline: var(--spacing, 0);
  }
  :host([with-label]:where([orientation='vertical'], [vertical])) [part~='line'] {
    border-block-start: 0;
    border-inline-start: var(--width, var(--lr-border-width-thin)) solid
      var(--color, var(--lr-color-border-subtle));
  }
  :host([with-label]:where([orientation='vertical'], [vertical])) [part='label'] {
    padding-inline: 0;
    padding-block: var(--label-spacing, var(--lr-space-s));
  }
`;
