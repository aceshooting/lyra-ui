import { expect } from '@open-wc/testing';
import { toast } from './toaster.js';

it('retries registration after one shared attempt rejects', async () => {
  const define = customElements.define;
  const failure = new Error('Registration unavailable');
  customElements.define = () => { throw failure; };
  try {
    const first = toast('First').item;
    const second = toast('Second').item;
    const errors = await Promise.all([first, second].map(item => item.catch((error: unknown) => error)));
    expect(errors.every(error => error === failure)).to.equal(true);
  } finally {
    customElements.define = define;
  }
  const item = await toast({ message: 'Recovered', duration: 0 }).item;
  expect(item.isConnected).to.equal(true);
  item.remove();
});
