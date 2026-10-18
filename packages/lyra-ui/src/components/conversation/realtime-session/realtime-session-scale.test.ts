import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './realtime-session.js';
import type { LyraRealtimeSession } from './realtime-session.class.js';
it('discloses original collection loss and clears it after replacement', async () => {
  expectDevWarning(collectionTruncationWarningKey('lr-realtime-session', 'entries'));
  const values = Array.from({ length: 12000 }, (_, i) => ({ id: `e${i}`, text: 'Caption' }));
  const host = await fixture<LyraRealtimeSession>(html`<lr-realtime-session .entries=${values}></lr-realtime-session>`);
  const initialNotice = host.shadowRoot!.querySelector('[part="input-limit"]')?.textContent ?? '';
  expect(sinkTexts().includes(initialNotice)).to.equal(false);
  const loss = publicCollectionTruncation(host, 'entries')!;
  expect(host.shadowRoot!.querySelector('[part="input-limit"]')?.textContent ?? '').to.contain('12,000');
  recordScaleMeasurement('lr-realtime-session', 'n=12000 wrapper admission', { retained: loss.retained, notices: host.shadowRoot!.querySelectorAll('[part="input-limit"]').length });
  const seam = host as unknown as { announcements: { announcePolite(message: string): void } };
  const original = seam.announcements.announcePolite;
  const announced: string[] = [];
  seam.announcements.announcePolite = (message) => { announced.push(message); };
  try {
    host.entries = [...values, { id: 'latest', text: 'Latest' }]; await host.updateComplete;
    expect(announced.some((text) => text.includes('12,001'))).to.equal(true);
    announced.length = 0;
    const parent = host.parentElement!; host.remove(); parent.append(host); await host.updateComplete;
    expect(announced.length).to.equal(0);
  } finally { seam.announcements.announcePolite = original; }
  host.entries = []; await host.updateComplete;
  expect(host.shadowRoot!.querySelectorAll('[part="input-limit"]').length).to.equal(0);
});
