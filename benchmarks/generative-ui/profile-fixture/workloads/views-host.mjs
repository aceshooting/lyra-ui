import { createHash } from 'node:crypto';
import { createViewDefinition, createViewCatalog } from './views.js';

/** Actual static SSR from installed public exports; no browser HTML reconstruction. */
export async function createHostServices({ loadLibrary }) {
  const [catalogLibrary, { createSnapshot, createSurfaceState, setSurfaceState, validateView }, { renderGenSnapshot, GEN_SSR_ROLES }, { render }, { collectResult }, { emitMarkup }] = await Promise.all([
    loadLibrary('@aceshooting/lyra-gen/catalog.js'), loadLibrary('@aceshooting/lyra-gen/runtime.js'), loadLibrary('@aceshooting/lyra-gen/ssr.js'),
    loadLibrary('@lit-labs/ssr'), loadLibrary('@lit-labs/ssr/lib/render-result.js'), loadLibrary('@aceshooting/lyra-gen/authoring.js'),
  ]);
  const catalog = createViewCatalog(catalogLibrary);
  const inputBodies = new Map(), viewInputs = {};
  for (const workload of ['V', 'X', 'R']) {
    const view = createViewDefinition(workload), admitted = validateView(view, catalog), emitted = emitMarkup(view, catalog);
    if (!admitted.ok || !emitted.ok) throw new Error(`${workload} frozen input admission failed.`);
    const body = JSON.stringify({ view, markup: emitted.value });
    if (Buffer.byteLength(body) > 262144) throw new Error(`${workload} input response exceeds its fixed bound.`);
    inputBodies.set(workload, body);
    viewInputs[workload] = { url: `/host/view-inputs/${workload}`, sha256: createHash('sha256').update(body).digest('hex') };
  }
  const view = createViewDefinition('R');
  const roles = new Set(); const visit = node => { roles.add(node.type); node.children?.forEach(visit); }; visit(view.root);
  if (roles.size !== 13 || GEN_SSR_ROLES.some(role => !roles.has(role))) throw new Error('R must exercise exactly the thirteen supported static roles.');
  const edited = setSurfaceState(createSurfaceState(view), '/note', 'Saved user edit');
  if (!edited.ok) throw new Error('R dirty note was rejected.');
  const snapshot = createSnapshot(view, edited.value);
  const renderSnapshot = async () => {
    const started = performance.now();
    const result = renderGenSnapshot(snapshot, catalog, { locale: 'en-US', direction: 'ltr' });
    if (!result.ok) throw new Error('R static SSR was rejected.');
    const body = await collectResult(render(result.value.template));
    return { body, serverRenderMs: performance.now() - started };
  };
  let { body } = await renderSnapshot();
  if (Buffer.byteLength(body) > 262144) throw new Error('R server response exceeds its fixed bound.');
  const sha256 = createHash('sha256').update(body).digest('hex');
  let disposed = false;
  return {
    routes: [{ path: '/host/ssr/R', methods: ['GET'], handle: async () => {
      if (disposed) throw new Error('R SSR host is disposed.');
      const result = await renderSnapshot();
      if (createHash('sha256').update(result.body).digest('hex') !== sha256) throw new Error('R server markup changed.');
      return { status: 200, contentType: 'text/html', body: result.body, metrics: { serverRenderMs: result.serverRenderMs } };
    } }, ...['V', 'X', 'R'].map(workload => ({ path: `/host/view-inputs/${workload}`, methods: ['GET'], handle: async () => {
      if (disposed) throw new Error('View input host is disposed.');
      return { status: 200, contentType: 'application/json', body: inputBodies.get(workload) };
    } }))],
    services: { ssr: { url: '/host/ssr/R', sha256 }, viewInputs },
    async dispose() { disposed = true; body = ''; inputBodies.clear(); },
  };
}
