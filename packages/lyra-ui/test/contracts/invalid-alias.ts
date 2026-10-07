import { expect } from '@open-wc/testing';

type InvalidHost = HTMLElement & { checkValidity(): boolean };

interface InvalidAliasOptions {
  alias?: 'observe' | 'cancel' | 'ignore';
  native?: 'uncancelled' | 'cancelled' | 'ignore';
  nativeCancelable?: boolean;
}

/** Checks the host's invalid alias and its cancellation relay to the native event. */
export function assertInvalidAlias(
  host: InvalidHost,
  { alias = 'observe', native = 'uncancelled', nativeCancelable = false }: InvalidAliasOptions = {}
): CustomEvent[] {
  const aliases: CustomEvent[] = [];
  const natives: Event[] = [];
  if (alias !== 'ignore') {
    host.addEventListener('lr-invalid', event => {
      aliases.push(event as CustomEvent);
      if (alias === 'cancel') event.preventDefault();
    });
  }
  // The host's relay was registered before this native recorder.
  if (native !== 'ignore') host.addEventListener('invalid', event => natives.push(event));

  expect(host.checkValidity()).to.be.false;
  if (alias !== 'ignore') {
    expect(aliases).to.have.lengthOf(1);
    const event = aliases[0];
    if (!event) throw new Error('The invalid alias was not emitted.');
    expect(event.target === host).to.equal(true);
    expect(event.bubbles && event.composed).to.be.true;
    expect(event.cancelable).to.be.true;
  }
  if (native !== 'ignore') {
    expect(natives).to.have.lengthOf(1);
    const event = natives[0];
    if (!event) throw new Error('The native invalid event was not emitted.');
    if (nativeCancelable) expect(event.cancelable, 'the native invalid event is cancelable').to.be.true;
    expect(event.defaultPrevented).to.equal(native === 'cancelled');
  }
  return aliases;
}
