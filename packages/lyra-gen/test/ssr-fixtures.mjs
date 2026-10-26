import { createCatalog, initialCatalog } from '../dist/catalog.js';
import { createSnapshot, createSurfaceState, setSurfaceState } from '../dist/runtime.js';

export const fixtureCatalog = createCatalog({
  ...initialCatalog,
  actions: { save: { payload: { type: 'object', properties: { note: { type: 'string' }, agreed: { type: 'boolean' } }, required: ['note', 'agreed'] } } },
});
export function fixtureSnapshot() {
  const view = {
    version: '1', surfaceId: 'server-report', revision: 2,
    catalog: { id: fixtureCatalog.id, version: fixtureCatalog.version },
    root: { id: 'root', type: 'stack', children: [
      { id: 'heading', type: 'heading', text: 'Monthly report' },
      { id: 'literal', type: 'text', text: '</template><script>globalThis.snapshotExecuted = true</script>' },
      { id: 'table', type: 'table', props: { caption: 'Order totals', columns: [{ key: 'c0', label: 'Month' }, { key: 'c1', label: 'Orders' }], rows: [{ c0: 'January', c1: 0 }, { c0: 'February', c1: 12 }] } },
      { id: 'form', type: 'form', props: { ariaLabel: 'Review report' }, action: { name: 'save' }, children: [
        { id: 'note', type: 'input', props: { label: 'Review note', value: 'Model default', name: 'note', required: true, hint: 'Write an observation.' }, bindings: { value: '/note' } },
        { id: 'agreed', type: 'checkbox', text: 'Reviewed', props: { name: 'agreed', checked: true }, bindings: { checked: '/agreed' } },
        { id: 'submit', type: 'button', text: 'Save review', props: { type: 'submit' } },
      ] },
    ] },
  };
  const state = setSurfaceState(createSurfaceState(view), '/note', 'Saved user edit');
  if (!state.ok) throw new Error('Fixture state rejected.');
  return createSnapshot(view, state.value);
}
