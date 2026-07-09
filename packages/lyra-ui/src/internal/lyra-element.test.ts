import { fixture, expect, html } from '@open-wc/testing';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';

class Demo extends LyraElement {
  render() {
    return html`<span>hi</span>`;
  }
}
customElements.define(tag('demo-base'), Demo);

it('applies the token font-family from the base', async () => {
  const el = await fixture<Demo>(`<lyra-demo-base></lyra-demo-base>`);
  expect(getComputedStyle(el).fontFamily).to.not.be.empty;
});

it('emit() dispatches a composed, bubbling lyra event', async () => {
  const el = await fixture<Demo>(`<lyra-demo-base></lyra-demo-base>`);
  let caught: CustomEvent | undefined;
  el.addEventListener('lyra-ping', (e) => (caught = e as CustomEvent));
  (el as unknown as { emit: (n: string, d?: unknown) => void }).emit('lyra-ping', { ok: true });
  expect(caught).to.exist;
  expect(caught!.bubbles).to.be.true;
  expect(caught!.composed).to.be.true;
  expect((caught!.detail as { ok: boolean }).ok).to.be.true;
});
