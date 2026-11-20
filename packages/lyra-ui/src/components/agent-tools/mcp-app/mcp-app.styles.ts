import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { containerHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${containerHost}
  }

  [part='base'] {
    position: relative;
    min-inline-size: 0;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }

  [part='frame'] {
    block-size: var(--lr-mcp-app-frame-height, var(--_lr-mcp-app-frame-height));
    display: block;
    inline-size: 100%;
    border: 0;
    background: var(--lr-color-surface);
  }

  [part='loading'],
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-m);
  }

  [part='loading'] {
    position: absolute;
    inset-block-start: 0;
    inset-inline: 0;
    pointer-events: none;
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
  }

  [part='error'] {
    color: var(--lr-color-danger);
    background: var(--lr-color-danger-quiet);
  }

  @container ${compactContainerQuery} {
    [part='loading'],
    [part='error'] {
      padding: var(--lr-space-s);
    }
  }
`;
