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

  it('preserves foreign-realm native event kinds and constructs relays in the target realm', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const foreignWindow = iframe.contentWindow!;
      const foreignDocument = iframe.contentDocument!;
      const target = foreignDocument.createElement('div');
      const input = foreignDocument.createElement('input');
      foreignDocument.body.append(target, input);
      const seen: Event[] = [];
      target.addEventListener('input', (event) => seen.push(event));
      target.addEventListener('blur', (event) => seen.push(event));
      input.addEventListener('input', (event) => relayNativeEvent(target, event));
      input.addEventListener('blur', (event) => relayNativeEvent(target, event));

      input.dispatchEvent(new foreignWindow.InputEvent('input', {
        bubbles: true,
        composed: true,
        data: 'ß',
        inputType: 'insertText',
        isComposing: true,
        view: foreignWindow,
      }));
      input.dispatchEvent(new foreignWindow.FocusEvent('blur', {
        relatedTarget: target,
        view: foreignWindow,
      }));

      expect(seen.length).to.equal(2);
      expect(seen[0] instanceof foreignWindow.InputEvent).to.equal(true);
      expect(seen[0] instanceof InputEvent).to.equal(false);
      expect((seen[0] as InputEvent).data).to.equal('ß');
      expect((seen[0] as InputEvent).inputType).to.equal('insertText');
      expect((seen[0] as InputEvent).isComposing).to.equal(true);
      expect(seen[1] instanceof foreignWindow.FocusEvent).to.equal(true);
      expect((seen[1] as FocusEvent).relatedTarget === target).to.equal(true);
    } finally {
      iframe.remove();
    }
  });

  it('constructs source-less native events in a foreign target\'s realm', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const foreignWindow = iframe.contentWindow!;
      const target = iframe.contentDocument!.createElement('div');
      const input = dispatchNativeInputEvent(target, { data: '7', inputType: 'insertText' });
      const change = dispatchNativeEvent(target, 'change');

      expect(input instanceof foreignWindow.InputEvent).to.equal(true);
      expect(input instanceof InputEvent).to.equal(false);
      expect(change.constructor === foreignWindow.Event).to.equal(true);
    } finally {
      iframe.remove();
    }
  });

  it('uses an inert foreign owner document\'s creator realm when it has no defaultView', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const foreignWindow = iframe.contentWindow!;
      const inertDocument = iframe.contentDocument!.implementation.createHTMLDocument('relay');
      const target = inertDocument.createElement('div');
      const related = inertDocument.createElement('button');
      const expectedEventConstructor = inertDocument.createEvent('Event').constructor;
      const expectedFocusConstructor = inertDocument.createEvent('FocusEvent').constructor;

      const change = dispatchNativeEvent(target, 'change');
      const input = relayNativeEvent(
        target,
        new foreignWindow.InputEvent('input', {
          data: '9',
          inputType: 'insertText',
          view: foreignWindow,
        }),
      );
      const blur = relayNativeEvent(
        target,
        new foreignWindow.FocusEvent('blur', { relatedTarget: related, view: foreignWindow }),
      );

      expect(inertDocument.defaultView === null).to.equal(true);
      expect(change.constructor === expectedEventConstructor).to.equal(true);
      expect(input.constructor === foreignWindow.InputEvent).to.equal(true);
      expect(input.data).to.equal('9');
      expect(blur.constructor === expectedFocusConstructor).to.equal(true);
      expect((blur as FocusEvent).relatedTarget === related).to.equal(true);
      expect(() => dispatchNativeInputEvent(target)).to.throw(
        TypeError,
        'InputEvent is not available in the target realm.',
      );
    } finally {
      iframe.remove();
    }
  });
});
