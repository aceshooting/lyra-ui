import { css } from 'lit';

/**
 * The shared pointer-interaction transition, as an opt-in stylesheet.
 *
 * Compose it the way the size ladder is composed — values from one place, declared at each point of
 * use:
 *
 * ```ts
 * static override styles = [LyraElement.styles, interactiveTransition, styles];
 * ```
 *
 * Every parted element in the adopting component's shadow root then eases its fill, text and border
 * colour instead of snapping between them, and a rule that wants something different simply says
 * so: the selector is wrapped in `:where()`, so it carries zero specificity and ANY of the
 * component's own rules — including a bare `[part='base']` — outranks it. That is the whole reason
 * it is safe to apply this broadly rather than part by part.
 *
 * Two questions this sheet answers deliberately:
 *
 * - **Why `[part]` and not `*`?** A part is the library's own marker for "a surface a consumer can
 *   see and style". Unnamed internal nodes are implementation detail — a spacer, a measuring box, a
 *   sizing shim — and quietly attaching motion to all of them turns every future refactor into a
 *   possible animation change. `[part]` is also exactly the scope the interaction-state gate
 *   reasons about, so what this sheet covers and what that gate demands are the same set.
 * - **Why not a per-part list?** Part names are per-component; a shared sheet cannot know them, and
 *   inventing a naming convention to make one possible would be a second public vocabulary nobody
 *   asked for. The custom property is the shared thing; this sheet is only the shortcut that
 *   applies it without each component re-typing the declaration.
 *
 * The VALUE lives with the rest of the motion scale, in `tokens.styles.ts`, not here — it is a
 * token, readable and overridable by consumers like any other, and being derived there from
 * `--lr-transition-fast` is what makes the reduced-motion collapse reach it with no extra block.
 * A component that only needs the transition on one or two parts should skip this sheet entirely
 * and write `transition: var(--lr-interactive-transition);` on those rules; that spelling is the
 * canonical one and the one the interaction-state gate names in its findings.
 */
export const interactiveTransition = css`
  :where([part]) {
    transition: var(--lr-interactive-transition);
  }
`;
