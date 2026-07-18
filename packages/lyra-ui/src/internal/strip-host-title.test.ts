import { fixture, expect, html } from '@open-wc/testing';
import { property } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import { StripHostTitleAttribute } from './strip-host-title.js';
import { tag } from './prefix.js';

class Ctl extends StripHostTitleAttribute(LyraElement) {
  @property() title = '';
  render() {
    return html``;
  }
}
customElements.define(tag('demo-strip-host-title'), Ctl);

it('syncs a declarative title attribute into the title property, then strips the host attribute', async () => {
  const el = (await fixture(html`<lr-demo-strip-host-title title="hello"></lr-demo-strip-host-title>`)) as Ctl;
  expect(el.title).to.equal('hello');
  expect(el.hasAttribute('title')).to.be.false;
});

it('strips a title attribute set programmatically after connection too', async () => {
  const el = (await fixture(html`<lr-demo-strip-host-title></lr-demo-strip-host-title>`)) as Ctl;
  el.setAttribute('title', 'late');
  await el.updateComplete;
  expect(el.title).to.equal('late');
  expect(el.hasAttribute('title')).to.be.false;
});

it('keeps the title property in sync across repeated re-assignment without the attribute reappearing', async () => {
  const el = (await fixture(html`<lr-demo-strip-host-title title="first"></lr-demo-strip-host-title>`)) as Ctl;
  el.title = 'second';
  await el.updateComplete;
  expect(el.title).to.equal('second');
  expect(el.hasAttribute('title')).to.be.false;
});
