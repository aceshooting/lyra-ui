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
