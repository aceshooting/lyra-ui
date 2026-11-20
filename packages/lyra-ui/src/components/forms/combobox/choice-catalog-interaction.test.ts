import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraCombobox } from '../../lr-combobox.js';
import { LyraSelect } from '../../lr-select.js';
import '../../lr-option.js';
import '../../../translations/ja/forms.js';
import '../../../translations/ja/shared.js';

it('finds accented local and unmatched choices using unaccented filter text', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox multiple open with-unknown-option>
    <lr-option value="tea">Thé</lr-option></lr-combobox>`);
  combo.value = ['théière'];
  combo.inputValue = 'the';
  await combo.updateComplete;
  const labels = Array.from(combo.shadowRoot!.querySelectorAll('[role="option"]'), row => row.textContent?.trim());
  expect(labels.some(label => label?.includes('Thé'))).to.equal(true);
  expect(labels.some(label => label?.includes('théière'))).to.equal(true);
});

it('finds accented select labels from an unaccented type-ahead key', async () => {
  const select = await fixture<LyraSelect>(html`<lr-select><lr-option value="one">Éclair</lr-option></lr-select>`);
  select.shadowRoot!.querySelector('[role="combobox"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', cancelable: true }));
  expect(select.value).to.equal('one');
});

it('restores an authored combobox default across late option arrival and dirty writes', async () => {
  const form = await fixture<HTMLFormElement>(html`<form><lr-combobox default-value="first"></lr-combobox></form>`);
  const combo = form.querySelector('lr-combobox')!;
  expect(combo.value).to.equal('first');
  combo.value = 'edited';
  combo.setAttribute('default-value', 'next');
  const option = document.createElement('lr-option');
  option.value = 'unrelated';
  option.defaultSelected = true;
  combo.append(option);
  await combo.updateComplete;
  expect(combo.value).to.equal('edited');
  form.reset();
  expect(combo.value).to.equal('next');
});

it('reuses cached source rows after moving during a refresh', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open></lr-combobox>`);
  let pending = false;
  let finish!: (rows: []) => void;
  combo.source = () => pending
    ? new Promise(resolve => { finish = resolve; })
    : Promise.resolve([{ value: 'one', label: 'Cached' }]);
  const rows = () => combo.shadowRoot!.querySelectorAll('[part~="option"]');
  await waitUntil(() => rows().length === 1);
  pending = true;
  combo.refresh();
  await waitUntil(() => Boolean(finish) && rows().length === 0);
  const parent = combo.parentNode!;
  combo.remove();
  parent.appendChild(combo);
  await combo.show();
  finish([]);
  await waitUntil(() => rows().length === 1, 'the cached row returns after reconnect');
  expect(rows()[0]!.textContent).to.contain('Cached');
});

for (const name of ['select', 'combobox']) {
  it(`${name} limits the listbox to its allocated block size`, async () => {
    const picker = await fixture<LyraSelect | LyraCombobox>(`<lr-${name}><lr-option>A</lr-option></lr-${name}>`);
    await picker.show();
    const popup = picker.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    popup.style.setProperty('--lr-positioner-available-block-size', '31px');
    expect(getComputedStyle(popup).maxBlockSize).to.equal('31px');
  });
}

it('ignores unsupported validity flags returned by a configured validator', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox></lr-combobox>`);
  combo.validators = [() => ({ unsupported: true, customError: false })];
  await combo.updateComplete;
  expect(combo.validity.valid).to.equal(true);
  expect(combo.validationMessage).to.equal('');
});

it('keeps an existing selection when a replacement row is vetoed', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox value="a" open>
    <lr-option value="a">A</lr-option><lr-option value="b">B</lr-option></lr-combobox>`);
  let requests = 0;
  combo.addEventListener('lr-change-request', event => {
    requests++;
    event.preventDefault();
  });
  combo.shadowRoot!.querySelectorAll<HTMLElement>('[part~="option"]')[1]!.click();
  expect(requests).to.equal(1);
  expect(combo.value).to.equal('a');
  expect(combo.open).to.equal(true);
});

