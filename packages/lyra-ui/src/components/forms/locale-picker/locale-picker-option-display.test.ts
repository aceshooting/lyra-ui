import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.js';

const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
before(() => setFlagUrlResolver(async () => TEST_FLAG_SRC));
after(() => {
  fixtureCleanup();
  setFlagUrlResolver(null);
});

// Custom labels that share no characters with their BCP-47 tag, so "is the tag rendered?" can be
// answered from the row's own text without the endonym accidentally supplying the answer.
const CATALOG = [
  { tag: 'fr-CA', label: 'Canadien' },
  { tag: 'pt-BR', label: 'Brasileiro' },
];

function optionRows(el: LyraLocalePicker): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="option"]')];
}
function optionTags(el: LyraLocalePicker): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="option-tag"]')];
}
async function openPicker(el: LyraLocalePicker): Promise<void> {
  el.open = true;
  await el.updateComplete;
}

describe('lr-locale-picker optionDisplay', () => {
  it('defaults to label-tag and renders one tag line per row', async () => {
    const el = await fixture<LyraLocalePicker>(
      html`<lr-locale-picker .showFlags=${false} .locales=${CATALOG}></lr-locale-picker>`,
    );
    await openPicker(el);
    expect(el.optionDisplay).to.equal('label-tag');
    expect(optionTags(el).length).to.equal(CATALOG.length);
    expect(optionTags(el).map((node) => node.textContent)).to.deep.equal(['fr-CA', 'pt-BR']);
    expect(optionRows(el)[0]!.textContent!.includes('fr-CA')).to.equal(
      true,
      'the default rendering keeps the raw tag in the row text',
    );
  });

  it('omits the option-tag part entirely under optionDisplay="label"', async () => {
    const el = await fixture<LyraLocalePicker>(
      html`<lr-locale-picker
        option-display="label"
        .showFlags=${false}
        .locales=${CATALOG}
      ></lr-locale-picker>`,
    );
    await openPicker(el);
    expect(el.optionDisplay).to.equal('label');
    expect(el.shadowRoot!.querySelector('[part~="option-tag"]') === null).to.equal(
      true,
      'option-tag must be absent from the shadow tree, not merely hidden',
    );
    expect(optionTags(el).length).to.equal(0);
    // Omission, not CSS hiding: a visually hidden tag would still sit in the row's text and would
    // still be announced as part of the option's accessible name.
    const rows = optionRows(el);
    expect(rows.length).to.equal(CATALOG.length);
    expect(rows[0]!.textContent!.includes('fr-CA')).to.equal(
      false,
      'the raw tag must not survive in the row text under optionDisplay="label"',
    );
    expect(rows[0]!.textContent!.includes('Canadien')).to.equal(true);
    expect(rows[1]!.textContent!.includes('pt-BR')).to.equal(false);
  });

  it('restores the tag line when the attribute is removed again (unset regression)', async () => {
    const el = await fixture<LyraLocalePicker>(
      html`<lr-locale-picker .showFlags=${false} .locales=${CATALOG}></lr-locale-picker>`,
    );
    await openPicker(el);
    expect(optionTags(el).length).to.equal(CATALOG.length);

    el.setAttribute('option-display', 'label');
    await el.updateComplete;
    expect(el.optionDisplay).to.equal('label');
    expect(optionTags(el).length).to.equal(0);

    el.removeAttribute('option-display');
    await el.updateComplete;
    expect(el.optionDisplay).to.equal(
      'label-tag',
      'removing the attribute returns the declared default, never undefined',
    );
    expect(optionTags(el).map((node) => node.textContent)).to.deep.equal(['fr-CA', 'pt-BR']);

    // The property path agrees with the attribute path.
    el.optionDisplay = 'label';
    await el.updateComplete;
    expect(optionTags(el).length).to.equal(0);
    el.optionDisplay = 'label-tag';
    await el.updateComplete;
    expect(optionTags(el).length).to.equal(CATALOG.length);
  });

  it('leaves every other option surface untouched in both modes (unset regression)', async () => {
    const el = await fixture<LyraLocalePicker>(
      html`<lr-locale-picker value="fr-CA" .locales=${CATALOG}></lr-locale-picker>`,
    );
    await openPicker(el);
    const baselineFlags = el.shadowRoot!.querySelectorAll('[part~="option-flag"]').length;
    const baselineLabels = el.shadowRoot!.querySelectorAll('[part~="option-label"]').length;
    const baselineSelected = optionRows(el).map((row) => row.getAttribute('aria-selected'));
    expect(baselineFlags).to.equal(CATALOG.length);
    expect(baselineLabels).to.equal(CATALOG.length);
    expect(baselineSelected).to.deep.equal(['true', 'false']);

    el.optionDisplay = 'label';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part~="option-flag"]').length).to.equal(baselineFlags);
    expect(el.shadowRoot!.querySelectorAll('[part~="option-label"]').length).to.equal(baselineLabels);
    expect(optionRows(el).map((row) => row.getAttribute('aria-selected'))).to.deep.equal(baselineSelected);
    expect(optionRows(el).map((row) => row.dataset['value'])).to.deep.equal(['fr-CA', 'pt-BR']);
    // The trigger keeps the committed label regardless of the option rendering.
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part~="trigger-label"]')!.textContent).to.equal('Canadien');
  });

  it('omits the tag under dir="rtl" as well, keeping the stacked logical row layout', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir="rtl">
        <lr-locale-picker option-display="label" .showFlags=${false} .locales=${CATALOG}></lr-locale-picker>
      </div>
    `);
    const el = wrapper.querySelector('lr-locale-picker') as LyraLocalePicker;
    await openPicker(el);
    expect(getComputedStyle(el).direction).to.equal('rtl');
    expect(el.shadowRoot!.querySelector('[part~="option-tag"]') === null).to.equal(
      true,
      'option-tag stays omitted under RTL',
    );
    const label = el.shadowRoot!.querySelector<HTMLElement>('[part~="option-label"]')!;
    expect(getComputedStyle(label).flexDirection).to.equal('column');
    expect(getComputedStyle(optionRows(el)[0]!).textAlign).to.equal('start');
  });

  it('still commits the actually-focused row from the keyboard with the tag omitted', async () => {
    const el = await fixture<LyraLocalePicker>(
      html`<lr-locale-picker option-display="label" .showFlags=${false} .locales=${CATALOG}></lr-locale-picker>`,
    );
    // The page-level locale is the host's job once a listener vetoes; keep this fixture from
    // mutating the shared registry state every other test in the run reads.
    el.addEventListener('lr-change', (event: Event) => event.preventDefault());
    const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="trigger"]')!;
    trigger.focus();
    expect(el.shadowRoot!.activeElement === trigger).to.equal(true, 'the trigger owns focus');
    await sendKeys({ press: 'ArrowDown' });
    await el.updateComplete;
    await sendKeys({ press: 'ArrowDown' });
    await el.updateComplete;
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.value).to.equal('fr-CA');
    expect(el.shadowRoot!.querySelector('[part~="option-tag"]') === null).to.equal(true);
  });

  it('passes axe with the listbox open and populated in the label-only mode', async () => {
    const el = await fixture<LyraLocalePicker>(
      html`<lr-locale-picker
        label="Language"
        option-display="label"
        .locales=${CATALOG}
      ></lr-locale-picker>`,
    );
    await openPicker(el);
    expect(optionRows(el).length).to.equal(CATALOG.length);
    await expect(el).to.be.accessible();
  });
});
