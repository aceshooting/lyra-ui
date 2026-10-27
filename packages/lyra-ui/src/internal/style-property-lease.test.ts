import { expect } from '@open-wc/testing';
import { leaseInlineStyleProperty } from './style-property-lease.js';

describe('leaseInlineStyleProperty', () => {
  let element: HTMLElement;
  beforeEach(() => {
    element = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => element.remove());

  const nextMutationDelivery = (): Promise<void> => new Promise<void>((resolve) => queueMicrotask(resolve));

  it('holds its value, then restores the original declaration on release', () => {
    element.style.setProperty('overflow', 'auto', 'important');
    const lease = leaseInlineStyleProperty(element, 'overflow', 'hidden');
    expect(element.style.overflow).to.equal('hidden');
    expect(element.style.getPropertyPriority('overflow')).to.equal('');
    lease.release();
    expect(element.style.overflow).to.equal('auto');
    expect(element.style.getPropertyPriority('overflow')).to.equal('important');
  });

  it('restores an absent declaration after CSSOM canonicalizes a zero-length lease', () => {
    const lease = leaseInlineStyleProperty(element, 'padding', '0');
    expect(element.style.padding, 'CSSOM canonicalizes the temporary zero length').to.equal('0px');
    lease.release();
    expect(element.style.padding, 'the temporary canonical value is not an external write').to.equal('');
  });

  it('does not reinterpret a canonicalized lease as external after an unrelated style mutation', async () => {
    element.style.setProperty('padding', '8px', 'important');
    let resolutions = 0;
    const lease = leaseInlineStyleProperty(element, 'padding', '0', '', () => {
      resolutions += 1;
      return { value: '0' };
    });
    try {
      element.style.color = 'red';
      await nextMutationDelivery();
      expect(resolutions, 'an unrelated declaration must not resolve or reassert the lease').to.equal(0);
      expect(element.style.padding).to.equal('0px');
    } finally {
      lease.release();
    }
    expect(element.style.padding).to.equal('8px');
    expect(element.style.getPropertyPriority('padding')).to.equal('important');
    expect(element.style.color, 'unrelated authored declarations survive release').to.equal('red');
  });

  it('retains the latest external declaration and priority when set() writes a canonicalized zero', async () => {
    element.style.setProperty('padding', '8px', 'important');
    const lease = leaseInlineStyleProperty(element, 'padding', '4px');
    try {
      element.style.setProperty('padding', '12px', 'important');
      await nextMutationDelivery();
      expect(element.style.padding, 'the lease still reasserts its temporary value').to.equal('4px');
      lease.set('0');
      expect(element.style.padding).to.equal('0px');
    } finally {
      lease.release();
    }
    expect(element.style.padding).to.equal('12px');
    expect(element.style.getPropertyPriority('padding')).to.equal('important');
  });

  it('release() is idempotent: a second call never reverts what the page wrote after the first', () => {
    element.style.overflow = 'auto';
    const lease = leaseInlineStyleProperty(element, 'overflow', 'hidden');
    lease.release();
    expect(element.style.overflow).to.equal('auto');
    // The page now writes the very value the lease used to hold; a repeated release that treated it
    // as lease-owned would restore the stale snapshot over it.
    element.style.overflow = 'hidden';
    lease.release();
    expect(element.style.overflow).to.equal('hidden');
  });

  it('ignores set() after release and replaces the value while leased', () => {
    const lease = leaseInlineStyleProperty(element, 'overflow', 'hidden');
    lease.set('clip');
    expect(element.style.overflow).to.equal('clip');
    lease.release();
    expect(element.style.overflow).to.equal('');
    lease.set('hidden');
    expect(element.style.overflow, 'a released lease stays released').to.equal('');
  });

  it('reasserts the leased value after an external write and restores that write on release', async () => {
    const lease = leaseInlineStyleProperty(element, 'overflow', 'hidden');
    element.style.setProperty('overflow', 'scroll', 'important');
    await nextMutationDelivery();
    expect(element.style.overflow).to.equal('hidden');
    lease.release();
    expect(element.style.overflow).to.equal('scroll');
    expect(element.style.getPropertyPriority('overflow')).to.equal('important');
  });

  it('lets a resolver derive the leased value from the external one', async () => {
    const lease = leaseInlineStyleProperty(element, 'padding-inline-end', '10px', '', (externalValue) => ({
      value: `${parseFloat(externalValue) + 10}px`,
    }));
    element.style.setProperty('padding-inline-end', '5px');
    await nextMutationDelivery();
    expect(element.style.paddingInlineEnd).to.equal('15px');
    lease.release();
    expect(element.style.paddingInlineEnd).to.equal('5px');
  });
});
