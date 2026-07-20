import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* Component-local geometry knobs (defined on :host so each instance can
       tune its own geometry) — a fully-rounded pill/thumb
       needs a radius well past --lr-radius's small 0.375rem default, so
       it's expressed here rather than bent onto that shared token. */
    --lr-switch-track-inline-size: var(--lr-size-2-25rem);
    --lr-switch-track-block-size: var(--lr-size-1-25rem);
    --lr-switch-thumb-offset: var(--lr-size-2px);
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Gives mouse users the same 'this is interactive' cue the :focus-visible ring above already
     gives keyboard users -- mirrors the generic --lr-hover-brightness lift used by
     lr-confirm-bar/lr-chat-composer's own button hovers, gated on :host(:not(:disabled)) the same
     way lr-checkbox's/lr-radio's [part='base']:hover rules are (this control isn't a native
     button, so a bare [part='base']:hover would otherwise also fire while disabled). */
  :host(:not(:disabled)) [part='base']:hover {
    filter: brightness(var(--lr-hover-brightness));
  }
  :host(:disabled) [part='base'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part='track'] {
    position: relative;
    flex: 0 0 auto;
    inline-size: var(--lr-switch-track-inline-size);
    block-size: var(--lr-switch-track-block-size);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border);
    transition: background-color var(--lr-transition-fast);
  }
  :host([checked]) [part='track'] {
    background: var(--lr-color-brand);
  }

  [part='thumb'] {
    position: absolute;
    inset-block-start: var(--lr-switch-thumb-offset);
    inset-inline-start: var(--lr-switch-thumb-offset);
    inline-size: calc(var(--lr-switch-track-block-size) - (var(--lr-switch-thumb-offset) * 2));
    block-size: calc(var(--lr-switch-track-block-size) - (var(--lr-switch-thumb-offset) * 2));
    border-radius: 50%;
    background: var(--lr-color-surface);
    /* Animates the logical 'inset-inline-start' rather than a physical
       'transform: translateX()' so the slide direction mirrors correctly
       under dir="rtl" — consistent with this library's CSS-logical-
       properties approach to RTL (see internal/lyra-element.ts). */
    transition: inset-inline-start var(--lr-transition-fast);
  }
  :host([checked]) [part='thumb'] {
    inset-inline-start: calc(
      var(--lr-switch-track-inline-size) - var(--lr-switch-track-block-size) +
        var(--lr-switch-thumb-offset)
    );
  }

  /* No explicit "display" here (unlike e.g. lr-combobox's
     [part='form-control-label']), so the UA stylesheet's default
     "[hidden] { display: none }" rule needs no author-side override to
     take effect when hasLabelSlot is false. */
  [part='label'] {
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text);
  }

  [part='hint'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches here -- same fix as [part='hint']/[part='error'] on lr-select. */
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='track'],
    [part='thumb'] {
      transition: none !important;
    }
  }
`;
