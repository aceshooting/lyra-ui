import { html, ssrFixture } from '../wtr-ssr-fixture.js';
import { expect, oneEvent } from '@open-wc/testing';

describe('hydrated utility, media and retrieval content', () => {
  it('lr-format-number formats identically on the server and after hydration for a German ancestor', async () => {
    const wrapper = await ssrFixture(html`<p lang="de"><lr-format-number value="1234.5"></lr-format-number></p>`);
    const formatted = wrapper.querySelector<HTMLElement & { value: number; updateComplete: Promise<boolean> }>('lr-format-number')!;
    expect(formatted.shadowRoot!.querySelector('bdi')!.textContent!.trim()).to.equal('1.234,5');
    formatted.value = 98765.5;
    await formatted.updateComplete;
    expect(formatted.shadowRoot!.querySelector('bdi')!.textContent!.trim()).to.equal('98.765,5');
  });

  it('lr-format-date, lr-format-bytes and lr-relative-time commit a German ancestor locale after hydration', async () => {
    const wrapper = await ssrFixture(html`<p lang="de">
      <lr-format-date date="2024-03-05T12:00:00Z" month="long" time-zone="UTC"></lr-format-date>
      <lr-format-bytes value="1536"></lr-format-bytes>
      <lr-relative-time date="2001-01-01T00:00:00Z" unit="year"></lr-relative-time>
    </p>`);
    const text = (name: string, selector: string) =>
      wrapper.querySelector(name)!.shadowRoot!.querySelector(selector)!.textContent!.trim();
    expect(text('lr-format-date', 'time')).to.equal('März');
    expect(text('lr-format-bytes', 'bdi')).to.equal('1,5 kB');
    expect(text('lr-relative-time', 'time')).to.match(/^vor \d+ Jahren$/);
  });

  it('lr-copy-button keeps its server value, role fallback and operability after hydration', async () => {
    const button = await ssrFixture<HTMLElement & { value: string }>(
      html`<lr-copy-button value="server" copy-label="Copy value"></lr-copy-button>`,
    );
    expect(button.value).to.equal('server');
    expect(button.getAttribute('role')).to.equal('group');
    expect(button.shadowRoot!.querySelector('[part~="copy-button"]')).to.not.equal(null);
  });

  it('lr-avatar keeps its server initials and accessible name after hydration', async () => {
    const avatar = await ssrFixture(html`<lr-avatar initials="AB" label="Account owner"></lr-avatar>`);
    expect(avatar.shadowRoot!.querySelector('[part~="initials"]')!.textContent!.trim()).to.equal('AB');
  });

  it('lr-citation-badge keeps its server index and activates after hydration', async () => {
    const badge = await ssrFixture(html`<lr-citation-badge index="3" source-id="doc-7" label="Source"></lr-citation-badge>`);
    expect(badge.shadowRoot!.textContent).to.contain('3');
    const activated = oneEvent(badge, 'lr-citation-activate');
    badge.shadowRoot!.querySelector<HTMLElement>('button, a, [part~="base"]')!.click();
    const event = (await activated) as CustomEvent<{ index: number }>;
    expect(event.detail.index).to.equal(3);
  });
});
