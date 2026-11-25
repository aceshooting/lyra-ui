import '@aceshooting/lyra-ui/all.js';
import '@aceshooting/lyra-gen/gen-view.js';
import { createCatalog, liveDashboardCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { createMockQueryProvider, mockLiveData } from '@aceshooting/lyra-gen/mock-data.js';

const [view, queries] = await Promise.all([
  fetch('./dashboard-view.json').then(response => response.json()),
  fetch('./queries.json').then(response => response.json()),
]);
// The catalog is the contract: roles, queries and bounds. Replace the queries with your own.
const catalog = createCatalog({ ...liveDashboardCatalog, id: view.catalog.id, version: view.catalog.version, queries });

// A fake provider: reveals one child per revision, as a model streaming a view would.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function* fakeProvider(canned) {
  const children = canned.root.children ?? [];
  for (let count = 1; count <= children.length; count++) {
    await sleep(450);
    yield { ...canned, revision: count, root: { ...canned.root, children: children.slice(0, count) } };
  }
}

const element = document.querySelector('#view');
element.catalog = catalog;
element.liveData = mockLiveData(view, catalog, { seed: 1 });
element.queryProvider = createMockQueryProvider(catalog, { seed: 1, latencyMs: 150 });
for await (const next of fakeProvider(view)) element.document = next;
