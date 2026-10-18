import { expect, fixture } from '@open-wc/testing';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { publicCollectionTruncation, collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import './prompt-input.js';

for (const property of ['modelCatalog', 'voiceCatalog', 'mentionItems', 'commandItems'] as const) {
  expectDevWarning(collectionTruncationWarningKey('lr-prompt-input', property));
  it(`discloses outer ${property} loss before a child can infer the original input`, async () => {
    const host = document.createElement('lr-prompt-input');
    host.strings = { promptInputInputLimit: 'Prompt omitted' };
    const source = () => Array.from({ length: 1000 }, (_, index) => ({ id: `item${index}`, suggestionId: `item${index}`, label: `Item ${index}`, extra: Array.from({ length: 100 }, () => 'x') }));
    host[property] = source();
    const spoken: string[] = [];
    const original = AnnouncementSinkController.prototype.announce;
    AnnouncementSinkController.prototype.announce = function(message, politeness) {
      if ((this as unknown as { host: HTMLElement }).host === host && message) spoken.push(message);
      original.call(this, message, politeness);
    };
    try {
      await fixture(host);
      expect(publicCollectionTruncation(host, property) !== undefined).to.equal(true);
      expect(host[property]!.length < 1024).to.equal(true);
      expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Prompt omitted');
      expect(spoken).to.deep.equal([]);
      const loss = publicCollectionTruncation(host, property)!;
      recordScaleMeasurement('lr-prompt-input', `n=1000 ${property} nested admission and notice`, {
        sourceEntries: loss.source, retainedEntries: host[property]!.length,
        limitNotices: host.shadowRoot!.querySelectorAll('[part="limit"]').length,
        domNodes: renderedNodeCount(host), initialAnnouncements: spoken.length,
      });
      host[property] = []; await host.updateComplete;
      expect(host.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
      host[property] = source(); await host.updateComplete;
      expect(spoken).to.deep.equal(['Prompt omitted']);
      Reflect.set(host, property, Reflect.get(host, property)); await host.updateComplete;
      const parent = host.parentNode!; host.remove(); parent.append(host); await host.updateComplete;
      expect(spoken).to.deep.equal(['Prompt omitted']);
      expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Prompt omitted');
      host[property] = [...source(), { id: 'after-reconnect', suggestionId: 'after-reconnect', label: 'After reconnect', extra: Array.from({ length: 100 }, () => 'x') }]; await host.updateComplete;
      expect(spoken).to.deep.equal(['Prompt omitted', 'Prompt omitted']);
    } finally { AnnouncementSinkController.prototype.announce = original; }
  });
}

it('keeps original catalog loss visible when no valid child catalog remains', async () => {
  const host = document.createElement('lr-prompt-input');
  host.strings = { promptInputInputLimit: 'No catalog retained' };
  host.modelCatalog = Array.from({ length: 1000 }, () => ({ id: '', label: '', extra: Array.from({ length: 100 }, () => 'x') }));
  await fixture(host);
  expect(publicCollectionTruncation(host, 'modelCatalog') !== undefined).to.equal(true);
  expect(host.shadowRoot!.querySelectorAll('lr-model-select').length).to.equal(0);
  expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('No catalog retained');
});

it('renders the unregistered English outer-input notice', async () => {
  const host = document.createElement('lr-prompt-input');
  host.lang = 'en';
  host.modelCatalog = Array.from({ length: 1000 }, (_, index) => ({ id: `model${index}`, label: `Model ${index}`, extra: Array.from({ length: 100 }, () => 'x') }));
  await fixture(host);
  expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Some suggestions or catalog entries were omitted because an input limit was reached.');
});
