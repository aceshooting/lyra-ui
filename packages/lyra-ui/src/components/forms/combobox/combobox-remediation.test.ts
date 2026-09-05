import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraCombobox } from './combobox.js';
import type { LyraOption } from './option.js';
import type { LyraSelect } from '../select/select.js';
import './combobox.js';
import './option.js';
import '../select/select.js';

const settle = async (el: LyraCombobox | LyraSelect): Promise<void> => {
  await el.updateComplete;
  await aTimeout(0);
  await el.updateComplete;
};
const descriptions = (el: Element): Element[] =>
  Array.from((el as Element & { ariaDescribedByElements?: Element[] }).ariaDescribedByElements ?? []);

for (const tag of ['lr-combobox', 'lr-select'] as const) {
  const mount = async (multiple = false) => {
    const form = await fixture<HTMLFormElement>(tag === 'lr-combobox' ? html`
      <form><lr-combobox name="pick" label="Pick" .multiple=${multiple}>
        <lr-option value="a" selected>Alpha</lr-option><lr-option value="b">Beta</lr-option>
      </lr-combobox></form>` : html`
      <form><lr-select name="pick" label="Pick" .multiple=${multiple}>
        <lr-option value="a" selected>Alpha</lr-option><lr-option value="b">Beta</lr-option>
      </lr-select></form>`);
    const el = form.querySelector(tag)! as LyraCombobox | LyraSelect;
    await settle(el);
    const [a, b] = Array.from(el.querySelectorAll<LyraOption>('lr-option'));
    if (!a || !b) throw new Error('Expected two source options');
    return { form, el, a, b };
  };

  for (const multiple of [false, true]) {
    it(`${tag} immediately consumes mounted ${multiple ? 'multiple' : 'single'} selected writes silently and keeps reset defaults`, async () => {
      const { form, el, a, b } = await mount(multiple);
      const events: string[] = [];
      for (const name of ['input', 'change', 'lr-input', 'lr-change', 'lr-option-change']) {
        el.addEventListener(name, () => events.push(name));
      }
      let childChanges = 0;
      b.addEventListener('lr-option-change', (event) => {
        childChanges += 1;
        expect(event.detail).to.equal(null);
      });
      b.selected = true;
      expect(childChanges).to.equal(1);
      expect(el.value).to.deep.equal(multiple ? ['a', 'b'] : 'b');
      expect(new FormData(form).getAll('pick')).to.deep.equal(multiple ? ['a', 'b'] : ['b']);
      await settle(el);
      expect(childChanges).to.equal(1);
      a.defaultSelected = false;
      a.defaultSelected = true;
      b.sub = 'Updated';
      await settle(el);
      expect(el.value).to.deep.equal(multiple ? ['a', 'b'] : 'b');
      b.selected = false;
      expect(el.value).to.deep.equal(multiple ? ['a'] : '');
      expect(new FormData(form).getAll('pick')).to.deep.equal(multiple ? ['a'] : ['']);
      a.selected = false;
      expect(el.value).to.deep.equal(multiple ? [] : '');
      await settle(el);
      expect(events).to.deep.equal([]);
      form.reset();
      await settle(el);
      expect(el.value).to.deep.equal(multiple ? ['a'] : 'a');
      expect([a.selected, b.selected]).to.deep.equal([true, false]);
    });

    it(`${tag} treats an equal mounted selected write as a live edit in ${multiple ? 'multiple' : 'single'} mode`, async () => {
      const { el, a, b, form } = await mount(multiple);
      a.selected = true;
      b.defaultSelected = true;
      await settle(el);
      expect(el.value).to.deep.equal(multiple ? ['a'] : 'a');
      form.reset();
      await settle(el);
      expect(el.value).to.deep.equal(multiple ? ['a', 'b'] : 'a');
    });
  }

  it(`${tag} retains an initially empty reset default after mounted selection`, async () => {
    const { el, a, b, form } = await mount();
    a.defaultSelected = false;
    await settle(el);
    b.selected = true;
    expect(el.value).to.equal('b');
    form.reset();
    await settle(el);
    expect(el.value).to.equal('');
  });

  it(`${tag} resolves previously missing descriptions after iframe adoption`, async () => {
    const { el } = await mount();
    el.hint = 'Local hint';
    el.setAttribute('aria-describedby', 'adopted-guidance');
    await settle(el);
    const target = el.shadowRoot!.querySelector<HTMLElement>('[role="combobox"]')!;
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error('Expected an iframe document');
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      const source = frameDocument.createElement('p');
      source.id = 'adopted-guidance';
      source.textContent = 'Adopted guidance';
      frameDocument.body.append(source);
      await waitUntil(() => descriptions(target)[0] === source);
      expect(descriptions(target).map((item) => item.textContent?.trim())).to.deep.equal(['Adopted guidance', 'Local hint']);
      source.id = 'different-guidance';
      await waitUntil(() => descriptions(target).length === 1);
      source.id = 'adopted-guidance';
      await waitUntil(() => descriptions(target)[0] === source);
    } finally {
      document.adoptNode(el);
      el.remove();
      frame.remove();
    }
  });

  for (const attribute of tag === 'lr-select' ? ['label', 'hint', 'help-text', 'error-text'] : ['label', 'hint', 'error-text']) {
    it(`${tag} safely renders removed ${attribute} without changing null readback`, async () => {
      const { el } = await mount();
      const property = attribute === 'error-text' ? 'errorText' : attribute === 'help-text' ? 'helpText' : attribute;
      el.setAttribute(attribute, 'Guidance');
      await settle(el);
      el.removeAttribute(attribute);
      await settle(el);
      expect(Reflect.get(el, property)).to.equal(null);
      expect(el.shadowRoot!.textContent?.includes('Guidance')).to.equal(false);
      el.setAttribute(attribute, '');
      await settle(el);
      expect(Reflect.get(el, property)).to.equal('');
      el.setAttribute(attribute, 'Recovered');
      await settle(el);
      expect(el.shadowRoot!.textContent?.includes('Recovered')).to.equal(true);
    });
  }

  it(`${tag} projects live external descriptions before internal guidance through replacement and reconnect`, async () => {
    const { el, form } = await mount();
    const source = document.createElement('p');
    source.id = `${tag}-external`;
    source.textContent = 'External guidance';
    form.prepend(source);
    el.hint = 'Local hint';
    el.errorText = 'Local error';
    el.setAttribute('aria-describedby', `${source.id} unresolved ${source.id}`);
    await settle(el);
    const target = el.shadowRoot!.querySelector<HTMLElement>('[role="combobox"]')!;
    await waitUntil(() => descriptions(target)[0] === source);
    expect(descriptions(target).map((item) => item.textContent?.trim())).to.deep.equal(['External guidance', 'Local error', 'Local hint']);
    const replacement = source.cloneNode(true) as HTMLElement;
    replacement.textContent = 'Replacement';
    source.replaceWith(replacement);
    await waitUntil(() => descriptions(target)[0] === replacement);
    replacement.remove();
    await waitUntil(() => descriptions(target).length === 2);
    form.prepend(replacement);
    await waitUntil(() => descriptions(target)[0] === replacement);
    el.removeAttribute('aria-describedby');
    await waitUntil(() => descriptions(target).length === 2);
    el.setAttribute('aria-describedby', replacement.id);
    await waitUntil(() => descriptions(target)[0] === replacement);
    el.remove();
    form.append(el);
    await settle(el);
    await waitUntil(() => descriptions(target)[0] === replacement);
  });
}

