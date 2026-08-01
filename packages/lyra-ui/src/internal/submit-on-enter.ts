/**
 * Implicit form submission on Enter, for a control whose real editing surface is a native
 * `<input>` living inside a shadow root.
 *
 * A native `<input>` submits its form owner when the user presses Enter. The inputs these
 * components render have no form owner at all — they are in a shadow tree, and only the *host*
 * custom element participates in the light-DOM `<form>` — so the platform can never run implicit
 * submission for them. Without this, Enter in a text control inside a `<form>` silently does
 * nothing, which reads as a broken form.
 *
 * The rules below are the platform's, not an approximation of them:
 *
 * - **Modifiers disqualify the keystroke.** `Ctrl`/`Cmd`/`Alt`/`Shift`+Enter is an application
 *   shortcut (send-and-keep-open, insert-newline, open-in-new-tab), never implicit submission.
 * - **An IME composition Enter is not a submit.** Enter commits the highlighted candidate in
 *   Japanese/Chinese/Korean input; submitting the form there throws away the word the user was
 *   typing. `keyCode === 229` is the defense-in-depth fallback for engines that report
 *   `isComposing` inconsistently on the `compositionend`-adjacent keydown.
 * - **A vetoed keydown stays vetoed.** A listener above this one (an autocomplete panel committing
 *   a selection, a consumer's own shortcut) already claimed the keystroke.
 * - **The submitter is resolved, not skipped.** The form's *default button* is the first enabled
 *   submit control in `form.elements`; a submission that ignores it loses `SubmitEvent.submitter`,
 *   and with it the button's own `name`/`value` entry and its `formaction`/`formmethod`/
 *   `formnovalidate` overrides. A native submitter goes through `form.requestSubmit(submitter)`;
 *   an `<lr-button>`/`<lr-icon-button>` is a form-associated custom element rather than a native
 *   submit button, so `requestSubmit()` rejects it with a `TypeError` — it is activated through its
 *   own `click()`, which runs the same submit path a real click would.
 * - **A submit-button-less form submits only from a single field.** The platform refuses implicit
 *   submission when a form with no default button holds more than one field that blocks it.
 *
 * `requestSubmit()` (never `submit()`) is what runs interactive constraint validation, so an
 * invalid field blocks the submission exactly as a real submit button would.
 *
 * **Not wired everywhere on purpose.** Enter carries a different meaning in several controls, and
 * implicit submission must never shadow it:
 * - `<lr-textarea>` and `<lr-code-editor>` — Enter inserts a newline, the whole point of a
 *   multi-line surface.
 * - `<lr-select>` — its trigger is a `role="combobox"` button where Enter opens the listbox (and,
 *   once open, commits the active option), per the ARIA combobox pattern its upstream counterpart
 *   follows.
 * - `<lr-date-picker>` — Enter selects the focused day in the calendar grid.
 * Callers also gate on their own `disabled`/`readonly` state before calling in, so a
 * non-interactive control stays inert.
 */

/** Options for {@linkcode submitOnEnter}. */
export interface SubmitOnEnterOptions {
  /**
   * Runs immediately before the form is submitted, and only when a submission actually happens.
   * The hook a control uses to commit whatever it holds in transient, not-yet-published state
   * (typed-but-unparsed text, a pending `change`) so the submitted form value is what the user
   * sees rather than what they last committed.
   */
  beforeSubmit?: () => void;
}

/**
 * Native `<input>` `type`s the HTML Standard calls "fields that block implicit submission" — the
 * single-line text-entry types. A form with no default button submits implicitly only when at most
 * one of them is present.
 */
const BLOCKING_INPUT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
  'number',
]);

/** `type` values that mark a custom element as a button rather than a field. */
const BUTTON_TYPES: ReadonlySet<string> = new Set(['button', 'submit', 'reset']);

function customElementType(element: Element): string | undefined {
  const value = (element as { type?: unknown }).type;
  return typeof value === 'string' ? value : undefined;
}

