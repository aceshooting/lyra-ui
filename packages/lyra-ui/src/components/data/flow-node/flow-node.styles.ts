import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: var(--lr-space-xs);
  }
  [hidden] {
    display: none !important;
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
  }
  .handles {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    inline-size: var(--lr-space-l);
    flex: 0 0 auto;
  }
  :host([orientation='vertical']) .handles {
    flex-direction: row;
    inline-size: auto;
    block-size: var(--lr-space-l);
  }
  .handle {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border-strong);
    flex: 0 0 auto;
  }
  .card {
    flex: 1 1 auto;
    /* The single source of the card's minimum width -- a second min-inline-size later in this rule
       would win outright and make --lr-flow-node-min-inline-size dead, as a stray
       "min-inline-size: 0" here once did. The host caps at max-inline-size: 100%, so a narrow
       allocation still wraps rather than overflowing. */
    min-inline-size: var(--lr-flow-node-min-inline-size, calc(var(--lr-size-10rem) + var(--lr-size-1rem)));
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    /* Resting chrome: the card step s rather than xs -- a node card must separate from a
       patterned/gridded canvas background, not a flat panel. */
    box-shadow: var(--lr-shadow-s);
  }
  /* Density escape -- same convention as lr-source-card's compact. Inline var() fallbacks rather
     than a :host declaration (which every instance re-declares, shadowing any ancestor value), so
     a canvas or palette can retune every card from outside; the fallbacks are the pre-existing
     values scaled down one step, leaving an unset card unchanged.

     BEFORE the :host([selected]) and :host([status='running']) rules below -- all three are
     :host([x]) .card, so source order decides. Nothing collides today (they carry border-color and
     the run-state ring, this one only padding/gap), but state last stops a future border/shadow
     tweak here winning over selection or run state. */
  :host([compact]) .card {
    padding: var(--lr-flow-node-compact-padding, var(--lr-space-xs));
    gap: var(--lr-flow-node-compact-gap, var(--lr-space-2xs));
  }
  :host([selected]) .card {
    outline: var(--lr-size-2px) solid
      var(--lr-flow-node-selected-outline-color, var(--lr-color-brand));
    outline-offset: var(--lr-size-2px);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part='heading'] {
    font-weight: var(--lr-font-weight-medium);
    overflow-wrap: anywhere;
  }
  [part='status'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  .status-dot {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-flow-status-color, var(--lr-color-border-strong));
    flex: 0 0 auto;
  }
  [part='status'][data-status='pending'] .status-dot {
    background: var(--lr-flow-status-pending-color, var(--lr-color-border-strong));
  }
  [part='status'][data-status='running'] .status-dot {
    background: var(--lr-flow-status-running-color, var(--lr-color-brand));
  }
  [part='status'][data-status='success'] .status-dot {
    background: var(--lr-flow-status-success-color, var(--lr-color-success));
  }
  [part='status'][data-status='error'] .status-dot {
    background: var(--lr-flow-status-error-color, var(--lr-color-danger));
  }
  [part='status'][data-status='denied'] .status-dot {
    background: var(--lr-flow-status-denied-color, var(--lr-color-warning));
  }
  [part='progress'] {
    inline-size: 100%;
    block-size: var(--lr-size-2px);
    background: var(--lr-flow-node-progress-track-color, var(--lr-color-border));
    border-radius: var(--lr-radius-pill);
    overflow: hidden;
  }
  .progress-fill {
    block-size: 100%;
    background: var(--lr-flow-node-progress-fill-color, var(--lr-color-brand));
  }
  [part='toolbar'] {
    display: flex;
    gap: var(--lr-space-2xs);
    justify-content: flex-end;
    opacity: 0;
  }
  /* no-pressed-state: the toolbar is not a target -- it is the container for the node's own
     slotted action buttons, revealed by hovering/focusing the CARD. Pressing it means pressing one
     of those buttons, each with its own pressed state; a treatment on the container would fire for
     all of them and say nothing about which. */
  :host(:hover) [part='toolbar'],
  :host(:focus-within) [part='toolbar'] {
    opacity: 1;
  }
  .card[data-pulse] {
    animation: lr-flow-node-pulse var(--lr-duration-ambient) var(--lr-easing-emphasized) infinite;
  }
  :host([status='running']) .card {
    border-color: var(--lr-flow-node-running-border, var(--lr-color-brand));
    box-shadow: 0 0 0 var(--lr-size-2px) var(--lr-flow-node-running-glow, var(--lr-color-brand-quiet));
  }
  /* The JS gate evaluates the preference only at render time; this branch also covers a change
     while an already-rendered card is still pulsing. */
  @media (prefers-reduced-motion: reduce) {
    .card[data-pulse] {
      animation: none;
    }
  }
  @keyframes lr-flow-node-pulse {
    50% {
      box-shadow: 0 0 0 var(--lr-size-4px) var(--lr-flow-node-running-glow, var(--lr-color-brand-quiet));
    }
  }
`;
