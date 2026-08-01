import { expect } from '@open-wc/testing';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from './native-event-relay.js';

describe('relayNativeEvent', () => {
  it('replaces a composed shadow input with exactly one host InputEvent and preserves its payload', () => {
    const host = document.createElement('div');
    const input = document.createElement('input');
    host.attachShadow({ mode: 'open' }).append(input);
    document.body.append(host);

    const seen: Event[] = [];
    host.addEventListener('input', (event) => seen.push(event));
    input.addEventListener('input', (event) => relayNativeEvent(host, event));

    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        cancelable: false,
        data: 'é',
        inputType: 'insertText',
        isComposing: true,
      }),
    );

    expect(seen.length).to.equal(1);
    expect(seen[0] instanceof InputEvent).to.be.true;
    const relayed = seen[0] as InputEvent;
    expect(relayed.target === host).to.be.true;
    expect(relayed.bubbles).to.be.true;
    expect(relayed.composed).to.be.true;
    expect(relayed.data).to.equal('é');
    expect(relayed.inputType).to.equal('insertText');
    expect(relayed.isComposing).to.be.true;

    host.remove();
  });

  it('preserves focus relatedTarget while making the host event bubble and compose', () => {
    const host = document.createElement('div');
    const input = document.createElement('input');
    const related = document.createElement('button');
    host.attachShadow({ mode: 'open' }).append(input);
    document.body.append(host, related);

    let seen: FocusEvent | undefined;
    host.addEventListener('blur', (event) => {
      seen = event as FocusEvent;
    });
    input.addEventListener('blur', (event) => relayNativeEvent(host, event));
    input.dispatchEvent(new FocusEvent('blur', { relatedTarget: related }));

    expect(seen instanceof FocusEvent).to.be.true;
    expect(seen?.target === host).to.be.true;
    expect(seen?.relatedTarget === related).to.be.true;
    expect(seen?.bubbles).to.be.true;
    expect(seen?.composed).to.be.true;

    host.remove();
    related.remove();
  });

  it('dispatches native form events rather than CustomEvents for source-less interactions', () => {
    const target = document.createElement('div');
    const input = dispatchNativeInputEvent(target, { data: '7', inputType: 'insertText' });
    const change = dispatchNativeEvent(target, 'change');

    expect(input instanceof InputEvent).to.be.true;
    expect(input instanceof CustomEvent).to.be.false;
    expect(input.data).to.equal('7');
    expect(input.inputType).to.equal('insertText');
    expect(change.constructor === Event).to.be.true;
    expect(change.bubbles).to.be.true;
    expect(change.composed).to.be.true;
  });
});
