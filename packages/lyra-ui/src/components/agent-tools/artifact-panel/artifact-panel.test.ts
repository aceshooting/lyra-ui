import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './artifact-panel.js';
import type { LyraArtifactPanel } from './artifact-panel.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

describe('lr-artifact-panel', () => {
  it('defaults to view=preview and activeVersionId=null (latest)', async () => {
    const el = (await fixture(html`<lr-artifact-panel></lr-artifact-panel>`)) as LyraArtifactPanel;
    expect(el.view).to.equal('preview');
    expect(el.activeVersionId).to.be.null;
  });

  it('renders the view toggle only once the code slot is populated', async () => {
    const noCode = (await fixture(html`<lr-artifact-panel></lr-artifact-panel>`)) as LyraArtifactPanel;
    await noCode.updateComplete;
    expect((noCode.shadowRoot!.querySelector('[part="view-toggle"]')) == null).to.be.true;

    const withCode = (await fixture(html`
      <lr-artifact-panel><pre slot="code">code</pre></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await withCode.updateComplete;
    expect(withCode.shadowRoot!.querySelector('[part="view-toggle"]')).to.exist;
  });

  it('keeps the view selector purpose-named instead of cloning the host aria-label', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel aria-label="Report artifact">
        <pre slot="code">code</pre>
      </lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[part="view-toggle"]') as HTMLElement;
    expect(group.getAttribute('role')).to.equal('group');
    expect(el.getAttribute('aria-label')).to.equal('Report artifact');
    expect(group.getAttribute('aria-label')).to.equal('Artifact');

    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(group.getAttribute('aria-label')).to.equal('Artifact');
    await expect(el).to.be.accessible();
  });

  it('distinguishes an omitted label from an explicit empty override on the view-toggle group name', async () => {
    const omitted = (await fixture(html`
      <lr-artifact-panel><pre slot="code">code</pre></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await omitted.updateComplete;
    expect(
      (omitted.shadowRoot!.querySelector('[part="view-toggle"]') as HTMLElement).getAttribute('aria-label')
    ).to.equal('Artifact');
    expect(omitted.shadowRoot!.querySelector('[part="label"]') === null).to.be.true;

    const explicitEmpty = (await fixture(html`
      <lr-artifact-panel label=""><pre slot="code">code</pre></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await explicitEmpty.updateComplete;
    expect(
      (explicitEmpty.shadowRoot!.querySelector('[part="view-toggle"]') as HTMLElement).getAttribute('aria-label')
    ).to.equal('');
    expect(explicitEmpty.shadowRoot!.querySelector('[part="label"]') === null).to.be.true;

    const explicitOverride = (await fixture(html`
      <lr-artifact-panel label="Custom title"><pre slot="code">code</pre></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await explicitOverride.updateComplete;
    expect(
      (explicitOverride.shadowRoot!.querySelector('[part="view-toggle"]') as HTMLElement).getAttribute('aria-label')
    ).to.equal('Custom title');
    expect(explicitOverride.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Custom title');
  });

  it('returns to preview when the active code slot is removed', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel>
        <div id="preview">preview</div>
        <pre id="code" slot="code">code</pre>
      </lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="view-button"][data-view="code"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.view).to.equal('code');

    el.querySelector('#code')!.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.view).to.equal('preview');
    expect((el.shadowRoot!.querySelector('[part="view-toggle"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('slot:not([name])') as HTMLElement).style.display).to.equal('');
  });

  it('rejects a programmatic code view when no code content exists after mount', async () => {
    const el = await fixture<LyraArtifactPanel>(html`
      <lr-artifact-panel><div id="preview">preview</div></lr-artifact-panel>
    `);
    el.view = 'code';
    await el.updateComplete;

    expect(el.view).to.equal('preview');
    expect((el.shadowRoot!.querySelector('slot:not([name])') as HTMLElement).style.display).to.equal('');
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

  it('renders the active version label beside its localized position', async () => {
    const el = await fixture<LyraArtifactPanel>(html`
      <lr-artifact-panel
        active-version-id="v1"
        .versions=${[{ id: 'v1', label: 'Initial draft' }, { id: 'v2', label: 'Published' }]}
      ></lr-artifact-panel>
    `);
    expect(el.shadowRoot!.querySelector('[part="version-label"]')?.textContent).to.equal(
      'Initial draft',
    );
  });

  it('clears a removed active version id without emitting a user navigation event', async () => {
    const el = await fixture<LyraArtifactPanel>(html`
      <lr-artifact-panel
        active-version-id="v1"
        .versions=${[{ id: 'v1', label: 'Initial' }, { id: 'v2', label: 'Latest' }]}
      ></lr-artifact-panel>
    `);
    let changes = 0;
    el.addEventListener('lr-version-change', () => changes++);

    el.versions = [{ id: 'v2', label: 'Latest' }];
    await el.updateComplete;
    expect(el.activeVersionId).to.equal(null);
    expect(el.hasAttribute('active-version-id')).to.equal(false);
    expect(changes).to.equal(0);

    el.versions = [{ id: 'v1', label: 'Reintroduced' }, { id: 'v2', label: 'Latest' }];
    await el.updateComplete;
    expect(el.activeVersionId, 'reintroducing the id must not silently repin selection').to.equal(null);
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

    await el.updateComplete;
    const nextListener = oneEvent(el, 'lr-version-change');
    (el.shadowRoot!.querySelector('[part="version-next"]') as HTMLButtonElement).click();
    const nextEvent = (await nextListener) as CustomEvent<{ versionId: string }>;
    expect(nextEvent.detail.versionId).to.equal('v3');
    expect(el.activeVersionId, 'the latest version is represented by an unpinned selection').to.equal(null);
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

  it('gives the view/restore/copy/download header buttons the WCAG 24px minimum hit area', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel
        .versions=${[{ id: 'v1' }, { id: 'v2' }]}
        active-version-id="v1"
        copy-text="hello"
        download-src="https://example.com/f.md"
      >
        <pre slot="code">code</pre>
      </lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    for (const part of ['view-button', 'restore-button', 'copy-button', 'download-button']) {
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      expect(button !== null, `${part} should render`).to.be.true;
      expect(getComputedStyle(button).minBlockSize, `${part} minBlockSize`).to.equal('24px');
      expect(button.getBoundingClientRect().height, `${part} rendered height`).to.be.at.least(24);
    }
  });

  it('mirrors the version-previous/version-next chevron glyphs under RTL', async () => {
    const ltr = (await fixture(html`
      <lr-artifact-panel .versions=${[{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }]}></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    const rtl = (await fixture(html`
      <lr-artifact-panel dir="rtl" .versions=${[{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }]}></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await ltr.updateComplete;
    await rtl.updateComplete;
    const ltrPrevious = ltr.shadowRoot!.querySelector('[part="version-previous-glyph"]') as HTMLElement;
    const rtlPrevious = rtl.shadowRoot!.querySelector('[part="version-previous-glyph"]') as HTMLElement;
    const ltrNext = ltr.shadowRoot!.querySelector('[part="version-next-glyph"]') as HTMLElement;
    const rtlNext = rtl.shadowRoot!.querySelector('[part="version-next-glyph"]') as HTMLElement;
    expect(getComputedStyle(ltrPrevious).transform).to.equal('none');
    expect(getComputedStyle(rtlPrevious).transform).to.not.equal('none');
    expect(getComputedStyle(ltrNext).transform).to.equal('none');
    expect(getComputedStyle(rtlNext).transform).to.not.equal('none');
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
    expect((restore) != null).to.equal(true);
    const listener = oneEvent(el, 'lr-restore');
    restore.click();
    const event = (await listener) as CustomEvent<{ versionId: string }>;
    expect(event.detail.versionId).to.equal('v1');

    const latestEl = (await fixture(html`
      <lr-artifact-panel .versions=${[{ id: 'v1' }, { id: 'v2' }]}></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await latestEl.updateComplete;
    expect((latestEl.shadowRoot!.querySelector('[part="restore-button"]')) == null).to.be.true;
  });

  it('sets aria-busy on the body while streaming and shows a reduced-motion-safe indicator', async () => {
    const el = (await fixture(html`<lr-artifact-panel streaming></lr-artifact-panel>`)) as LyraArtifactPanel;
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('[part="body"]')!;
    expect(body.getAttribute('aria-busy')).to.equal('true');
    expect(el.shadowRoot!.querySelector('[part="streaming-indicator"]')).to.exist;
  });

  it('hides an empty copy action and emits success only after the owner write fulfills', async () => {
    const empty = (await fixture(html`<lr-artifact-panel></lr-artifact-panel>`)) as LyraArtifactPanel;
    await empty.updateComplete;
    expect((empty.shadowRoot!.querySelector('[part="copy-button"]')) == null).to.be.true;

    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    let resolveWrite!: () => void;
    const pending = new Promise<void>((resolve) => { resolveWrite = resolve; });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => pending },
    });
    try {
      const el = (await fixture(
        html`<lr-artifact-panel copy-text="hello"></lr-artifact-panel>`,
      )) as LyraArtifactPanel;
      await el.updateComplete;
      let copies = 0;
      el.addEventListener('lr-copy', () => { copies += 1; });
      const listener = oneEvent(el, 'lr-copy');
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await Promise.resolve();
      expect(copies).to.equal(0);
      resolveWrite();
      const event = (await listener) as CustomEvent<{ ok: true; text: string }>;
      expect(event.detail).to.deep.equal({ ok: true, text: 'hello' });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('emits the shared typed failure outcome when the clipboard rejects', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const failure = new DOMException('Denied', 'NotAllowedError');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(failure) },
    });
    try {
      const el = (await fixture(
        html`<lr-artifact-panel copy-text="hello"></lr-artifact-panel>`,
      )) as LyraArtifactPanel;
      const genericError = oneEvent(el, 'lr-error');
      const detailedError = oneEvent(el, 'lr-copy-error');
      let copies = 0;
      el.addEventListener('lr-copy', () => { copies += 1; });
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await genericError;
      const event = (await detailedError) as CustomEvent<{
        ok: false;
        text: string;
        reason: string;
        error: unknown;
      }>;
      expect(event.detail).to.deep.equal({
        ok: false,
        text: 'hello',
        reason: 'denied',
        error: failure,
      });
      expect(copies).to.equal(0);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('uses the adopted owner clipboard and fails closed in an ownerless document', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const inertDocument = document.implementation.createHTMLDocument('ownerless');
    const ambientDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
    const destinationDescriptor = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    const ambientWrites: string[] = [];
    const destinationWrites: string[] = [];
    let el: LyraArtifactPanel | undefined;

    try {
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => ambientWrites.push(text) },
      });
      Object.defineProperty(frameWindow.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => destinationWrites.push(text) },
      });
      el = (await fixture(
        html`<lr-artifact-panel copy-text="owner text"></lr-artifact-panel>`,
      )) as LyraArtifactPanel;
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      button.click();
      expect(destinationWrites).to.deep.equal(['owner text']);
      expect(ambientWrites).to.deep.equal([]);

      el.remove();
      inertDocument.body.append(inertDocument.adoptNode(el));
      button.click();
      expect(ambientWrites, 'an ownerless component must not fall back to the ambient clipboard').to.deep.equal([]);
    } finally {
      if (el && el.ownerDocument !== document) document.adoptNode(el);
      el?.remove();
      if (ambientDescriptor) Object.defineProperty(window.navigator, 'clipboard', ambientDescriptor);
      else Reflect.deleteProperty(window.navigator, 'clipboard');
      if (destinationDescriptor) Object.defineProperty(frameWindow.navigator, 'clipboard', destinationDescriptor);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      frame.remove();
    }
  });

  it('download button hidden while downloadSrc is empty, emits lr-download with filename/src when set', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel download-src="https://example.com/f.md" download-name="f.md"></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-download');
    (el.shadowRoot!.querySelector('[part="download-button"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ filename: string; src: string }>;
    expect(event.detail).to.deep.equal({ filename: 'f.md', src: 'https://example.com/f.md' });
  });

  it('rejects active-document data URLs from the download event sink', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel download-src="data:text/html,<script>alert(1)</script>"></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    let calls = 0;
    el.addEventListener('lr-download', () => calls++);
    (el.shadowRoot!.querySelector('[part="download-button"]') as HTMLButtonElement).click();
    expect(calls).to.equal(0);
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

    it('preserves the selected-view cssprops while the selected button is physically pressed', async () => {
      const el = await pressedFixture();
      el.style.setProperty('--lr-artifact-panel-view-active-bg', 'rgb(10, 20, 30)');
      el.style.setProperty('--lr-artifact-panel-view-active-color', 'rgb(40, 50, 60)');
      const pressed = el.shadowRoot!.querySelector('[part="view-button"][aria-pressed="true"]') as HTMLElement;
      const rect = pressed.getBoundingClientRect();
      try {
        await sendMouse({
          type: 'move',
          position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
        });
        expect(getComputedStyle(pressed).backgroundColor).to.equal('rgb(10, 20, 30)');
        expect(getComputedStyle(pressed).color).to.equal('rgb(40, 50, 60)');
        await sendMouse({
          type: 'down',
        });
        await waitUntil(() => pressed.matches(':active'));
        await waitUntil(() => getComputedStyle(pressed).backgroundColor === 'rgb(10, 20, 30)', 'pressed background color never reached rgb(10, 20, 30)');
        expect(getComputedStyle(pressed).color).to.equal('rgb(40, 50, 60)');
      } finally {
        await resetMouse();
      }
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

  it('routes localized strings through a .strings override, reaching the rendered DOM', async () => {
    const el = (await fixture(html`
      <lr-artifact-panel
        streaming
        .versions=${[{ id: 'v1' }, { id: 'v2' }]}
        .strings=${{
          artifactPanelPreviousVersion: 'Version précédente',
          artifactPanelVersionPosition: 'Version {index} sur {count}',
          artifactPanelGenerating: 'Génération…',
        }}
      ></lr-artifact-panel>
    `)) as LyraArtifactPanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="version-previous"]')!.getAttribute('aria-label')).to.equal(
      'Version précédente',
    );
    expect(el.shadowRoot!.querySelector('[part="version-position"]')!.textContent).to.equal('Version 2 sur 2');
    expect(el.shadowRoot!.querySelector('[part="streaming-indicator"]')!.textContent).to.equal('Génération…');
  });

  it('paints rendered hover and focus feedback on artifact header controls', async () => {
    const el = await fixture<LyraArtifactPanel>(html`
      <lr-artifact-panel
        active-version-id="v1"
        copy-text="copy me"
        download-src="https://example.com/artifact.txt"
        style="--lr-color-brand-quiet: rgb(1, 2, 3)"
        .versions=${[{ id: 'v1', createdAt: new Date(0) }, { id: 'v2', createdAt: new Date(1) }]}
      >
        preview
        <pre slot="code">code</pre>
      </lr-artifact-panel>
    `);
    try {
      for (const part of ['restore-button', 'copy-button', 'download-button', 'view-button']) {
        const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLButtonElement;
        const rect = button.getBoundingClientRect();
        await sendMouse({
          type: 'move',
          position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
        });
        await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(1, 2, 3)');
        expect(getComputedStyle(button).backgroundColor, `${part} hover`).to.equal('rgb(1, 2, 3)');
        button.focus();
        expect(getComputedStyle(button).outlineStyle, `${part} focus`).to.equal('solid');
      }
    } finally {
      await resetMouse();
    }
  });

  it('removes version navigation hover and press paint when an enabled control becomes disabled under the pointer', async function () {
    this.timeout(20000);
    const cases: Array<{ part: 'version-previous' | 'version-next'; disabledVersionId: string | null }> = [
      { part: 'version-previous', disabledVersionId: 'v1' },
      { part: 'version-next', disabledVersionId: null },
    ];

    try {
      for (const { part, disabledVersionId } of cases) {
        const el = await fixture<LyraArtifactPanel>(html`
          <lr-artifact-panel
            active-version-id="v2"
            style="--lr-color-brand-quiet: rgb(1, 2, 3); --lr-color-mix-partner: rgb(4, 5, 6); --lr-color-mix-active: 100%"
            .versions=${[{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }]}
          ></lr-artifact-panel>
        `);
        const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLButtonElement;
        const resting = getComputedStyle(button).backgroundColor;

        await hoverUntilMatched(button, `${part} never registered :hover while enabled`);
        await waitUntil(
          () => getComputedStyle(button).backgroundColor === 'rgb(1, 2, 3)',
          `${part} never painted its enabled hover state`,
        );
        const hovered = getComputedStyle(button).backgroundColor;
        await sendMouse({ type: 'down' });
        await waitUntil(
          () => button.matches(':active') && getComputedStyle(button).backgroundColor !== hovered,
          `${part} never painted its enabled press state`,
        );

        el.activeVersionId = disabledVersionId;
        await el.updateComplete;
        const disabledButton = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLButtonElement;
        expect(disabledButton.disabled, `${part} must become disabled without moving the pointer`).to.equal(true);
        expect(disabledButton.matches(':hover'), `${part} must remain under the stationary pointer`).to.equal(true);
        await waitUntil(
          () => getComputedStyle(disabledButton).backgroundColor === resting,
          `${part} kept hover or press paint after becoming disabled`,
        );
        await sendMouse({ type: 'up' });
      }
    } finally {
      await resetMouse();
    }
  });

  it('contains long public label and kind values at 320px', async () => {
    const token = 'unbroken'.repeat(80);
    const wrapper = (await fixture(html`
      <div style="inline-size: 320px; max-inline-size: 320px;">
        <lr-artifact-panel label=${token} kind=${token}></lr-artifact-panel>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-artifact-panel') as LyraArtifactPanel;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    const kind = el.shadowRoot!.querySelector('[part="kind"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(Math.ceil(base.getBoundingClientRect().width) + 1);
    expect(header.scrollWidth).to.be.at.most(Math.ceil(header.getBoundingClientRect().width) + 1);
    expect(label.scrollWidth).to.be.at.most(Math.ceil(label.getBoundingClientRect().width) + 1);
    expect(kind.scrollWidth).to.be.at.most(Math.ceil(kind.getBoundingClientRect().width) + 1);
  });
});

it('normalizes duplicate version ids first-wins before navigation and labels', async () => {
  const el = await fixture<LyraArtifactPanel>(html`
    <lr-artifact-panel .versions=${[
      { id: 'same', label: 'First version' },
      { id: 'same', label: 'Later version' },
    ]}></lr-artifact-panel>
  `);
  expect(el.shadowRoot!.querySelector('[part="version-position"]')!.textContent).to.contain('1');
  expect(el.shadowRoot!.querySelector('[part="version-label"]')!.textContent).to.equal('First version');
});
