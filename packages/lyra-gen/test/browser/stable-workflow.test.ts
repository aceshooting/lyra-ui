import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '@aceshooting/lyra-translations/fr.js';
import '@aceshooting/lyra-translations/ar.js';
import type { LyraConfirmBar } from '@aceshooting/lyra-ui/components/lr-confirm-bar.js';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { setReducedMotion } from '../../../lyra-ui/test/wtr-media.js';
import { sinkTexts } from '../../../lyra-ui/test/announcements.js';
import { connectGeneratedApproval } from '../../examples/approval.js';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenStateChange } from '../../src/gen-view.class.js';
import { createSnapshot, createSurfaceState } from '../../src/runtime.js';
import type { LyraGenAction, LyraGenView } from '../../src/types.js';

type UpdatingElement = HTMLElement & { readonly updateComplete: Promise<unknown> };
const scenarios = [
  { locale: 'en', direction: 'ltr', heading: 'Review response', label: 'Response', hint: 'Enter your response.', save: 'Save response',
    review: 'Approve this response?', approve: 'Approve', deny: 'Deny', value: 'Accepted', denied: 'You cannot save this response.', failed: 'The response form is unavailable.' },
  { locale: 'fr', direction: 'ltr', heading: 'Vérifier la réponse', label: 'Réponse', hint: 'Saisissez votre réponse.', save: 'Enregistrer la réponse',
    review: 'Approuver cette réponse ?', approve: 'Approuver', deny: 'Refuser', value: 'Acceptée', denied: 'Vous ne pouvez pas enregistrer cette réponse.', failed: 'Le formulaire de réponse est indisponible.' },
  { locale: 'ar', direction: 'rtl', heading: 'مراجعة الرد', label: 'الرد', hint: 'أدخل ردك.', save: 'حفظ الرد',
    review: 'هل توافق على هذا الرد؟', approve: 'موافقة', deny: 'رفض', value: 'مقبول', denied: 'لا يمكنك حفظ هذا الرد.', failed: 'نموذج الرد غير متاح.' },
] as const;

