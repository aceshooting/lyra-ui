import type { ApprovalDecision } from '../components/agent-tools/approval-state.js';
import type { LyraConfirmBar } from '../components/agent-tools/confirm-bar/confirm-bar.class.js';
import type { LyraToolApprovalDialog } from '../components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
import type { LyraButton } from '../components/forms/button/button.class.js';
import type { LyraCombobox } from '../components/forms/combobox/combobox.class.js';
import type { LyraLocalePicker } from '../components/forms/locale-picker/locale-picker.class.js';
import type { LyraSelect } from '../components/forms/select/select.class.js';
import type { LyraSwitch } from '../components/forms/switch/switch.class.js';
import type { LyraModelSelect } from '../components/conversation/model-select/model-select.class.js';
import type { LyraVoicePicker } from '../components/conversation/voice-picker/voice-picker.class.js';
import type { LyraStepper } from '../components/layout/stepper/stepper.class.js';

/**
 * A small, typed set of interaction drivers that go through one `lr-*` component's own real
 * activation path -- the same shadow-part lookup and `.click()` the component's own tests use --
 * instead of a downstream suite reverse-engineering internal detail shapes or shadow-part
 * selectors itself. Each driver awaits `updateComplete` before returning, so assertions written
 * immediately after it see fully-settled DOM/state. Every driver throws a plain `Error` (not a
 * localized, user-facing one) when the requested interaction cannot actually happen -- disabled,
 * read-only, or the target row/step is not currently rendered -- rather than silently doing
 * nothing, which is the exact class of mistake {@link chooseOption}, {@link toggleSwitch},
 * {@link submitConfirmDecision} and {@link activateStep} exist to prevent.
 *
 * Pure DOM operations only (`Element.click()`, shadow-part queries, public properties) -- no
 * `@web/test-runner`/CDP-only helper such as `sendMouse`, so these also run under a downstream
 * suite's own happy-dom/jsdom environment, not only a real browser.
 *
 * Scope: one driver per interaction named in the request this closes (choosing an option,
 * submitting a confirm-bar decision, toggling a switch, activating a stepper step). Not a general
 * "drive any component" toolkit -- render the real component and interact with it directly for
 * anything else.
 */

/**
 * A `LyraElement` that opens an option listbox in its own shadow root and renders each option as
 * a `[part="option"]` row carrying `data-value`, delegating a click on that row back to its own
 * selection logic -- the exact shape `<lr-combobox>`, `<lr-select>`, `<lr-model-select>`,
 * `<lr-locale-picker>` and `<lr-voice-picker>` all independently implement the same way (each
 * one's own source comments say so: "mirroring lr-select/lr-combobox"; `<lr-model-select>` and
 * `<lr-voice-picker>` share the same behavior through the shared `CatalogPickerController`'s
 * `handleListboxClick`).
 */
type LyraOptionListElement =
  | LyraCombobox
  | LyraSelect
  | LyraModelSelect
  | LyraLocalePicker
  | LyraVoicePicker;

/**
 * Opens `owner`'s listbox/popup (if not already open) and clicks the rendered `[part="option"]`
 * row whose `data-value` matches `value` -- the same delegated click each of
 * `<lr-combobox>`/`<lr-select>`/`<lr-model-select>`/`<lr-locale-picker>`/`<lr-voice-picker>`
 * listens for on its own listbox, so this exercises the real component's own selection path
 * (including whatever native `input`/`change`/`lr-change` sequence that component emits) rather
 * than writing `.value` directly.
 *
 * Matches by comparing `dataset['value']` in script rather than interpolating `value` into a CSS
 * attribute selector, so a value containing a quote or other selector-special character is still
 * matched correctly.
 *
 * Only ever sees rows `owner` has already rendered: a `<lr-combobox>`/`<lr-select>` using
 * `source`/`asyncRows` may need its own query to resolve (e.g. by awaiting the same `source`
 * promise a test already awaits) before the option this driver looks for exists in the DOM.
 *
 * @throws {Error} if `owner` is disabled, or no rendered option currently carries `value`.
 */
