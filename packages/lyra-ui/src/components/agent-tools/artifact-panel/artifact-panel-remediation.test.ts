import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import '../../lr-artifact-panel.js';
import type { LyraArtifactPanel } from '../../lr-artifact-panel.js';
import { SLOT_PRESENCE_UNRESOLVED } from '../../../internal/lyra-element.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';

describe('lr-artifact-panel remediation', () => {
  it('gives the selected view button its own hover step mixed from the selected fill', async () => {
    const el = await fixture<LyraArtifactPanel>(html`
      <lr-artifact-panel data-lr-theme-scope
        style="--lr-artifact-panel-view-active-bg: rgb(10, 20, 30); --lr-transition-fast: 0s"
      >
        preview
        <pre slot="code">code</pre>
      </lr-artifact-panel>
    `);
    const selected = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="view-button"][aria-pressed="true"]')!;
    const resting = getComputedStyle(selected).backgroundColor;
    expect(resting).to.equal('rgb(10, 20, 30)');
    try {
      await hoverUntilMatched(selected, 'selected view button never received hover');
      await waitUntil(() => getComputedStyle(selected).backgroundColor !== resting, 'selected hover paint never applied');
      expect(getComputedStyle(selected).backgroundColor).to.not.equal(resting);
    } finally {
      await resetMouse();
    }
  });

  it('draws the version chevrons as vector icons rather than font glyph text', async () => {
    const el = await fixture<LyraArtifactPanel>(html`<lr-artifact-panel .versions=${[{ id: 'v1' }, { id: 'v2' }]}></lr-artifact-panel>`);
    for (const part of ['version-previous-glyph', 'version-next-glyph']) {
      const glyph = el.shadowRoot!.querySelector(`[part="${part}"]`)!;
      expect(glyph.textContent!.trim(), part).to.equal('');
      expect(glyph.querySelectorAll('svg').length, part).to.equal(1);
      expect(glyph.getBoundingClientRect().width, part).to.be.greaterThan(0);
    }
    const previousSvg = el.shadowRoot!.querySelector('[part="version-previous-glyph"] svg')!;
    const nextSvg = el.shadowRoot!.querySelector('[part="version-next-glyph"] svg')!;
    expect(getComputedStyle(previousSvg).transform).to.not.equal(getComputedStyle(nextSvg).transform);
  });

  it('keeps view=code and its toggle while slot presence is unresolved', async () => {
    const el = document.createElement('lr-artifact-panel') as LyraArtifactPanel & Record<symbol, () => boolean>;
    el[SLOT_PRESENCE_UNRESOLVED] = () => true;
    el.view = 'code';
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(el.view).to.equal('code');
      expect(el.shadowRoot!.querySelectorAll('[part="view-toggle"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="code"]')!.style.display).to.equal('');
    } finally {
      el.remove();
    }
  });
});

describe('lr-artifact-panel view request', () => {
  it('asks before a toggle press changes the view and honours a veto', async () => {
    const el = await fixture<LyraArtifactPanel>(html`<lr-artifact-panel>preview<pre slot="code">code</pre></lr-artifact-panel>`);
    const requests: unknown[] = [];
    const changes: string[] = [];
    el.addEventListener('lr-artifact-view-change', (event) => changes.push((event as CustomEvent<{ view: string }>).detail.view));
    const code = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="view-button"][data-view="code"]')!;
    const veto = (event: Event) => { requests.push((event as CustomEvent).detail); event.preventDefault(); };
    el.addEventListener('lr-artifact-view-change-request', veto);
    code().click();
    expect(requests).to.deep.equal([{ view: 'code', previousView: 'preview' }]);
    expect(el.view).to.equal('preview');
    el.removeEventListener('lr-artifact-view-change-request', veto);
    el.addEventListener('lr-artifact-view-change-request', () => { el.view = 'code'; }, { once: true });
    code().click();
    expect(el.view).to.equal('code');
    expect(changes).to.deep.equal([]);
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="view-button"][data-view="preview"]')!.click();
    expect(el.view).to.equal('preview');
    expect(changes).to.deep.equal(['preview']);
  });
});
