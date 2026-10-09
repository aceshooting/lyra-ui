import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './currency-picker.js';
import '../../../translations/fr/forms.js';
import '../../../translations/fr/shared.js';
import '../../../translations/ar/forms.js';
import '../../../translations/ar/shared.js';
import type { LyraCurrencyPicker } from './currency-picker.js';
import type { LyraSelect } from '../select/select.class.js';
import { resolveValidityAnchor } from '../../../internal/anchored-validity.js';
import { chooseOption } from '../../../testing/interaction-drivers.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

function select(picker: LyraCurrencyPicker): LyraSelect {
  const child = picker.shadowRoot?.querySelector<LyraSelect>('lr-select');
  expect(Boolean(child), 'supported child select exists').to.equal(true);
  return child!;
}

async function settled(picker: LyraCurrencyPicker): Promise<void> {
  await picker.updateComplete;
  await select(picker).updateComplete;
  await picker.updateComplete;
}

describe('lr-currency-picker composed field ownership', () => {
  it('starts with one empty external form value and no inferred currency', async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <lr-currency-picker name="currency" .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    expect(picker.value).to.equal('');
    expect([...new FormData(form).entries()]).to.deep.equal([['currency', '']]);
    expect(select(picker).name).to.equal('');
    expect(select(picker).form === null).to.equal(true);
    expect(resolveValidityAnchor(select(picker))!.getAttribute('aria-label')).to.equal('Currency');
  });

  it('commits the real row synchronously and emits each outer event exactly once', async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <lr-currency-picker name="currency" .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    const events: string[] = [];
    const details: unknown[] = [];
    for (const type of ['input', 'lr-input', 'change', 'lr-change']) {
      form.addEventListener(type, (event) => {
        events.push(type);
        expect(event.target === picker).to.equal(true);
        expect(event.bubbles && event.composed && !event.cancelable).to.equal(true);
        expect(new FormData(form).get('currency')).to.equal('EUR');
        if (type.startsWith('lr-')) details.push((event as CustomEvent).detail);
      });
    }
    await chooseOption(select(picker), 'EUR');
    expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
    expect(details).to.deep.equal([
      { value: 'EUR', previousValue: '' },
      { value: 'EUR', previousValue: '' },
    ]);
    picker.value = 'USD';
    await settled(picker);
    expect(events.length).to.equal(4);
    expect([...new FormData(form).entries()]).to.deep.equal([['currency', 'USD']]);
  });

  it('normalizes the live value and reset default while preserving custom validity', async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <lr-currency-picker name="currency" value=" eur " .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    expect(picker.value).to.equal('EUR');
    picker.value = ' usd ';
    expect(picker.value).to.equal('USD');
    expect(new FormData(form).get('currency')).to.equal('USD');
    picker.setCustomValidity('Choose a billing currency');
    form.reset();
    await settled(picker);
    expect(picker.value).to.equal('EUR');
    expect(picker.validity.customError).to.equal(true);
    expect(picker.validationMessage).to.equal('Choose a billing currency');
    picker.setCustomValidity('');
    expect(picker.checkValidity()).to.equal(true);
  });

  it('projects populated label, hint and error slots onto the true child control', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker .currencies=${['EUR']}>
      <span slot="label">Billing currency</span>
      <span slot="hint">For estimates</span>
      <span slot="error">Check this choice</span>
    </lr-currency-picker>`);
    await settled(picker);
    const child = select(picker);
    const label = child.shadowRoot!.querySelector<HTMLLabelElement>('[part="form-control-label"]')!;
    expect(label.hidden).to.equal(false);
    const projected = child.querySelector<HTMLSlotElement>('slot[slot="label"]')!;
    expect(projected.assignedElements()[0]?.textContent).to.equal('Billing currency');
    const trigger = resolveValidityAnchor(child)!;
    const ids = (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/);
    expect(ids).to.include('select-hint');
    expect(ids).to.include('select-error');
    label.click();
    await waitUntil(() => child.shadowRoot?.activeElement === trigger);
    expect(child.shadowRoot!.activeElement === trigger).to.equal(true);
  });

  it('supports external form ownership and external label activation', async () => {
    const host = await fixture<HTMLDivElement>(html`<div>
      <form id="billing-form"></form>
      <label for="billing-currency">Payment currency</label>
      <lr-currency-picker id="billing-currency" form="billing-form" name="currency"
        value="EUR" .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    const form = host.querySelector<HTMLFormElement>('form')!;
    await settled(picker);
    expect(picker.form === form).to.equal(true);
    expect([...new FormData(form).entries()]).to.deep.equal([['currency', 'EUR']]);
    expect(select(picker).form === null).to.equal(true);
    const trigger = resolveValidityAnchor(select(picker))!;
    expect(trigger.getAttribute('aria-label')).to.equal('Payment currency');
    host.querySelector<HTMLLabelElement>('label')!.click();
    await waitUntil(() => select(picker).shadowRoot?.activeElement === trigger);
  });

  it('resolves external descriptions across both shadow roots and keeps host naming precedence', async () => {
    const host = await fixture<HTMLDivElement>(html`<div>
      <p id="currency-guidance">Displayed estimates</p>
      <lr-currency-picker aria-label="Settlement currency" aria-describedby="currency-guidance"
        label="Ignored field name" .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    const trigger = resolveValidityAnchor(select(picker))!;
    expect(trigger.getAttribute('aria-label')).to.equal('Settlement currency');
    expect(trigger.ariaDescribedByElements?.map((element) => element.textContent)).to.include('Displayed estimates');
    const replacement = picker.ownerDocument.createElement('p');
    replacement.id = 'currency-guidance';
    replacement.textContent = 'Replacement guidance';
    host.querySelector('#currency-guidance')!.replaceWith(replacement);
    await waitUntil(() => trigger.ariaDescribedByElements?.some((element) => element.textContent === 'Replacement guidance'));
    picker.removeAttribute('aria-describedby');
    await waitUntil(() => !trigger.ariaDescribedByElements?.some((element) => element.id === 'currency-guidance'));
  });

  it('reports outer required validity once and focuses the nested trigger', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker
      required .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settled(picker);
    const invalidEvents: string[] = [];
    picker.addEventListener('invalid', () => invalidEvents.push('invalid'));
    picker.addEventListener('lr-invalid', () => invalidEvents.push('lr-invalid'));
    expect(picker.validity.valueMissing).to.equal(true);
    expect(picker.reportValidity()).to.equal(false);
    expect(invalidEvents).to.deep.equal(['lr-invalid', 'invalid']);
    const trigger = resolveValidityAnchor(select(picker))!;
    await waitUntil(() => select(picker).shadowRoot?.activeElement === trigger);
    expect(trigger.getAttribute('aria-required')).to.equal('true');
    await chooseOption(select(picker), 'EUR');
    expect(picker.checkValidity()).to.equal(true);
  });

  it('retains a selected disabled code and refuses submission instead of clearing it', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker value="EUR"
      .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settled(picker);
    picker.currencies = [{ code: 'EUR', disabled: true }, { code: 'USD' }];
    await settled(picker);
    expect(picker.value).to.equal('EUR');
    expect(picker.validity.valid).to.equal(false);
    expect(picker.checkValidity()).to.equal(false);
    expect(picker.validationMessage).to.equal('not in catalog');
    const unavailable = select(picker).querySelector<HTMLElement>('[slot="end"]')!;
    expect(unavailable.textContent).to.equal('not in catalog');
    expect(unavailable.getClientRects().length).to.be.greaterThan(0);
    picker.currencies = ['EUR', 'USD'];
    await settled(picker);
    expect(picker.value).to.equal('EUR');
    expect(picker.checkValidity()).to.equal(true);
  });

  it('cascades disabled fieldsets without changing the authored disabled value', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><fieldset disabled>
      <lr-currency-picker name="currency" value="EUR" .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </fieldset></form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    expect(picker.disabled).to.equal(false);
    expect(picker.effectiveDisabled).to.equal(true);
    expect(select(picker).effectiveDisabled).to.equal(true);
    expect(new FormData(form).has('currency')).to.equal(false);
    form.querySelector('fieldset')!.disabled = false;
    await settled(picker);
    expect(picker.effectiveDisabled).to.equal(false);
    await focusByKeyboard(picker);
    await sendKeys({ press: 'u' });
    expect(picker.value).to.equal('USD');
  });
  it('gates focus and activation immediately when the outer field becomes disabled', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker
      .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settled(picker);
    picker.disabled = true;
    picker.focus();
    picker.click();
    expect(select(picker).shadowRoot?.activeElement === resolveValidityAnchor(select(picker))).to.equal(false);
    expect(select(picker).open).to.equal(false);
    await settled(picker);
    expect(select(picker).effectiveDisabled).to.equal(true);
  });

  it('keeps slotted input and change events outside the owned selection boundary', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker value="EUR"
      .currencies=${['EUR', 'USD']}><span slot="hint">Caller content</span></lr-currency-picker>`);
    await settled(picker);
    const foreign = picker.querySelector('span')!;
    const observed: string[] = [];
    for (const name of ['input', 'change', 'lr-change']) picker.addEventListener(name, (event) => {
      if (event.target === foreign) observed.push(name);
    });
    foreign.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    foreign.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    foreign.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: { value: 'USD' } }));
    expect(observed).to.deep.equal(['input', 'change', 'lr-change']);
    expect(picker.value).to.equal('EUR');
  });

  it('projects outer custom validity and interactive invalid state to the child trigger', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker data-lr-theme-scope value="EUR" style="--lr-theme-color-danger-fill-loud: rgb(22, 33, 44)"
      .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settled(picker);
    picker.setCustomValidity('Billing account disallows this currency');
    await settled(picker);
    expect(select(picker).validity.valid).to.equal(false);
    let invalid = 0;
    picker.addEventListener('lr-invalid', () => invalid++);
    expect(picker.reportValidity()).to.equal(false);
    await settled(picker);
    expect(invalid).to.equal(1);
    expect(resolveValidityAnchor(select(picker))!.getAttribute('aria-invalid')).to.equal('true');
    expect(getComputedStyle(resolveValidityAnchor(select(picker))!).borderTopColor).to.equal('rgb(22, 33, 44)');
    picker.setCustomValidity('');
    await settled(picker);
    expect(select(picker).validity.valid).to.equal(true);
    expect(resolveValidityAnchor(select(picker))!.getAttribute('aria-invalid')).to.equal('false');
    expect(getComputedStyle(resolveValidityAnchor(select(picker))!).borderTopColor).not.to.equal('rgb(22, 33, 44)');
  });

  it('forwards instance strings and gives authored aria-label precedence over idrefs', async () => {
    const host = await fixture<HTMLDivElement>(html`<div><p id="other-currency-name">Other name</p>
      <lr-currency-picker aria-label="Invoice currency" aria-labelledby="other-currency-name"
        clearable value="EUR" .currencies=${['EUR', 'USD']} .strings=${{ clear: 'Clear currency' }}></lr-currency-picker>
    </div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    const trigger = resolveValidityAnchor(select(picker))!;
    expect(trigger.getAttribute('aria-label')).to.equal('Invoice currency');
    expect(select(picker).shadowRoot!.querySelector('[part="clear-button"]')!.getAttribute('aria-label')).to.equal('Clear currency');
    expect(trigger.ariaLabelledByElements?.some((element) => element.id === 'other-currency-name') ?? false).to.equal(false);
  });

  it('honors inherited positioning, explicit override and live restoration of inheritance', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="--lr-positioning-strategy: fixed">
      <lr-currency-picker value="EUR" .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    const child = select(picker);
    child.open = true;
    await child.updateComplete;
    const listbox = child.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    await waitUntil(() => getComputedStyle(listbox).position === 'fixed', 'inherited fixed strategy applied');
    picker.positioningStrategy = 'absolute';
    await settled(picker);
    await waitUntil(() => getComputedStyle(listbox).position === 'absolute', 'explicit absolute strategy applied');
    picker.positioningStrategy = undefined;
    await settled(picker);
    await waitUntil(() => getComputedStyle(listbox).position === 'fixed', 'unset restored inherited fixed strategy');
  });

  it('projects actual form submission validity without duplicate invalid events or canceled focus', async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <button type="button">Keep focus</button>
      <lr-currency-picker required name="currency" .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    const button = form.querySelector<HTMLButtonElement>('button')!;
    await focusByKeyboard(button);
    let aliases = 0;
    let nativeInvalid = 0;
    let submissions = 0;
    picker.addEventListener('lr-invalid', (event) => { aliases++; event.preventDefault(); });
    picker.addEventListener('invalid', () => nativeInvalid++);
    form.addEventListener('submit', (event) => { submissions++; event.preventDefault(); });
    form.requestSubmit();
    await settled(picker);
    expect([aliases, nativeInvalid, submissions]).to.deep.equal([1, 1, 0]);
    expect(picker.ownerDocument.activeElement === button).to.equal(true);
    expect(resolveValidityAnchor(select(picker))!.getAttribute('aria-invalid')).to.equal('true');
    await chooseOption(select(picker), 'EUR');
    form.requestSubmit();
    expect(submissions).to.equal(1);
  });

  it('keeps silent checks pristine and clears interactive projection on disable and reset', async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <lr-currency-picker required .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    const child = select(picker);
    const trigger = resolveValidityAnchor(child)!;
    expect(picker.checkValidity()).to.equal(false);
    expect(trigger.getAttribute('aria-invalid')).to.equal('false');
    picker.setCustomValidity('Retained account constraint');
    picker.reportValidity();
    await settled(picker);
    expect(trigger.getAttribute('aria-invalid')).to.equal('true');
    child.requestUpdate('size');
    await child.updateComplete;
    expect(trigger.getAttribute('aria-invalid')).to.equal('true');
    picker.disabled = true;
    await settled(picker);
    expect(trigger.getAttribute('aria-invalid')).to.equal('false');
    picker.disabled = false;
    await settled(picker);
    expect(trigger.getAttribute('aria-invalid')).to.equal('true');
    form.reset();
    await settled(picker);
    expect(picker.validationMessage).to.equal('Retained account constraint');
    expect(trigger.getAttribute('aria-invalid')).to.equal('false');
  });

  it('clears unavailable state through the real clear action and restores the declared default', async () => {
    const form = await fixture<HTMLFormElement>(html`<form>
      <lr-currency-picker name="currency" clearable value="EUR" .currencies=${['EUR', 'USD']}></lr-currency-picker>
    </form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    picker.value = 'malformed currency';
    picker.reportValidity();
    await settled(picker);
    const child = select(picker);
    expect(resolveValidityAnchor(child)!.getAttribute('aria-invalid')).to.equal('true');
    child.shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]')!.click();
    await settled(picker);
    expect(picker.value).to.equal('');
    expect(new FormData(form).get('currency')).to.equal('');
    expect(resolveValidityAnchor(child)!.getAttribute('aria-invalid')).to.equal('false');
    form.reset();
    await settled(picker);
    expect(picker.value).to.equal('EUR');
    expect(picker.validity.valid).to.equal(true);
  });

  it('reconnects closed and binds validation projection to the adopted document', async () => {
    const host = await fixture<HTMLDivElement>(html`<div>
      <lr-currency-picker required .currencies=${['EUR', 'USD']}></lr-currency-picker>
      <iframe title="Synthetic field document"></iframe>
    </div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    const child = select(picker);
    child.open = true;
    await child.updateComplete;
    picker.remove();
    host.prepend(picker);
    await settled(picker);
    expect(child.open).to.equal(false);
    const frame = host.querySelector('iframe')!;
    await waitUntil(() => Boolean(frame.contentDocument?.body));
    frame.contentDocument!.body.append(picker);
    await settled(picker);
    expect(picker.ownerDocument === frame.contentDocument).to.equal(true);
    picker.reportValidity();
    await settled(picker);
    expect(resolveValidityAnchor(child)!.getAttribute('aria-invalid')).to.equal('true');
    picker.value = 'EUR';
    await settled(picker);
    expect(resolveValidityAnchor(child)!.getAttribute('aria-invalid')).to.equal('false');
  });

  it('uses the pinned default catalog without selecting a currency and restores it after an empty override', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker></lr-currency-picker>`);
    await settled(picker);
    expect(select(picker).querySelectorAll('lr-option').length).to.equal(176);
    expect(picker.value).to.equal('');
    expect(picker.currencies).to.equal(undefined);
    picker.currencies = [];
    await settled(picker);
    expect(select(picker).querySelectorAll('lr-option').length).to.equal(0);
    picker.removeAttribute('value');
    picker.currencies = undefined;
    await settled(picker);
    expect(select(picker).querySelectorAll('lr-option').length).to.equal(176);
    expect(picker.value).to.equal('');
  });

  it('owns catalog snapshots and uses normalized identities without evaluating caller getters', async () => {
    const source = [{ code: ' eur ', label: 'Original', symbol: '€' }, { code: 'EUR', label: 'Duplicate' }];
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, 'code', { get() { getterCalls++; return 'USD'; } });
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker></lr-currency-picker>`);
    picker.currencies = [...source, accessor] as typeof source;
    source[0]!.label = 'Changed';
    await settled(picker);
    expect(getterCalls).to.equal(0);
    expect(picker.currencies).to.deep.equal([{ code: 'EUR', label: 'Original', symbol: '€' }]);
    expect(Object.isFrozen(picker.currencies)).to.equal(true);
    expect(select(picker).querySelectorAll('lr-option').length).to.equal(1);
    picker.value = 'bad-code';
    await settled(picker);
    expect(picker.value).to.equal('bad-code');
    expect(picker.validity.valid).to.equal(false);
  });

  it('resolves option presentation from the effective locale while keeping literal overrides', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker locale="fr"
      .currencies=${[{ code: 'EUR' }, { code: 'USD', label: '', symbol: '' }]}></lr-currency-picker>`);
    await settled(picker);
    const row = select(picker).querySelector('lr-option') as HTMLElement & { sub: string };
    expect(row.sub).to.include(new Intl.DisplayNames('fr', { type: 'currency' }).of('EUR'));
    const custom = select(picker).querySelectorAll('lr-option')[1] as HTMLElement & { sub: string };
    expect(custom.sub).to.equal('');
    picker.locale = 'ar';
    await settled(picker);
    expect(row.sub).to.include(new Intl.DisplayNames('ar', { type: 'currency' }).of('EUR'));
    expect(picker.value).to.equal('');
  });

  it('reuses the per-instance presentation projection until its catalog or effective locale changes', async () => {
    const original = Intl.NumberFormat.prototype.formatToParts;
    let calls = 0;
    Intl.NumberFormat.prototype.formatToParts = function (value) {
      calls++;
      return original.call(this, value);
    };
    try {
      const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker locale="en"
        .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
      await settled(picker);
      expect(calls, 'regular and narrow symbols are each resolved once per row').to.equal(4);
      picker.label = 'Settlement';
      picker.required = true;
      await settled(picker);
      expect(calls).to.equal(4);
      picker.locale = 'fr';
      await settled(picker);
      expect(calls).to.equal(8);
      picker.currencies = ['EUR'];
      await settled(picker);
      expect(calls).to.equal(10);
    } finally {
      Intl.NumberFormat.prototype.formatToParts = original;
    }
  });

  it('normalizes native restoration callback values without emitting user events or replacing the reset default', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-currency-picker name="currency" value="EUR"
      .currencies=${['EUR', 'USD']}></lr-currency-picker></form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settled(picker);
    let changes = 0;
    picker.addEventListener('lr-change', () => changes++);
    picker.formStateRestoreCallback(' usd ', 'restore');
    await settled(picker);
    expect(picker.value).to.equal('USD');
    expect(new FormData(form).get('currency')).to.equal('USD');
    expect(picker.validity.valid).to.equal(true);
    picker.formStateRestoreCallback('unsupported', 'autocomplete');
    await settled(picker);
    expect(picker.value).to.equal('unsupported');
    expect(picker.validity.valid).to.equal(false);
    form.reset();
    await settled(picker);
    expect(picker.value).to.equal('EUR');
    expect(changes).to.equal(0);
  });

  it('resolves the default catalog once per locale for every picker and spares the shared formatter cache', async () => {
    const original = Intl.NumberFormat;
    let constructions = 0;
    Intl.NumberFormat = new Proxy(original, {
      construct(target, args, newTarget) {
        constructions += 1;
        return Reflect.construct(target, args, newTarget);
      },
    });
    try {
      const host = await fixture<HTMLDivElement>(html`<div><lr-currency-picker locale="en"></lr-currency-picker><lr-currency-picker locale="en"></lr-currency-picker></div>`);
      for (const picker of host.querySelectorAll<LyraCurrencyPicker>('lr-currency-picker')) await settled(picker);
      expect(constructions, 'two currency formatters per code, built once').to.be.at.most(176 * 2 + 40);
    } finally {
      Intl.NumberFormat = original;
    }
  });
});
