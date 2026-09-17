import { css } from 'lit';
import { srOnly } from '../../../internal/a11y.js';

export const styles = css`
  ${srOnly}
  :host {
    display: block;
    /* Query container, so the label-auto rule at the end of this sheet reacts to the bar's own
       allocated width rather than the viewport's -- a filter bar is as likely to sit in a narrow
       side panel or a dialog as across a full page. Deliberately unnamed: see that rule's own note
       on why a container-name cannot be used here. */
    container-type: inline-size;
    /* inline-size containment removes content-based intrinsic sizing, so without this fallback the
       bar collapses to a sliver in any shrink-to-fit context (display: grid; place-items: center) --
       the same pairing lr-confirm-bar, lr-mcp-app and lr-prompt-studio declare. */
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='controls'] {
    display: flex;
    flex-wrap: wrap;
    /* end, not center/stretch: every composed control (lr-select, lr-combobox, lr-date-input,
       lr-input) draws its own label above its own field, so aligning on the field row keeps the
       label-less reset button flush with them. */
    align-items: flex-end;
    gap: var(--lr-filter-bar-gap, var(--lr-space-s));
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* [part~=], not [part=]: the field wrapper's part attribute is now a token list ("field
     field-<filterId>"), matching how the exported ::part(field) selector itself matches -- one
     token in the list, not the whole attribute value. */
  [part~='field'] {
    flex: 1 1 var(--lr-filter-bar-field-basis, var(--lr-size-12rem));
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='end'] {
    flex: 0 0 auto;
  }
  [part='filter-control'] {
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* The checkbox-menu branch is the one built-in filter whose composed control (lr-dropdown)
     brings no label/error chrome of its own, so this wrapper stacks the trigger and the revealed
     required error the way every other branch's own control already does internally. */
  .checkbox-menu {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* lr-dropdown's own trigger wrapper is display: inline-block, the right default for an overlay
     hung off an inline control. A filter field is not one: shrink-to-fit lets the trigger resolve
     to the button's max-content width and overflow the field wrapper (measured: a 192px field with
     an 899px trigger) instead of truncating inside it, and it is also the box the button's
     inline-size: 100% below resolves against. Blocking it out is what puts the trigger back inside
     the field and gives the ellipsis rules further down something to act on. */
  .checkbox-menu lr-dropdown::part(trigger) {
    display: block;
    min-inline-size: 0;
  }
  /* The trigger. Sized on the lr-button HOST, while the field-frame part name is forwarded off its
     internal base instead (see CHECKBOX_MENU_TRIGGER_EXPORT_PARTS): the host is inline-block and
     paints no chrome of its own, so a part name on it would be silently inert. This branch renders
     exactly one lr-button inside .checkbox-menu -- the trigger. */
  .checkbox-menu lr-button {
    inline-size: 100%;
    min-inline-size: 0;
  }
  /* lr-button's own gap sits BETWEEN its start/label/end wrappers, not inside the label wrapper --
     and this trigger slots two runs into that one wrapper (the field label and the selection
     summary), which would otherwise butt together with no separation at all ("TeamsCore and
     Design"). Laying the wrapper out as a flex row supplies the separation and, just as
     importantly, blockifies both runs: overflow, text-overflow and min-inline-size are all ignored
     on a non-replaced INLINE box, so the truncation rule below only takes effect once they are
     flex items. */
  .checkbox-menu lr-button::part(label) {
    display: flex;
    align-items: baseline;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  /* Both runs ellipsis-truncate rather than overflow: the label wrapper they sit in clips
     (overflow: hidden), and a hard clip mid-word reads as a rendering fault where an ellipsis reads
     as "there is more". The screen-reader-only label run is out of flow, so it is unaffected. */
  .checkbox-menu [part='filter-control-label'],
  .checkbox-menu [part='filter-control-input'] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .checkbox-menu [part='filter-control-error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  .validation-spacer {
    display: block;
    block-size: var(--lr-size-1-5rem);
  }
  .validation-spacer[hidden] {
    display: none;
  }
  .reset-field {
    flex: 0 0 auto;
  }
  [part='status'] {
    flex: 0 0 auto;
  }
  [part='active-filters'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='chips'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    inline-size: 100%;
  }
  [part='chip'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* lr-chip has no disabled property to bind ?disabled to, unlike the other composed controls
     here; render() drops its \`removable\` affordance while the bar is disabled, so nothing
     clickable is left to gate and this only adds the dimmed treatment every other disabled
     sub-control gets. Shared library-wide disabled-state token -- see
     lr-checkbox/lr-select/lr-menu-item. */
  :host([disabled]) [part='chip'] {
    opacity: var(--lr-opacity-disabled);
  }
  /* labelVisibility: 'auto'. Below this allocation a filter marked data-label-auto keeps its label
     in the DOM -- and therefore keeps naming its control -- while the text itself is clipped away,
     reclaiming the stacked label row for a narrow panel, dialog or split pane.

     Three structural notes:

     - The query is UNNAMED, and must stay that way. Every element it targets sits behind at least
       one shadow boundary relative to this stylesheet: the ::part arm reaches into the composed
       control's own shadow root, and the checkbox-menu arm's label span is slotted into the
       composed lr-button, so its flat-tree parent is a slot inside THAT shadow root. Safari/WebKit
       resolves an unnamed query container across those boundaries correctly but fails to find a
       NAMED one, so a container-name here silently no-ops the whole feature on one engine while
       Chromium and Firefox stay green (measured on all three: named clips a same-root target
       everywhere, and a cross-boundary target only in Chromium and Firefox). The cost of dropping
       the name is that the query binds to the nearest ancestor query container, so no composed
       control between the bar and its label may become one; the wide-allocation test is the guard,
       since each field is far narrower than the threshold and would clip immediately.

     - The geometry below is the same hairline-box + inset(50%) clip the shared .sr-only class uses
       (internal/a11y.ts's srOnly, already composed into this component's own styles). It is
       re-typed here rather than reused because neither reuse path exists: a container query cannot
       toggle a class, and for every filter type except 'checkbox-menu' the label element lives in
       the COMPOSED control's shadow root, where an unscoped .sr-only rule of this component's
       never applies. The ::part arm is what reaches it, and an outer ::part rule beats the inner
       tree's own normal declarations regardless of specificity.

     - The threshold is a literal, uniquely among this component's themeable values. A container
       query's prelude is an at-rule prelude, where var() is never substituted -- a
       @container (max-inline-size: var(--token)) rule parses and then silently never matches, which
       is precisely the class of inert CSS that is invisible to every gate. So the value stays where
       it can be read, in rem, matching every other container query in this library. */
  @container (max-inline-size: 30rem) {
    [data-label-auto]::part(form-control-label),
    [data-label-auto] [part='filter-control-label'] {
      position: absolute;
      inline-size: var(--lr-size-1px);
      block-size: var(--lr-size-1px);
      padding: 0;
      margin-inline: calc(-1 * var(--lr-size-1px));
      margin-block: calc(-1 * var(--lr-size-1px));
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
  }
`;
