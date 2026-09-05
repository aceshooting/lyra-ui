import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './dialog.js';
import '../drawer/drawer.js';
import type { LyraDialog } from './dialog.js';

function panelName(dialog: LyraDialog): string {
  const panel = dialog.shadowRoot!.querySelector('[part~="panel"]')!;
  return panel.getAttribute('aria-label') ?? dialog.shadowRoot!.getElementById(panel.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? '';
}

it('safely removes the dialog label and restores later text', async () => {
  const dialog = await fixture<LyraDialog>(html`<lr-dialog label="Original"></lr-dialog>`);
  dialog.removeAttribute('label');
  await dialog.updateComplete;
  expect(dialog.label === null).to.be.true;
  expect(panelName(dialog)).to.equal('');
  dialog.label = '';
  await dialog.updateComplete;
  expect(panelName(dialog)).to.equal('');
  dialog.label = 'Restored';
  await dialog.updateComplete;
  expect(panelName(dialog)).to.equal('Restored');
});

for (const tag of ['lr-dialog', 'lr-drawer']) {
  for (const attribute of ['aria-label', 'aria-labelledby', 'aria-hidden', 'hidden', 'inert', 'style', 'class']) {
    it(`updates ${tag} naming when its direct heading ${attribute} changes`, async () => {
      const dialog = await fixture<LyraDialog>(`<${tag} label="Fallback" style="--lr-duration-base: 0ms">
        <style>.excluded-heading { display: none; }</style>
        <h2>Original heading</h2><span id="other-heading">Referenced heading</span>
      </${tag}>`);
      try {
        await dialog.show();
        await waitUntil(() => panelName(dialog) === 'Original heading', 'the direct heading provides the initial name');
        const heading = dialog.querySelector('h2')!;
        const value = attribute === 'aria-label' ? 'Authored heading' : attribute === 'aria-labelledby' ? 'other-heading'
          : attribute === 'style' ? 'display: none' : attribute === 'class' ? 'excluded-heading' : 'true';
        heading.setAttribute(attribute, value);
        const expected = attribute === 'aria-label' ? 'Authored heading' : attribute === 'aria-labelledby' ? 'Referenced heading' : 'Fallback';
        await waitUntil(() => panelName(dialog) === expected, 'the heading attribute changes the open panel name');
        heading.removeAttribute(attribute);
        await waitUntil(() => panelName(dialog) === 'Original heading', 'removing the heading attribute restores the name');
        expect(dialog.open).to.be.true;
      } finally {
        await dialog.close('api');
      }
    });
  }
}

for (const tag of ['lr-dialog', 'lr-drawer']) {
  it(`keeps nested and slot-empty headings outside ${tag} direct discovery`, async () => {
    const dialog = await fixture<LyraDialog>(`<${tag} label="Fallback" style="--lr-duration-base: 0ms">
      <h2 slot="">Unmanaged</h2><div><h2>Nested</h2></div>
    </${tag}>`);
    try {
      await dialog.show();
      for (const heading of dialog.querySelectorAll('h2')) heading.setAttribute('aria-label', 'Still unmanaged');
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await dialog.updateComplete;
      expect(panelName(dialog)).to.equal('Fallback');
      dialog.setAttribute('aria-label', 'Host authority');
      await dialog.updateComplete;
      expect(panelName(dialog)).to.equal('Host authority');
    } finally {
      await dialog.close('api');
    }
  });
}
