import { getLyraLocale, setLyraLocale } from '../internal/localization.js';
import '../translations/fr/forms.js';
import '../translations/fr/shared.js';
import { setFlagUrlResolver } from '../components/media/flag/flag.class.js';
import { fixtureCleanup, fixture, expect, html, oneEvent } from '@open-wc/testing';
import '../components/forms/combobox/combobox.js';
import '../components/forms/select/select.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';
import '../components/forms/switch/switch.js';
import '../components/agent-tools/confirm-bar/confirm-bar.js';
import '../components/agent-tools/tool-approval-dialog/tool-approval-dialog.js';
import '../components/layout/stepper/stepper.js';
import '../components/forms/swatch-picker/swatch-picker.js';
import '../components/forms/currency-picker/currency-picker.js';
import '../components/overlays/overlay/popover.js';
import '../components/forms/button/button.js';
import type { LyraSwatchPicker } from '../components/forms/swatch-picker/swatch-picker.js';
import type { LyraCurrencyPicker } from '../components/forms/currency-picker/currency-picker.js';
import type { LyraPopover } from '../components/overlays/overlay/popover.class.js';
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
  chooseCurrency,
  chooseOption,
  chooseSwatch,
  closePopover,
  openPopover,
  submitConfirmDecision,
  toggleSwitch,
} from './interaction-drivers.js';

const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"%3E%3Cpath fill="%23005" d="M0 0h3v2H0z"/%3E%3Cpath fill="white" d="M1 0h1v2H1zM0 .5h3v1H0z"/%3E%3C/svg%3E';
before(() => setFlagUrlResolver(async () => TEST_FLAG_SRC));
after(() => {
  fixtureCleanup();
  setFlagUrlResolver(null);
});

