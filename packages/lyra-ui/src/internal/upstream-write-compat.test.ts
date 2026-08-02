import { expect, fixture, html } from '@open-wc/testing';
import '../components/forms/button/button.js';
import '../components/forms/checkbox/checkbox.js';
import '../components/forms/color-picker/color-picker.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/input/input.js';
import '../components/forms/input/number-input.js';
import '../components/forms/input/time-input.js';
import '../components/forms/otp-input/otp-input.js';
import '../components/forms/radio/radio.js';
import '../components/forms/radio/radio-group.js';
import '../components/forms/select/select.js';
import '../components/forms/switch/switch.js';
import '../components/forms/textarea/textarea.js';
import '../components/overlays/overlay/popover.js';
import '../components/overlays/overlay/tooltip.js';
import '../components/overlays/rating/rating.js';
import '../components/utility/known-date/known-date.js';
import { resolveValidityAnchor } from './anchored-validity.js';

type UpdatingElement = HTMLElement & { updateComplete: Promise<boolean> };

async function makeElement(tagName: string, inForm = false): Promise<UpdatingElement> {
  const container = await fixture<HTMLElement>(inForm ? html`<form></form>` : html`<div></div>`);
  const element = document.createElement(tagName) as UpdatingElement;
  container.append(element);
  await element.updateComplete;
  return element;
}

function write(element: HTMLElement, member: string, value: unknown): void {
  Reflect.set(element, member, value);
}

describe('pinned upstream nullable string writes', () => {
  it('normalizes null names to the existing empty, unsubmitted state', async () => {
    const tags = [
      'lr-button',
      'lr-checkbox',
      'lr-color-picker',
      'lr-combobox',
      'lr-date-input',
      'lr-input',
      'lr-known-date',
      'lr-number-input',
      'lr-otp-input',
      'lr-radio',
      'lr-radio-group',
      'lr-rating',
      'lr-select',
      'lr-switch',
      'lr-textarea',
      'lr-time-input',
    ];

    for (const tagName of tags) {
      const element = await makeElement(tagName);
      write(element, 'name', 'field');
      expect(Reflect.get(element, 'name'), `${tagName} accepts a non-empty name`).to.equal('field');

      write(element, 'name', null);
      expect(Reflect.get(element, 'name'), `${tagName} normalizes a null name`).to.equal('');
      await element.updateComplete;
      expect(element.hasAttribute('name'), `${tagName} removes the empty name attribute`).to.be.false;
    }
  });

  it('normalizes null text values without widening reads to null', async () => {
    const cases: [string, string, string][] = [
      ['lr-checkbox', 'custom', 'on'],
      ['lr-color-picker', '#123456', ''],
      ['lr-input', 'typed', ''],
      ['lr-number-input', '42', ''],
      ['lr-otp-input', '1234', ''],
      ['lr-radio-group', 'chosen', ''],
      ['lr-switch', 'custom', 'on'],
    ];

    for (const [tagName, initial, expected] of cases) {
      const element = await makeElement(tagName, expected === 'on');
      if (expected === 'on') {
        write(element, 'value', 'on');
        await element.updateComplete;
        expect(element.getAttribute('value'), `${tagName} reflects an explicit on value`).to.equal('on');
      }
      write(element, 'value', initial);
      expect(Reflect.get(element, 'value'), `${tagName} accepts a non-default value`).to.equal(initial);

      if (expected === 'on') {
        await element.updateComplete;
        const mutations: MutationRecord[] = [];
        const observer = new MutationObserver((records) => mutations.push(...records));
        observer.observe(element, {
          attributes: true,
          attributeFilter: ['value'],
          attributeOldValue: true,
        });
        write(element, 'value', null);
        await element.updateComplete;
        await Promise.resolve();
        observer.disconnect();
        expect(Reflect.get(element, 'value'), `${tagName} normalizes a null value`).to.equal(expected);
        expect(element.hasAttribute('value'), `${tagName} restores the absent default attribute`).to.be.false;
        expect(element.outerHTML, `${tagName} serialization omits the restored default`).to.not.include('value=');
        expect(
          mutations.some((record) => record.attributeName === 'value' && record.oldValue === initial),
          `${tagName} exposes the value-attribute removal to observers`,
        ).to.be.true;

        write(element, 'value', 'queued');
        write(element, 'value', null);
        await element.updateComplete;
        expect(
          element.hasAttribute('value'),
          `${tagName} does not replay a queued reflection after a same-tick null reset`,
        ).to.be.false;

        write(element, 'name', 'choice');
        write(element, 'checked', true);
        await element.updateComplete;
        const form = element.closest('form')!;
        expect(new FormData(form).get('choice'), `${tagName} still submits the native default`).to.equal('on');
      } else {
        write(element, 'value', null);
        expect(Reflect.get(element, 'value'), `${tagName} normalizes a null value`).to.equal(expected);
      }
    }
  });

  it('normalizes null anchor ids to an absent attribute and an empty string read', async () => {
    for (const tagName of ['lr-popover', 'lr-tooltip']) {
      const element = await makeElement(tagName);
      write(element, 'for', 'anchor');
      await element.updateComplete;
      expect(element.getAttribute('for'), `${tagName} reflects a non-empty anchor id`).to.equal('anchor');

      write(element, 'for', null);
      await element.updateComplete;
      expect(Reflect.get(element, 'for'), `${tagName} normalizes a null anchor id`).to.equal('');
      expect(element.hasAttribute('for'), `${tagName} omits an empty anchor id`).to.be.false;
    }
  });

  it('supports validationTarget overrides and restores each internal target with undefined', async () => {
    for (const tagName of ['lr-combobox', 'lr-date-input']) {
      const element = await makeElement(tagName);
      const defaultTarget = Reflect.get(element, 'validationTarget') as HTMLElement | undefined;
      const override = document.createElement('span');
      element.shadowRoot!.append(override);

      expect(defaultTarget?.localName, `${tagName} exposes its native input by default`).to.equal('input');
      expect(resolveValidityAnchor(element), `${tagName} uses the default target as its anchor`).to.equal(defaultTarget);
      write(element, 'validationTarget', override);
      expect(Reflect.get(element, 'validationTarget'), `${tagName} stores an override`).to.equal(override);
      expect(resolveValidityAnchor(element), `${tagName} uses the override as its anchor`).to.equal(override);

      write(element, 'validationTarget', undefined);
      expect(Reflect.get(element, 'validationTarget'), `${tagName} restores its default`).to.equal(defaultTarget);
      expect(resolveValidityAnchor(element), `${tagName} restores its default anchor`).to.equal(defaultTarget);
    }
  });
});