export async function chooseOption(
  owner: LyraOptionListElement,
  value: string,
): Promise<void> {
  if (owner.effectiveDisabled) {
    throw new Error('chooseOption(): the control is disabled and will not open.');
  }
  owner.open = true;
  await owner.updateComplete;
  const rows = owner.renderRoot?.querySelectorAll<HTMLElement>('[part="option"]');
  const row = rows ? Array.from(rows).find((candidate) => candidate.dataset['value'] === value) : undefined;
  if (!row) {
    throw new Error(`chooseOption(): no rendered option has value ${JSON.stringify(value)}.`);
  }
  row.click();
  await owner.updateComplete;
}

/**
 * Clicks `owner`'s own internal `[part="approve-button"]` (for `'approved'`) or
 * `[part="deny-button"]` (for `'denied'`) -- the same `<lr-button>` a real reviewer presses --
 * which runs the real component's own decision logic and its full `lr-approve`/`lr-deny`
 * sequence, instead of dispatching a hand-built event at the host.
 *
 * `<lr-confirm-bar>` and `<lr-tool-approval-dialog>` both render this exact pair of parts for the
 * same `lr-approve`/`lr-deny` contract (each one's own class doc says so), so this accepts either.
 *
 * @throws {Error} if the requested button is not currently rendered, or is disabled/loading (the
 *   bar/dialog itself is disabled, already decided, or that action is loading/pending the other
 *   one's decision).
 */
export async function submitConfirmDecision(
  owner: LyraConfirmBar | LyraToolApprovalDialog,
  decision: ApprovalDecision,
): Promise<void> {
  const part = decision === 'approved' ? 'approve-button' : 'deny-button';
  const button = owner.renderRoot?.querySelector<LyraButton>(`[part="${part}"]`);
  if (!button) {
    throw new Error(
      `submitConfirmDecision(): [part="${part}"] is not currently rendered (already decided, ` +
        'or not currently open).',
    );
  }
  if (button.effectiveDisabled || button.loading) {
    throw new Error(
      `submitConfirmDecision(): [part="${part}"] is disabled or loading and will not respond ` +
        'to click().',
    );
  }
  button.click();
  await owner.updateComplete;
}

/**
 * Calls `switchEl.click()` -- `<lr-switch>`'s own documented programmatic activation path, which
 * it forwards onto its internal `role="switch"` control -- toggling `checked` through the same
 * `lr-switch-toggle-request` -> `input`/`lr-input`/`change`/`lr-change` sequence a real pointer
 * click runs, rather than assigning `.checked` directly (which fires none of those events).
 *
 * @throws {Error} if `switchEl` is disabled, directly or through an ancestor `<fieldset disabled>`.
 */
export async function toggleSwitch(switchEl: LyraSwitch): Promise<void> {
  if (switchEl.effectiveDisabled) {
    throw new Error('toggleSwitch(): the switch is disabled and will not respond to click().');
  }
  switchEl.click();
  await switchEl.updateComplete;
}

/**
 * Clicks the rendered `[part="step"]` button at the given step's index -- the same element
 * `selectStep()`'s own `@click` binding listens on -- so a non-`disabled` step fires a real
 * `lr-step-select` with that step's `stepId`/index, instead of dispatching a hand-built event at
 * the host.
 *
 * `target` is either a zero-based index into `stepper.steps`, or a `stepId` to look up (the first
 * matching occurrence, disambiguated by index the same way `lr-step-select`'s own detail is).
 *
 * @throws {Error} if `stepper` is read-only, `target` does not resolve to a step, or that step is
 *   `disabled`.
 */
export async function activateStep(
  stepper: LyraStepper,
  target: number | string,
): Promise<void> {
  if (stepper.readonly) {
    throw new Error('activateStep(): the stepper is read-only; its steps are not interactive.');
  }
  const index = typeof target === 'number' ? target : stepper.steps.findIndex((step) => step.stepId === target);
  const step = index >= 0 ? stepper.steps[index] : undefined;
  if (!step) {
    throw new Error(`activateStep(): no step matches ${JSON.stringify(target)}.`);
  }
  if (step.disabled) {
    throw new Error(`activateStep(): step ${JSON.stringify(target)} is disabled.`);
  }
  const button = stepper.renderRoot?.querySelector<HTMLElement & { click(): void }>(
    `[part="step"][data-index="${index}"]`,
  );
  if (!button) {
    throw new Error(`activateStep(): step ${JSON.stringify(target)} is not currently rendered.`);
  }
  button.click();
  await stepper.updateComplete;
}
