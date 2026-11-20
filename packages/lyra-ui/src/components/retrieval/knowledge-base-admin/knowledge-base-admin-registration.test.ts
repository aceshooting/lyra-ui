import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-knowledge-base-admin.js';
import type { LyraKnowledgeBaseAdmin } from './knowledge-base-admin.class.js';

it('registers the ingestion queue only when its tab first opens', async () => {
  const admin = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin></lr-knowledge-base-admin>`);
  expect(Boolean(customElements.get('lr-ingestion-queue'))).to.equal(false);
  admin.activeTab = 'ingestion';
  await admin.updateComplete;
  const queue = admin.shadowRoot!.querySelector('lr-ingestion-queue');
  const Queue = customElements.get('lr-ingestion-queue');
  expect(Boolean(Queue && queue instanceof Queue)).to.equal(true);
});
