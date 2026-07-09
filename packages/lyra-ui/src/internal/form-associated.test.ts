import { fixture, expect, html } from '@open-wc/testing';
import { LyraElement } from './lyra-element.js';
import { FormAssociated } from './form-associated.js';
import { tag } from './prefix.js';

class Ctl extends FormAssociated(LyraElement) {
  render() {
    return html``;
  }
}
customElements.define(tag('demo-ctl'), Ctl);

it('submits its value via the form and clears on reset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lyra-demo-ctl name="x"></lyra-demo-ctl></form>
  `);
  const ctl = form.querySelector('lyra-demo-ctl') as unknown as Ctl;

  ctl.value = 'hello';
  expect(new FormData(form).get('x')).to.equal('hello');

  form.reset();
  expect(ctl.value).to.equal('');
  expect(new FormData(form).get('x')).to.equal('');
});

it('reflects disabled and required as attributes', async () => {
  const ctl = (await fixture(html`<lyra-demo-ctl></lyra-demo-ctl>`)) as unknown as Ctl;
  ctl.disabled = true;
  ctl.required = true;
  await (ctl as unknown as LyraElement).updateComplete;
  expect((ctl as unknown as HTMLElement).hasAttribute('disabled')).to.be.true;
  expect((ctl as unknown as HTMLElement).hasAttribute('required')).to.be.true;
});
