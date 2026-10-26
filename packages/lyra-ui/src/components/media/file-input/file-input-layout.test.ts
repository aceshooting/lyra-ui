import { expect, fixture, html, nextFrame, oneEvent } from '@open-wc/testing';
import { setViewport } from '@web/test-runner-commands';
import './file-input.js';
import '../../overlays/dialog/dialog.js';
import '../../../translations/fr.js';
import type { LyraFileInput } from './file-input.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.js';

function expectContained(control: LyraFileInput, state: string): void {
  const host = control.getBoundingClientRect();
  const parts = control.shadowRoot!.querySelectorAll<HTMLElement>(
    '[part="form-control-label"], [part="dropzone"], [part="file-input"], [part="file-list"], [part="hint"], [part="error"], [part="rejection"]',
  );
  for (const part of parts) {
    if (!part.getClientRects().length) continue;
    const rect = part.getBoundingClientRect();
    const description = `${state}: ${part.getAttribute('part')}`;
    expect(rect.top, `${description} top`).to.be.at.least(host.top - 1);
    expect(rect.bottom, `${description} bottom (${rect.bottom} vs host ${host.bottom})`).to.be.at.most(host.bottom + 1);
    expect(rect.left, `${description} left`).to.be.at.least(host.left - 1);
    expect(rect.right, `${description} right`).to.be.at.most(host.right + 1);
  }
}

for (const width of [320, 390, 768, 1280]) {
  for (const direction of ['ltr', 'rtl']) {
    it(`contains empty, selected and rejected compact file controls in a ${width}px ${direction} dialog grid`, async () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      let dialog: LyraDialog | undefined;
      try {
        await setViewport({ width, height: 960 });
        dialog = await fixture<LyraDialog>(html`
          <lr-dialog open label="Importer des documents" lang="fr" dir=${direction} style="--lr-duration-base: 0ms">
            <div style="display: grid; gap: var(--lr-space-m); min-inline-size: 0">
              <lr-file-input size="s" label="Archive contenant les documents à importer" hint="Choisissez une archive ZIP." accept=".zip"></lr-file-input>
              <lr-file-input size="s" label="Dossier contenant les documents à importer" hint="Tous les fichiers du dossier seront ajoutés." directory multiple accept=".csv"></lr-file-input>
              <div data-following>Vérifiez les documents avant de continuer.</div>
            </div>
          </lr-dialog>
        `);
        const controls = [...dialog.querySelectorAll<LyraFileInput>('lr-file-input')];
        await Promise.all(controls.map((control) => control.updateComplete));
        await nextFrame();
        for (const control of controls) expectContained(control, 'empty');
        expect(controls[0]!.shadowRoot!.querySelector('[part="dropzone-text"]')!.textContent).to.contain('Déposez');

        controls[0]!.files = [new File(['archive'], 'documents-avec-un-nom-très-long-à-importer.zip')];
        controls[1]!.files = [new File(['a'], 'premier-document.csv'), new File(['b'], 'deuxième-document.csv')];
        await Promise.all(controls.map((control) => control.updateComplete));
        await nextFrame();
        for (const control of controls) {
          expect(control.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(control.files.length);
          expectContained(control, 'selected');
        }

        for (const control of controls) {
          const transfer = new DataTransfer();
          transfer.items.add(new File(['text'], 'document-non-pris-en-charge.txt', { type: 'text/plain' }));
          const event = new DragEvent('drop', { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'dataTransfer', { value: transfer });
          const changed = oneEvent(control, 'lr-files');
          control.shadowRoot!.querySelector('[part="dropzone"]')!.dispatchEvent(event);
          await changed;
          control.errorText = 'Choisissez un document dans un format pris en charge.';
          await control.updateComplete;
          expect(control.shadowRoot!.querySelectorAll('[part="rejection"]').length).to.equal(1);
          expectContained(control, 'rejected with selection and error');
        }
        const first = controls[0]!.getBoundingClientRect();
        const second = controls[1]!.getBoundingClientRect();
        const following = dialog.querySelector('[data-following]')!.getBoundingClientRect();
        expect(first.bottom, 'first field stays before the second').to.be.at.most(second.top);
        expect(second.bottom, 'last field stays before following content').to.be.at.most(following.top);
      } finally {
        await dialog?.close('api');
        await setViewport(viewport);
      }
    });
  }
}

it('allocates the remaining definite height to a labelled dropzone and keeps selection and feedback inside', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="position: relative; inline-size: 390px; block-size: 640px">
      <lr-file-input label="Supporting documents" hint="PDF files only" error-text="Review the selected documents" accept=".pdf" multiple style="position: absolute; inset: 0"></lr-file-input>
    </div>
  `);
  const control = wrapper.querySelector<LyraFileInput>('lr-file-input')!;
  control.files = [new File(['a'], 'first.pdf'), new File(['b'], 'second.pdf')];
  await control.updateComplete;
  expectContained(control, 'definite height');
  const frame = control.shadowRoot!.querySelector('[part="form-control"]')!.getBoundingClientRect();
  const dropzone = control.shadowRoot!.querySelector('[part="dropzone"]')!.getBoundingClientRect();
  const hint = control.shadowRoot!.querySelector('[part="hint"]')!.getBoundingClientRect();
  expect(frame.height).to.be.closeTo(wrapper.getBoundingClientRect().height, 1);
  expect(hint.bottom, 'the complete field fills its allocation').to.be.closeTo(frame.bottom, 1);
  expect(dropzone.height, 'the picker grows into the remaining area').to.be.greaterThan(300);

  const transfer = new DataTransfer();
  transfer.items.add(new File(['text'], 'unsupported.txt', { type: 'text/plain' }));
  const event = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  const changed = oneEvent(control, 'lr-files');
  control.shadowRoot!.querySelector('[part="dropzone"]')!.dispatchEvent(event);
  await changed;
  await control.updateComplete;
  expectContained(control, 'definite height with rejected selection');
  const rejection = control.shadowRoot!.querySelector('[part="rejection"]')!.getBoundingClientRect();
  expect(rejection.bottom, 'rejection shares the host allocation').to.be.closeTo(control.getBoundingClientRect().bottom, 1);
});
