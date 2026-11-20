import { expect } from '@open-wc/testing';
import { RESOURCE_TIMING_BUFFER_SIZE, fetchedModule, fetchedModulePaths } from '../test/resource-entries.js';

function thrownMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  return '';
}

describe('resource-entry module checks', () => {
  it('answers an absence check only when its control module was recorded', () => {
    const control = '/test/resource-entries.ts';
    expect(fetchedModule(control)).to.equal(true);
    expect(fetchedModule('/never-a-module.ts', { control })).to.equal(false);
    expect(fetchedModule(/\/resource-entries\.ts$/u, { control })).to.equal(true);
    expect(thrownMessage(() => fetchedModule('/never-a-module.ts', { control: '/never-a-control.ts' })))
      .to.contain('Control module /never-a-control.ts is absent');
  });

  it('records more resources than the default 250-entry buffer allows', async () => {
    // The runner page enlarges the buffer before any module loads, so a large import graph keeps
    // every entry, including the modules fetched after the 250th.
    await import('./lyra.js');
    const paths = fetchedModulePaths();
    expect(paths.length).to.be.above(250);
    expect(paths.length).to.be.below(RESOURCE_TIMING_BUFFER_SIZE);
    expect(fetchedModule('/src/lyra.ts')).to.equal(true);
  });
});