it('fails closed when a validator returns an unreadable flag', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox></lr-combobox>`);
  combo.validators = [() => ({ get customError(): boolean { throw new Error('unavailable'); } })];
  await combo.updateComplete;
  expect(combo.validity.customError).to.equal(true);
  expect(combo.validationMessage.length).to.be.greaterThan(0);
});

it('keeps the selection and draft after vetoing creation, removal, or clear', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox multiple clearable allow-create open>
    <lr-option value="one" selected>One</lr-option></lr-combobox>`);
  const proposals: unknown[] = [];
  const veto = new AbortController();
  combo.addEventListener('lr-change-request', e => {
    proposals.push(e.detail.value);
    e.preventDefault();
  }, { signal: veto.signal });
  combo.inputValue = 'New';
  await combo.updateComplete;
  const root = combo.shadowRoot!;
  root.querySelector<HTMLElement>('[part="option"]')!.click();
  expect(combo.querySelectorAll('lr-option').length).to.equal(1);
  root.querySelector<HTMLElement>('[part="tag__remove-button"]')!.click();
  root.querySelector<HTMLElement>('[part="clear-button"]')!.click();
  expect(proposals).to.deep.equal([['one', 'New'], [], []]);
  expect(combo.value).to.deep.equal(['one']);
  expect(combo.inputValue).to.equal('New');
  veto.abort();
  root.querySelector<HTMLElement>('[part="option"]')!.click();
  expect(combo.value).to.deep.equal(['one', 'New']);
  await combo.updateComplete;
  root.querySelector<HTMLElement>('[part="tag__remove-button"]')!.click();
  expect(combo.value).to.deep.equal(['New']);
  root.querySelector<HTMLElement>('[part="clear-button"]')!.click();
  expect(combo.value).to.deep.equal([]);
});

it('preserves a controlled write of the same value during a combobox selection request', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox value="a" open>
    <lr-option value="a">A</lr-option><lr-option value="b">B</lr-option></lr-combobox>`);
  let committed = 0;
  combo.addEventListener('lr-change', () => { committed++; });
  combo.addEventListener('lr-change-request', () => { combo.value = 'a'; });
  combo.shadowRoot!.querySelectorAll<HTMLElement>('[part~="option"]')[1]!.click();
  expect(combo.value).to.equal('a');
  expect(committed).to.equal(0);
});

it('copies multiple reset defaults and keeps a restored value until reset', async () => {
  const form = await fixture<HTMLFormElement>(html`<form><lr-combobox multiple></lr-combobox></form>`);
  const combo = form.querySelector('lr-combobox')!;
  const values = ['one', 'two'];
  combo.defaultValue = values;
  values.pop();
  expect(combo.value).to.deep.equal(['one', 'two']);
  expect(combo.defaultValue).to.deep.equal(['one', 'two']);
  combo.formStateRestoreCallback('["restored"]', 'restore');
  combo.defaultValue = ['next'];
  expect(combo.value).to.deep.equal(['restored']);
  form.reset();
  expect(combo.value).to.deep.equal(['next']);
});

for (const mutation of ['disable', 'readonly', 'mode', 'close', 'remove option', 'disable option', 'inert option', 'rename option', 'replace data', 'remove picker'] as const) {
  it(`retires a combobox selection proposal after its listener chooses to ${mutation}`, async () => {
    const combo = await fixture<LyraCombobox>(html`<lr-combobox open>
      <lr-option value="one">One</lr-option></lr-combobox>`);
    const option = combo.querySelector('lr-option')!;
    const row = combo.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!;
    let committed = 0;
    combo.addEventListener('lr-change', () => { committed++; });
    combo.addEventListener('lr-change-request', () => {
      switch (mutation) {
        case 'disable': combo.disabled = true; break;
        case 'readonly': combo.readonly = true; break;
        case 'mode': combo.multiple = true; break;
        case 'close': combo.open = false; break;
        case 'remove option': option.remove(); break;
        case 'disable option': option.disabled = true; break;
        case 'inert option': option.inert = true; break;
        case 'rename option': option.value = 'two'; break;
        case 'replace data': option.data = {}; break;
        case 'remove picker': combo.remove(); break;
      }
    });
    row.click();
    expect(committed).to.equal(0);
    expect(combo.value).to.deep.equal(combo.multiple ? [] : '');
  });
}

it('keeps a nested row activation from replacing the outer proposal', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox open>
    <lr-option value="one">One</lr-option><lr-option value="two">Two</lr-option></lr-combobox>`);
  const rows = combo.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]');
  const requests: unknown[] = [];
  combo.addEventListener('lr-change-request', event => {
    requests.push(event.detail.value);
    if (requests.length === 1) rows[1]!.click();
  });
  rows[0]!.click();
  expect(requests).to.deep.equal(['one']);
  expect(combo.value).to.equal('one');
});

