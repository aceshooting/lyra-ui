import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; }
  [part='base'] { display: inline-flex; align-items: center; min-block-size: var(--lyra-size-1-25rem); padding-inline: var(--lyra-space-s); border: var(--lyra-border-width-thin) solid var(--lyra-badge-border, var(--lyra-color-border)); border-radius: var(--lyra-radius-pill); background: var(--lyra-badge-background, var(--lyra-color-surface)); color: var(--lyra-badge-color, var(--lyra-color-text)); font-size: var(--lyra-font-size-sm); font-weight: var(--lyra-font-weight-medium); line-height: var(--lyra-line-height-compact); white-space: nowrap; }
  :host([variant='brand']) { --lyra-badge-background: var(--lyra-color-brand-quiet); --lyra-badge-color: var(--lyra-color-brand); --lyra-badge-border: var(--lyra-color-brand); }
  :host([variant='success']) { --lyra-badge-background: var(--lyra-color-success-quiet); --lyra-badge-color: var(--lyra-color-success); --lyra-badge-border: var(--lyra-color-success); }
  :host([variant='warning']) { --lyra-badge-background: var(--lyra-color-warning-quiet); --lyra-badge-color: var(--lyra-color-warning); --lyra-badge-border: var(--lyra-color-warning); }
  :host([variant='danger']) { --lyra-badge-background: var(--lyra-color-danger-quiet); --lyra-badge-color: var(--lyra-color-danger); --lyra-badge-border: var(--lyra-color-danger); }
`;
