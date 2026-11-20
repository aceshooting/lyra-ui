import { css } from 'lit';
import { activeFill, disabledControl, focusRing, iconHitTarget, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { catalogPickerStyles } from '../catalog-picker-trigger.styles.js';

export const styles = css`
  ${catalogPickerStyles('voice-picker', css`flex: 1 1 auto;`, css``)}

  [part='form-control-label'] {
    overflow-wrap: anywhere;
  }

  .control-row {
    display: flex;
    align-items: stretch;
    gap: var(--lr-voice-picker-gap, var(--_lr-voice-picker-gap-default));
  }

  [part='preview-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: max(var(--lr-icon-button-size), var(--lr-form-control-height));
    /* Match either height override so the preview button tracks the trigger. */
    block-size: var(
      --lr-voice-picker-trigger-height,
      var(
        --lr-voice-picker-trigger-min-height,
        max(var(--lr-icon-button-size), var(--lr-form-control-height))
      )
    );
    ${iconHitTarget}
    /* The adjacent trigger's resting tokens, so retinting the field retints the preview with it. */
    border: var(--lr-border-width-thin) solid var(--lr-voice-picker-trigger-border-color, var(--lr-color-border));
    border-radius: var(--lr-voice-picker-radius, var(--_lr-voice-picker-radius-default));
    background: var(--lr-voice-picker-trigger-fill, var(--lr-color-surface));
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
    ${interactiveTransition}
  }
  [part='preview-button']:hover:not(:disabled) {
    border-color: var(--lr-voice-picker-trigger-hover-border-color, var(--lr-voice-picker-trigger-border-color, var(--lr-color-border)));
    background: var(--lr-voice-picker-preview-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-voice-picker-preview-hover-color, var(--lr-color-brand));
  }
  [part='preview-button']:active:not(:disabled) {
    background: ${activeFill('var(--lr-voice-picker-preview-hover-bg, var(--lr-color-brand-quiet))')};
    color: var(--lr-voice-picker-preview-hover-color, var(--lr-color-brand));
  }
  [part='preview-button']:focus-visible {
    ${focusRing}
  }
  [part='preview-button']:disabled {
    ${disabledControl}
  }
  [part='preview-button'][data-playing] {
    border-color: var(--lr-voice-picker-preview-active-border, var(--lr-color-brand));
    color: var(--lr-voice-picker-preview-active-color, var(--lr-color-brand));
  }

  [part='option-label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  [part='option-label'] > :first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='option-meta'] {
    font-size: var(--lr-size-0-6875rem);
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* no-pressed-state: The shared option supplies the pressed background while metadata retains its hover contrast. */
  [part='option']:where(:not([aria-disabled='true'])):hover [part='option-meta'],
  [part='option'][data-active] [part='option-meta'] {
    color: var(--lr-color-text);
  }

  [part='option-preview'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    ${iconHitTarget}
    border-radius: var(--lr-voice-picker-radius, var(--_lr-voice-picker-radius-default));
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    ${interactiveTransition}
  }
  [part='option-preview']:hover {
    background: var(--lr-voice-picker-preview-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-voice-picker-preview-hover-color, var(--lr-color-brand));
  }
  [part='option-preview']:active {
    background: ${activeFill('var(--lr-voice-picker-preview-hover-bg, var(--lr-color-brand-quiet))')};
    color: var(--lr-voice-picker-preview-hover-color, var(--lr-color-brand));
  }

  [part='hint'] {
    overflow-wrap: anywhere;
  }

  [part='error'] {
    overflow-wrap: anywhere;
  }
`;
