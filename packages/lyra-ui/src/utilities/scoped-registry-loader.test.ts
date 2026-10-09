import { expect, fixture, html } from '@open-wc/testing';
import { loadScopedRegistry } from './scoped-registry-loader.js';
import { supportsScopedRegistries } from './scoped-registry.js';
import type { LyraApprovalQueue } from '../components/agent-tools/approval-queue/approval-queue.class.js';

const { default: { components } } = await import(
  new URL('../../scripts/fixtures/component-inventory.json', import.meta.url).href
) as { default: { components: Array<{ tag: string; classModule: string }> } };

describe('optional scoped dependency loader', () => {
  it('rejects unsupported environments without loading or registering components', async () => {
    if (supportsScopedRegistries()) return;
    const before = customElements.get('lr-approval-queue');
    let message = '';
    try { await loadScopedRegistry(['lr-approval-queue']); } catch (error) { message = String(error); }
    expect(message).to.include('Scoped custom element registries are not supported');
    expect(customElements.get('lr-approval-queue') === before).to.equal(true);
  });
  it('loads composed classes without globally registering them', async function () {
    if (!supportsScopedRegistries()) this.skip();
    const before = customElements.get('lr-approval-queue');
    const scope = await loadScopedRegistry(['lr-approval-queue']);
    expect(scope.registry.get('lr-tool-approval-dialog') !== undefined).to.equal(true);
    expect(customElements.get('lr-approval-queue') === before).to.equal(true);
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const queue = scope.createElement('lr-approval-queue') as LyraApprovalQueue;
    queue.requests = [{ id: 'call', toolName: 'read_file', args: { path: 'example.txt' } }];
    scope.attachShadow(host).append(queue);
    await queue.updateComplete;
    expect(queue.shadowRoot!.querySelector('[part="request"]')?.textContent).to.include('read_file');
  });
  it('rejects unknown tags before loading any classes', async function () {
    if (!supportsScopedRegistries()) this.skip();
    let message = '';
    try { await loadScopedRegistry(['lr-unknown-component']); } catch (error) { message = String(error); }
    expect(message).to.include('Unknown Lyra scoped tag');
  });

  for (const component of components) {
    it(`loads the declared ${component.tag} class into an isolated registry`, async function () {
      if (!supportsScopedRegistries()) this.skip();
      const before = new Map(components.map(({ tag }) => [tag, customElements.get(tag)]));
      const scope = await loadScopedRegistry([component.tag]);
      const Constructor = scope.registry.get(component.tag);
      expect(typeof Constructor, 'the requested tag is registered in its scope').to.equal('function');
      const moduleUrl = new URL(`../../${component.classModule}`, import.meta.url);
      const declaredModule = await import(moduleUrl.href) as Record<string, unknown>;
      const sourceConstructor = Object.getPrototypeOf(Constructor!.prototype).constructor;
      expect(Object.values(declaredModule).includes(sourceConstructor), 'the scoped class extends its declared public class').to.equal(true);
      const element = scope.createElement(component.tag);
      expect(element.localName).to.equal(component.tag);
      expect(element instanceof Constructor!, 'construction uses the isolated definition').to.equal(true);
      expect(element.ownerDocument === document).to.equal(true);
      // One assertion over the whole catalog: a per-tag expect() here ran catalog-size squared
      // assertions across the file, which coverage instrumentation turned into a runner that never finished.
      const changed = components.filter(({ tag }) => customElements.get(tag) !== before.get(tag)).map(({ tag }) => tag);
      expect(changed, 'tags whose global registration changed').to.deep.equal([]);
    });
  }
});