it('select keeps exact duplicate occurrences for mounted selected writes', async () => {
  const form = await fixture<HTMLFormElement>(html`<form><lr-select name="pick" label="Pick" multiple>
    <lr-option value="same" selected>First</lr-option><lr-option value="same">Second</lr-option>
  </lr-select></form>`);
  const el = form.querySelector<LyraSelect>('lr-select')!;
  await settle(el);
  const [a, b] = Array.from(el.querySelectorAll<LyraOption>('lr-option'));
  if (!a || !b) throw new Error('Expected duplicate options');
  b.selected = true;
  expect(el.value).to.deep.equal(['same', 'same']);
  expect(new FormData(form).getAll('pick')).to.deep.equal(['same', 'same']);
  a.selected = false;
  expect(el.selectedOptions.map((option) => option.label)).to.deep.equal(['Second']);
  el.multiple = false;
  a.selected = true;
  expect(el.selectedOptions.map((option) => option.label)).to.deep.equal(['First']);
  b.selected = false;
  expect(el.value).to.equal('same');
});

it('combobox exposes one effective selection while retaining multiple selection history', async () => {
  const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick" multiple>
    <lr-option value="a">Alpha</lr-option><lr-option value="b">Beta</lr-option>
  </lr-combobox>`);
  await settle(el);
  el.value = ['a', 'b'];
  el.multiple = false;
  await el.show();
  expect(el.value).to.equal('a');
  expect(Array.from(el.querySelectorAll<LyraOption>('lr-option')).map((option) => option.selected)).to.deep.equal([true, false]);
  expect(Array.from(el.shadowRoot!.querySelectorAll('[part="option"]')).map((row) => row.getAttribute('aria-selected'))).to.deep.equal(['true', 'false']);
  el.multiple = true;
  await settle(el);
  expect(el.value).to.deep.equal(['a', 'b']);
  expect(Array.from(el.querySelectorAll<LyraOption>('lr-option')).map((option) => option.selected)).to.deep.equal([true, true]);
});

for (const legacy of [false, true]) {
  for (const custom of [false, true]) {
    it(`combobox leaves ${legacy ? 'legacy' : 'isComposing'} keys in the ${custom ? 'custom-value' : 'active-option'} filter`, async () => {
      const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick" .allowCustomValue=${custom}>
        <lr-option value="a">Alpha</lr-option><lr-option value="b">Beta</lr-option>
      </lr-combobox>`);
      await el.show();
      const input = el.shadowRoot!.querySelector('input')!;
      input.value = custom ? 'Novel' : '';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      await settle(el);
      if (!custom) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await settle(el);
      const active = input.getAttribute('aria-activedescendant');
      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', 'Tab']) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, isComposing: !legacy, keyCode: legacy ? 229 : 0 });
        input.dispatchEvent(event);
        await settle(el);
        expect(event.defaultPrevented, key).to.equal(false);
        expect(el.value, key).to.equal('');
        expect(el.open, key).to.equal(true);
        expect(input.getAttribute('aria-activedescendant'), key).to.equal(active);
      }
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await settle(el);
      expect(el.value).to.equal(custom ? 'Novel' : 'a');
    });
  }
}

