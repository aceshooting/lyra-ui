const workload = await (await fetch('/workloads.json')).json();
const packageBase = `/packages/${window.__lyraPackage.key}/dist/`;
const tags = workload.componentRetention.tags;

await Promise.all(tags.map((tag) => import(`${packageBase}components/${tag}.js`)));
await Promise.all(tags.map((tag) => customElements.whenDefined(tag)));

function makeGridData(revision) {
  return [{ id: 'retained-row', label: `row-${revision}` }];
}

function makeTreeData(revision) {
  return [{ id: 'retained-node', label: `node-${revision}` }];
}

async function mountUpdateActivateDisconnect(revision) {
  const startedAt = performance.now();
  const root = document.querySelector('#retention-root');
  const input = document.createElement('lr-input');
  input.label = 'Retention input';
  const select = document.createElement('lr-select');
  select.label = 'Retention select';
  const option = document.createElement('lr-option');
  option.value = 'retention';
  option.textContent = 'Retention option';
  select.append(option);
  const dialog = document.createElement('lr-dialog');
  dialog.label = 'Retention dialog';
  dialog.textContent = `dialog-${revision}`;
  const grid = document.createElement('lr-data-grid');
  grid.label = 'Retention grid';
  grid.style.cssText = 'display:block;width:400px;height:180px';
  grid.rowKey = 'id';
  grid.columns = [{ id: 'label', field: 'label', label: 'Label' }];
  grid.data = makeGridData(revision);
  const tree = document.createElement('lr-tree');
  tree.label = 'Retention tree';
  tree.data = makeTreeData(revision);
  root.append(input, select, dialog, grid, tree);

  await Promise.all([input.updateComplete, select.updateComplete, dialog.updateComplete, grid.updateComplete, tree.updateComplete]);
  const nativeInput = input.shadowRoot?.querySelector('input');
  if (!nativeInput || nativeInput.getBoundingClientRect().width <= 0) {
    throw new Error('retention input failed its native usability assertion');
  }
  input.value = `input-${revision}`;
  await input.updateComplete;
  nativeInput.focus();
  if (document.activeElement !== input) throw new Error('retention input did not receive focus');
  if (input.shadowRoot.querySelector('input')?.value !== `input-${revision}`) {
    throw new Error('retention input update did not reach its native control');
  }

  await select.show();
  if (!select.open) throw new Error('retention select failed to open');
  await select.hide();
  if (select.open) throw new Error('retention select failed to close');

  await dialog.show();
  if (!dialog.open) throw new Error('retention dialog failed to open');
  await dialog.hide();
  if (dialog.open) throw new Error('retention dialog failed to close');

  grid.data = makeGridData(revision + 1);
  tree.data = makeTreeData(revision + 1);
  await Promise.all([grid.updateComplete, tree.updateComplete]);
  await Promise.all(Array.from(tree.querySelectorAll('lr-tree-item'), (item) => item.updateComplete));
  if (!grid.shadowRoot?.textContent?.includes(`row-${revision + 1}`)) {
    throw new Error('retention grid update did not render its reassigned row');
  }
  const treeItem = tree.querySelector('lr-tree-item');
  if (!treeItem?.shadowRoot?.textContent?.includes(`node-${revision + 1}`)) {
    throw new Error('retention tree update did not render its reassigned node');
  }

  for (const host of [input, select, dialog, grid, tree]) host.remove();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (root.querySelector(tags.join(','))) throw new Error('retention hosts remain connected after teardown');
  return {
    durationMs: performance.now() - startedAt,
    usability: { inputNamedAndUpdated: true, selectOpenedAndClosed: true, dialogOpenedAndClosed: true },
    updateAssertions: { gridRevisionVisible: true, treeRevisionVisible: true },
  };
}

// Warm lazy services before establishing the listener baseline.
const warmupSamples = [];
for (let index = 0; index < workload.componentRetention.warmupCycles; index++) {
  warmupSamples.push(await mountUpdateActivateDisconnect(-3 + index));
}
window.__lyraRetention = {
  tags,
  warmupSamples,
  async cycle(revision) { return mountUpdateActivateDisconnect(revision); },
  countDom() {
    return {
      hostCount: document.querySelectorAll(tags.join(',')).length,
      elementCount: document.querySelectorAll('*').length,
    };
  },
};
document.documentElement.dataset.lyraRetentionReady = 'true';
