import { expect, fixture, html } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../internal/announcer.js';
import { ViewerAnnouncementController } from './viewer-announcements.js';

const sink = (doc: Document, politeness: 'polite' | 'assertive'): HTMLElement | null =>
  doc.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);

describe('ViewerAnnouncementController', () => {
  it('pre-mounts light-DOM sinks, suppresses the initial state, and announces later transitions once', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const announcements = new ViewerAnnouncementController(host);

    announcements.connect();
    expect(sink(document, 'polite')?.childElementCount).to.equal(0);
    expect(sink(document, 'assertive')?.childElementCount).to.equal(0);

    announcements.transition('load', 'loading', 'Loading document');
    expect(sink(document, 'polite')?.childElementCount).to.equal(0);

    announcements.transition('load', 'ready');
    announcements.transition('load', 'loading', 'Loading document');
    announcements.transition('load', 'loading', 'Loading document');
    expect(sink(document, 'polite')?.textContent).to.equal('Loading document');
    expect(sink(document, 'polite')?.childElementCount).to.equal(1);

    announcements.transition('load', 'error', 'Document failed');
    announcements.transition('load', 'error', 'Document failed');
    expect(sink(document, 'assertive')?.textContent).to.equal('Document failed');
    expect(sink(document, 'assertive')?.childElementCount).to.equal(1);

    announcements.disconnect();
    host.remove();
    expect(sink(document, 'polite') === null).to.equal(true);
    expect(sink(document, 'assertive') === null).to.equal(true);
  });

  it('does not replay held state after reconnect and retargets both sinks after adoption', async () => {
    const realms = await fixture<HTMLDivElement>(html`
      <div>
        <iframe title="First announcement realm"></iframe>
        <iframe title="Second announcement realm"></iframe>
      </div>
    `);
    const [firstFrame, secondFrame] = Array.from(realms.querySelectorAll('iframe'));
    const firstDocument = firstFrame!.contentDocument!;
    const secondDocument = secondFrame!.contentDocument!;
    const host = firstDocument.createElement('div');
    firstDocument.body.append(host);
    const announcements = new ViewerAnnouncementController(host);

    try {
      expect(
        firstDocument.defaultView !== null && secondDocument.defaultView !== null,
        'both owner documents must be rendered realms so source visibility can be evaluated',
      ).to.equal(true);
      expect(
        typeof host.checkVisibility !== 'function' ||
          host.checkVisibility({ contentVisibilityAuto: true }),
        'the announcement source must be rendered',
      ).to.equal(true);

      announcements.connect();
      announcements.transition('load', 'error', 'Historical failure');
      announcements.disconnect();
      announcements.connect();
      announcements.transition('load', 'error', 'Historical failure');
      expect(sink(firstDocument, 'assertive')?.childElementCount).to.equal(0);

      secondDocument.adoptNode(host);
      secondDocument.body.append(host);
      announcements.adopted();
      expect(sink(firstDocument, 'polite') === null).to.equal(true);
      expect(sink(firstDocument, 'assertive') === null).to.equal(true);
      expect(sink(secondDocument, 'polite')?.childElementCount).to.equal(0);
      expect(sink(secondDocument, 'assertive')?.childElementCount).to.equal(0);

      announcements.transition('load', 'ready');
      announcements.transition('load', 'error', 'New failure');
      expect(sink(secondDocument, 'assertive')?.textContent).to.equal('New failure');

      announcements.disconnect();
      expect(sink(secondDocument, 'polite') === null).to.equal(true);
      expect(sink(secondDocument, 'assertive') === null).to.equal(true);
    } finally {
      announcements.disconnect();
      host.remove();
      realms.remove();
    }
  });
});
