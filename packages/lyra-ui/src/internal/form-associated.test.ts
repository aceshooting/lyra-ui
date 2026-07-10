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

it('submits its value via the form and restores the constructed default value on reset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lyra-demo-ctl name="x" value="hello"></lyra-demo-ctl></form>
  `);
  const ctl = form.querySelector('lyra-demo-ctl') as unknown as Ctl;
  expect(new FormData(form).get('x')).to.equal('hello');

  ctl.value = 'changed';
  form.reset();
  expect(ctl.value).to.equal('hello');
  expect(new FormData(form).get('x')).to.equal('hello');
});

it('does not let a user/programmatic value change become the reset default (true native `defaultValue` semantics)', async () => {
  // Regression for the 2026-07-10 review: only the *content attribute*
  // (construction-time/declarative) feeds the reset default. Without a
  // `value` attribute, no amount of later `.value =` assignment — however
  // many, or however "first" — may become what `form.reset()` restores to,
  // exactly like a plain native `<input>` with no `value` attribute.
  const form = await fixture<HTMLFormElement>(html`<form><lyra-demo-ctl name="x"></lyra-demo-ctl></form>`);
  const ctl = form.querySelector('lyra-demo-ctl') as unknown as Ctl;
  ctl.value = 'first-user-edit';
  ctl.value = 'second-user-edit';
  form.reset();
  expect(ctl.value).to.equal('');
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
  const form = await fixture<HTMLFormElement>(
    html`<form><lyra-demo-ctl name="x" value="2026-07-15"></lyra-demo-ctl></form>`,
  );
  const ctl = form.querySelector('lyra-demo-ctl') as unknown as Ctl;
  ctl.value = 'changed';
  form.reset();
  expect(ctl.value).to.equal('2026-07-15');
});
