import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    --lyra-avatar-size: var(--lyra-size-2rem);
    --lyra-avatar-bg: var(--lyra-color-border);
    --lyra-avatar-color: var(--lyra-color-text);
  }
  :host([size='sm']) {
    --lyra-avatar-size: var(--lyra-size-1-5rem);
  }
  :host([size='lg']) {
    --lyra-avatar-size: var(--lyra-size-2-5rem);
  }
  :host([tone='brand']) {
    --lyra-avatar-bg: var(--lyra-color-brand-quiet);
    --lyra-avatar-color: var(--lyra-color-brand);
  }
  :host([tone='success']) {
    --lyra-avatar-bg: var(--lyra-color-success-quiet);
    --lyra-avatar-color: var(--lyra-color-success);
  }
  :host([tone='warning']) {
    --lyra-avatar-bg: var(--lyra-color-warning-quiet);
    --lyra-avatar-color: var(--lyra-color-warning);
  }
  :host([tone='danger']) {
    --lyra-avatar-bg: var(--lyra-color-danger-quiet);
    --lyra-avatar-color: var(--lyra-color-danger);
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-avatar-size);
    block-size: var(--lyra-avatar-size);
    overflow: hidden;
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-avatar-bg);
    color: var(--lyra-avatar-color);
    font-size: var(--lyra-font-size-sm);
    font-weight: var(--lyra-font-weight-semibold);
    flex: 0 0 auto;
  }
  :host([shape='square']) [part='base'] {
    border-radius: var(--lyra-radius);
  }
  [part='icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  [part='icon'] ::slotted(svg) {
    display: block;
  }
  /* The native [hidden] UA rule alone would lose to [part='icon']'s own
     'display: inline-flex' above at equal specificity -- same fix
     lyra-chip's/lyra-stat's identical [part='icon'][hidden] already applies. */
  [part='icon'][hidden] {
    display: none;
  }
  [part='image'] {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
`;