it('combobox refreshes inert availability and skips unavailable source proxies', async () => {
  const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick">
    <lr-option value="a" inert>Alpha</lr-option><lr-option value="b">Beta</lr-option>
  </lr-combobox>`);
  await el.show();
  const a = el.querySelector<LyraOption>('lr-option')!;
  const input = el.shadowRoot!.querySelector('input')!;
  const row = () => el.shadowRoot!.querySelector<HTMLElement>('[data-value="a"]')!;
  expect(row().getAttribute('aria-disabled')).to.equal('true');
  row().click();
  expect(el.value).to.equal('');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(el.value).to.equal('b');
  a.inert = false;
  await waitUntil(() => row().getAttribute('aria-disabled') === 'false');
  a.inert = true;
  await waitUntil(() => row().getAttribute('aria-disabled') === 'true');
  a.inert = false;
  el.inert = true;
  await waitUntil(() => row().getAttribute('aria-disabled') === 'true');
  el.inert = false;
  await waitUntil(() => row().getAttribute('aria-disabled') === 'false');
});

for (const slot of ['start', 'end', 'prefix', 'suffix']) {
  it(`combobox refreshes ${slot} adornment snapshots only after source presentation changes`, async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick"><lr-option value="a">Alpha</lr-option></lr-combobox>`);
    await el.show();
    const source = el.querySelector<LyraOption>('lr-option')!;
    const span = document.createElement('span');
    span.slot = slot;
    span.textContent = 'First';
    const part = slot === 'prefix' || slot === 'start' ? 'option-start' : 'option-end';
    const clone = () => el.shadowRoot!.querySelector(`[part~="${part}"] span`);
    source.append(span);
    await waitUntil(() => clone()?.textContent === 'First');
    span.firstChild!.textContent = 'Second';
    await waitUntil(() => clone()?.textContent === 'Second');
    const unchanged = clone();
    const input = el.shadowRoot!.querySelector('input')!;
    input.value = 'Al';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle(el);
    expect(clone() === unchanged).to.equal(true);
    source.sub = 'Updated secondary text';
    await settle(el);
    expect(clone() === unchanged).to.equal(true);
    span.setAttribute('title', 'Updated title');
    await waitUntil(() => clone()?.getAttribute('title') === 'Updated title');
    const replacement = span.cloneNode(true) as HTMLElement;
    replacement.textContent = 'Replacement';
    span.replaceWith(replacement);
    await waitUntil(() => clone()?.textContent === 'Replacement');
    replacement.remove();
    await waitUntil(() => clone() === null);
  });
}

