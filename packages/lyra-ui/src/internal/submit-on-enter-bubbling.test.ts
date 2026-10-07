import { expect, fixture, html } from '@open-wc/testing';
import { dispatchEnterKey, settleEnterSubmission } from '../../test/contracts/enter-submit.js';
import '../components/forms/input/input.js';
import '../components/forms/input/number-input.js';
import '../components/forms/input/native-time-input.js';

type InputHost = HTMLElement & { updateComplete: Promise<unknown> };

for (const tagName of ['lr-input', 'lr-number-input', 'lr-native-time-input']) {
  describe(`${tagName} bubbling Enter submission`, () => {
    async function mount(): Promise<{
      form: HTMLFormElement;
      host: InputHost;
      input: HTMLInputElement;
      submissions: () => number;
    }> {
      const form = await fixture<HTMLFormElement>(html`<form><button type="submit">Submit</button></form>`);
      const host = document.createElement(tagName) as InputHost;
      host.setAttribute('name', 'field');
      host.setAttribute('aria-label', 'Field');
      form.prepend(host);
      await host.updateComplete;
      const input = host.shadowRoot?.querySelector('input');
      if (!input) throw new Error(`${tagName} did not render an input`);
      let count = 0;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        count += 1;
      });
      return { form, host, input, submissions: () => count };
    }

    it('lets a bubbling host or ancestor listener veto Enter, then submits once normally', async () => {
      const { form, host, input, submissions } = await mount();
      const veto = (event: Event): void => event.preventDefault();
      host.addEventListener('keydown', veto);
      dispatchEnterKey(input);
      await settleEnterSubmission();
      expect(submissions(), 'host veto').to.equal(0);
      host.removeEventListener('keydown', veto);

      form.addEventListener('keydown', veto);
      dispatchEnterKey(input);
      await settleEnterSubmission();
      expect(submissions(), 'form veto').to.equal(0);
      form.removeEventListener('keydown', veto);

      dispatchEnterKey(input);
      await settleEnterSubmission();
      expect(submissions(), 'bare Enter submits exactly once').to.equal(1);
    });

    it('does not submit if the control disconnects during bubbling', async () => {
      const { form, host, input, submissions } = await mount();
      form.addEventListener('keydown', () => host.remove(), { once: true });
      dispatchEnterKey(input);
      await settleEnterSubmission();
      expect(submissions()).to.equal(0);
    });

    it('does not submit the former form if the control changes owners during bubbling', async () => {
      const { form, host, input, submissions } = await mount();
      const nextForm = document.createElement('form');
      let nextSubmissions = 0;
      nextForm.addEventListener('submit', (event) => {
        event.preventDefault();
        nextSubmissions += 1;
      });
      form.after(nextForm);
      host.addEventListener('keydown', () => nextForm.append(host), { once: true });
      dispatchEnterKey(input);
      await settleEnterSubmission();
      expect(submissions()).to.equal(0);
      expect(nextSubmissions).to.equal(0);
      nextForm.remove();
    });

    it('does not submit after becoming disabled during bubbling', async () => {
      const { host, input, submissions } = await mount();
      host.addEventListener('keydown', () => host.setAttribute('disabled', ''), { once: true });
      dispatchEnterKey(input);
      await settleEnterSubmission();
      expect(submissions()).to.equal(0);
    });

    it('still submits once when propagation stops without a veto', async () => {
      const { host, input, submissions } = await mount();
      host.addEventListener('keydown', (event) => event.stopPropagation(), { once: true });
      dispatchEnterKey(input);
      await settleEnterSubmission();
      expect(submissions()).to.equal(1);
    });

    it('honors a window veto listener installed during host bubbling', async () => {
      const { host, input, submissions } = await mount();
      let vetoes = 0;
      const veto = (event: Event): void => {
        event.preventDefault();
        vetoes += 1;
      };
      host.addEventListener('keydown', () => {
        window.addEventListener('keydown', veto, { once: true });
      }, { once: true });
      try {
        dispatchEnterKey(input);
        await settleEnterSubmission();
      } finally {
        window.removeEventListener('keydown', veto);
      }
      expect(vetoes).to.equal(1);
      expect(submissions()).to.equal(0);
    });
  });
}
