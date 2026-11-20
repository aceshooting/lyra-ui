import { expect } from '@open-wc/testing';
import { fetchedModule } from '../../../../test/resource-entries.js';

it('normalizes composer status without loading the editor class', async () => {
  const { LyraAgentWorkspace } = await import('./agent-workspace.class.js');
  expect(typeof LyraAgentWorkspace).to.equal('function');
  expect(fetchedModule(/\/chat-composer\.class\.(?:js|ts)$/, { control: '/agent-workspace.class.ts' })).to.equal(false);
});