it('combobox exposes the exact mounted duplicate occurrence in single mode', async () => {
  const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick">
    <lr-option value="same">First</lr-option><lr-option value="same">Second</lr-option>
  </lr-combobox>`);
  await settle(el);
  const [a, b] = Array.from(el.querySelectorAll<LyraOption>('lr-option'));
  if (!a || !b) throw new Error('Expected duplicate source options');
  b.selected = true;
  await el.show();
  expect([a.selected, b.selected]).to.deep.equal([false, true]);
  expect(Array.from(el.shadowRoot!.querySelectorAll('[part="option"]')).map((row) => row.getAttribute('aria-selected'))).to.deep.equal(['false', 'true']);
  a.selected = false;
  expect(el.value).to.equal('same');
  b.selected = false;
  expect(el.value).to.equal('');
});

for (const slot of ['start', 'end', 'prefix', 'suffix']) {
  it(`combobox removes and reassigns decorative ${slot} presentation without a label change`, async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Pick"><lr-option value="a">Alpha</lr-option></lr-combobox>`);
    const option = el.querySelector<LyraOption>('lr-option')!;
    const decoration = document.createElement('span');
    decoration.slot = slot;
    decoration.setAttribute('aria-hidden', 'true');
    decoration.textContent = 'Decoration';
    option.append(decoration);
    await el.show();
    const originalPart = slot === 'start' || slot === 'prefix' ? 'option-start' : 'option-end';
    const oppositePart = originalPart === 'option-start' ? 'option-end' : 'option-start';
    const presentation = (part: string) => el.shadowRoot!.querySelector(`[part~="${part}"]`);
    expect(presentation(originalPart)?.textContent).to.equal('Decoration');
    const originalLabel = option.defaultLabel;
    decoration.removeAttribute('slot');
    await waitUntil(() => presentation(originalPart) === null);
    expect(option.defaultLabel).to.equal(originalLabel);
    decoration.slot = originalPart === 'option-start' ? 'end' : 'start';
    await waitUntil(() => presentation(oppositePart)?.textContent === 'Decoration');
    expect(presentation(originalPart) === null).to.equal(true);
    decoration.slot = slot;
    await waitUntil(() => presentation(originalPart)?.textContent === 'Decoration');
    expect(presentation(oppositePart) === null).to.equal(true);
    expect(option.defaultLabel).to.equal(originalLabel);
  });
}

