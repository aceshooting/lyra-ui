import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import '../components/forms/combobox/combobox.js';
import '../components/forms/select/select.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';
import '../components/forms/switch/switch.js';
import '../components/agent-tools/confirm-bar/confirm-bar.js';
import '../components/agent-tools/tool-approval-dialog/tool-approval-dialog.js';
import '../components/layout/stepper/stepper.js';
import type { LyraCombobox } from '../components/forms/combobox/combobox.js';
import type { LyraSelect } from '../components/forms/select/select.js';
import type { LyraLocalePicker } from '../components/forms/locale-picker/locale-picker.js';
import type { LyraModelSelect } from '../components/conversation/model-select/model-select.js';
import type { LyraVoicePicker } from '../components/conversation/voice-picker/voice-picker.js';
import type { LyraSwitch } from '../components/forms/switch/switch.js';
import type { LyraConfirmBar } from '../components/agent-tools/confirm-bar/confirm-bar.js';
import type { LyraToolApprovalDialog } from '../components/agent-tools/tool-approval-dialog/tool-approval-dialog.js';
import type { LyraStepper } from '../components/layout/stepper/stepper.js';
import {
  activateStep,
  chooseOption,
  submitConfirmDecision,
  toggleSwitch,
} from './interaction-drivers.js';

const comboboxFixture = () => html`
  <lr-combobox>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-combobox>
`;

const stepperSteps = () => [
  { stepId: 'basics', label: 'Basics', state: 'completed' as const },
  { stepId: 'inputs', label: 'Inputs', state: 'current' as const },
  { stepId: 'review', label: 'Review', state: 'pending' as const, disabled: true },
];

describe('chooseOption', () => {
  it("opens the listbox and clicks the real option row, firing the component's own change event (lr-combobox)", async () => {
    const el = (await fixture(comboboxFixture())) as LyraCombobox;
    const changed = oneEvent(el, 'lr-change');

    await chooseOption(el, 'b');

    // Single-select closes the listbox on pick (the component's own real behavior) -- the driver
    // only asserts it opened long enough to click the option, not that it stays open afterward.
    const detail = (await changed).detail as { value: unknown };
    expect(detail.value).to.equal('b');
    expect(el.value).to.equal('b');
  });

  it("opens the listbox and clicks the real option row, firing lr-change (lr-select, the same [part=\"option\"]/data-value pattern)", async () => {
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    const changed = oneEvent(el, 'lr-change');

    await chooseOption(el, 'b');

    expect((await changed).detail).to.deep.equal({ value: 'b', data: [undefined] });
    expect(el.value).to.equal('b');
  });

  it('opens the listbox and clicks the real option row, firing lr-change (lr-model-select)', async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${['llama3.1', 'mistral']}></lr-model-select>`,
    )) as LyraModelSelect;

    await chooseOption(el, 'mistral');

    expect(el.value).to.equal('mistral');
  });

  it('opens the popup and clicks the real option row, firing lr-change (lr-locale-picker)', async () => {
    const el = (await fixture(
      html`<lr-locale-picker .locales=${['fr', 'de']}></lr-locale-picker>`,
    )) as LyraLocalePicker;
    const changed = oneEvent(el, 'lr-change');

    await chooseOption(el, 'fr');

    const detail = (await changed).detail as { value: unknown };
    expect(detail.value).to.equal('fr');
    expect(el.value).to.equal('fr');
  });

  it(
    'opens the popup and clicks the real option row, firing lr-change (lr-voice-picker, the ' +
      'same [part="option"]/data-value pattern via the shared CatalogPickerController)',
    async () => {
      const el = (await fixture(
        html`<lr-voice-picker .catalog=${['alloy', 'verse']}></lr-voice-picker>`,
      )) as LyraVoicePicker;
      const changed = oneEvent(el, 'lr-change');

      await chooseOption(el, 'verse');

      const detail = (await changed).detail as { value: unknown };
      expect(detail.value).to.equal('verse');
      expect(el.value).to.equal('verse');
    },
  );

  it('throws rather than silently no-op when no rendered option carries the requested value', async () => {
    const el = (await fixture(comboboxFixture())) as LyraCombobox;
    let error: unknown;
    try {
      await chooseOption(el, 'does-not-exist');
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    expect((error as Error).message).to.contain('does-not-exist');
  });

  it('throws rather than silently no-op on a disabled combobox', async () => {
    const el = (await fixture(html`<lr-combobox disabled><lr-option value="a">Apple</lr-option></lr-combobox>`)) as LyraCombobox;
    let error: unknown;
    try {
      await chooseOption(el, 'a');
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    expect(el.open).to.be.false;
  });

  it('matches a value containing selector-special characters (no CSS-selector injection)', async () => {
    const el = (await fixture(html`
      <lr-combobox>
        <lr-option value='has"quote'>Quoted</lr-option>
        <lr-option value="plain">Plain</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;

    await chooseOption(el, 'has"quote');

    expect(el.value).to.equal('has"quote');
  });
});

