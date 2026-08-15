import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --_lr-page-rail-height: var(--lr-size-24rem);
  }
  [part="base"] {
    display: block;
  }
  [part="pages"] {
    --lr-virtual-list-height: var(
      --lr-page-rail-height,
      var(--_lr-page-rail-height)
    );
  }
  /* Page rows are produced by this component's renderItem but are committed into the embedded
     lr-virtual-list's OWN shadow root, one boundary deeper than this stylesheet: a bare
     [part='page'] selector can never match one, so every row-level rule reaches through
     ::part(). ::part() cannot be followed by an attribute selector either, so the state variants
     (current page, heat tone, overflow marker) each carry their own name in the element's part
     list -- ::part() matches with part~= semantics, so a row is both page and page-current. */
  lr-virtual-list::part(page) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    padding: var(--lr-space-s);
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    cursor: pointer;
    box-sizing: border-box;
  }
  lr-virtual-list::part(page):hover {
    background: var(--lr-color-surface-raised);
  }
  lr-virtual-list::part(page):active {
    background: color-mix(
      in oklab,
      var(--lr-color-surface-raised),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  lr-virtual-list::part(page):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  lr-virtual-list::part(page-current) {
    background: var(--lr-page-rail-current-bg, var(--lr-color-brand-quiet));
  }
  /* Split out from the resting rule rather than folded into its selector list: it has to match the
     specificity of the ::part(page):hover rule above and come later, or the current page reverts to
     the generic hover surface under the pointer and stops being identifiable. */
  lr-virtual-list::part(page-current):hover {
    background: var(--lr-page-rail-current-bg, var(--lr-color-brand-quiet));
  }
  lr-virtual-list::part(page-current):active {
    background: color-mix(
      in oklab,
      var(--lr-page-rail-current-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  lr-virtual-list::part(thumbnail) {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--lr-size-4rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  lr-virtual-list::part(thumbnail-target) {
    display: block;
    max-inline-size: 100%;
  }
  lr-virtual-list::part(page-number) {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  /* No inset here: the cluster is the third stacked child of the column-flex, center-aligned page
     button and is positioned entirely by that flow. An inset on a position: static box has no
     effect at all, so a trailing-edge offset declared here would be silently inert -- and giving
     it effect (position: relative) would push a deliberately centered row off-centre. */
  lr-virtual-list::part(heat) {
    display: flex;
    align-items: center;
    gap: var(--lr-space-2xs);
  }
  lr-virtual-list::part(heat-dot) {
    inline-size: var(--lr-size-6px);
    block-size: var(--lr-size-6px);
    border-radius: 50%;
    background: var(--lr-page-rail-heat-accent-color, var(--lr-color-brand));
    font-size: var(--lr-font-size-2xs);
  }
  lr-virtual-list::part(heat-dot-success) {
    background: var(--lr-page-rail-heat-success-color, var(--lr-color-success));
  }
  lr-virtual-list::part(heat-dot-warning) {
    background: var(--lr-page-rail-heat-warning-color, var(--lr-color-warning));
  }
  lr-virtual-list::part(heat-dot-danger) {
    background: var(--lr-page-rail-heat-danger-color, var(--lr-color-danger));
  }
  lr-virtual-list::part(heat-dot-neutral) {
    background: var(
      --lr-page-rail-heat-neutral-color,
      var(--lr-color-text-quiet)
    );
  }
  lr-virtual-list::part(heat-dot-overflow) {
    inline-size: auto;
    block-size: auto;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
  }
`;