it('honors a listener withdrawing creation while proposing the new row', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox open allow-create></lr-combobox>`);
  combo.inputValue = 'New';
  await combo.updateComplete;
  combo.addEventListener('lr-change-request', () => { combo.allowCreate = false; });
  combo.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!.click();
  expect(combo.value).to.equal('');
  expect(combo.querySelectorAll('lr-option').length).to.equal(0);
});

it('settles an independently aborted source without leaving the value loading', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" value="missing" multiple open></lr-combobox>`);
  let reject!: (reason: Error) => void;
  combo.source = () => new Promise((_resolve, fail) => { reject = fail; });
  await waitUntil(() => Boolean(reject));
  const originalWarn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args) => warnings.push(...args);
  try {
    const error = new DOMException('Canceled', 'AbortError');
    reject(error);
    await waitUntil(() => !!combo.shadowRoot!.querySelector('[part~="unknown-value"]'), 'the settled source reports the unmatched selection');
    expect(combo.shadowRoot!.querySelector('[part="source-error-row"]') === null).to.equal(true);
    expect(warnings).to.deep.equal([]);
  } finally {
    console.warn = originalWarn;
  }
});

for (const name of ['select', 'combobox'] as const) {
  it(`${name} limits an unsynced listbox to its inline allocation`, async () => {
    const picker = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(`<lr-${name}><lr-option>One</lr-option></lr-${name}>`);
    await picker.show();
    const popup = picker.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    popup.style.setProperty('--lr-positioner-available-inline-size', '77px');
    expect(getComputedStyle(popup).maxInlineSize).to.equal('77px');
  });
}

for (const name of ['select', 'combobox'] as const) {
  it(`${name} formats the full accessible selection in the control locale`, async () => {
    const picker = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(`<lr-${name} multiple lang="ja">
      <lr-option value="a">Alpha</lr-option><lr-option value="b">Beta</lr-option></lr-${name}>`);
    picker.value = ['a', 'b'];
    await picker.updateComplete;
    const text = picker.shadowRoot!.querySelector(name === 'select' ? '[part="display-input"]' : '#combobox-value')!;
    expect(text.textContent?.trim()).to.equal(new Intl.ListFormat('ja', { type: 'unit' }).format(['Alpha', 'Beta']));
  });
}

it('keeps stacked select chips inside the space before the clear and expand controls', async () => {
  const el = await fixture<LyraSelect>(html`<lr-select multiple clearable style="inline-size: 11rem">
    <lr-option value="one" selected>A deliberately long selected label</lr-option></lr-select>`);
  for (const dir of ['ltr', 'rtl']) {
    el.dir = dir;
    await el.updateComplete;
    const root = el.shadowRoot!;
    const tags = root.querySelector('[part="tags"]')!.getBoundingClientRect();
    const chevron = root.querySelector('[part="expand-icon"]')!.getBoundingClientRect();
    expect(dir === 'ltr' ? tags.right <= chevron.left : tags.left >= chevron.right).to.equal(true);
  }
});

