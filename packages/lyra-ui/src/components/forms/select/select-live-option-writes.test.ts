import { expect, fixture, html } from '@open-wc/testing';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraOption } from '../combobox/option.js';

const settle = async (el: { updateComplete: Promise<unknown> }) => {
  await Promise.resolve();
  await Promise.resolve();
  await el.updateComplete;
};

const optionsOf = (el: Element) => [...el.querySelectorAll<LyraOption>('lr-option')];

describe('lr-select live option selected writes', () => {
  it('clears a single selection when its own option is deselected', async () => {
    const el = await fixture<LyraSelect>(html`<lr-select value="b">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>`);
    const [, banana] = optionsOf(el);
    expect(el.value).to.equal('b');

    banana!.selected = false;
    await settle(el);

    expect(el.value).to.equal('');
    expect(banana!.selected).to.equal(false);
  });

  it('keeps a single selection when a different option is deselected', async () => {
    const el = await fixture<LyraSelect>(html`<lr-select value="b">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>`);
    const [apple] = optionsOf(el);

    apple!.selected = true;
    apple!.selected = false;
    await settle(el);

    expect(el.value).to.equal('b');
  });

  it('removes and adds individual values in multiple mode from option writes', async () => {
    const el = await fixture<LyraSelect<true>>(html`<lr-select multiple>
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>`);
    const [, banana, cherry] = optionsOf(el);
    expect(el.value).to.deep.equal(['a', 'b']);

    banana!.selected = false;
    cherry!.selected = true;
    await settle(el);

    expect(el.value).to.deep.equal(['a', 'c']);
    expect(optionsOf(el).map((option) => option.selected)).to.deep.equal([true, false, true]);
  });

  it('re-values an already selected option when it is written selected again with a new value', async () => {
    const el = await fixture<LyraSelect<true>>(html`<lr-select multiple>
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>`);
    const [apple] = optionsOf(el);

    apple!.value = 'apricot';
    apple!.selected = true;
    await settle(el);

    expect(el.value).to.deep.equal(['apricot']);
  });
});

describe('lr-select keyboard navigation with no navigable option', () => {
  it('leaves no active option for arrow, Home and End keys when every option is disabled', async () => {
    const el = await fixture<LyraSelect>(html`<lr-select>
      <lr-option value="a" disabled>Apple</lr-option>
      <lr-option value="b" disabled>Banana</lr-option>
    </lr-select>`);
    await el.show();
    const trigger = el.renderRoot.querySelector<HTMLElement>('[part="trigger"]')!;
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
      await el.updateComplete;
      expect(el.open, key).to.equal(true);
      expect(trigger.getAttribute('aria-activedescendant') ?? '', key).to.equal('');
      expect(el.renderRoot.querySelector('[part~="option"][data-active]') !== null, key).to.equal(false);
    }
    expect(el.value).to.equal('');
  });
});

describe('lr-select vetoed tag removal', () => {
  it('keeps both values when a tag removal is canceled through lr-change-request', async () => {
    const el = await fixture<LyraSelect<true>>(html`<lr-select multiple label="Fruit">
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
    </lr-select>`);
    let requests = 0;
    let changes = 0;
    el.addEventListener('lr-change-request', (event) => { requests += 1; event.preventDefault(); });
    el.addEventListener('lr-change', () => { changes += 1; });
    const remove = el.renderRoot.querySelector<HTMLButtonElement>('[part~="tag__remove-button"]');
    expect(remove !== null, 'a removable tag renders').to.equal(true);

    remove!.click();
    await el.updateComplete;

    expect(requests).to.equal(1);
    expect(changes).to.equal(0);
    expect(el.value).to.deep.equal(['a', 'b']);
    expect(el.renderRoot.querySelectorAll('[part~="tag__remove-button"]').length).to.equal(2);
  });
});

describe('lr-select multiple with unmatched committed values', () => {
  it('keeps an unmatched value in place when another option is added', async () => {
    const el = await fixture<LyraSelect<true>>(html`<lr-select multiple label="Fruit" .value=${['zzz', 'a']}>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>`);
    expect(el.value).to.deep.equal(['zzz', 'a']);
    await el.show();
    el.renderRoot.querySelector<HTMLElement>('[part="option"][data-value="b"]')!.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(['zzz', 'a', 'b']);
    expect(el.selectedOptions.map((option) => option.value)).to.deep.equal(['a', 'b']);
  });
});
