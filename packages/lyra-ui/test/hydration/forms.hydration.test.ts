import { html, ssrFixture, ssrStaticDocument } from '../wtr-ssr-fixture.js';
import { expect } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../wtr-focus.js';

interface ValueHost extends HTMLElement {
  value: string;
  checked: boolean;
  updateComplete: Promise<boolean>;
}

describe('hydrated forms', () => {
  it('lr-input keeps its server value and edits it after hydration', async () => {
    const form = await ssrFixture<HTMLFormElement>(html`<form>
      <lr-input name="city" value="Beirut" label="City" hint="Where you live"></lr-input>
    </form>`);
    const input = form.querySelector<ValueHost>('lr-input')!;
    const native = input.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
    expect(native.value).to.equal('Beirut');
    expect(new FormData(form).get('city')).to.equal('Beirut');
    await focusByKeyboard(native);
    await sendKeys({ press: 'End' });
    await sendKeys({ type: ' Nord' });
    await input.updateComplete;
    expect(input.value).to.equal('Beirut Nord');
    expect(new FormData(form).get('city')).to.equal('Beirut Nord');
  });

  it('lr-checkbox keeps its server checked state and toggles after hydration', async () => {
    const form = await ssrFixture<HTMLFormElement>(html`<form>
      <lr-checkbox name="terms" value="yes" checked>Accept terms</lr-checkbox>
    </form>`);
    expect(form.querySelector('lr-checkbox')!.shadowRoot!.querySelector('[part="label"]')!.hasAttribute('hidden')).to.equal(false);
    const checkbox = form.querySelector<ValueHost>('lr-checkbox')!;
    expect(checkbox.checked).to.equal(true);
    expect(new FormData(form).get('terms')).to.equal('yes');
    checkbox.click();
    await checkbox.updateComplete;
    expect(checkbox.checked).to.equal(false);
    expect(new FormData(form).get('terms')).to.equal(null);
  });
});

/** Whether `host`'s own light-DOM text lays out with a non-empty box (slotted or not). */
function textIsPainted(host: Element): boolean {
  const range = host.ownerDocument.createRange();
  range.selectNodeContents(host);
  const box = range.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

describe('server-rendered choice labels without JavaScript', () => {
  it('lr-checkbox shows its slotted label in the server markup alone', async () => {
    const served = await ssrStaticDocument(html`<form>
      <lr-checkbox name="terms" value="yes">Accept terms</lr-checkbox>
    </form>`);
    const checkbox = served.querySelector('lr-checkbox')!;
    expect(checkbox.matches(':defined')).to.equal(false, 'no definition reaches the static page');
    expect(checkbox.shadowRoot!.querySelector('[part="label"]')!.hasAttribute('hidden')).to.equal(false);
    expect(textIsPainted(checkbox)).to.equal(true);
  });

  it('lr-radio shows its label inside a server-rendered lr-radio-group', async () => {
    const served = await ssrStaticDocument(html`<form>
      <lr-radio-group name="plan" label="Plan">
        <lr-radio value="basic">Basic</lr-radio>
        <lr-radio value="pro">Pro</lr-radio>
      </lr-radio-group>
    </form>`);
    const group = served.querySelector('lr-radio-group')!;
    expect(group.shadowRoot).to.not.equal(null);
    const radios = [...served.querySelectorAll('lr-radio')];
    expect(radios.map((radio) => textIsPainted(radio))).to.deep.equal([true, true]);
  });
});

describe('hydrated forms: checkbox label presence', () => {
  it('lr-checkbox keeps the server label wrapper through hydration and collapses an empty one after it', async () => {
    const form = await ssrFixture<HTMLFormElement>(html`<form>
      <lr-checkbox name="terms">Accept terms</lr-checkbox>
      <lr-checkbox name="icon-only" aria-label="Pin"></lr-checkbox>
    </form>`);
    const [labelled, iconOnly] = [...form.querySelectorAll('lr-checkbox')];
    expect(labelled!.shadowRoot!.querySelector('[part="label"]')!.hasAttribute('hidden')).to.equal(false);
    expect(iconOnly!.shadowRoot!.querySelector('[part="label"]')!.hasAttribute('hidden')).to.equal(true);
  });
});

describe('hydrated forms: switch and submit button', () => {
  it('lr-switch keeps its server state and toggles by keyboard after hydration', async () => {
    const form = await ssrFixture<HTMLFormElement>(html`<form>
      <lr-switch name="alerts" checked>Alerts</lr-switch>
    </form>`);
    const control = form.querySelector<ValueHost>('lr-switch')!;
    expect(control.checked).to.equal(true);
    expect(new FormData(form).get('alerts')).to.equal('on');
    const owner = control.shadowRoot!.querySelector<HTMLElement>('[part~="switch"]')!;
    expect(owner.getAttribute('aria-checked')).to.equal('true');
    expect(control.shadowRoot!.querySelector('[part="label"]')!.hasAttribute('hidden')).to.equal(false);
    await focusByKeyboard(owner);
    await sendKeys({ press: 'Space' });
    await control.updateComplete;
    expect(control.checked).to.equal(false);
    expect(new FormData(form).has('alerts')).to.equal(false);
  });

  it('lr-button submits its owning form with its own entry after hydration', async () => {
    const form = await ssrFixture<HTMLFormElement>(html`<form>
      <lr-button type="submit" name="intent" value="save">Save</lr-button>
    </form>`);
    const submitted = new Promise<string | null>((resolve) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        resolve(new FormData(form, event.submitter).get('intent') as string | null);
      }, { once: true });
    });
    form.querySelector<HTMLElement>('lr-button')!.click();
    expect(await submitted).to.equal('save');
  });
});
