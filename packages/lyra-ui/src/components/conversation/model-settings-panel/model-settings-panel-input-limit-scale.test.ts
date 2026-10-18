import { expect, fixture } from '@open-wc/testing';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { publicCollectionTruncation, collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import type { LyraModelSettingsPanel } from './model-settings-panel.class.js';
import './model-settings-panel.js';

expectDevWarning(collectionTruncationWarningKey('lr-model-settings-panel', 'catalog'));
const source = (): LyraModelSettingsPanel['catalog'] => Array.from({ length: 1000 }, (_, index) => ({ id: `m${index}`, label: `Model ${index}`, extra: Array.from({ length: 100 }, () => 'x') }));

it('discloses original input loss and keeps mount, rebind and reconnect quiet', async () => {
  const host = document.createElement('lr-model-settings-panel');
  host.strings = { catalogPickerInputLimit: 'Input omitted' };
  host.catalog = source();
  const spoken: string[] = [];
  const original = AnnouncementSinkController.prototype.announce;
  AnnouncementSinkController.prototype.announce = function(message, politeness) {
    if ((this as unknown as { host: HTMLElement }).host === host && message) spoken.push(message);
    original.call(this, message, politeness);
  };
  try {
    await fixture(host);
    expect(publicCollectionTruncation(host, 'catalog') !== undefined).to.equal(true);
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Input omitted');
    expect(spoken).to.deep.equal([]);
    const loss = publicCollectionTruncation(host, 'catalog')!;
    recordScaleMeasurement('lr-model-settings-panel', 'n=1000 nested catalog admission and notice', {
      sourceEntries: loss.source, retainedEntries: host.catalog!.length,
      limitNotices: host.shadowRoot!.querySelectorAll('[part="limit"]').length,
      domNodes: renderedNodeCount(host), initialAnnouncements: spoken.length,
    });
    host.catalog = host.catalog; await host.updateComplete;
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Input omitted');
    host.catalog = []; await host.updateComplete;
    expect(host.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
    host.catalog = source(); await host.updateComplete;
    expect(spoken).to.deep.equal(['Input omitted']);
    host.requestUpdate(); await host.updateComplete;
    const parent = host.parentNode!; host.remove(); parent.append(host); await host.updateComplete;
    expect(spoken).to.deep.equal(['Input omitted']);
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Input omitted');
  } finally { AnnouncementSinkController.prototype.announce = original; }
});

it('renders the unregistered English original-input notice', async () => {
  const host = document.createElement('lr-model-settings-panel');
  host.lang = 'en'; host.catalog = source();
  await fixture(host);
  expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Some catalog entries were omitted because an input limit was reached.');
  expect(getComputedStyle(host.shadowRoot!.querySelector<HTMLElement>('[part="limit"]')!).display).to.not.equal('none');
});

it('announces the first changed loss after a reconnect that does not need a render', async () => {
  const host = document.createElement('lr-model-settings-panel');
  host.strings = { catalogPickerInputLimit: 'Changed catalog loss' };
  host.catalog = source(); await fixture(host);
  const spoken: string[] = [];
  const original = AnnouncementSinkController.prototype.announce;
  AnnouncementSinkController.prototype.announce = function(message, politeness) {
    if ((this as unknown as { host: HTMLElement }).host === host && message) spoken.push(message);
    original.call(this, message, politeness);
  };
  try {
    const parent = host.parentNode!; host.remove(); parent.append(host); await host.updateComplete;
    expect(spoken).to.deep.equal([]);
    host.catalog = Array.from({ length: 1001 }, (_, index) => ({ id: `later${index}`, label: `Later ${index}`, extra: Array.from({ length: 100 }, () => 'x') }));
    await host.updateComplete;
    expect(spoken).to.deep.equal(['Changed catalog loss']);
  } finally { AnnouncementSinkController.prototype.announce = original; }
});
