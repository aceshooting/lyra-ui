import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './artifact-panel.js';
import type { LyraArtifactPanel } from './artifact-panel.js';

describe('lr-artifact-panel', () => {
  it('defaults to view=preview and activeVersionId=null (latest)', async () => {
    const el = (await fixture(html`<lr-artifact-panel></lr-artifact-panel>`)) as LyraArtifactPanel;
    expect(el.view).to.equal('preview');
    expect(el.activeVersionId).to.be.null;
  });

  it('renders the view toggle only once the code slot is populated', async () => {
    const noCode = (await fixture(html`<lr-artifact-panel></lr-artifact-panel>`)) as LyraArtifactPanel;
    await noCode.updateComplete;
    expect(noCode.shadowRoot!.querySelector('[part="view-toggle"]')).to.not.exist;

    const withCode = (await fixture(html`
      <lr-artifact-panel><pre slot="code">code</pre></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await withCode.updateComplete;
    expect(withCode.shadowRoot!.querySelector('[part="view-toggle"]')).to.exist;
  });

  it('view-button activation emits lr-view-change and updates view', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel><pre slot="code">code</pre></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-view-change');
    (el.shadowRoot!.querySelector('[part="view-button"][data-view="code"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ view: string }>;
    expect(event.detail.view).to.equal('code');
    expect(el.view).to.equal('code');
  });

  it('renders version-position text and disables previous/next at the ends', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel
        .versions=${[{ id: 'v1', label: 'v1' }, { id: 'v2', label: 'v2' }, { id: 'v3', label: 'v3' }]}
      ></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="version-position"]')!.textContent).to.include('3');
    expect((el.shadowRoot!.querySelector('[part="version-next"]') as HTMLButtonElement).disabled).to.be.true; // at latest
  });

  it('previous/next emit lr-version-change with the neighboring version id', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel
        .versions=${[{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }]}
      ></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-version-change');
    (el.shadowRoot!.querySelector('[part="version-previous"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ versionId: string }>;
    expect(event.detail.versionId).to.equal('v2');
    expect(el.activeVersionId).to.equal('v2');
  });

  it('gives the version-previous/version-next buttons the shared minimum hit area', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel
        .versions=${[{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }]}
      ></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    const previous = el.shadowRoot!.querySelector('[part="version-previous"]') as HTMLElement;
    const next = el.shadowRoot!.querySelector('[part="version-next"]') as HTMLElement;
    expect(getComputedStyle(previous).minInlineSize).to.equal('40px');
    expect(getComputedStyle(previous).minBlockSize).to.equal('40px');
    expect(getComputedStyle(next).minInlineSize).to.equal('40px');
    expect(getComputedStyle(next).minBlockSize).to.equal('40px');
  });

  it('renders a restore button only while the active version is not latest, emitting lr-restore', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel
        .versions=${[{ id: 'v1' }, { id: 'v2' }]}
        active-version-id="v1"
      ></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    const restore = el.shadowRoot!.querySelector('[part="restore-button"]') as HTMLButtonElement;
    expect(restore).to.exist;
    const listener = oneEvent(el, 'lr-restore');
    restore.click();
    const event = (await listener) as CustomEvent<{ versionId: string }>;
    expect(event.detail.versionId).to.equal('v1');

    const latestEl = (await fixture(html`
      <lr-artifact-panel .versions=${[{ id: 'v1' }, { id: 'v2' }]}></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await latestEl.updateComplete;
    expect(latestEl.shadowRoot!.querySelector('[part="restore-button"]')).to.not.exist;
  });

  it('sets aria-busy on the body while streaming and shows a reduced-motion-safe indicator', async () => {
    const el = (await fixture(html`<lr-artifact-panel streaming></lr-artifact-panel>`)) as LyraArtifactPanel;
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('[part="body"]')!;
    expect(body.getAttribute('aria-busy')).to.equal('true');
    expect(el.shadowRoot!.querySelector('[part="streaming-indicator"]')).to.exist;
  });

  it('copy button hidden while copyText is empty, emits lr-copy with it when set', async () => {
    const empty = (await fixture(html`<lr-artifact-panel></lr-artifact-panel>`)) as LyraArtifactPanel;
    await empty.updateComplete;
    expect(empty.shadowRoot!.querySelector('[part="copy-button"]')).to.not.exist;

    const el = (await fixture(
      html`<lr-artifact-panel copy-text="hello"></lr-artifact-panel>`,
    )) as LyraArtifactPanel;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-copy');
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ text: string }>;
    expect(event.detail.text).to.equal('hello');
  });

  it('download button hidden while downloadSrc is empty, emits lr-download with filename/src when set', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel download-src="https://example.com/f.md" download-name="f.md"></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-download');
    (el.shadowRoot!.querySelector('[part="download-button"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ filename: string; src?: string }>;
    expect(event.detail).to.deep.equal({ filename: 'f.md', src: 'https://example.com/f.md' });
  });

  it('is accessible with versions, streaming, and both slots populated', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel
        label="report.md"
        kind="document"
        .versions=${[{ id: 'v1' }, { id: 'v2' }]}
        copy-text="hello"
      >
        <div>preview</div>
        <pre slot="code">code</pre>
      </lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  describe('--lr-artifact-panel-view-active-bg / -color', () => {
    const pressedFixture = async (): Promise<LyraArtifactPanel> => {
      const el = (await fixture(html`
        <lr-artifact-panel><pre slot="code">code</pre></lr-artifact-panel>
      `)) as LyraArtifactPanel;
      await el.updateComplete;
      return el;
    };

    it('retints the pressed view button background and color via the cssprops', async () => {
      const el = await pressedFixture();
      el.style.setProperty('--lr-artifact-panel-view-active-bg', 'rgb(10, 20, 30)');
      el.style.setProperty('--lr-artifact-panel-view-active-color', 'rgb(40, 50, 60)');
      const pressed = el.shadowRoot!.querySelector('[part="view-button"][aria-pressed="true"]') as HTMLElement;
      expect(pressed.getAttribute('data-view')).to.equal('preview');
      expect(getComputedStyle(pressed).backgroundColor).to.equal('rgb(10, 20, 30)');
      expect(getComputedStyle(pressed).color).to.equal('rgb(40, 50, 60)');
    });

    it('renders byte-identically to the token defaults when unset', async () => {
      const el = await pressedFixture();
      const pressed = el.shadowRoot!.querySelector('[part="view-button"][aria-pressed="true"]') as HTMLElement;
      const bg = getComputedStyle(pressed).backgroundColor;
      const color = getComputedStyle(pressed).color;
      el.style.setProperty('--lr-artifact-panel-view-active-bg', 'var(--lr-color-brand-quiet)');
      el.style.setProperty('--lr-artifact-panel-view-active-color', 'var(--lr-color-brand)');
      expect(getComputedStyle(pressed).backgroundColor).to.equal(bg);
      expect(getComputedStyle(pressed).color).to.equal(color);
    });
  });
});
