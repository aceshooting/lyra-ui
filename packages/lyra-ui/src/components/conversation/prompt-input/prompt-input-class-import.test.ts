import { expect } from '@open-wc/testing';

it('normalizes composer status without loading the editor class', async () => {
  const { LyraPromptInput } = await import('./prompt-input.class.js');
  expect(typeof LyraPromptInput).to.equal('function');
  const loaded = performance.getEntriesByType('resource').some(entry =>
    /\/chat-composer\.class\.(?:js|ts)$/.test(new URL(entry.name).pathname));
  expect(loaded).to.equal(false);
});
