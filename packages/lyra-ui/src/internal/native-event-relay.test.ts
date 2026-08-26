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

  it('falls back to the global realm when an inert owner document cannot construct any event', () => {
    const target = document.createElement('div');
    const brokenOwnerDocument = {
      defaultView: null,
      createEvent() {
        throw new Error('this owner document cannot construct any event');
      },
    } as unknown as Document;
    Object.defineProperty(target, 'ownerDocument', { value: brokenOwnerDocument, configurable: true });

    const seen: Event[] = [];
    target.addEventListener('ping', (event) => seen.push(event));
    const event = dispatchNativeEvent(target, 'ping');

    expect(seen.length).to.equal(1);
    expect(event.constructor === Event).to.be.true;
    expect(event.type).to.equal('ping');
  });

  it("uses a detached document's own creator realm when it is itself the relay target", () => {
    const inertDocument = document.implementation.createHTMLDocument('detached');
    expect(inertDocument.defaultView === null).to.equal(true);

    const seen: Event[] = [];
    inertDocument.addEventListener('ping', (event) => seen.push(event));
    const event = dispatchNativeEvent(inertDocument, 'ping');

    expect(seen.length).to.equal(1);
    expect(event.constructor === inertDocument.createEvent('Event').constructor).to.be.true;
  });

  it("uses a target's own defaultView when it exposes neither ownerDocument nor createEvent", () => {
    const target = new EventTarget() as EventTarget & { defaultView?: Window | null };
    target.defaultView = window;

    const seen: Event[] = [];
    target.addEventListener('ping', (event) => seen.push(event));
    const event = dispatchNativeEvent(target, 'ping');

    expect(seen.length).to.equal(1);
    expect(event.constructor === Event).to.be.true;
  });

  it('falls back to the event target realm when currentTarget is unavailable (post-dispatch relay)', () => {
    const dispatchHost = document.createElement('input');
    document.body.append(dispatchHost);
    let captured: InputEvent | undefined;
    dispatchHost.addEventListener('input', (event) => {
      captured = event as InputEvent;
    });
    dispatchHost.dispatchEvent(
      new InputEvent('input', { bubbles: true, cancelable: false, data: 'z', inputType: 'insertText' }),
    );
    // Outside the listener now: currentTarget has reset to null, but target is sticky.
    expect(captured?.currentTarget).to.equal(null);
    expect(captured?.target === dispatchHost).to.be.true;

    const relayHost = document.createElement('div');
    document.body.append(relayHost);
    const seen: Event[] = [];
    relayHost.addEventListener('input', (event) => seen.push(event));

    const relayed = relayNativeEvent(relayHost, captured!);

    expect(seen.length).to.equal(1);
    expect(relayed instanceof InputEvent).to.be.true;
    expect(relayed.data).to.equal('z');

    dispatchHost.remove();
    relayHost.remove();
  });

  it('falls back to the global realm for a source event that was never dispatched', () => {
    const relayHost = document.createElement('div');
    document.body.append(relayHost);
    const seen: Event[] = [];
    relayHost.addEventListener('input', (event) => seen.push(event));

    const fresh = new InputEvent('input', { data: 'w', inputType: 'insertText' });
    expect(fresh.currentTarget).to.equal(null);
    expect(fresh.target).to.equal(null);
    expect(fresh.view).to.equal(null);

    const relayed = relayNativeEvent(relayHost, fresh);

    expect(seen.length).to.equal(1);
    expect(relayed instanceof InputEvent).to.be.true;
    expect(relayed.data).to.equal('w');

    relayHost.remove();
  });

  it('throws when the target realm lacks InputEvent and the source is from a different realm', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const inertDocument = iframe.contentDocument!.implementation.createHTMLDocument('relay');
      const target = inertDocument.createElement('div');

      // A same-realm (main document) InputEvent is not `instanceof` the inert
      // document's own Event constructor, so the source-constructor fallback
      // can't apply either -- this must fail closed.
      expect(() =>
        relayNativeEvent(
          target,
          new InputEvent('input', { data: 'x', inputType: 'insertText' }),
        ),
      ).to.throw(TypeError, 'InputEvent is not available in the target realm.');
    } finally {
      iframe.remove();
    }
  });

  it('throws when the target realm lacks FocusEvent and the source is from a different realm', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const foreignDocument = iframe.contentDocument!;
      // A hand-built owner document: it can construct a generic Event (in the
      // iframe's own realm, so it differs from the main document's) but it
      // can never construct a FocusEvent -- unlike a real inert document,
      // where FocusEvent construction succeeds via createEvent().
      const fakeOwnerDocument = {
        defaultView: null,
        createEvent(interfaceName: string) {
          if (interfaceName === 'FocusEvent') {
            throw new Error('this fake owner document cannot construct a FocusEvent');
          }
          return foreignDocument.createEvent(interfaceName);
        },
      } as unknown as Document;

      const target = document.createElement('div');
      Object.defineProperty(target, 'ownerDocument', { value: fakeOwnerDocument, configurable: true });

      // A same-realm (main document) FocusEvent is not `instanceof` the fake
      // realm's Event constructor, so the source-constructor fallback can't
      // apply either -- this must fail closed.
      expect(() =>
        relayNativeEvent(target, new FocusEvent('blur', { cancelable: true })),
      ).to.throw(TypeError, 'FocusEvent is not available in the target realm.');
    } finally {
      iframe.remove();
    }
  });

  it('falls back to the source constructor for a FocusEvent when only the target realm lacks a native FocusEvent', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const foreignWindow = iframe.contentWindow!;
      const foreignDocument = iframe.contentDocument!;
      // Same fake shape as above, but the source below is constructed in the
      // iframe's own realm, so it IS `instanceof` the fake realm's Event --
      // the source-constructor fallback can apply and must succeed.
      const fakeOwnerDocument = {
        defaultView: null,
        createEvent(interfaceName: string) {
          if (interfaceName === 'FocusEvent') {
            throw new Error('this fake owner document cannot construct a FocusEvent');
          }
          return foreignDocument.createEvent(interfaceName);
        },
      } as unknown as Document;

      const target = document.createElement('div');
      Object.defineProperty(target, 'ownerDocument', { value: fakeOwnerDocument, configurable: true });

      const source = new foreignWindow.FocusEvent('blur', { cancelable: true, view: foreignWindow });
      const relayed = relayNativeEvent(target, source);

      expect(relayed.constructor === foreignWindow.FocusEvent).to.be.true;
    } finally {
      iframe.remove();
    }
  });

  it('relays a plain native Event that is neither InputEvent- nor FocusEvent-shaped', () => {
    const host = document.createElement('div');
    const button = document.createElement('button');
    host.attachShadow({ mode: 'open' }).append(button);
    document.body.append(host);

    const seen: Event[] = [];
    host.addEventListener('change', (event) => seen.push(event));
    button.addEventListener('change', (event) => relayNativeEvent(host, event));

    button.dispatchEvent(new Event('change', { bubbles: true, composed: true, cancelable: true }));

    expect(seen.length).to.equal(1);
    expect(seen[0]!.constructor === Event).to.be.true;
    expect(seen[0] instanceof InputEvent).to.be.false;
    expect(seen[0] instanceof FocusEvent).to.be.false;

    host.remove();
  });

  it('propagates a prevented source event to the relayed event', () => {
    const host = document.createElement('div');
    const input = document.createElement('input');
    host.attachShadow({ mode: 'open' }).append(input);
    document.body.append(host);

    let relayedEvent: Event | undefined;
    host.addEventListener('input', (event) => {
      relayedEvent = event;
    });
    input.addEventListener('input', (event) => relayNativeEvent(host, event));

    const source = new InputEvent('input', {
      bubbles: true,
      composed: true,
      cancelable: true,
      data: 'p',
      inputType: 'insertText',
    });
    source.preventDefault();
    input.dispatchEvent(source);

    expect(source.defaultPrevented).to.be.true;
    expect(relayedEvent?.cancelable).to.be.true;
    expect(relayedEvent?.defaultPrevented).to.be.true;

    host.remove();
  });

  it('propagates a relayed event prevented by a host listener back to the source event', () => {
    const host = document.createElement('div');
    const input = document.createElement('input');
    host.attachShadow({ mode: 'open' }).append(input);
    document.body.append(host);

    host.addEventListener('input', (event) => event.preventDefault());
    input.addEventListener('input', (event) => relayNativeEvent(host, event));

    const source = new InputEvent('input', {
      bubbles: true,
      composed: true,
      cancelable: true,
      data: 'q',
      inputType: 'insertText',
    });
    input.dispatchEvent(source);

    expect(source.defaultPrevented).to.be.true;

    host.remove();
  });
});