function query<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing workflow element ${selector}`);
  return element;
}
function activeElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}
async function ready(view: LyraGenViewElement): Promise<void> {
  await waitUntil(() => view.status === 'ready', 'Workflow is ready', { timeout: 5000 });
  for (const child of view.shadowRoot!.querySelectorAll<UpdatingElement>('[data-gen-id]')) {
    if ('updateComplete' in child) await child.updateComplete;
  }
}
async function activate(button: HTMLElement): Promise<void> {
  await focusByKeyboard(button);
  await sendKeys({ press: 'Enter' });
}
async function approval(connection: ReturnType<typeof connectGeneratedApproval>): Promise<LyraConfirmBar> {
  await waitUntil(() => connection.pending !== undefined, 'Host approval is open');
  const bar = connection.pending!;
  await bar.updateComplete;
  for (const button of bar.shadowRoot!.querySelectorAll<UpdatingElement>('[part$="-button"]')) await button.updateComplete;
  return bar;
}

for (const copy of scenarios) {
  it(`completes the ${copy.locale}/${copy.direction} keyboard workflow with approval, cancellation, dirty restore and safe failures under reduced motion`, async () => {
    await setReducedMotion('reduce');
    const catalog = createCatalog({ ...initialCatalog, actions: { save: { confirm: true, payload: {
      type: 'object', properties: { answer: { type: 'string', minLength: 1 } }, required: ['answer'], additionalProperties: false,
    } } } });
    const documentFor = (revision = 0, value = ''): LyraGenView => ({ version: '1', surfaceId: 'review-workflow', revision,
      catalog: { id: catalog.id, version: catalog.version }, root: { id: 'root', type: 'stack', children: [
        { id: 'heading', type: 'heading', text: `${copy.heading} ${revision}` },
        { id: 'form', type: 'form', props: { ariaLabel: copy.heading }, action: { name: 'save' }, children: [
          { id: 'answer', type: 'input', props: { name: 'answer', label: copy.label, hint: copy.hint, required: true, value }, bindings: { value: '/answer' } },
          { id: 'submit', type: 'button', props: { type: 'submit' }, text: copy.save },
        ] },
      ] } });
    const document = documentFor();
    const root = await fixture<HTMLElement>(html`<section lang=${copy.locale} dir=${copy.direction}>
      <lr-gen-view .catalog=${catalog} .document=${document} .strings=${{ genViewActionDenied: copy.denied, genViewLoadFailed: copy.failed }}></lr-gen-view>
      <div data-approval></div>
    </section>`);
    const view = query<LyraGenViewElement>(root, 'lr-gen-view');
    const region = query(root, '[data-approval]');
    const actions: LyraGenAction[] = [];
    view.addEventListener('lr-gen-action', event => actions.push(event.detail));
    const connection = connectGeneratedApproval(view, region, { heading: () => copy.review });
    try {
      await ready(view);
      expect(matchMedia('(prefers-reduced-motion: reduce)').matches).to.equal(true);
      expect(getComputedStyle(view).direction).to.equal(copy.direction);
      const field = query<UpdatingElement>(view.shadowRoot!, '[data-gen-id="answer"]');
      const native = query<HTMLInputElement>(field.shadowRoot!, 'input');
      const submit = query(query(view.shadowRoot!, '[data-gen-id="submit"]').shadowRoot!, 'button');
      expect([...native.labels ?? []].some(label => label.textContent?.includes(copy.label))).to.equal(true);
      expect(query(view.shadowRoot!, 'form').getAttribute('aria-label')).to.equal(copy.heading);
      await activate(submit);
      await field.updateComplete;
      expect(activeElement() === native, 'Invalid submission returns focus to the required response').to.equal(true);
      expect(native.getAttribute('aria-invalid')).to.equal('true');
      expect(connection.pending === undefined).to.equal(true);
      expect(actions.length).to.equal(0);
      await expect(view).to.be.accessible();

      let latestEdit: LyraGenStateChange | undefined;
      view.addEventListener('lr-gen-state-change', event => { latestEdit = event.detail; });
      await sendKeys({ type: copy.value });
      await view.updateComplete;
      await field.updateComplete;
      if (!latestEdit) throw new Error('Native typing must publish bound state');
      const edit = latestEdit;
      expect(native.value).to.equal(copy.value);
      expect(native.getAttribute('aria-invalid')).to.equal('false');
      expect(edit.values).to.deep.equal({ answer: copy.value });
      expect(edit.dirty).to.deep.equal(['/answer']);
      await sendKeys({ press: 'Tab' });
      expect(activeElement() === submit).to.equal(true);
      await sendKeys({ press: 'Enter' });
      const canceled = await approval(connection);
      expect(canceled.heading).to.equal(copy.review);
      expect(getComputedStyle(canceled).direction).to.equal(copy.direction);
      expect(query(canceled.shadowRoot!, '[part="deny-button"]').textContent?.trim()).to.equal(copy.deny);
      expect(query(canceled.shadowRoot!, '[part="approve-button"]').textContent?.trim()).to.equal(copy.approve);
      expect(canceled.args).to.deep.equal({ surfaceId: document.surfaceId, nodeId: 'form', revision: 0, payload: { answer: copy.value } });
      await expect(root).to.be.accessible();
      connection.cancel();
      await canceled.updateComplete;
      expect(canceled.decision).to.equal('denied');
      expect(connection.pending === undefined).to.equal(true);
      expect(activeElement() === submit, 'Host cancellation restores the submit control').to.equal(true);
      expect(actions.length).to.equal(0);
      await activate(submit);
      const bar = await approval(connection);
      await expect(bar).to.be.accessible();
      const dispatched = oneEvent(view, 'lr-gen-action');
      await activate(query(bar.shadowRoot!, '[part="approve-button"]'));
      await dispatched;
      expect(actions.map(action => action.payload)).to.deep.equal([{ answer: copy.value }]);
      expect(activeElement() === submit).to.equal(true);

      const snapshot = createSnapshot(document, { ...createSurfaceState(document, edit.values), dirty: edit.dirty });
      const restored = new LyraGenViewElement();
      restored.catalog = catalog;
      restored.strings = view.strings;
      restored.addEventListener('lr-gen-action', event => actions.push(event.detail));
      connection.dispose();
      view.replaceWith(restored);
      expect(restored.restoreSnapshot(JSON.parse(JSON.stringify(snapshot))).ok).to.equal(true);
      await ready(restored);
      expect(query<HTMLInputElement>(restored.shadowRoot!, '[data-gen-id="answer"]').value).to.equal(copy.value);
      const revisionReady = oneEvent(restored, 'lr-gen-ready');
      restored.document = documentFor(1, copy.heading);
      expect((await revisionReady as CustomEvent<{ surfaceId: string; revision: number }>).detail).to.deep.equal({ surfaceId: document.surfaceId, revision: 1 });
      await ready(restored);
      expect(query(restored.shadowRoot!, '[data-gen-id="heading"]').textContent).to.equal(`${copy.heading} 1`);
      expect(query<HTMLInputElement>(restored.shadowRoot!, '[data-gen-id="answer"]').value, 'Restored dirty value wins over the next model default').to.equal(copy.value);
      expect(actions.length, 'Restore and revision changes never replay the approved action').to.equal(1);
      await expect(restored).to.be.accessible();

      restored.enabledActions = [];
      await restored.updateComplete;
      const denied = oneEvent(restored, 'lr-gen-error');
      await activate(query(query(restored.shadowRoot!, '[data-gen-id="submit"]').shadowRoot!, 'button'));
      expect((await denied as CustomEvent).detail.diagnostics[0].code).to.equal('action.denied');
      expect(sinkTexts()).to.include(copy.denied);
      expect(actions.length).to.equal(1);
      await expect(restored).to.be.accessible();

      const failedCatalog = createCatalog({ ...catalog, version: '2', components: { ...catalog.components,
        input: { ...catalog.components['input']!, load: async () => { throw new Error('Untrusted loader exception'); } },
      } });
      restored.catalog = failedCatalog;
      restored.document = { ...documentFor(2), catalog: { id: failedCatalog.id, version: failedCatalog.version } };
      await restored.updateComplete;
      await waitUntil(() => restored.status === 'error' && restored.shadowRoot?.querySelector('[part="error"]')?.textContent === copy.failed, 'Failed workflow renders its localized fallback');
      expect(restored.status).to.equal('error');
      expect(query(restored.shadowRoot!, '[part="error"]').textContent).to.equal(copy.failed);
      expect(restored.shadowRoot!.textContent).not.to.contain('Untrusted loader exception');
      expect(actions.length).to.equal(1);
      await expect(restored).to.be.accessible();
    } finally {
      connection.dispose();
      await setReducedMotion('no-preference');
    }
  });
}
