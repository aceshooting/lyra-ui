import { html, replacedServerNodes, ssrFixture } from '../wtr-ssr-fixture.js';
import { expect } from '@open-wc/testing';

async function rejection(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected ssrFixture to reject');
}

describe('ssrFixture harness', () => {
  it('hydrates shadow-nested Lyra hosts the server deferred, with a property-bound object catalog', async () => {
    const currencies = [
      { code: 'EUR', label: 'Euro', symbol: '€' },
      { code: 'USD', label: 'US dollar', symbol: '$' },
    ];
    const picker = await ssrFixture<HTMLElement & { value: string }>(
      html`<lr-currency-picker .currencies=${currencies} value="USD" label="Billing currency"></lr-currency-picker>`,
    );
    expect(picker.value).to.equal('USD');
    const nestedHosts = [...picker.shadowRoot!.querySelectorAll('*')].filter((node) => node.localName.startsWith('lr-'));
    expect(nestedHosts.map((host) => host.localName)).to.include('lr-select');
    expect(nestedHosts.every((host) => host.shadowRoot !== null && !host.hasAttribute('defer-hydration'))).to.equal(true);
    expect(picker.shadowRoot!.querySelector('style')).to.not.equal(null, 'server styles stay in the adopted shadow root');
  });

  it('rejects values that cannot cross to the server instead of rendering something else', async () => {
    const message = await rejection(() => ssrFixture(html`<lr-badge .variant=${() => 'primary'}></lr-badge>`));
    expect(message).to.contain('cannot be rendered on the server');
  });

  it('fails a knownDefect allowance that no longer reproduces, so it cannot outlive its fix', async () => {
    const message = await rejection(() =>
      ssrFixture(html`<lr-badge>Stable</lr-badge>`, { knownDefect: { matches: /never/, reason: 'probe' } }),
    );
    expect(message).to.contain('no longer reproduces');
  });

  it('still fails problems outside a knownDefect pattern', async () => {
    const message = await rejection(() =>
      // A misspelled attribute makes the dev-mode check warn while hydrating: a real problem
      // that stays independent of any library defect a later fix would remove.
      ssrFixture(html`<lr-badge varient="primary">Stable</lr-badge>`, {
        knownDefect: { matches: /unrelated pattern/, reason: 'probe' },
      }),
    );
    expect(message).to.contain('beyond the known defect');
  });

  it('tells a re-rendered server node from a collapsed progressive fallback', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<span part="label">Name</span><slot name="hint"></slot>';
    const server = [root, ...root.childNodes, ...root.firstChild!.childNodes];
    const wrapper = document.createElement('div');
    wrapper.append(host);
    expect(replacedServerNodes(server, wrapper)).to.have.length(0);
    root.querySelector('slot')!.remove();
    expect(replacedServerNodes(server, wrapper), 'a removed fallback is not a replacement').to.have.length(0);
    root.replaceChild(root.firstChild!.cloneNode(true), root.firstChild!);
    expect(replacedServerNodes(server, wrapper).map((node) => node.nodeName)).to.deep.equal(['SPAN', '#text']);
  });
});
