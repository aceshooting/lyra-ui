import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-terminal-surface-color, var(--lr-color-surface-raised));
    overflow: hidden;
  }
  /* Chrome escape -- the shared frame="plain" treatment, matching lr-result-card, lr-stack-trace,
     lr-task-list and lr-thinking-panel. Streamed tool output routinely nests in a container that
     already draws a border, doubling the box. Only the outer card decoration goes: the toolbar/log
     divider stays as interior structure, as in task-list's and thinking-panel's header/body
     divider, and the toolbar buttons' own border/hover/focus never depended on it. */
  :host([frame='plain']) [part='base'] {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part='toolbar'] {
    display: flex;
    justify-content: flex-end;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-size-1px) solid var(--lr-color-border);
  }
  /* Density escape -- same convention as lr-task-list's/lr-thinking-panel's compact. Inline var()
     fallbacks, not a :host declaration every instance would re-declare and so shadow an ancestor
     value, let a transcript retune every nested terminal at once. Each fallback is one step
     tighter than the regular value, so an unset terminal renders as before. */
  :host([compact]) [part='toolbar'] {
    gap: var(--lr-terminal-compact-toolbar-gap, var(--lr-space-2xs));
    padding: var(--lr-terminal-compact-toolbar-padding, var(--lr-space-2xs) var(--lr-space-xs));
  }
  [part='copy-button'],
  [part='download-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    background: none;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    cursor: pointer;
  }
  [part='copy-button']:hover,
  [part='download-button']:hover {
    background: var(--lr-terminal-toolbar-button-hover-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed is the toolbar hover tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner, which follows the text colour -- a distinctly deeper step in both
     light and dark themes. */
  [part='copy-button']:active,
  [part='download-button']:active {
    background: var(--lr-terminal-toolbar-button-active-bg, color-mix(in oklab, var(--lr-terminal-toolbar-button-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
  }
  [part='copy-button']:focus-visible,
  [part='download-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='viewport'] {
    position: relative;
    block-size: var(--lr-terminal-height, var(--lr-size-20rem));
  }
  lr-virtual-list {
    display: block;
    block-size: 100%;
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }
  /* renderItem's content is committed inside <lr-virtual-list>'s own shadow root -- Lit renders a
     function-supplied template into whichever root is currently updating, not the defining
     module's -- so a plain [part='line'] rule here would never match. ::part() is what reaches
     that one level in; <lr-lightbox>'s lr-zoomable-frame[part='frame']::part(base) uses the same
     technique against a statically-templated child. */
  lr-virtual-list::part(line) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding-inline: var(--lr-space-s);
    line-height: var(--lr-line-height-normal);
  }
  /* Only an interactive (highlight-owning) line carries tabindex="0" -- renderLine() in
     terminal.class.ts -- so :focus-visible below needs no extra scoping. :hover cannot be scoped
     the same way: every line shares one part name and ::part() forbids a trailing attribute
     selector, so this is a plain pointer preview across all lines. Semantic aliases below
     reassert their own tone. */
  lr-virtual-list::part(line):hover {
    background: var(--lr-terminal-line-hover-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed is the line hover tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner, as for [part='copy-button']/[part='download-button'] above: a
     highlight-owning line is a real activatable target (renderLine() wires @click/@keydown), not a
     hover-only preview. */
  lr-virtual-list::part(line):active {
    background: var(--lr-terminal-line-active-bg, color-mix(in oklab, var(--lr-terminal-line-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
  }
  /* State-specific parts keep semantic highlights intact through hover/press, and give a consumer
     a semantic part to override deliberately. */
  lr-virtual-list::part(line-highlight-accent):hover {
    background: var(--lr-terminal-highlight-accent-bg, var(--lr-color-brand-quiet));
  }
  lr-virtual-list::part(line-highlight-accent):active {
    background: var(--lr-terminal-highlight-accent-bg, var(--lr-color-brand-quiet));
  }
  lr-virtual-list::part(line-highlight-success):hover {
    background: var(--lr-terminal-highlight-success-bg, var(--lr-color-success-quiet));
  }
  lr-virtual-list::part(line-highlight-success):active {
    background: var(--lr-terminal-highlight-success-bg, var(--lr-color-success-quiet));
  }
  lr-virtual-list::part(line-highlight-warning):hover {
    background: var(--lr-terminal-highlight-warning-bg, var(--lr-color-warning-quiet));
  }
  lr-virtual-list::part(line-highlight-warning):active {
    background: var(--lr-terminal-highlight-warning-bg, var(--lr-color-warning-quiet));
  }
  lr-virtual-list::part(line-highlight-danger):hover {
    background: var(--lr-terminal-highlight-danger-bg, var(--lr-color-danger-quiet));
  }
  lr-virtual-list::part(line-highlight-danger):active {
    background: var(--lr-terminal-highlight-danger-bg, var(--lr-color-danger-quiet));
  }
  lr-virtual-list::part(line-highlight-neutral):hover {
    background: var(--lr-terminal-highlight-neutral-bg, var(--lr-color-surface));
  }
  lr-virtual-list::part(line-highlight-neutral):active {
    background: var(--lr-terminal-highlight-neutral-bg, var(--lr-color-surface));
  }
  lr-virtual-list::part(line):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The log's half of the density escape above: the same one-hop ::part() selector as the base
     rule, plus the host attribute selector, so it outranks it on specificity and source order. */
  :host([compact]) lr-virtual-list::part(line) {
    padding-inline: var(--lr-terminal-compact-line-padding-inline, var(--lr-space-xs));
  }
  :host(:not([wrap])) lr-virtual-list::part(line) {
    white-space: pre;
    overflow-wrap: normal;
    inline-size: max-content;
    min-inline-size: 100%;
    box-sizing: border-box;
  }
  :host(:not([wrap])) lr-virtual-list::part(base) {
    overflow-x: auto;
  }
  [part='jump-to-latest'] {
    position: absolute;
    inset-block-end: var(--lr-space-s);
    inset-inline-end: var(--lr-space-s);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-surface);
    background: var(--lr-color-brand);
    border: none;
    border-radius: var(--lr-radius-pill);
    padding: var(--lr-space-2xs) var(--lr-space-s);
    /* Overlay step, not a card step: absolutely positioned over live scrollback, so it must read
       as a layer above the lines it covers. */
    box-shadow: var(--lr-shadow-m);
    cursor: pointer;
    z-index: var(--lr-layer-content);
    transition: opacity var(--lr-transition-fast);
  }
  /* Mixes toward --lr-color-mix-partner, which follows the text colour, rather than the
     filter: brightness() this replaces: multiplying every channel did nothing at all to a pure
     white or pure black brand colour, and a filter applies to the whole subtree, dragging the
     pill's own label along with the surface. Mixing always moves, in the direction the surface
     needs. */
  [part='jump-to-latest']:hover {
    background: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  [part='jump-to-latest']:active {
    background: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='jump-to-latest']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
