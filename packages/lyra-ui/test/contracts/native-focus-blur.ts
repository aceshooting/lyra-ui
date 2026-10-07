import { expect } from '@open-wc/testing';

/** Checks the native host focus pair without passing DOM nodes to Chai failures. */
export function assertNativeFocusBlurPair(host: HTMLElement, events: readonly FocusEvent[], aliases: readonly string[]): void {
  const FocusEventConstructor = host.ownerDocument.defaultView!.FocusEvent;
  expect(events.map(event => event.type)).to.deep.equal(['focus', 'blur']);
  expect(events.every(event => event instanceof FocusEventConstructor)).to.be.true;
  expect(events.every(event => event.target === host && event.bubbles && event.composed)).to.be.true;
  expect(aliases).to.deep.equal([]);
}
