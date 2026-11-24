import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { initialCatalog } from '../../src/catalog.js';
import '../../src/gen-view.js';
import type { LyraGenViewElement } from '../../src/gen-view.js';
import { createJsonViewStream } from '../../src/json-stream.js';
import type { LyraGenPartialView } from '../../src/partial-view.js';
import { createProgressiveMarkupParser } from '../../src/progressive.js';
import type { LyraGenNode, LyraGenView } from '../../src/types.js';

const panel = (index: number): LyraGenNode => ({ id: `panel-${index}`, type: 'stack', children: [
  { id: `panel-${index}-title`, type: 'heading', text: `Panel ${index}` },
  { id: `panel-${index}-body`, type: 'text', text: `Synthetic summary for panel ${index}.` }
] });
const root: LyraGenNode = { id: 'root', type: 'stack', children: [{ id: 'title', type: 'heading', text: 'Overview' }, ...[1, 2, 3, 4].map(panel)] };
const document: LyraGenView = { version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: 'progressive', revision: 2, root };
const markup = (node: LyraGenNode): string => node.children
  ? `<${node.type} id="${node.id}">${node.children.map(markup).join('')}</${node.type}>`
  : `<${node.type} id="${node.id}">${node.text ?? ''}</${node.type}>`;

async function render(view: LyraGenView): Promise<LyraGenViewElement> {
  const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${initialCatalog} .document=${view}></lr-gen-view>`);
  await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="loading"]').length === 0, 'Generated modules loaded', { timeout: 5000 });
  await element.updateComplete;
  return element;
}
const renderedIds = (element: LyraGenViewElement): string[] => [...element.shadowRoot!.querySelectorAll('[data-gen-id]')].map(node => node.getAttribute('data-gen-id')!);

describe('progressive generated views', () => {
  for (const format of ['json', 'markup'] as const) {
    it(`renders ${format} previews that only grow, then the unchanged final commit`, async () => {
      const source = format === 'json' ? JSON.stringify(document) : markup(root);
      const parser = format === 'json'
        ? createJsonViewStream({ catalog: initialCatalog, progressive: { minCodeUnits: 0 } })
        : createProgressiveMarkupParser({ catalog: initialCatalog, surfaceId: 'progressive', revision: 2, progressive: { minCodeUnits: 0 } });
      const partials: { partial: LyraGenPartialView; at: number }[] = [];
      for (let offset = 0; offset < source.length; offset += 16) {
        const step = parser.push(source.slice(offset, offset + 16));
        if (step.partial) partials.push({ partial: step.partial, at: Math.min(source.length, offset + 16) });
      }
      const final = parser.finish();
      expect(final.status).to.equal('complete');
      expect(partials.length).to.be.greaterThan(1);
      expect(partials[0]!.at / source.length).to.be.lessThan(0.5);
      expect(partials[0]!.partial.partialNodes).to.include('root');
      let previous: string[] = [];
      for (const { partial } of partials) {
        expect(partial.view.revision).to.equal(2);
        const element = await render(partial.view);
        const ids = renderedIds(element);
        for (const id of previous) expect(ids).to.include(id);
        previous = ids;
      }
      const committed = await render(final.view!);
      for (const id of previous) expect(renderedIds(committed)).to.include(id);
      expect(renderedIds(committed)).to.include('panel-4-body');
    });
  }
});
