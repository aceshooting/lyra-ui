import { expect, fixture } from '@open-wc/testing';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { publicCollectionTruncation, collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import type { LyraThreadList } from './thread-list.class.js';
import './thread-list.js';

expectDevWarning(collectionTruncationWarningKey('lr-thread-list', 'threads'));
const source = (): LyraThreadList['threads'] => Array.from({ length: 10001 }, (_, index) => ({ id: `t${index}`, title: `Thread ${index}` }));

it('discloses original input loss and keeps mount, rebind and reconnect quiet', async () => {
  const host = document.createElement('lr-thread-list');
  host.strings = { threadListInputLimit: 'Input omitted' };
  host.threads = source();
  const spoken: string[] = [];
  const original = AnnouncementSinkController.prototype.announce;
  AnnouncementSinkController.prototype.announce = function(message, politeness) {
    if ((this as unknown as { host: HTMLElement }).host === host && message) spoken.push(message);
    original.call(this, message, politeness);
  };
  try {
    await fixture(host);
    expect(publicCollectionTruncation(host, 'threads') !== undefined).to.equal(true);
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Input omitted');
    expect(spoken).to.deep.equal([]);
    host.threads = host.threads; await host.updateComplete;
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Input omitted');
    host.threads = []; await host.updateComplete;
    expect(host.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
    host.threads = source(); await host.updateComplete;
    expect(spoken).to.deep.equal(['Input omitted']);
    host.requestUpdate(); await host.updateComplete;
    const parent = host.parentNode!; host.remove(); parent.append(host); await host.updateComplete;
    expect(spoken).to.deep.equal(['Input omitted']);
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Input omitted');
    host.threads = [...source(), { id: 'after-reconnect', title: 'After reconnect' }]; await host.updateComplete;
    expect(spoken).to.deep.equal(['Input omitted', 'Input omitted']);
  } finally { AnnouncementSinkController.prototype.announce = original; }
});

it('renders the unregistered English original-input notice', async () => {
  const host = document.createElement('lr-thread-list');
  host.lang = 'en'; host.threads = source();
  await fixture(host);
  expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Some threads were omitted because an input limit was reached.');
  expect(getComputedStyle(host.shadowRoot!.querySelector<HTMLElement>('[part="limit"]')!).display).to.not.equal('none');
});
