import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
  }

  [part='form-control'],
  [part='fields'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  [part='form-control'] {
    gap: var(--lr-space-2xs);
  }

  [part='fields'] {
    gap: var(--lr-space-l);
  }

  [part~='aggregate-label'] {
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part~='aggregate-hint'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }

  [part~='aggregate-error'] {
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-xs);
  }

  [part='field'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='label'] {
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }

  ${formControlRequiredMarker}

  [part='description'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }

  [part='error'] {
    margin: 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-xs);
  }

  [part='scale'] {
    max-inline-size: var(--lr-size-32rem);
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    flex-wrap: wrap;
  }

  [part='submit'],
  [part='skip'] {
    font: inherit;
    border-radius: var(--lr-radius);
    padding: var(--lr-space-xs) var(--lr-space-m);
    cursor: pointer;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='submit'] {
    background: var(--lr-rubric-form-submit-bg, var(--lr-color-brand));
    border-color: var(--lr-rubric-form-submit-border-color, var(--lr-color-brand));
    color: var(--lr-rubric-form-submit-color, var(--lr-color-on-brand));
  }
  [part='skip'] {
    background: var(--lr-rubric-form-skip-bg, var(--lr-color-surface));
    border-color: var(--lr-rubric-form-skip-border-color, var(--lr-color-border));
    color: var(--lr-rubric-form-skip-color, var(--lr-color-text));
  }
  /* A colour mix, not filter: brightness(). The filter multiplied every channel, so it moved a
     mid-brand fill but did nothing at all to a pure white or pure black one, and -- because a
     filter applies to the whole subtree -- it dragged the button's own label along with its
     background. Mixing the fill toward --lr-color-mix-partner (which follows the text colour)
     always moves, always in the direction the surface needs, and leaves the label alone. */
  [part='submit']:not(:disabled):hover {
    background: var(--lr-rubric-form-submit-hover-bg, color-mix(in oklab, var(--lr-rubric-form-submit-bg, var(--lr-color-brand)), var(--lr-color-mix-partner) var(--lr-color-mix-hover)));
    border-color: var(--lr-rubric-form-submit-hover-border-color, color-mix(in oklab, var(--lr-rubric-form-submit-border-color, var(--lr-color-brand)), var(--lr-color-mix-partner) var(--lr-color-mix-hover)));
  }
  [part='submit']:not(:disabled):active {
    background: var(--lr-rubric-form-submit-active-bg, color-mix(in oklab, var(--lr-rubric-form-submit-bg, var(--lr-color-brand)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
    border-color: var(--lr-rubric-form-submit-active-border-color, color-mix(in oklab, var(--lr-rubric-form-submit-border-color, var(--lr-color-brand)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
  }
  [part='skip']:not(:disabled):hover {
    background: var(--lr-rubric-form-skip-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='skip']:not(:disabled):active {
    background: var(--lr-rubric-form-skip-active-bg, color-mix(in oklab, var(--lr-rubric-form-skip-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
  }
  [part='submit']:disabled,
  [part='skip']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='submit']:focus-visible,
  [part='skip']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='empty'] {
    color: var(--lr-color-text-quiet);
  }

  [part='unsupported'] {
    margin: 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-xs);
  }

  .option-description {
    display: block;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }

  [part='base'],
  [part='field'],
  [part='scale'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='label'],
  [part='description'],
  [part='error'],
  [part='empty'],
  [part='unsupported'],
  .option-description {
    overflow-wrap: anywhere;
  }
`;