let previousLocale: string;
beforeEach(() => { previousLocale = getLyraLocale(); });
afterEach(() => {
  fixtureCleanup();
  setLyraLocale(previousLocale);
});

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

    expect((await changed).detail).to.deep.equal({ value: 'b', previousValue: '', data: [undefined] });
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
  it("clicks the real approve button, firing the component's cancelable lr-approve-request and settling decision", async () => {
    const el = (await fixture(html`<lr-confirm-bar .args=${{ x: 1 }}></lr-confirm-bar>`)) as LyraConfirmBar;
    const approved = oneEvent(el, 'lr-approve-request');

    await submitConfirmDecision(el, 'approved');

    const event = await approved;
    expect(event.cancelable).to.equal(true);
    const detail = event.detail as { args: unknown; waitUntil: unknown };
    expect(detail.args).to.deep.equal({ x: 1 });
    expect(detail.waitUntil).to.be.a('function');
    expect(el.decision).to.equal('approved');
  });

  it("clicks the real deny button, firing the component's cancelable lr-deny-request and settling decision", async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const denied = oneEvent(el, 'lr-deny-request');

    await submitConfirmDecision(el, 'denied');

    const event = await denied;
    expect(event.cancelable).to.equal(true);
    expect(Object.keys(event.detail as object)).to.deep.equal(['waitUntil']);
    expect(el.decision).to.equal('denied');
  });

  it('keeps the confirm bar pending when its approval request is vetoed', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    el.addEventListener('lr-approve-request', (event) => event.preventDefault(), { once: true });

    await submitConfirmDecision(el, 'approved');

    expect(el.decision).to.equal(null);
    expect(el.pendingAction).to.equal('approve');
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

  it('clicks the real approve button on lr-tool-approval-dialog and fires its cancelable lr-approve-request', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open tool-name="web_search"></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const approved = oneEvent(el, 'lr-approve-request');

    await submitConfirmDecision(el, 'approved');

    const event = await approved;
    expect(event.cancelable).to.equal(true);
    const detail = event.detail as { args: unknown };
    expect(detail.args).to.deep.equal({});
  });

  it('keeps the approval dialog open when its approval request is vetoed', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open tool-name="web_search"></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.addEventListener('lr-approve-request', (event) => event.preventDefault(), { once: true });

    await submitConfirmDecision(el, 'approved');

    expect(el.open).to.equal(true);
    expect(el.pendingAction).to.equal('approve');
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

const swatchItems = [
  { value: 'emerald', color: '#10b981', label: 'Emerald' },
  { value: 'ruby', color: '#e11d48', label: 'Ruby' },
  { value: 'topaz', color: '#f59e0b', label: 'Topaz', disabled: true },
];

/** Records host events in dispatch order; the listener is attached before the driver runs. */
function recordEvents(target: EventTarget, types: readonly string[]): string[] {
  const seen: string[] = [];
  for (const type of types) target.addEventListener(type, () => seen.push(type));
  return seen;
}

describe('chooseSwatch', () => {
  it('clicks the real swatch radio: lr-change then lr-activate have fired when it resolves', async () => {
    const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Accent" value="emerald" .items=${swatchItems}></lr-swatch-picker>`);
    const seen = recordEvents(el, ['lr-change', 'lr-activate']);
    const changed = oneEvent(el, 'lr-change');
    await chooseSwatch(el, 'ruby');
    expect((await changed).detail).to.deep.equal({ value: 'ruby' });
    expect(seen).to.deep.equal(['lr-change', 'lr-activate']);
    expect(el.value).to.equal('ruby');
    const selected = el.shadowRoot!.querySelector<HTMLElement>('[part~="swatch-selected"]');
    expect(selected?.dataset['value']).to.equal('ruby');
    expect(selected?.getAttribute('aria-checked')).to.equal('true');
  });

  it('re-choosing the current value emits only lr-activate, like a real click', async () => {
    const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Accent" value="emerald" .items=${swatchItems}></lr-swatch-picker>`);
    const seen = recordEvents(el, ['lr-change', 'lr-activate']);
    await chooseSwatch(el, 'emerald');
    expect(seen).to.deep.equal(['lr-activate']);
  });

  it('throws for a disabled picker, a disabled swatch, or an unknown value without changing the value', async () => {
    const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Accent" value="emerald" .items=${swatchItems}></lr-swatch-picker>`);
    const seen = recordEvents(el, ['lr-change', 'lr-activate']);
    let error: unknown;
    try { await chooseSwatch(el, 'topaz'); } catch (caught) { error = caught; }
    expect(String(error)).to.include('is disabled');
    error = undefined;
    try { await chooseSwatch(el, 'sapphire'); } catch (caught) { error = caught; }
    expect(String(error)).to.include('no rendered swatch');
    el.disabled = true;
    await el.updateComplete;
    error = undefined;
    try { await chooseSwatch(el, 'ruby'); } catch (caught) { error = caught; }
    expect(String(error)).to.include('disabled');
    expect(el.value).to.equal('emerald');
    expect(seen).to.deep.equal([]);
  });
});

describe('chooseCurrency', () => {
  const currencies = [{ code: 'EUR' }, { code: 'USD' }, { code: 'GBP', disabled: true }];

  it('commits through the composed select: input, lr-input, change and lr-change have fired once when it resolves', async () => {
    const el = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Currency" value="EUR" .currencies=${currencies}></lr-currency-picker>`);
    const seen = recordEvents(el, ['input', 'lr-input', 'change', 'lr-change']);
    const changed = oneEvent(el, 'lr-change');
    await chooseCurrency(el, 'USD');
    expect((await changed).detail).to.deep.equal({ value: 'USD', previousValue: 'EUR' });
    expect(seen).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
    expect(el.value).to.equal('USD');
  });

  it('drives a searchable picker through its lazily loaded combobox', async () => {
    const el = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Currency" searchable .currencies=${currencies}></lr-currency-picker>`);
    const changed = oneEvent(el, 'lr-change');
    await chooseCurrency(el, 'EUR');
    expect((await changed).detail.value).to.equal('EUR');
    expect(el.value).to.equal('EUR');
    expect(el.shadowRoot!.querySelector('lr-combobox'), 'the combobox took over').to.not.equal(null);
  });

  it('throws for a disabled picker, a disabled entry, or a code outside the catalog without committing', async () => {
    const el = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Currency" value="EUR" .currencies=${currencies}></lr-currency-picker>`);
    const seen = recordEvents(el, ['change', 'lr-change']);
    let error: unknown;
    try { await chooseCurrency(el, 'GBP'); } catch (caught) { error = caught; }
    expect(String(error)).to.include('is disabled');
    error = undefined;
    try { await chooseCurrency(el, 'JPY'); } catch (caught) { error = caught; }
    expect(String(error)).to.include('not in the picker');
    el.disabled = true;
    await el.updateComplete;
    error = undefined;
    try { await chooseCurrency(el, 'USD'); } catch (caught) { error = caught; }
    expect(String(error)).to.include('disabled');
    expect(el.value).to.equal('EUR');
    expect(seen).to.deep.equal([]);
  });
});

describe('openPopover / closePopover', () => {
  const popoverFixture = () => html`
    <lr-popover style="--show-duration: 0ms; --hide-duration: 0ms">
      <lr-button slot="trigger">Open details</lr-button>
      <p>Details</p>
    </lr-popover>
  `;

  it('opens through the slotted trigger and closes with Escape, resolving after each lifecycle pair', async () => {
    const el = await fixture<LyraPopover>(popoverFixture());
    const seen = recordEvents(el, ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
    await openPopover(el);
    expect(el.open).to.equal(true);
    expect(seen).to.deep.equal(['lr-show', 'lr-after-show']);
    await openPopover(el);
    expect(seen, 'opening an open popover is a no-op').to.deep.equal(['lr-show', 'lr-after-show']);
    await closePopover(el);
    expect(el.open).to.equal(false);
    expect(seen).to.deep.equal(['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
    await closePopover(el);
    expect(seen.length, 'closing a closed popover is a no-op').to.equal(4);
  });

  it('closes by clicking the trigger again with via: trigger, and opens a for-owned popover', async () => {
    const host = await fixture<HTMLElement>(html`
      <div>
        <button id="driver-popover-owner">Filters</button>
        <lr-popover for="driver-popover-owner" style="--show-duration: 0ms; --hide-duration: 0ms"><p>Filter list</p></lr-popover>
      </div>
    `);
    const el = host.querySelector('lr-popover') as LyraPopover;
    const owner = host.querySelector('button')!;
    await openPopover(el);
    expect(el.open).to.equal(true);
    expect(owner.getAttribute('aria-expanded')).to.equal('true');
    await closePopover(el, { via: 'trigger' });
    expect(el.open).to.equal(false);
    expect(owner.getAttribute('aria-expanded')).to.equal('false');
  });

  it('throws instead of hanging when lr-show or lr-hide is vetoed, and refuses manual or disabled popovers', async () => {
    const el = await fixture<LyraPopover>(popoverFixture());
    const veto = (event: Event): void => event.preventDefault();
    el.addEventListener('lr-show', veto);
    let error: unknown;
    try { await openPopover(el); } catch (caught) { error = caught; }
    expect(String(error)).to.include('did not open');
    el.removeEventListener('lr-show', veto);

    await openPopover(el);
    el.addEventListener('lr-hide', veto);
    error = undefined;
    try { await closePopover(el); } catch (caught) { error = caught; }
    expect(String(error)).to.include('did not close');
    expect(el.open).to.equal(true);
    el.removeEventListener('lr-hide', veto);
    await closePopover(el);

    el.trigger = 'manual';
    error = undefined;
    try { await openPopover(el); } catch (caught) { error = caught; }
    expect(String(error)).to.include('manual');
    el.trigger = 'click';
    el.disabled = true;
    error = undefined;
    try { await openPopover(el); } catch (caught) { error = caught; }
    expect(String(error)).to.include('disabled');
    expect(el.open).to.equal(false);
  });
});
