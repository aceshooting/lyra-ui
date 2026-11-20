import { expect } from '@open-wc/testing';
import { fetchedModule } from '../../../../test/resource-entries.js';

it('normalizes composer status without loading the editor class', async () => {
  const { LyraPromptInput } = await import('./prompt-input.class.js');
  expect(typeof LyraPromptInput).to.equal('function');
  expect(fetchedModule(/\/chat-composer\.class\.(?:js|ts)$/, { control: '/prompt-input.class.ts' })).to.equal(false);
});
