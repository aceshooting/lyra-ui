import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './date-input.js';
import type { LyraDateInput } from './date-input.js';
import '../../../translations/de/forms.js';
import '../../../translations/de/shared.js';

async function replaceAndBlur(input: HTMLInputElement, text: string): Promise<void> {
  await focusByKeyboard(input);
  input.select();
  await sendKeys({ type: text });
  await waitUntil(() => input.value === text, 'the native field contains the complete edit');
  await sendKeys({ press: 'Tab' });
  await waitUntil(() => input.getRootNode() instanceof ShadowRoot
    && (input.getRootNode() as ShadowRoot).activeElement !== input, 'the native field has blurred');
}

describe('date input public value boundaries', () => {
  it('clears through the nullable UTC setter and synchronizes required validity without edit events', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-date-input name="date" locale="de" required value="2026-10-06"></lr-date-input></form>
    `);
    const el = form.querySelector('lr-date-input') as LyraDateInput;
    await el.updateComplete;
    const input = el.input!;
    expect(el.valueAsUTCDate?.toISOString()).to.equal('2026-10-06T00:00:00.000Z');
    expect(new FormData(form).get('date')).to.equal('2026-10-06');
    expect(el.validity.valid).to.equal(true);
    const events: string[] = [];
    for (const type of ['input', 'change', 'lr-input', 'lr-change']) {
      el.addEventListener(type, () => events.push(type));
    }

    el.valueAsUTCDate = null;
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(input.value).to.equal('');
    expect(el.valueAsDate).to.equal(null);
    expect(el.valueAsLocalDate).to.equal(null);
    expect(el.valueAsUTCDate).to.equal(null);
    expect(new FormData(form).get('date')).to.equal('');
    expect(el.validity.valueMissing).to.equal(true);
    expect(el.validity.badInput).to.equal(false);
    expect(el.checkValidity()).to.equal(false);

    el.valueAsUTCDate = new Date('2027-01-02T23:30:00.000Z');
    await el.updateComplete;
    expect(el.value).to.equal('2027-01-02');
    expect(el.valueAsUTCDate?.toISOString()).to.equal('2027-01-02T00:00:00.000Z');
    expect(new FormData(form).get('date')).to.equal('2027-01-02');
    expect(el.validity.valid).to.equal(true);
    expect(events).to.deep.equal([]);
  });

  const cases = [
    {
      name: 'foreign-letter date text with three numeric groups', mode: 'single',
      initial: '2026-10-06', invalid: 'Fremd 07.10.2026',
      recovery: '07.10.2026', expected: '2026-10-07',
    },
    {
      name: 'a six-group localized range with an impossible endpoint', mode: 'range',
      initial: '2026-10-06/2026-10-08', invalid: '07.10.2026 – 32.10.2026',
      recovery: '07.10.2026 – 09.10.2026', expected: '2026-10-07/2026-10-09',
    },
    {
      name: 'word-only range text without a locale range separator', mode: 'range',
      initial: '2026-10-06/2026-10-08', invalid: 'unbekannter Zeitraum',
      recovery: '07.10.2026 – 09.10.2026', expected: '2026-10-07/2026-10-09',
    },
  ] as const;

  for (const example of cases) {
    it(`rejects ${example.name}, retains its submitted value and accepts the next valid edit`, async () => {
      const message = 'Bitte ein vollständiges Datum eingeben.';
      const form = await fixture<HTMLFormElement>(html`
        <form>
          <lr-date-input
            name="date"
            label="Datum"
            locale="de"
            mode=${example.mode}
            value=${example.initial}
            .strings=${{ dateInputInvalid: message }}
          ></lr-date-input>
          <button type="button">Weiter</button>
        </form>
      `);
      const el = form.querySelector('lr-date-input') as LyraDateInput;
      await el.updateComplete;
      const input = el.input!;
      const committedDisplay = input.value;
      expect(el.validity.valid).to.equal(true);
      expect(new FormData(form).get('date')).to.equal(example.initial);
      const changes: string[] = [];
      el.addEventListener('change', () => changes.push('change'));
      el.addEventListener('lr-change', () => changes.push('lr-change'));

      await replaceAndBlur(input, example.invalid);
      await waitUntil(() => el.validity.badInput && input.value === committedDisplay,
        'the rejected edit restores the committed display and reports bad input');
      await el.updateComplete;
      expect(el.value).to.equal(example.initial);
      expect(new FormData(form).get('date')).to.equal(example.initial);
      expect(el.validationMessage).to.equal(message);
      expect(el.checkValidity()).to.equal(false);
      expect(input.getAttribute('aria-invalid')).to.equal('true');
      expect(changes).to.deep.equal([]);

      await replaceAndBlur(input, example.recovery);
      await waitUntil(() => el.value === example.expected && !el.validity.badInput,
        'a later valid native edit commits and clears bad input');
      await el.updateComplete;
      expect(new FormData(form).get('date')).to.equal(example.expected);
      expect(el.validity.valid).to.equal(true);
      expect(el.validationMessage).to.equal('');
      expect(input.getAttribute('aria-invalid')).to.equal('false');
      expect(input.value === committedDisplay).to.equal(false);
      expect(changes).to.deep.equal(['change', 'lr-change']);
    });
  }
});
