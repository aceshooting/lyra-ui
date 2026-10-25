import { expect } from '@open-wc/testing';
import { defaultLabelForwardingSlots, isDefaultLabelNode } from './default-label-forwarding.js';

it('classifies unnamed roots without trimming authored slot names', () => {
  expect(isDefaultLabelNode(document.createTextNode('label'))).to.equal(true);
  expect(isDefaultLabelNode(document.createComment('label boundary'))).to.equal(true);
  const root = document.createElement('span');
  expect(isDefaultLabelNode(root)).to.equal(true);
  root.setAttribute('slot', '');
  expect(isDefaultLabelNode(root)).to.equal(true);
  for (const name of ['label', 'start', ' ', 'default']) {
    root.setAttribute('slot', name);
    expect(isDefaultLabelNode(root), name).to.equal(false);
  }
});

it('discovers only slots under unnamed light-DOM roots, including nested fallback slots', () => {
  const host = document.createElement('div');
  host.innerHTML = `
    <slot id="direct"><span><slot id="fallback"></slot></span></slot>
    <div><div><slot id="nested" name="forwarded-source"></slot></div></div>
    <div slot=""><slot id="explicit-default"></slot></div>
    <div slot="hint"><slot id="named-root"></slot></div>
    <slot id="named-slot-root" slot="start"></slot>
  `;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<slot id="host-render-slot"></slot>';
  const nestedHost = document.createElement('section');
  nestedHost.attachShadow({ mode: 'open' }).innerHTML = '<slot id="nested-shadow-slot"></slot>';
  host.append(nestedHost);
  expect(defaultLabelForwardingSlots(host).map(slot => slot.id)).to.deep.equal([
    'direct', 'fallback', 'nested', 'explicit-default',
  ]);
});

it('reads current root ownership and order after slot changes and reparenting', () => {
  const host = document.createElement('div');
  host.innerHTML = '<div id="branch"><slot id="first"></slot></div><slot id="second"></slot>';
  const branch = host.querySelector<HTMLElement>('#branch')!;
  const current = (): string[] => defaultLabelForwardingSlots(host).map(slot => slot.id);
  expect(current()).to.deep.equal(['first', 'second']);
  branch.slot = 'hint';
  expect(current()).to.deep.equal(['second']);
  branch.slot = '';
  host.append(branch);
  expect(current()).to.deep.equal(['second', 'first']);
  const other = document.createElement('div');
  other.append(branch);
  expect(current()).to.deep.equal(['second']);
  expect(defaultLabelForwardingSlots(other).map(slot => slot.id)).to.deep.equal(['first']);
});

it('accepts node and slot objects from another owner realm', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const owner = frame.contentDocument;
    if (!owner) throw new Error('The iframe document is unavailable.');
    const host = owner.createElement('div');
    host.innerHTML = '<div><slot id="foreign-default"></slot></div><div slot="hint"><slot id="foreign-hint"></slot></div>';
    expect(isDefaultLabelNode(owner.createTextNode('foreign label'))).to.equal(true);
    expect(isDefaultLabelNode(host.firstChild!)).to.equal(true);
    expect(defaultLabelForwardingSlots(host).map(slot => slot.id)).to.deep.equal(['foreign-default']);
  } finally {
    frame.remove();
  }
});
