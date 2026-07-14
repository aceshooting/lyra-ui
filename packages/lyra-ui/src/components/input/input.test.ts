import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './input.js';
import type { LyraInput } from './input.class.js';

describe('lyra-input', () => {
  it('defaults to type="text" with an empty value', async () => {
    const el = (await fixture(html`<lyra-input></lyra-input>`)) as LyraInput;
    expect(el.type).to.equal('text');
    expect(el.value).to.equal('');
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(input.type).to.equal('text');
  });

  it('forwards placeholder/autocomplete/min/max/step onto the native input', async () => {
    const el = (await fixture(
      html`<lyra-input type="number" placeholder="Qty" autocomplete="off" min="1" max="10" step="2"></lyra-input>`,
    )) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(input.placeholder).to.equal('Qty');
    expect(input.autocomplete).to.equal('off');
    expect(input.min).to.equal('1');
    expect(input.max).to.equal('10');
    expect(input.step).to.equal('2');
  });

  it('updates value and fires lyra-input on user typing', async () => {
    const el = (await fixture(html`<lyra-input></lyra-input>`)) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    input.value = 'hello';
    setTimeout(() => input.dispatchEvent(new Event('input', { bubbles: true })));
    const ev = await oneEvent(el, 'lyra-input');
    expect(ev.detail).to.deep.equal({ value: 'hello' });
    expect(el.value).to.equal('hello');
  });

  it('fires lyra-change on the native change timing', async () => {
    const el = (await fixture(html`<lyra-input></lyra-input>`)) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    input.value = 'hello';
    setTimeout(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    const ev = await oneEvent(el, 'lyra-change');
    expect(ev.detail).to.deep.equal({ value: 'hello' });
  });

  describe('label/hint/error chrome', () => {
    it('renders no chrome by default', async () => {
      const el = (await fixture(html`<lyra-input></lyra-input>`)) as LyraInput;
      const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
      expect(label.hidden).to.be.true;
    });

    it('shows label/hint/error text and wires aria-describedby', async () => {
      const el = (await fixture(
        html`<lyra-input label="Email" hint="We'll never share it." error-text="Required"></lyra-input>`,
      )) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.getAttribute('aria-describedby')).to.equal('input-error input-hint');
    });
  });

  describe('accessibleLabel', () => {
    it('falls back to placeholder', async () => {
      const el = (await fixture(html`<lyra-input placeholder="Search"></lyra-input>`)) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.getAttribute('aria-label')).to.equal('Search');
    });

    it('a host aria-label wins over label and placeholder', async () => {
      const el = (await fixture(
        html`<lyra-input aria-label="Search field" label="Query" placeholder="Type here"></lyra-input>`,
      )) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.getAttribute('aria-label')).to.equal('Search field');
    });
  });

  describe('type="password"', () => {
    it('renders a password-toggle button that flips the native input type and passwordVisible', async () => {
      const el = (await fixture(html`<lyra-input type="password" label="Password"></lyra-input>`)) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      const toggle = el.shadowRoot!.querySelector('[part="password-toggle"]') as HTMLButtonElement;
      expect(input.type).to.equal('password');
      toggle.click();
      await el.updateComplete;
      expect(el.passwordVisible).to.be.true;
      expect(input.type).to.equal('text');
      toggle.click();
      await el.updateComplete;
      expect(el.passwordVisible).to.be.false;
      expect(input.type).to.equal('password');
    });

    it('omits the password-toggle button for every other type', async () => {
      const el = (await fixture(html`<lyra-input type="email"></lyra-input>`)) as LyraInput;
      expect(el.shadowRoot!.querySelector('[part="password-toggle"]')).to.be.null;
    });
  });

  describe('validity', () => {
    it('type="email" rejects a malformed address via native constraint validation', async () => {
      const el = (await fixture(html`<lyra-input type="email"></lyra-input>`)) as LyraInput;
      el.value = 'not-an-email';
      expect(el.checkValidity()).to.be.false;
      el.value = 'ada@example.com';
      expect(el.checkValidity()).to.be.true;
    });

    it('type="number" enforces min/max/step', async () => {
      const el = (await fixture(
        html`<lyra-input type="number" min="1" max="10" step="1"></lyra-input>`,
      )) as LyraInput;
      el.value = '99';
      expect(el.checkValidity()).to.be.false;
      el.value = '5';
      expect(el.checkValidity()).to.be.true;
    });

    it('required + empty is invalid, matching every other FormAssociated control', async () => {
      const el = (await fixture(html`<lyra-input required></lyra-input>`)) as LyraInput;
      expect(el.checkValidity()).to.be.false;
      el.value = 'anything';
      expect(el.checkValidity()).to.be.true;
    });

    it('type="number" rejects a non-numeric value silently sanitized away by the native input', async () => {
      const el = (await fixture(html`<lyra-input type="number"></lyra-input>`)) as LyraInput;
      el.value = 'not-a-number';
      expect(el.checkValidity()).to.be.false;
    });

    it('recomputes validity when max narrows below the current value without a value write', async () => {
      const el = (await fixture(
        html`<lyra-input type="number" max="10" value="5"></lyra-input>`,
      )) as LyraInput;
      expect(el.checkValidity()).to.be.true;
      el.max = 3;
      await el.updateComplete;
      expect(el.checkValidity()).to.be.false;
    });
  });

  it('is accessible', async () => {
    const el = await fixture(html`<lyra-input label="Name"></lyra-input>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible as type="password"', async () => {
    const el = await fixture(html`<lyra-input type="password" label="Password"></lyra-input>`);
    await expect(el).to.be.accessible();
  });
});