it('keeps a custom draft if its selection request is vetoed', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox allow-custom-value open></lr-combobox>`);
  combo.inputValue = 'custom';
  combo.addEventListener('lr-change-request', e => e.preventDefault(), { once: true });
  await combo.updateComplete;
  combo.input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
  expect(combo.value).to.equal('');
  expect(combo.inputValue).to.equal('custom');
  combo.input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
  expect(combo.value).to.equal('custom');
});

for (const useSource of [true, false]) {
  it(`keeps unknown selection payloads aligned while proposing a ${useSource ? 'remote' : 'local'} row`, async () => {
    const combo = await fixture<LyraCombobox>(html`<lr-combobox multiple open source-delay="0">
      <lr-option value="one" .data=${{ id: 1 }}>One</lr-option></lr-combobox>`);
    if (useSource) combo.source = () => Promise.resolve([{ value: 'one', label: 'Remote', data: { id: 1 } }]);
    combo.value = ['missing'];
    await combo.updateComplete;
    await waitUntil(() => combo.shadowRoot!.querySelector('[part="option"]')?.textContent?.includes(useSource ? 'Remote' : 'One'));
    let data: readonly unknown[] | undefined;
    combo.addEventListener('lr-change-request', event => { data = event.detail.data; });
    combo.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!.click();
    expect(data).to.deep.equal([undefined, { id: 1 }]);
    expect(combo.value).to.deep.equal(['missing', 'one']);
  });
}

it('retains only the first authored reset value when set in single mode', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox></lr-combobox>`);
  combo.defaultValue = ['one', 'two'];
  expect(combo.value).to.equal('one');
  combo.multiple = true;
  expect(combo.defaultValue).to.deep.equal(['one']);
});

for (const name of ['select', 'combobox'] as const) {
  it(`${name} reuses long accessible value text across unrelated renders`, async () => {
    const picker = await fixture<HTMLElementTagNameMap[`lr-${typeof name}`]>(`<lr-${name} multiple max-options-visible="1"><lr-option value="known">Known</lr-option></lr-${name}>`);
    const values = Array.from({ length: 70 }, (_, index) => String(index));
    let reads = 0;
    picker.getUnknownLabel = value => { reads++; return `Label ${value}`; };
    picker.value = values;
    await picker.updateComplete;
    const valueText = picker.shadowRoot!.querySelector(name === 'select' ? '[part="display-input"]' : '#combobox-value')!;
    expect(valueText.textContent).to.contain('Label 69');
    reads = 0;
    picker.hint = 'Choose';
    await picker.updateComplete;
    expect(reads).to.be.lessThan(10);
    picker.getUnknownLabel = value => `Updated ${value}`;
    await picker.updateComplete;
    expect(valueText.textContent).to.contain('Updated 69');
  });
}