/** Whether `element` is inert — its own `disabled`, or an ancestor `<fieldset disabled>`'s cascade
 *  (which only `:disabled` tracks; a `[disabled]` attribute check misses it entirely). */
function isInert(element: Element): boolean {
  if ((element as { disabled?: unknown }).disabled === true) return true;
  try {
    return element.matches(':disabled');
  } catch {
    // A DOM implementation without the `:disabled` pseudo-class: the property check above stands.
    return false;
  }
}

/** Whether `element` is a submit control — native or a `type="submit"` custom element. */
function isSubmitControl(element: Element): boolean {
  if (element instanceof HTMLButtonElement) return element.type === 'submit';
  if (element instanceof HTMLInputElement) return element.type === 'submit' || element.type === 'image';
  return element.localName.includes('-') && customElementType(element) === 'submit';
}

/**
 * Whether `element` counts against the platform's "more than one field blocks implicit submission"
 * rule. Native inputs use the spec's own type list. A custom element counts unless it declares
 * itself a button (`type="button"`/`"submit"`/`"reset"`, the vocabulary `<lr-button>`/
 * `<lr-icon-button>` use) — deliberately conservative, since a wrongly-*permissive* answer submits
 * a form the platform would have left alone, while a wrongly-restrictive one only leaves Enter
 * doing what it already does today.
 */
function blocksImplicitSubmission(element: Element): boolean {
  if (element instanceof HTMLInputElement) return BLOCKING_INPUT_TYPES.has(element.type);
  if (!element.localName.includes('-')) return false;
  const type = customElementType(element);
  return type === undefined || !BUTTON_TYPES.has(type);
}

/**
 * Whether `event` is the platform's implicit-submission keystroke: a bare Enter, un-vetoed, and
 * outside an IME composition. Exported so a control that has its own work to do on that same
 * keystroke (committing typed text before the value is read) can apply one identical gate.
 */
export function isImplicitSubmission(event: KeyboardEvent): boolean {
  if (event.key !== 'Enter') return false;
  if (event.defaultPrevented) return false;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  if (event.isComposing || event.keyCode === 229) return false;
  return true;
}

/**
 * The form's default button: the first enabled submit control in `form.elements` (tree order),
 * native or custom. `null` when the form has none.
 */
export function findImplicitSubmitter(form: HTMLFormElement): HTMLElement | null {
  for (const element of Array.from(form.elements)) {
    if (!isSubmitControl(element)) continue;
    if (isInert(element)) continue;
    return element as HTMLElement;
  }
  return null;
}

/**
 * Performs the implicit form submission a native `<input>` would perform for this keystroke.
 *
 * Returns `true` when a submission was actually requested, so a caller can branch on it (and so a
 * test can assert the decision rather than only its side effect). Does not call
 * `event.preventDefault()`: the keystroke has no default action to cancel here — the internal
 * input has no form owner — and cancelling it would suppress unrelated handlers downstream.
 *
 * @param host The form-associated custom element, i.e. the thing that actually sits in the `<form>`
 *   — not the shadow-internal `<input>`, which has no form owner to search from.
 */
export function submitOnEnter(
  host: HTMLElement,
  event: KeyboardEvent,
  options: SubmitOnEnterOptions = {},
): boolean {
  if (!isImplicitSubmission(event)) return false;
  const form = host.closest('form');
  if (!form) return false;

  const submitter = findImplicitSubmitter(form);
  if (!submitter) {
    const blocking = Array.from(form.elements).filter(blocksImplicitSubmission);
    if (blocking.length > 1) return false;
  }

  options.beforeSubmit?.();
  if (!submitter) {
    form.requestSubmit();
  } else if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
    form.requestSubmit(submitter);
  } else {
    // A form-associated custom element is never a legal `requestSubmit()` submitter (the platform
    // throws a TypeError for one); its own `click()` runs the submit path a real click would.
    submitter.click();
  }
  return true;
}
