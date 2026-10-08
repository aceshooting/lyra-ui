import { expect, fixture } from '@open-wc/testing';
import './layout/widget/widget.js';
import './layout/app-rail/app-rail-item.js';
import './data/flow-node/flow-node.js';
import './agent-tools/tool-call-chip/tool-call-chip.js';

type Host = HTMLElement & { updateComplete: Promise<unknown> };

const cases: ReadonlyArray<readonly [string, string, string, string]> = [
  ['lr-widget', 'lr-widget', 'slot[name="start"]', 'label="W"'],
  ['lr-app-rail-item', 'lr-app-rail-item', 'slot[name="start"]', 'href="#home"'],
  ['lr-flow-node', 'lr-flow-node', 'slot[name="start"]', 'heading="N"'],
  ['lr-tool-call-chip', 'lr-tool-call-chip', 'slot[name="status-icon"]', 'name="search"'],
];

for (const [name, tagName, selector, attrs] of cases) {
  const alias = selector.includes('status-icon') ? 'status-icon' : 'start';
  it(`${name} renders its ${alias} slot and keeps the legacy icon slot as the fallback`, async () => {
    const withAlias = await fixture<Host>(`<${tagName} ${attrs}><span slot="${alias}">A</span></${tagName}>`);
    await withAlias.updateComplete;
    const slot = withAlias.shadowRoot!.querySelector<HTMLSlotElement>(selector)!;
    expect(slot.assignedNodes().length).to.equal(1);
    const legacy = await fixture<Host>(`<${tagName} ${attrs}><span slot="icon">L</span></${tagName}>`);
    await legacy.updateComplete;
    const outer = legacy.shadowRoot!.querySelector<HTMLSlotElement>(selector)!;
    expect(outer.assignedNodes().length).to.equal(0);
    const inner = outer.querySelector<HTMLSlotElement>('slot[name="icon"]')!;
    expect(inner.assignedNodes().length).to.equal(1);
  });
}
