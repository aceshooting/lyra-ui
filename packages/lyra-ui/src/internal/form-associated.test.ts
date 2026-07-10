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

it('submits its value via the form and restores the default value on reset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lyra-demo-ctl name="x"></lyra-demo-ctl></form>
  `);
  const ctl = form.querySelector('lyra-demo-ctl') as unknown as Ctl;

  ctl.value = 'hello'; // the first assignment becomes the form's default
  expect(new FormData(form).get('x')).to.equal('hello');

  ctl.value = 'changed';
  form.reset();
  expect(ctl.value).to.equal('hello');
  expect(new FormData(form).get('x')).to.equal('hello');
});

it('reflects disabled and required as attributes', async () => {
  const ctl = (await fixture(html`<lyra-demo-ctl></lyra-demo-ctl>`)) as unknown as Ctl;
  ctl.disabled = true;
  ctl.required = true;
  await (ctl as unknown as LyraElement).updateComplete;
  expect((ctl as unknown as HTMLElement).hasAttribute('disabled')).to.be.true;
  expect((ctl as unknown as HTMLElement).hasAttribute('required')).to.be.true;
});

it('marks the control invalid via ElementInternals while required and empty, valid once filled', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lyra-demo-ctl name="x" required></lyra-demo-ctl></form>
  `);
  const ctl = form.querySelector('lyra-demo-ctl') as unknown as Ctl;
  expect(form.reportValidity()).to.be.false;
  expect((ctl as unknown as HTMLElement).matches(':invalid')).to.be.true;

  ctl.value = 'hello';
  expect(form.reportValidity()).to.be.true;
  expect((ctl as unknown as HTMLElement).matches(':valid')).to.be.true;
});

it('restores the constructed default value on form.reset(), not blank', async () => {
  const form = await fixture<HTMLFormElement>(html`<form><lyra-demo-ctl name="x"></lyra-demo-ctl></form>`);
  const ctl = form.querySelector('lyra-demo-ctl') as unknown as Ctl;
  ctl.value = '2026-07-15'; // the first assignment becomes the form's default
  ctl.value = 'changed';
  form.reset();
  expect(ctl.value).to.equal('2026-07-15');
});
