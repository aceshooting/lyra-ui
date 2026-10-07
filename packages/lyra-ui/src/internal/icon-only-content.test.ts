import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { IconOnlyLabelObserver } from './icon-only-content.js';

it('IconOnlyLabelObserver follows a replaced label element', async () => {
  const stage = await fixture<HTMLDivElement>(html`<div><div><i></i></div><div></div></div>`);
  const [host, labels] = [...stage.children] as HTMLElement[];
  const makeLabel = (): HTMLElement => {
    const el = document.createElement('span');
    el.style.cssText = 'display: inline-block; inline-size: 10px; block-size: 10px';
    labels!.append(el);
    return el;
  };
  let label = makeLabel();
  const changes: boolean[] = [];
  const observer = new IconOnlyLabelObserver(host!, () => label, () => false, next => changes.push(next));
  observer.arm();
  await waitUntil(() => changes.length === 1);
  label = makeLabel();
  observer.arm();
  await waitUntil(() => changes.length === 2, 'the replacement label is observed');
  observer.disarm();
  expect(changes).to.deep.equal([true, true]);
});
