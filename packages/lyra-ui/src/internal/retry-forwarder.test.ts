import { expect } from '@open-wc/testing';
import { createRetryForwarder } from './retry-forwarder.js';

const retry = (): CustomEvent<null> => new CustomEvent('lr-retry-request', { cancelable: true, detail: null });

it('commits unless the forwarded request is vetoed, and always stops the nested event', () => {
  let commits = 0;
  let veto = false;
  const forward = createRetryForwarder(
    (init) => {
      const request = new CustomEvent('lr-retry-request', init);
      if (veto) request.preventDefault();
      return request;
    },
    () => { commits++; },
  );
  const allowed = retry();
  forward(allowed);
  expect(commits).to.equal(1);
  expect(allowed.defaultPrevented).to.equal(false);
  veto = true;
  const vetoed = retry();
  forward(vetoed);
  expect(commits).to.equal(1);
  expect(vetoed.defaultPrevented).to.equal(true);
});

it('refuses a retry that arrives while one is being forwarded', () => {
  const nested = retry();
  let forward: (event: CustomEvent<null>) => void = () => {};
  forward = createRetryForwarder(
    (init) => {
      forward(nested);
      return new CustomEvent('lr-retry-request', init);
    },
    () => {},
  );
  forward(retry());
  expect(nested.defaultPrevented).to.equal(true);
});
