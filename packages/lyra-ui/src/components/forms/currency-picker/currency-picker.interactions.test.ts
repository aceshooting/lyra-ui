import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './currency-picker.js';
import '../../../translations/fr/forms.js';
import '../../../translations/fr/shared.js';
import type { LyraCurrencyPicker } from './currency-picker.js';
import type { LyraSelect } from '../select/select.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function child(picker: LyraCurrencyPicker): LyraSelect {
  const select = picker.shadowRoot?.querySelector<LyraSelect>('lr-select');
  if (!select) throw new Error('Currency field did not render its select');
  return select;
}
async function settle(picker: LyraCurrencyPicker): Promise<void> {
  await picker.updateComplete;
  await child(picker).updateComplete;
  await picker.updateComplete;
}
function part(picker: LyraCurrencyPicker, name: string): HTMLElement {
  const element = child(picker).shadowRoot?.querySelector<HTMLElement>(`[part="${name}"]`);
  if (!element) throw new Error(`Missing rendered ${name}`);
  return element;
}
async function click(element: HTMLElement): Promise<void> {
  await hoverUntilMatched(element, 'Pointer reaches the rendered currency control');
  const rect = element.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)] });
  await resetMouse();
}
async function open(picker: LyraCurrencyPicker): Promise<void> {
  await focusByKeyboard(picker);
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => child(picker).open);
  await settle(picker);
  await waitUntil(() => getComputedStyle(part(picker, 'listbox')).opacity === '1');
}

