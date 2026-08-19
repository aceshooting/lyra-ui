import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    block-size: var(--lr-audio-visualizer-height, var(--lr-size-3rem));
    --_lr-audio-visualizer-color-default: var(--lr-color-brand);
    /* --lr-color-brand-quiet (the brand-95/brand-30 fill step) reads ~1.1:1 against
       --lr-color-surface in both themes, nowhere near WCAG 1.4.11's 3:1 non-text minimum for idle
       bars that paint no other distinguishing shape or border. --lr-color-brand-border-normal
       (ramp step 60 in both light and dark) is the closest existing semantic-grid slot with enough
       contrast against the surface in both themes (~4.0:1 light, ~4.3:1 dark; see
       audio-visualizer.test.ts's "idle-state bar-fill contrast" suite) while staying quieter than
       the active/loud --lr-color-brand fill. */
    --_lr-audio-visualizer-quiet-color-default: var(--lr-color-brand-border-normal);
    --_lr-audio-visualizer-ambient-duration-default: var(--lr-duration-ambient);
  }
  [part='base'] {
    inline-size: 100%;
    block-size: 100%;
  }
  canvas {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
`;
