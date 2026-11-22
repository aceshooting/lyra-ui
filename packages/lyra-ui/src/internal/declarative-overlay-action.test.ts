import { expect, fixture, html } from '@open-wc/testing';
import {
  findDeclarativeAction,
  isDeclarativeActionInert,
  registerDeclarativeOverlay,
} from './declarative-overlay-action.js';

describe('declarative overlay actions', () => {
  it('finds the nearest carrier of the attribute within the path bound', async () => {
    const root = await fixture<HTMLElement>(html`
      <div id="outer" data-thing="close"><span id="inner" data-thing="other"><b id="leaf"></b></span></div>
    `);
    const leaf = root.querySelector('#leaf')!;
    const path = [leaf, root.querySelector('#inner')!, root, document.body, document, window];
    expect(findDeclarativeAction(path, 'data-thing')?.id).to.equal('inner');
    expect(findDeclarativeAction(path, 'data-thing', path.length, (value) => value === 'close')?.id).to.equal('outer');
    expect(findDeclarativeAction(path, 'data-thing', 1)).to.equal(undefined);
  });

  it('treats disabled, aria-disabled and inert elements as inert', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <button id="enabled"></button>
        <button id="disabled" disabled></button>
        <span id="aria" aria-disabled=" TRUE "></span>
        <span id="aria-false" aria-disabled="false"></span>
        <div inert><span id="inert"></span></div>
      </div>
    `);
    const inert = (id: string): boolean => isDeclarativeActionInert(root.querySelector(`#${id}`)!);
    expect(inert('enabled')).to.equal(false);
    expect(inert('aria-false')).to.equal(false);
    expect(inert('disabled')).to.equal(true);
    expect(inert('aria')).to.equal(true);
    expect(inert('inert')).to.equal(true);
    const custom = Object.assign(document.createElement('span'), { effectiveDisabled: true });
    expect(isDeclarativeActionInert(custom)).to.equal(true);
  });

  it('routes open and close to the registered host and stops after release', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <button id="open" data-dialog="OPEN target">Open</button>
        <section id="target"><button id="close" data-dialog="  close  ">Close</button></section>
      </div>
    `);
    const host = root.querySelector('#target')!;
    const calls: string[] = [];
    const release = registerDeclarativeOverlay(host, {
      kind: () => 'dialog',
      open: (source) => calls.push(`open:${source.id}`),
      close: (source) => calls.push(`close:${source.id}`),
    });
    root.querySelector<HTMLButtonElement>('#open')!.click();
    root.querySelector<HTMLButtonElement>('#close')!.click();
    release();
    release();
    root.querySelector<HTMLButtonElement>('#open')!.click();
    expect(calls).to.deep.equal(['open:open', 'close:close']);
  });
});
