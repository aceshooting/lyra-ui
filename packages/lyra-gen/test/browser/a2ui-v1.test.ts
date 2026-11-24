import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { A2uiV1Processor, createA2uiV1Catalog } from '../../src/adapters/a2ui-v1.js';
import type { A2uiV1ProcessResult, A2uiV1ViewResult } from '../../src/adapters/a2ui-v1.js';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenAction, LyraGenView } from '../../src/types.js';
import {
  dataCatalogId, dataRoles, fixtureAllowedParents, fixtureRoles, layoutCatalogId, layoutRoles, salesComponentUpdate,
  salesCreate, salesDataUpdate, salesSurface,
} from '../fixtures/a2ui/v1.0-candidate/processor-cases.js';

const owner = { ownerId: 'sales-agent' };
const viewCatalog = createCatalog({
  id: 'lyra-v1-fixture', version: '1',
  components: Object.fromEntries(fixtureRoles.map(role => [role, initialCatalog.components[role]!])),
  actions: { 'review-figures': { payload: { type: 'object', properties: { total: { type: 'string' }, scope: { type: 'string' } }, required: ['total', 'scope'], additionalProperties: false } } },
});

function accepted(result: A2uiV1ProcessResult): void {
  expect(result.ok, result.ok ? '' : JSON.stringify(result.error)).to.equal(true);
}
function view(result: A2uiV1ViewResult): LyraGenView {
  expect(result.ok, JSON.stringify(result.diagnostics)).to.equal(true);
  if (!result.ok) throw new Error('Expected an admitted candidate view');
  return result.value;
}
async function settled(host: LyraGenViewElement): Promise<void> {
  await host.updateComplete;
  await waitUntil(() => host.status === 'ready', 'Candidate A2UI view committed', { timeout: 5000 });
  for (const child of host.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) {
    if (child.updateComplete) await child.updateComplete;
  }
}

it('renders a v1.0 surface with mixed catalogs, keeps elements across updates and dispatches its event action', async () => {
  const processor = new A2uiV1Processor({ viewCatalog, catalogs: [
    createA2uiV1Catalog(viewCatalog, { catalogId: layoutCatalogId, roles: layoutRoles, allowedParents: fixtureAllowedParents }),
    createA2uiV1Catalog(viewCatalog, { catalogId: dataCatalogId, roles: dataRoles, allowedParents: fixtureAllowedParents }),
  ] });
  accepted(processor.process(salesCreate, owner));
  const first = view(processor.toView(salesSurface));
  const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${viewCatalog} .document=${first}></lr-gen-view>`);
  await settled(host);
  const heading = host.shadowRoot!.querySelector('h2')!;
  expect(heading.textContent!.trim()).to.equal('Quarterly sales');
  const headingId = first.root.children![0]!.id;
  expect(host.elementForNode(headingId)).to.equal(heading);

  accepted(processor.process(salesDataUpdate, owner));
  accepted(processor.process(salesComponentUpdate, owner));
  const second = view(processor.toView(salesSurface));
  host.document = second;
  await settled(host);
  expect(host.elementForNode(headingId)).to.equal(heading);
  expect(host.shadowRoot!.textContent).to.contain('Revenue by region, revised.');
  expect(host.shadowRoot!.textContent).to.contain('South figures are provisional.');

  const actions: LyraGenAction[] = [];
  host.addEventListener('lr-gen-action', event => actions.push(event.detail));
  const button = host.shadowRoot!.querySelector('lr-button')!;
  await focusByKeyboard(button.shadowRoot!.querySelector('button')!);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => actions.length === 1, 'Candidate event action dispatched', { timeout: 5000 });
  expect(actions[0]!.name).to.equal('review-figures');
  expect(actions[0]!.payload).to.deep.equal({ total: '1,377', scope: 'quarter' });
  await expect(host).to.be.accessible();

  // A coded rejection leaves the rendered surface untouched.
  const rejected = processor.process({ version: '1.0', updateComponents: { surfaceId: salesSurface, components: [{ id: 'notice', component: 'alert', children: ['total'] }] } }, owner);
  expect(rejected.ok).to.equal(false);
  if (!rejected.ok) expect(rejected.error.error.code).to.equal('UNALLOWED_CHILD');
  expect(view(processor.toView(salesSurface)).revision).to.equal(second.revision);
});
