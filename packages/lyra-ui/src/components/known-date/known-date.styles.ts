import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-known-date-field-padding-block: var(--lyra-space-s);
    --lyra-known-date-field-padding-inline: var(--lyra-space-s);
    --lyra-known-date-field-font-size: var(--lyra-font-size-md-sm);
    --lyra-known-date-field-gap: var(--lyra-space-s);
    --lyra-known-date-year-field-width: 5em;
    --lyra-known-date-day-field-width: 3.5em;
    --lyra-known-date-month-field-width: 3.5em;
  }
  :host([size='xs']) {
    --lyra-known-date-field-padding-block: var(--lyra-size-0-125rem);
    --lyra-known-date-field-padding-inline: var(--lyra-space-xs);
    --lyra-known-date-field-font-size: var(--lyra-font-size-xs);
  }
  :host([size='s']) {
    --lyra-known-date-field-padding-block: var(--lyra-space-xs);
    --lyra-known-date-field-padding-inline: var(--lyra-space-xs);
    --lyra-known-date-field-font-size: var(--lyra-font-size-sm);
  }
  :host([size='l']) {
    --lyra-known-date-field-padding-block: var(--lyra-space-m);
    --lyra-known-date-field-padding-inline: var(--lyra-space-m);
    --lyra-known-date-field-font-size: var(--lyra-font-size-lg);
  }
  :host([size='xl']) {
    --lyra-known-date-field-padding-block: var(--lyra-space-l);
    --lyra-known-date-field-padding-inline: var(--lyra-space-l);
    --lyra-known-date-field-font-size: var(--lyra-font-size-xl);
  }

  [part='form-control'] {
    min-inline-size: 0;
  }

  [part='fieldset'] {
    margin: 0;
    padding: 0;
    border: none;
    min-inline-size: 0;
  }

  [part='legend'] {
    display: block;
    padding: 0;
    margin-block-end: var(--lyra-space-xs);
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
  }
  /* [part] always contains a literal <slot> child regardless of assigned
     content, so :empty never matches -- real emptiness is tracked in JS
     (hasLabelSlot) and reflected via [hidden] instead (same fix as every
     other lyra form control's label/hint/error chrome). Without this the
     required-asterisk ::after below (attached to this box) would render a
     stray ' *' with nothing before it whenever no label is set. */
  [part='legend'][hidden] {
    display: none;
  }
  :host([required]) [part='legend']::after {
    content: ' *';
    color: var(--lyra-color-danger);
  }

  [part='fields'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-known-date-field-gap);
  }

  [part='field'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-2xs);
  }

  [part='field-label'] {
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }

  [part='field-input'] {
    box-sizing: border-box;
    padding-block: var(--lyra-known-date-field-padding-block);
    padding-inline: var(--lyra-known-date-field-padding-inline);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font-family: inherit;
    font-size: var(--lyra-known-date-field-font-size);
    text-align: center;
  }
  [part='field'][data-field='day'] [part='field-input'] {
    inline-size: var(--lyra-known-date-day-field-width);
  }
  [part='field'][data-field='month'] [part='field-input'] {
    inline-size: var(--lyra-known-date-month-field-width);
  }
  [part='field'][data-field='year'] [part='field-input'] {
    inline-size: var(--lyra-known-date-year-field-width);
  }
  [part='field-input']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host([data-invalid]) [part='field-input'] {
    border-color: var(--lyra-color-danger);
  }
  [part='field-input']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }

  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
