import { expect } from '@open-wc/testing';

it('resolves the published root entry and representative granular subpaths', async function () {
  // Importing the complete barrel can contend with the other module-heavy
  // test files when the full suite starts them concurrently.
  this.timeout(60_000);
  const root = await import('@aceshooting/lyra-ui');
  const classEntry = await import('@aceshooting/lyra-ui/components/empty/empty.class.js');
  const helperEntry = await import('@aceshooting/lyra-ui/components/export-button/csv.js');

  expect(typeof root.LyraElement).to.equal('function');
  expect(typeof root.groupByRecency).to.equal('function');
  expect(typeof classEntry.LyraEmpty).to.equal('function');
  expect(typeof helperEntry.buildCsv).to.equal('function');
});
