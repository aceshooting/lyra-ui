import { css, unsafeCSS, type CSSResult } from 'lit';

/**
 * The size ladder shared by every dropzone surface (the lr-file-input field and the lr-drop-zone
 * overlay), so a tier retune moves both together. Sets three private host properties that each
 * component reads behind its own public token: `--_lr-dropzone-font-size`,
 * `--_lr-dropzone-icon-size` and `--_lr-dropzone-padding`.
 */
export const dropzoneSizeLadder = css`
  :host {
    --_lr-dropzone-font-size: var(--lr-font-size-md-sm);
    --_lr-dropzone-icon-size: var(--lr-font-size-xl);
    --_lr-dropzone-padding: var(--lr-space-l);
  }
  :host([size='2xs']),
  :host([size='xs']) {
    --_lr-dropzone-font-size: var(--lr-font-size-xs);
    --_lr-dropzone-icon-size: var(--lr-font-size-md-sm);
    --_lr-dropzone-padding: var(--lr-space-s);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-dropzone-font-size: var(--lr-font-size-sm);
    --_lr-dropzone-icon-size: var(--lr-font-size-lg);
    --_lr-dropzone-padding: var(--lr-space-m);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-dropzone-font-size: var(--lr-font-size-lg);
    --_lr-dropzone-icon-size: var(--lr-font-size-2xl);
    --_lr-dropzone-padding: var(--lr-space-2xl);
  }
  :host([size='xl']) {
    --_lr-dropzone-font-size: var(--lr-font-size-xl);
    --_lr-dropzone-icon-size: var(--lr-font-size-3xl);
    --_lr-dropzone-padding: var(--lr-space-2xl);
  }
`;

/**
 * Forced-colors drag verdict for a dropzone surface: the mode replaces the success and danger
 * border colours, so an accepted drag draws a doubled Highlight edge and a rejected one a dotted
 * CanvasText edge. `surface` is the selector of the element that carries `data-drag-state`.
 */
export function dropzoneVerdictForcedColors(surface: string): CSSResult {
  const target = unsafeCSS(surface);
  return css`
    @media (forced-colors: active) {
      ${target}[data-drag-state='accept'] {
        border-color: Highlight;
        border-style: double;
        outline: var(--lr-border-width-thin) solid Highlight;
        outline-offset: calc(-1 * var(--lr-border-width-medium));
      }
      ${target}[data-drag-state='reject'] {
        border-color: CanvasText;
        border-style: dotted;
        outline: var(--lr-border-width-medium) double CanvasText;
        outline-offset: calc(-1 * var(--lr-border-width-medium));
      }
    }
  `;
}