describe('lr-currency-picker interactions and allocation', () => {
  it('renders one unavailable message when an unknown committed code has the child select badge', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Currency" value="ZZZ"
      .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settle(picker);
    const select = child(picker);
    const guidance = select.shadowRoot!.querySelector('[part="unknown-value"]')?.textContent?.trim();
    expect(guidance).to.equal('not in catalog');
    const visibleMessages = [...select.querySelectorAll<HTMLElement>('[slot="end"]'),
      ...select.shadowRoot!.querySelectorAll<HTMLElement>('[part]')].filter(element =>
        element.textContent?.trim() === guidance && element.getClientRects().length > 0);
    expect(visibleMessages.length).to.equal(1);
    expect(picker.value).to.equal('ZZZ');
    expect(picker.validity.valid).to.equal(false);
  });

  it('opens the full default catalog within the viewport and renders localized descriptive rows', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Devise" lang="fr" style="inline-size:280px"></lr-currency-picker>`);
    await settle(picker);
    await open(picker);
    const rows = child(picker).shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]');
    expect(rows.length).to.equal(176);
    const euro = Array.from(rows).find(row => row.dataset['value'] === 'EUR');
    expect(euro?.textContent).to.include('euro');
    expect(euro?.textContent).to.include('€');
    const listbox = part(picker, 'listbox');
    const bounds = listbox.getBoundingClientRect();
    expect(bounds.bottom).to.be.at.most(window.innerHeight + 1);
    expect(listbox.scrollHeight).to.be.greaterThan(listbox.clientHeight);
    expect(listbox.scrollWidth).to.be.at.most(listbox.clientWidth + 1);
    await expect(picker).to.be.accessible();
  });

  it('uses code typeahead despite localized names, skips disabled codes and commits on Enter', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Currency"
      .currencies=${[{ code: 'EUR', label: 'Euro' }, { code: 'USD', label: 'Dollar américain', disabled: true }, { code: 'UGX', label: 'Shilling ougandais' }]}></lr-currency-picker>`);
    await settle(picker);
    await open(picker);
    await sendKeys({ press: 'u' });
    expect(picker.value).to.equal('');
    await sendKeys({ press: 'Enter' });
    await settle(picker);
    expect(picker.value).to.equal('UGX');
    expect(child(picker).open).to.equal(false);
  });

  it('selects a real pointer row and clears once through the focused clear button', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Currency" clearable .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settle(picker);
    await click(part(picker, 'trigger'));
    await waitUntil(() => child(picker).open);
    const row = child(picker).shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="USD"]')!;
    await click(row);
    await settle(picker);
    expect(picker.value).to.equal('USD');
    let changes = 0;
    picker.addEventListener('lr-change', () => changes++);
    const changed = oneEvent(picker, 'lr-change');
    await focusByKeyboard(part(picker, 'clear-button'));
    await sendKeys({ press: 'Enter' });
    const event = await changed;
    await settle(picker);
    expect((event as CustomEvent).detail).to.deep.equal({ value: '', previousValue: 'USD' });
    expect(changes).to.equal(1);
    expect(picker.value).to.equal('');
    picker.clearable = false;
    picker.value = 'USD';
    await settle(picker);
    expect(child(picker).shadowRoot!.querySelectorAll('[part="clear-button"]').length).to.equal(0);
  });

  it('keeps vertical navigation and Escape usable in an inherited RTL field', async () => {
    const host = await fixture<HTMLDivElement>(html`<div dir="rtl"><lr-currency-picker label="عملة" .currencies=${['EUR', 'USD', 'JPY']}></lr-currency-picker></div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settle(picker);
    await open(picker);
    await sendKeys({ press: 'End' });
    await sendKeys({ press: 'Enter' });
    await settle(picker);
    expect(picker.value).to.equal('JPY');
    await open(picker);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !child(picker).open);
    expect(child(picker).shadowRoot?.activeElement === part(picker, 'trigger')).to.equal(true);
    expect(getComputedStyle(part(picker, 'trigger')).direction).to.equal('rtl');
  });

  it('does not commit empty or entirely disabled catalogs by keyboard', async () => {
    for (const currencies of [[], [{ code: 'EUR', disabled: true }, { code: 'USD', disabled: true }]]) {
      const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Currency" .currencies=${currencies}></lr-currency-picker>`);
      await settle(picker);
      await focusByKeyboard(picker);
      await sendKeys({ press: 'ArrowDown' });
      await sendKeys({ press: 'End' });
      await sendKeys({ press: 'Enter' });
      await settle(picker);
      expect(picker.value).to.equal('');
      await sendKeys({ press: 'Escape' });
      picker.remove();
    }
  });

  it('replaces the open catalog without activating a removed row', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Currency" .currencies=${['EUR', 'USD', 'JPY']}></lr-currency-picker>`);
    await settle(picker);
    await open(picker);
    await sendKeys({ press: 'End' });
    picker.currencies = ['EUR', 'GBP'];
    await settle(picker);
    const activeId = part(picker, 'trigger').getAttribute('aria-activedescendant');
    expect(Boolean(activeId && child(picker).shadowRoot!.getElementById(activeId))).to.equal(true);
    await sendKeys({ press: 'Enter' });
    await settle(picker);
    expect(['EUR', 'GBP']).to.include(picker.value);
    expect(child(picker).querySelectorAll('lr-option').length).to.equal(2);
  });

  it('fits a 320px allocation with long names and doubled inherited text, closed and open', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="inline-size:320px;font-size:200%;max-inline-size:100%">
      <lr-currency-picker label="Billing settlement currency" hint="Choose the currency used for your invoice"
        .currencies=${[{ code: 'EUR', label: 'An exceptionally long localized currency name for settlement estimates', symbol: '€' }, { code: 'USD', label: 'United States dollar', symbol: '$' }]}></lr-currency-picker>
    </div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settle(picker);
    const allocation = host.getBoundingClientRect();
    expect(part(picker, 'trigger').getBoundingClientRect().width).to.be.at.most(allocation.width + 1);
    expect(host.scrollWidth).to.be.at.most(host.clientWidth + 1);
    const bodyWidth = document.body.scrollWidth;
    await open(picker);
    const listbox = part(picker, 'listbox');
    await waitUntil(() => listbox.getBoundingClientRect().width > 0);
    expect(listbox.scrollWidth).to.be.at.most(listbox.clientWidth + 1);
    expect(document.body.scrollWidth).to.be.at.most(bodyWidth + 1);
    expect(child(picker).shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(2);
    await expect(picker).to.be.accessible();
  });

  it('opens a real top-layer listbox inside a modal dialog and remains pointer selectable', async () => {
    const dialog = await fixture<HTMLDialogElement>(html`<dialog aria-label="Invoice settings"><lr-currency-picker label="Currency" top-layer .currencies=${['EUR', 'USD']}></lr-currency-picker></dialog>`);
    dialog.showModal();
    try {
      const picker = dialog.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
      await settle(picker);
      await click(part(picker, 'trigger'));
      await waitUntil(() => child(picker).open);
      const listbox = part(picker, 'listbox');
      expect(listbox.matches(':popover-open')).to.equal(true);
      await click(child(picker).shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="USD"]')!);
      await settle(picker);
      expect(picker.value).to.equal('USD');
      expect(dialog.open).to.equal(true);
      picker.topLayer = false;
      await settle(picker);
      await click(part(picker, 'trigger'));
      await waitUntil(() => child(picker).open);
      expect(part(picker, 'listbox').matches(':popover-open')).to.equal(false);
    } finally { dialog.close(); }
  });
});