for (const tag of ['lr-combobox', 'lr-select']) {
  for (const multiple of [false, true]) {
    it(`${tag} preserves unmatched values when unrelated mounted options are deselected in ${multiple ? 'multiple' : 'single'} mode`, async () => {
      const form = await fixture<HTMLFormElement>(`<form><${tag} name="pick" label="Pick" ${multiple ? 'multiple' : ''}>
        <lr-option value="a">Alpha</lr-option><lr-option value="b">Beta</lr-option>
      </${tag}></form>`);
      const el = form.querySelector(tag) as LyraCombobox | LyraSelect;
      await settle(el);
      el.value = multiple ? ['custom', 'a'] : 'custom';
      const b = el.querySelectorAll<LyraOption>('lr-option')[1]!;
      b.selected = false;
      expect(el.value).to.deep.equal(multiple ? ['custom', 'a'] : 'custom');
      expect(new FormData(form).getAll('pick')).to.deep.equal(multiple ? ['custom', 'a'] : ['custom']);
      b.selected = true;
      expect(el.value).to.deep.equal(multiple ? ['custom', 'a', 'b'] : 'b');
      b.selected = false;
      expect(el.value).to.deep.equal(multiple ? ['custom', 'a'] : '');
      expect(new FormData(form).getAll('pick')).to.deep.equal(multiple ? ['custom', 'a'] : ['']);
      await settle(el);
      expect(el.value).to.deep.equal(multiple ? ['custom', 'a'] : '');
    });
  }
}

it('select retains unmatched values and exact duplicate occurrences while editing mounted options', async () => {
  const el = await fixture<LyraSelect>(html`<lr-select label="Pick" multiple>
    <lr-option value="same">First</lr-option><lr-option value="same">Second</lr-option>
  </lr-select>`);
  await settle(el);
  el.value = ['custom', 'same'];
  const [a, b] = Array.from(el.querySelectorAll<LyraOption>('lr-option'));
  if (!a || !b) throw new Error('Expected duplicate source options');
  b.selected = true;
  expect(el.value).to.deep.equal(['custom', 'same', 'same']);
  expect(el.selectedOptions.map((option) => option.label)).to.deep.equal(['First', 'Second']);
  a.selected = false;
  expect(el.value).to.deep.equal(['custom', 'same']);
  expect(el.selectedOptions.map((option) => option.label)).to.deep.equal(['Second']);
  b.selected = true;
  expect(el.value).to.deep.equal(['custom', 'same']);
  expect(el.selectedOptions.map((option) => option.label)).to.deep.equal(['Second']);
  b.selected = false;
  expect(el.value).to.deep.equal(['custom']);
});

for (const multiple of [false, true]) {
  for (const selected of [false, true]) {
    it(`select preserves committed occurrences when an option is renamed before selected=${selected} in ${multiple ? 'multiple' : 'single'} mode`, async () => {
      const form = await fixture<HTMLFormElement>(html`<form><lr-select name="pick" label="Pick" .multiple=${multiple}>
        <lr-option value="a">Alpha</lr-option><lr-option value="b">Beta</lr-option>
      </lr-select></form>`);
      const el = form.querySelector<LyraSelect>('lr-select')!;
      await settle(el);
      el.value = multiple ? ['custom', 'a', 'b'] : 'a';
      const first = el.querySelector<LyraOption>('lr-option')!;
      const events: string[] = [];
      for (const name of ['input', 'change', 'lr-input', 'lr-change']) {
        el.addEventListener(name, () => events.push(name));
      }
      first.value = 'renamed';
      first.selected = selected;
      const expected = multiple
        ? selected ? ['custom', 'renamed', 'b'] : ['custom', 'b']
        : selected ? 'renamed' : '';
      expect(el.value).to.deep.equal(expected);
      expect(new FormData(form).getAll('pick')).to.deep.equal(Array.isArray(expected) ? expected : [expected]);
      expect(el.selectedOptions.map((option) => option.value)).to.deep.equal(multiple
        ? selected ? ['renamed', 'b'] : ['b']
        : selected ? ['renamed'] : []);
      expect(events).to.deep.equal([]);
      await settle(el);
      expect(el.value).to.deep.equal(expected);
      expect(new FormData(form).getAll('pick')).to.deep.equal(Array.isArray(expected) ? expected : [expected]);
    });
  }
}
