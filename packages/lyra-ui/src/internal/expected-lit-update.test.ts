import { expect } from '@open-wc/testing';
import { captureReentrantUpdateWarning } from '../../test/expected-lit-update.js';

const message = (name: string) => `Element ${name} scheduled an update (generally because a property was set) after an update completed, causing a new update to be scheduled. This is inefficient and should be avoided unless the next update can only be scheduled as a side effect of the previous update. See https://lit.dev/msg/change-in-update for more information.`;

it('forwards unrelated and wrong-element warnings and restores warning state after failure', async () => {
  const runtime = globalThis as { litIssuedWarnings?: Set<string> };
  const issued = runtime.litIssuedWarnings;
  const original = console.warn;
  const forwarded: unknown[][] = [];
  const outer = (...args: unknown[]) => { forwarded.push(args); };
  const expected = message('lr-example');
  const failure = new Error('fixture failure');
  runtime.litIssuedWarnings = new Set([expected, 'unrelated']);
  console.warn = outer;
  try {
    let caught: unknown;
    try {
      await captureReentrantUpdateWarning('lr-example', async () => {
        expect(runtime.litIssuedWarnings!.has(expected)).to.equal(false);
        console.warn(message('lr-other'));
        console.warn('unrelated warning', 3);
        console.warn(expected);
        throw failure;
      });
    } catch (error) { caught = error; }
    expect(caught === failure).to.equal(true);
    expect(console.warn === outer).to.equal(true);
    expect([...runtime.litIssuedWarnings!]).to.have.members([expected, 'unrelated']);
    expect(forwarded).to.deep.equal([[message('lr-other')], ['unrelated warning', 3]]);
    runtime.litIssuedWarnings!.delete(expected);
    expect(await captureReentrantUpdateWarning('lr-example', async () => {
      console.warn(expected);
      runtime.litIssuedWarnings!.add(expected);
    })).to.equal(1);
    expect(runtime.litIssuedWarnings!.has(expected)).to.equal(false);
    expect(console.warn === outer).to.equal(true);
  } finally {
    console.warn = original;
    runtime.litIssuedWarnings = issued;
  }
});
