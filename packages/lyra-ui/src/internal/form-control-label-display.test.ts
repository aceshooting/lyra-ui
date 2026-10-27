import { expect, fixture, html } from '@open-wc/testing';
import { accessibleName } from '../../test/accessible-name.js';
import { tag } from './prefix.js';
import '../components/forms/select/select.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/input/input.js';
import '../components/forms/input/time-input.js';
import '../components/forms/textarea/textarea.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/forms/unit-picker/unit-picker.js';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/phone-input/phone-input.js';
import '../components/forms/token-input/token-input.js';
import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';

type Field = HTMLElement & {
  label: string;
  hint: string;
  errorText: string;
  required: boolean;
  labelDisplay: string;
  updateComplete: Promise<boolean>;
};

const ROLE_OWNER = 'input:not([type="hidden"]), textarea, [role="combobox"], select, button[aria-haspopup], [role="group"]';
const TAGS = ['select', 'combobox', 'input', 'time-input', 'textarea', 'locale-picker', 'unit-picker', 'date-input',
  'phone-input', 'token-input', 'model-select', 'voice-picker'];

async function make(name: string, attrs: Partial<Field> = {}, dir?: string): Promise<Field> {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size: 320px"></div>`);
  if (dir) wrapper.dir = dir;
  const el = document.createElement(tag(name)) as Field;
  el.label = 'Pick a thing';
  el.hint = 'Hint stays';
  Object.assign(el, attrs);
  if (name === 'locale-picker') el.setAttribute('without-flags', '');
  wrapper.append(el);
  await el.updateComplete;
  return el;
}

/** A shadow part, descending one level for a catalog picker that wraps an lr-select or lr-combobox. */
function part(el: Field, name: string): HTMLElement {
  const own = el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
  if (own) return own;
  const inner = el.shadowRoot!.querySelector<Field>(`${tag('select')}, ${tag('combobox')}`);
  const nested = inner?.shadowRoot?.querySelector<HTMLElement>(`[part~="${name}"]`);
  if (!nested) throw new Error(`no ${name} part`);
  return nested;
}
const labelPart = (el: Field): HTMLElement => part(el, 'form-control-label');

function isVisuallyHidden(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width <= 1 && rect.height <= 1 && style.clipPath !== 'none' && style.overflow === 'hidden';
}

for (const name of TAGS) {
  describe(`${name} label-display`, () => {
    it('renders the label by default and treats an explicit visible value as unset', async () => {
      const el = await make(name);
      expect(el.labelDisplay).to.equal('visible');
      expect(el.getAttribute('label-display')).to.equal('visible');
      expect(isVisuallyHidden(labelPart(el))).to.equal(false);
      expect(labelPart(el).getBoundingClientRect().width).to.be.greaterThan(20);
      el.labelDisplay = 'visible';
      await el.updateComplete;
      expect(isVisuallyHidden(labelPart(el))).to.equal(false);
    });

    it('hides the label box visually while hint stays visible and the name is kept', async () => {
      const el = await make(name, { labelDisplay: 'hidden' });
      expect(el.getAttribute('label-display')).to.equal('hidden');
      const label = labelPart(el);
      expect(label.hidden).to.equal(false);
      expect(isVisuallyHidden(label)).to.equal(true);
      expect(getComputedStyle(label).position).to.equal('absolute');
      const hint = part(el, 'hint');
      expect(hint.hidden).to.equal(false);
      expect(hint.getBoundingClientRect().height).to.be.greaterThan(5);
      el.labelDisplay = 'visible';
      await el.updateComplete;
      expect(isVisuallyHidden(labelPart(el))).to.equal(false);
    });

    it('keeps required marker inside the hidden label and the error text visible', async () => {
      const el = await make(name, { labelDisplay: 'hidden', required: true, errorText: 'Needs attention' });
      expect(isVisuallyHidden(labelPart(el))).to.equal(true);
      const error = part(el, 'error');
      expect(error.hidden).to.equal(false);
      expect(error.getBoundingClientRect().height).to.be.greaterThan(5);
    });

    it('adds no horizontal overflow under rtl', async () => {
      const el = await make(name, { labelDisplay: 'hidden' }, 'rtl');
      expect(isVisuallyHidden(labelPart(el))).to.equal(true);
      const box = labelPart(el).getBoundingClientRect();
      expect(box.right).to.be.at.most(document.documentElement.clientWidth + 1);
      expect(box.left).to.be.at.least(-1);
      expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth);
    });
  });
}

for (const name of ['select', 'combobox', 'input', 'textarea', 'date-input', 'phone-input', 'locale-picker', 'token-input']) {
  describe(`${name} label-display accessible name`, () => {
    it('still names the role owner from the hidden label and passes axe', async () => {
      const el = await make(name, { labelDisplay: 'hidden', hint: 'Hint stays' });
      await expect(el).to.be.accessible();
      const owner = (labelPart(el) as HTMLLabelElement).control ?? el.shadowRoot!.querySelector<HTMLElement>(ROLE_OWNER)!;
      const label = labelPart(el) as HTMLLabelElement;
      // The label is still rendered and unhidden for assistive tech: associated with the role owner,
      // not display:none / visibility:hidden / aria-hidden.
      expect(label.control).to.equal(owner);
      expect(label.closest('[aria-hidden="true"]')).to.equal(null);
      expect(getComputedStyle(label).display).to.not.equal('none');
      expect(getComputedStyle(label).visibility).to.equal('visible');
      expect(label.textContent).to.contain('Pick a thing');
      // axe resolves native-label names for text inputs; button triggers take it from the same label.
      if (!(owner instanceof HTMLButtonElement)) expect(accessibleName(owner)).to.contain('Pick a thing');
      expect(isVisuallyHidden(labelPart(el))).to.equal(true);
    });
  });
}
