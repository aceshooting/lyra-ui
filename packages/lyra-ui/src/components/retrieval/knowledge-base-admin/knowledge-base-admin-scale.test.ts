import { expect, fixture, html } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './knowledge-base-admin.js';
import type { LyraKnowledgeBaseAdmin } from './knowledge-base-admin.class.js';
it('discloses original collection loss and clears it after replacement', async () => {
  expectDevWarning(collectionTruncationWarningKey('lr-knowledge-base-admin', 'sources'));
  const values = Array.from({ length: 12000 }, (_, i) => ({ id: `s${i}`, name: 'Source', type: 'file', syncStatus: 'synced', indexingHealth: 'healthy', documentCount: 0 }));
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .sources=${values}></lr-knowledge-base-admin>`);
  const loss = publicCollectionTruncation(host, 'sources')!;
  expect(host.shadowRoot!.querySelector('[part="input-limit"]')?.textContent ?? '').to.contain('12,000');
  recordScaleMeasurement('lr-knowledge-base-admin', 'n=12000 wrapper admission', { retained: loss.retained, notices: host.shadowRoot!.querySelectorAll('[part="input-limit"]').length });
  host.activeTab = 'ingestion'; await host.updateComplete;
  expect(host.shadowRoot!.querySelectorAll('lr-knowledge-base').length).to.equal(0);
  expect(host.shadowRoot!.querySelectorAll('lr-ingestion-queue').length).to.equal(1);
  expect(host.shadowRoot!.querySelectorAll('[part="input-limit"]').length).to.equal(0);
  host.activeTab = 'sources';
  host.sources = []; await host.updateComplete;
  expect(host.shadowRoot!.querySelectorAll('[part="input-limit"]').length).to.equal(0);
});

it('announces a newly limited source after a quiet reconnect', async () => {
  expectDevWarning(collectionTruncationWarningKey('lr-knowledge-base-admin', 'sources'));
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin></lr-knowledge-base-admin>`);
  const seam = host as unknown as { inputAnnouncements: { announcePolite(message: string): void } };
  const original = seam.inputAnnouncements.announcePolite;
  const announced: string[] = [];
  seam.inputAnnouncements.announcePolite = (message) => { announced.push(message); };
  try {
    const parent = host.parentElement!; host.remove(); parent.append(host); await host.updateComplete;
    expect(announced.length).to.equal(0);
    host.sources = Array.from({ length: 12000 }, (_, i) => ({ id: `s${i}`, name: 'Source', syncStatus: 'synced' }));
    await host.updateComplete;
    expect(announced.length).to.equal(1);
  } finally { seam.inputAnnouncements.announcePolite = original; }
});
