import { expect, fixture } from '@open-wc/testing';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { publicCollectionTruncation, collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import type { LyraCommandPalette } from './command-palette.class.js';
import './command-palette.js';

expectDevWarning(collectionTruncationWarningKey('lr-command-palette', 'commands'));
const source = (): LyraCommandPalette['commands'] => Array.from({ length: 10001 }, (_, index) => ({ commandId: `c${index}`, label: `Command ${index}` }));

it('discloses original input loss and keeps mount, rebind and reconnect quiet', async () => {
  const host = document.createElement('lr-command-palette');
  host.strings = { commandPaletteInputLimit: 'Input omitted' };
  host.commands = source();
  host.open = true;
  const spoken: string[] = [];
  const original = AnnouncementSinkController.prototype.announce;
  AnnouncementSinkController.prototype.announce = function(message, politeness) {
    if ((this as unknown as { host: HTMLElement }).host === host && message) spoken.push(message);
    original.call(this, message, politeness);
  };
  try {
    await fixture(host);
    expect(publicCollectionTruncation(host, 'commands') !== undefined).to.equal(true);
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Input omitted');
    expect(spoken).to.deep.equal([]);
    host.commands = host.commands; await host.updateComplete;
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Input omitted');
    host.commands = []; await host.updateComplete;
    expect(host.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
    host.commands = source(); await host.updateComplete;
    expect(spoken).to.deep.equal(['Input omitted']);
    host.requestUpdate(); await host.updateComplete;
    const parent = host.parentNode!; host.remove(); parent.append(host); await host.updateComplete;
    expect(spoken).to.deep.equal(['Input omitted']);
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Input omitted');
  } finally { AnnouncementSinkController.prototype.announce = original; }
});

it('keeps closed loss changes quiet and announces later visible loss once', async () => {
  const host = document.createElement('lr-command-palette');
  host.strings = { commandPaletteInputLimit: 'Commands omitted' };
  const spoken: string[] = [];
  const original = AnnouncementSinkController.prototype.announce;
  AnnouncementSinkController.prototype.announce = function(message, politeness) {
    if ((this as unknown as { host: HTMLElement }).host === host && message) spoken.push(message);
    original.call(this, message, politeness);
  };
  try {
    await fixture(host);
    host.commands = source(); await host.updateComplete;
    expect(host.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
    expect(spoken).to.deep.equal([]);
    host.open = true; await host.updateComplete;
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Commands omitted');
    expect(spoken).to.deep.equal([]);
    host.commands = [...source(), { commandId: 'last', label: 'Last' }]; await host.updateComplete;
    expect(spoken).to.deep.equal(['Commands omitted']);
    host.requestUpdate(); await host.updateComplete;
    expect(spoken).to.deep.equal(['Commands omitted']);
  } finally { AnnouncementSinkController.prototype.announce = original; }
});

it('renders the unregistered English original-input notice', async () => {
  const host = document.createElement('lr-command-palette');
  host.lang = 'en'; host.commands = source();
  host.open = true;
  await fixture(host);
  expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Some commands were omitted because an input limit was reached.');
  expect(getComputedStyle(host.shadowRoot!.querySelector<HTMLElement>('[part="limit"]')!).display).to.not.equal('none');
});
