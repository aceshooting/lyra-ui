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
    await waitUntil(() => peer!.element.childElementCount === 1, 'retained peer announcement flushed');
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

it('replaces queued messages across rapid native modal transitions while preserving a peer region', async () => {
  const root = await fixture<HTMLDivElement>(html`<div><dialog id="first"><button>Source</button></dialog><dialog id="second"></dialog></div>`);
  const first = root.querySelector<HTMLDialogElement>('#first')!, second = root.querySelector<HTMLDialogElement>('#second')!;
  const source = first.querySelector('button')!;
  const producer = acquireAnnouncementSink('polite', { source });
  let peer: ReturnType<typeof acquireAnnouncementSink> | undefined;
  try {
    first.showModal();
    producer.announce('Retired first transition');
    peer = acquireAnnouncementSink('polite', { source });
    peer.announce('Preserved peer');
    second.append(source); second.showModal();
    producer.announce('Retired second transition');
    const retiredRegion = producer.element;
    second.close(); first.append(source);
    producer.announce('Current first transition');
    expect(retiredRegion.isConnected).to.equal(false);
    expect(producer.element === peer.element).to.equal(true);
    await waitUntil(() => producer.element.childElementCount === 2);
    expect([...producer.element.children].map(child => child.textContent)).to.deep.equal(['Preserved peer', 'Current first transition']);
    producer.release();
    expect([...peer.element.children].map(child => child.textContent)).to.deep.equal(['Preserved peer']);
  } finally {
    producer.release(); peer?.release(); second.close(); first.close();
  }
});

it('bounds a modal transition burst to its latest messages before they enter the shared live region', async () => {
  const root = await fixture<HTMLDialogElement>(html`<dialog><button>Source</button></dialog>`);
  const source = root.querySelector('button')!;
  const producer = acquireAnnouncementSink('polite', { source });
  try {
    root.showModal();
    for (let index = 0; index < 100; index++) producer.announce(`Status ${index}`);
    expect(producer.element.parentElement === root).to.equal(true);
    expect(producer.element.childElementCount).to.equal(0);
    await waitUntil(() => producer.element.childElementCount === 32);
    expect([...producer.element.children].map(child => child.textContent)).to.deep.equal(Array.from({ length: 32 }, (_, index) => `Status ${index + 68}`));
    producer.release();
    expect(root.querySelectorAll('[data-lr-live-region]').length).to.equal(0);
  } finally { producer.release(); root.close(); }
});
