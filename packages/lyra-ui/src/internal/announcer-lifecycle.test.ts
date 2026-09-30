import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { acquireAnnouncementSink } from './announcer.js';

it('sweeps and releases announcements in a document without a timer window', async () => {
  const doc = document.implementation.createHTMLDocument('Announcement owner');
  const sink = acquireAnnouncementSink('polite', { document: doc, messageTtlMs: 20 });
  try {
    expect(doc.defaultView === null).to.equal(true);
    sink.announce('Transient status');
    expect(sink.element.parentElement === doc.body).to.equal(true);
    expect(sink.element.textContent).to.equal('Transient status');
    await waitUntil(() => sink.element.childElementCount === 0, 'ownerless document message must be swept');
    sink.release();
    sink.announce('Released status');
    expect(doc.querySelectorAll('[data-lr-live-region]').length).to.equal(0);
  } finally {
    sink.release();
  }
});

it('cancels a deferred modal announcement on release without removing a peer sink', async () => {
  const root = await fixture<HTMLDivElement>(html`<div><dialog><button>Foreground source</button></dialog></div>`);
  const dialog = root.querySelector('dialog')!;
  const source = dialog.querySelector('button')!;
  const transitioning = acquireAnnouncementSink('polite', { source });
  let peer: ReturnType<typeof acquireAnnouncementSink> | undefined;
  try {
    dialog.showModal();
    transitioning.announce('Canceled transition');
    expect(transitioning.element.parentElement === dialog).to.equal(true);
    expect(transitioning.element.childElementCount).to.equal(0);
    peer = acquireAnnouncementSink('polite', { source });
    expect(peer.element === transitioning.element).to.equal(true);
    transitioning.release();
    peer.announce('Retained peer');
    await new Promise<void>(resolve => setTimeout(resolve, 30));
    expect(peer.element.parentElement === dialog).to.equal(true);
    expect([...peer.element.children].map(child => child.textContent)).to.deep.equal(['Retained peer']);
    transitioning.announce('Released producer');
    expect(peer.element.childElementCount).to.equal(1);
    peer.release();
    expect(dialog.querySelectorAll('[data-lr-live-region]').length).to.equal(0);
  } finally {
    transitioning.release();
    peer?.release();
    dialog.close();
  }
});
