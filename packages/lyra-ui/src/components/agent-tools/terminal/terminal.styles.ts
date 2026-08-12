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
    background: var(--lr-color-surface-raised);
    overflow: hidden;
  }
  /* Chrome escape -- the shared frame="plain" treatment, same convention as lr-result-card's,
     lr-stack-trace's, lr-task-list's, and lr-thinking-panel's. Streamed tool output is routinely
     nested inside a container that already draws a border (an agent-run panel, a message bubble),
     which would otherwise double the box. Only the outer card decoration goes: the toolbar/log
     divider below is interior structure that still explains where the actions end and the log
     begins, exactly the call task-list and thinking-panel make for their own header/body divider,
     and the toolbar buttons' own border/hover/focus affordances never depended on this one. */
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
  /* Density escape -- same convention as lr-task-list's/lr-thinking-panel's compact. The tuned
     values sit behind inline var() fallbacks (rather than a :host declaration, which every
     instance would re-declare and so shadow any ancestor value) so a transcript can retune every
     nested terminal at once from outside; the fallbacks are one step tighter than the regular
     values, so an unset terminal renders exactly as before. */
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
    background: var(--lr-color-brand-quiet);
  }
  /* Pressed is the hovered tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner (which follows the text colour), so it reads as a distinctly deeper step
     than hover in both light and dark themes rather than repeating it. */
  [part='copy-button']:active,
  [part='download-button']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
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
  /* renderItem's returned content is committed inside <lr-virtual-list>'s own shadow root (Lit
     renders a function-supplied template into whichever root is currently updating, regardless of
     which module the function was defined in), so a plain [part='line'] rule here -- scoped to this
     component's own shadow root -- would never match anything. Reaching one shadow level in through
     a part attribute set by content this component doesn't itself template statically is exactly
     what ::part() is for; see <lr-lightbox>'s lr-zoomable-frame[part='frame']::part(base) rule
     for the same technique used against a statically-templated child instead of a renderItem one. */
  lr-virtual-list::part(line) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding-inline: var(--lr-space-s);
    line-height: var(--lr-line-height-normal);
  }
  /* Only an interactive (highlight-owning) line ever carries tabindex="0" -- see renderLine() in
     terminal.class.ts -- so :focus-visible below already resolves to just those lines with no
     extra scoping needed: a non-interactive line is never focusable in the first place. :hover
     can't be scoped the same way -- every line shares this one part name, and ::part() forbids a
     trailing attribute selector (see the renderItem note above), so this is a plain pointer-hover
     preview across all lines rather than an attribute-gated one. Reuses the same
     --lr-color-brand-quiet token as the toolbar buttons' own hover fill above: a toned highlight's
     background is set inline via styleMap (see lineStateStyle()'s comment in terminal.class.ts) and
     always wins specificity over this rule, so the two never visibly compete. */
  lr-virtual-list::part(line):hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Pressed is the hovered tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner, matching this file's own [part='copy-button']/[part='download-button']
     :active pattern above -- a highlight-owning line is a real activatable target (renderLine()
     wires @click/@keydown), not a passive hover-only preview. */
  lr-virtual-list::part(line):active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  lr-virtual-list::part(line):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The log's own half of the density escape above. Reached through the same one-hop ::part()
     selector as the base rule (the lines live in lr-virtual-list's shadow root), and carrying the
     host attribute selector, so it outranks that rule on both specificity and source order. */
  :host([compact]) lr-virtual-list::part(line) {
    padding-inline: var(--lr-terminal-compact-line-padding-inline, var(--lr-space-xs));
  }
  :host(:not([wrap])) lr-virtual-list::part(line) {
    white-space: pre;
    overflow-wrap: normal;
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
    /* Overlay step, not a card step: this pill is absolutely positioned over live scrollback rather
       than resting in the layout, so it has to read as a layer above the lines it covers. */
    box-shadow: var(--lr-shadow-m);
    cursor: pointer;
    z-index: var(--lr-layer-content);
    transition: opacity var(--lr-transition-fast);
  }
  /* Mixed toward --lr-color-mix-partner (which follows the text colour) rather than the
     filter: brightness() this replaces: a filter multiplies every channel, so it lightened this
     brand-filled pill only by luck, did nothing at all to a pure white or pure black brand colour,
     and -- because a filter applies to the whole subtree -- dragged the pill's own label along with
     the surface. Mixing always moves, and always in the direction the surface needs. */
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