describe('submitConfirmDecision', () => {
  it("clicks the real approve button, firing the component's own lr-approve and settling decision", async () => {
    const el = (await fixture(html`<lr-confirm-bar .args=${{ x: 1 }}></lr-confirm-bar>`)) as LyraConfirmBar;
    const approved = oneEvent(el, 'lr-approve');

    await submitConfirmDecision(el, 'approved');

    const detail = (await approved).detail as { args: unknown };
    expect(detail.args).to.deep.equal({ x: 1 });
    expect(el.decision).to.equal('approved');
  });

  it("clicks the real deny button, firing the component's own lr-deny and settling decision", async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const denied = oneEvent(el, 'lr-deny');

    await submitConfirmDecision(el, 'denied');

    await denied;
    expect(el.decision).to.equal('denied');
  });

  it('throws rather than silently no-op once the bar is already decided', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    await submitConfirmDecision(el, 'approved');

    let error: unknown;
    try {
      await submitConfirmDecision(el, 'denied');
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    expect(el.decision).to.equal('approved');
  });

  it('throws rather than silently no-op on a disabled confirm bar', async () => {
    const el = (await fixture(html`<lr-confirm-bar disabled></lr-confirm-bar>`)) as LyraConfirmBar;
    let error: unknown;
    try {
      await submitConfirmDecision(el, 'approved');
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    expect(el.decision).to.equal(null);
  });

  it("clicks the real approve button on lr-tool-approval-dialog, the same lr-approve/lr-deny contract confirm-bar shares", async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open tool-name="web_search"></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const approved = oneEvent(el, 'lr-approve');

    await submitConfirmDecision(el, 'approved');

    const detail = (await approved).detail as { args: unknown };
    expect(detail.args).to.deep.equal({});
  });
});

describe('toggleSwitch', () => {
  it("calls the component's own click() activation path, firing input/lr-input/change/lr-change and flipping checked", async () => {
    const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
    const seen: string[] = [];
    for (const type of ['input', 'lr-input', 'change', 'lr-change']) {
      el.addEventListener(type, () => seen.push(type));
    }

    await toggleSwitch(el);

    expect(el.checked).to.be.true;
    expect(seen).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  });

  it('throws rather than silently no-op on a disabled switch, and leaves checked untouched', async () => {
    const el = (await fixture(html`<lr-switch disabled>Label</lr-switch>`)) as LyraSwitch;
    let error: unknown;
    try {
      await toggleSwitch(el);
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    expect(el.checked).to.be.false;
  });
});

describe('activateStep', () => {
  it('clicks the real step button by index, firing lr-step-select with the correct detail', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${stepperSteps()}></lr-stepper>`)) as LyraStepper;
    const selected = oneEvent(el, 'lr-step-select');

    await activateStep(el, 0);

    expect((await selected).detail).to.deep.equal({ stepId: 'basics', index: 0 });
  });

  it('resolves a stepId to its index and clicks the matching step button', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${stepperSteps()}></lr-stepper>`)) as LyraStepper;
    const selected = oneEvent(el, 'lr-step-select');

    await activateStep(el, 'inputs');

    expect((await selected).detail).to.deep.equal({ stepId: 'inputs', index: 1 });
  });

  it('throws rather than silently no-op on a disabled step', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${stepperSteps()}></lr-stepper>`)) as LyraStepper;
    let error: unknown;
    try {
      await activateStep(el, 'review');
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
  });

  it('throws rather than silently no-op while the stepper is read-only', async () => {
    const el = (await fixture(html`<lr-stepper readonly .steps=${stepperSteps()}></lr-stepper>`)) as LyraStepper;
    let error: unknown;
    try {
      await activateStep(el, 0);
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
  });

  it('throws rather than silently no-op for a target that does not resolve to any step', async () => {
    const el = (await fixture(html`<lr-stepper .steps=${stepperSteps()}></lr-stepper>`)) as LyraStepper;
    let error: unknown;
    try {
      await activateStep(el, 'not-a-real-step');
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
  });
});