it('keeps the selected remote payload when the next query has different rows', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox multiple open source-delay="0"></lr-combobox>`);
  combo.source = async query => query === 'Two'
    ? [{ value: 'two', label: 'Two', data: 2 }]
    : [{ value: 'one', label: 'One', data: 1 }];
  const displayed = () => combo.shadowRoot!.querySelector<HTMLElement>('[part="option"]');
  await waitUntil(() => displayed()?.textContent?.includes('One'));
  displayed()!.click();
  combo.inputValue = 'Two';
  await waitUntil(() => displayed()?.textContent?.includes('Two'));
  let data: readonly unknown[] | undefined;
  combo.addEventListener('lr-change-request', event => { data = event.detail.data; });
  displayed()!.click();
  expect(data).to.deep.equal([1, 2]);
  expect(combo.value).to.deep.equal(['one', 'two']);
});

it('toggles a multiple selection by value across equal-valued suggestions', async () => {
  const form = await fixture<HTMLFormElement>(html`<form><lr-combobox name="choice" multiple open>
    <lr-option value="same" .data=${1}>First</lr-option>
    <lr-option value="same" .data=${2}>Second</lr-option>
    <lr-option value="other" .data=${3}>Other</lr-option>
  </lr-combobox></form>`);
  const combo = form.querySelector('lr-combobox')!;
  const rows = () => Array.from(combo.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]'));
  const states = () => rows().map(row => row.getAttribute('aria-selected'));
  const proposals: unknown[] = [];
  combo.addEventListener('lr-change-request', event => { proposals.push(event.detail.data); });
  rows()[1]!.click();
  await combo.updateComplete;
  expect(states()).to.deep.equal(['true', 'true', 'false']);
  expect(combo.selectedRows.map(row => row.data)).to.deep.equal([2]);
  expect(new FormData(form).getAll('choice')).to.deep.equal(['same']);
  rows()[0]!.click();
  await combo.updateComplete;
  expect(combo.value).to.deep.equal([]);
  expect(new FormData(form).getAll('choice')).to.deep.equal([]);
  expect(states()).to.deep.equal(['false', 'false', 'false']);
  expect(proposals).to.deep.equal([[2], []]);
});

it('keeps value identity and the chosen payload across an async source refresh', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox multiple open source-delay="0"></lr-combobox>`);
  let calls = 0;
  combo.source = async query => {
    calls++;
    const first = { value: 'same', label: 'First', data: 1 };
    const second = { value: 'same', label: 'Second', data: 2 };
    return query ? [first] : [first, second];
  };
  const rows = () => Array.from(combo.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]'));
  const states = () => rows().map(row => row.getAttribute('aria-selected'));
  await waitUntil(() => rows().length === 2);
  const before = calls;
  rows()[1]!.click();
  await waitUntil(() => calls > before && states().join() === 'true,true');
  combo.inputValue = 'First';
  await waitUntil(() => rows().length === 1);
  expect(states()).to.deep.equal(['true']);
  expect(combo.selectedRows.map(row => row.data)).to.deep.equal([2]);
  rows()[0]!.click();
  await waitUntil(() => rows().length === 2);
  expect(states()).to.deep.equal(['false', 'false']);
  expect(combo.value).to.deep.equal([]);
});

it('retains the selected option occurrence at reset and through a multiple mode change', async () => {
  const form = await fixture<HTMLFormElement>(html`<form><lr-combobox multiple name="choice">
    <lr-option value="same" .data=${1}>First</lr-option>
    <lr-option value="same" selected .data=${2}>Second</lr-option>
  </lr-combobox></form>`);
  const combo = form.querySelector('lr-combobox')!;
  const [first, second] = Array.from(combo.querySelectorAll('lr-option'));
  expect(combo.selectedRows.map(row => row.data)).to.deep.equal([2]);
  first!.selected = true;
  await Promise.resolve();
  expect(new FormData(form).getAll('choice')).to.deep.equal(['same', 'same']);
  first!.selected = true;
  await Promise.resolve();
  expect(combo.selectedRows.map(row => row.data)).to.deep.equal([2, 1]);
  combo.multiple = false;
  await combo.updateComplete;
  expect(combo.selectedRows.map(row => row.data)).to.deep.equal([2]);
  combo.multiple = true;
  await combo.updateComplete;
  second!.selected = false;
  await Promise.resolve();
  expect(combo.selectedRows.map(row => row.data)).to.deep.equal([1]);
  form.reset();
  expect(combo.selectedRows.map(row => row.data)).to.deep.equal([2]);
});

it('deselects an unknown value from all equal synthetic rows', async () => {
  const combo = await fixture<LyraCombobox>(html`<lr-combobox multiple with-unknown-option
    .value=${['ghost', 'other', 'ghost']}></lr-combobox>`);
  await combo.show();
  const rows = combo.shadowRoot!.querySelectorAll<HTMLElement>('[data-unknown-value][role="option"]');
  expect(Array.from(rows, row => row.dataset['value'])).to.deep.equal(['ghost', 'other', 'ghost']);
  rows[2]!.click();
  expect(combo.value).to.deep.equal(['other']);
});
