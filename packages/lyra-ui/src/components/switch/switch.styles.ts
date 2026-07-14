import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* Component-local geometry knobs (defined on :host so each instance can
       tune its own geometry) — a fully-rounded pill/thumb
       needs a radius well past --lyra-radius's small 0.375rem default, so
       it's expressed here rather than bent onto that shared token. */
    --lyra-switch-track-inline-size: var(--lyra-size-2-25rem);
    --lyra-switch-track-block-size: var(--lyra-size-1-25rem);
    --lyra-switch-thumb-offset: var(--lyra-size-2px);
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-s);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host(:disabled) [part='base'] {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }

  [part='track'] {
    position: relative;
    flex: 0 0 auto;
    inline-size: var(--lyra-switch-track-inline-size);
    block-size: var(--lyra-switch-track-block-size);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-border);
    transition: background-color var(--lyra-transition-fast);
  }
  :host([checked]) [part='track'] {
    background: var(--lyra-color-brand);
  }

  [part='thumb'] {
    position: absolute;
    inset-block-start: var(--lyra-switch-thumb-offset);
    inset-inline-start: var(--lyra-switch-thumb-offset);
    inline-size: calc(var(--lyra-switch-track-block-size) - (var(--lyra-switch-thumb-offset) * 2));
    block-size: calc(var(--lyra-switch-track-block-size) - (var(--lyra-switch-thumb-offset) * 2));
    border-radius: 50%;
    background: var(--lyra-color-surface);
    /* Animates the logical 'inset-inline-start' rather than a physical
       'transform: translateX()' so the slide direction mirrors correctly
       under dir="rtl" — consistent with this library's CSS-logical-
       properties approach to RTL (see internal/lyra-element.ts). */
    transition: inset-inline-start var(--lyra-transition-fast);
  }
  :host([checked]) [part='thumb'] {
    inset-inline-start: calc(
      var(--lyra-switch-track-inline-size) - var(--lyra-switch-track-block-size) +
        var(--lyra-switch-thumb-offset)
    );
  }

  /* No explicit "display" here (unlike e.g. lyra-combobox's
     [part='form-control-label']), so the UA stylesheet's default
     "[hidden] { display: none }" rule needs no author-side override to
     take effect when hasLabelSlot is false. */
  [part='label'] {
    font-size: var(--lyra-font-size-md-sm);
    color: var(--lyra-color-text);
  }

  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  /* :empty never matches here -- same fix as [part='hint']/[part='error'] on lyra-select. */
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-danger);
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
