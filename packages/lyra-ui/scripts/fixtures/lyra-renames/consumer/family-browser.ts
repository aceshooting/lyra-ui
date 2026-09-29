import '@aceshooting/lyra-ui/components/lr-progress-bar.js';
import '@aceshooting/lyra-ui/components/lr-input.js';
import '@aceshooting/lyra-ui/components/lr-number-input.js';
import '@aceshooting/lyra-ui/components/lr-native-time-input.js';
import '@aceshooting/lyra-ui/components/lr-popover.js';
import '@aceshooting/lyra-ui/components/lr-dropdown.js';
import '@aceshooting/lyra-ui/components/lr-menu.js';
import '@aceshooting/lyra-ui/components/lr-menu-item.js';
import '@aceshooting/lyra-ui/components/lr-stat.js';
import '@aceshooting/lyra-ui/components/lr-agent-run.js';
import '@aceshooting/lyra-ui/components/lr-prompt-studio.js';
import '@aceshooting/lyra-ui/components/lr-code-block.js';
import '@aceshooting/lyra-ui/components/lr-code-block-core.js';
import '@aceshooting/lyra-ui/components/lr-graph.js';
import '@aceshooting/lyra-ui/components/lr-lite-chart.js';
import '@aceshooting/lyra-ui/components/lr-chart.js';
import '@aceshooting/lyra-ui/components/lr-mutation-observer.js';
import type { LitElement } from 'lit';

const results: string[] = [];
function check(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}
async function settled(element: LitElement) {
  await element.updateComplete;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await element.updateComplete;
}
async function until(test: () => boolean, message: string) {
  const deadline = performance.now() + 15000;
  while (!test()) {
    if (performance.now() > deadline) throw new Error(message);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
function region(name: string) {
  const section = document.createElement('section'); section.setAttribute('aria-label', name);
  section.style.cssText = 'display:block;width:640px;min-height:100px;margin:16px;'; document.body.append(section);
  return section;
}

// Source contracts: overlays/overlay/retired-naming-arrow.test.ts.
{
  const container = region('Naming and inherited dropdown arrows');
  const progress = document.createElement('lr-progress-bar'); progress.setAttribute('accessible-label', 'Retired attribute');
  container.append(progress); await settled(progress);
  const role = progress.shadowRoot!.querySelector('[role="progressbar"]')!;
  check(role.getAttribute('aria-label') !== 'Retired attribute', 'Retired naming attribute still controls the rendered name');
  progress.accessibleLabel = 'Retained property'; await settled(progress);
  check(role.getAttribute('aria-label') === 'Retained property', 'Floor24 property lost its rendered effect');
  progress.setAttribute('aria-label', ''); await settled(progress);
  check(role.getAttribute('aria-label') === '', 'Explicit empty native name must win');
  progress.setAttribute('aria-label', 'Canonical name'); await settled(progress);
  check(role.getAttribute('aria-label') === 'Canonical name', 'Canonical name is missing');
  const popover = document.createElement('lr-popover'); popover.innerHTML = '<button slot="trigger">Open</button>Details';
  popover.setAttribute('arrow', 'false'); container.append(popover); await settled(popover);
  check(popover.shadowRoot!.querySelectorAll('[part~="arrow"]').length === 1, 'Retired popover arrow changed the default');
  popover.withoutArrow = true; await settled(popover);
  check(popover.shadowRoot!.querySelectorAll('[part~="arrow"]').length === 0, 'Canonical popover polarity is wrong');
  const dropdown = document.createElement('lr-dropdown'); dropdown.innerHTML = '<button slot="trigger">Actions</button><button>Save</button>';
  container.append(dropdown); await settled(dropdown);
  check(dropdown.arrow === true && dropdown.shadowRoot!.querySelectorAll('[part~="arrow"]').length === 1, 'Dropdown inherited alias/default lost');
  dropdown.arrow = false; await settled(dropdown);
  check(dropdown.withoutArrow && dropdown.shadowRoot!.querySelectorAll('[part~="arrow"]').length === 0, 'Retained dropdown alias lost polarity');
  dropdown.withoutArrow = false; await settled(dropdown);
  check(dropdown.arrow, 'Dropdown canonical last-write precedence lost');
  const time = document.createElement('lr-native-time-input'); time.setAttribute('no-spin-buttons', '');
  container.append(time); await settled(time);
  check(!('noSpinButtons' in time), 'Retired time input alias remains inherited');
  check(!time.withoutSpinButtons, 'Retired time attribute changed canonical spin controls');
  time.withoutSpinButtons = true; await settled(time);
  check(time.withoutSpinButtons, 'Canonical time spin suppression lost');
  for (const tag of ['lr-input', 'lr-number-input'] as const) {
    const input = document.createElement(tag); input.type = 'number'; container.append(input); await settled(input);
    const defaultCanonical = input.withoutSpinButtons;
    input.noSpinButtons = true; await settled(input);
    check(input.withoutSpinButtons === defaultCanonical && input.shadowRoot!.querySelector('[part="input"]')!.hasAttribute('data-without-spin-buttons'), `${tag} lost mirrored spin alias`);
    input.withoutSpinButtons = true; input.noSpinButtons = false; await settled(input);
    check(input.withoutSpinButtons && input.shadowRoot!.querySelector('[part="input"]')!.hasAttribute('data-without-spin-buttons'), `${tag} alias overwrote independent canonical suppression`);
    input.withoutSpinButtons = false; await settled(input);
    check(!input.shadowRoot!.querySelector('[part="input"]')!.hasAttribute('data-without-spin-buttons'), `${tag} cannot restore native controls`);
  }
  results.push('naming-and-inheritance');
}

// Source contracts: layout/menu/menu.test.ts and data/stat/stat.test.ts.
{
  const container = region('Reviewed menu and stat slots');
  const menu = document.createElement('lr-menu');
  menu.innerHTML = '<span slot="header">Consumer heading</span><lr-menu-item>Save</lr-menu-item>';
  container.append(menu); await settled(menu);
  const header = menu.querySelector('span')!;
  check(header.getClientRects().length > 0, 'Reviewed menu header is not rendered');
  check(header.assignedSlot?.name === 'header', 'Menu content was not moved to header');
  check(!header.assignedSlot?.closest('[role="menu"]'), 'Header remains inside the menu role');
  check(menu.querySelector('lr-menu-item')!.getClientRects().length > 0, 'Menu default item no longer renders');
  const stat = document.createElement('lr-stat'); stat.label = 'Revenue'; stat.value = '42';
  stat.innerHTML = '<span id="retired-stat-content">Old icon</span><span slot="start">★</span><span slot="caption">Per month</span>';
  container.append(stat); await settled(stat);
  const icon = stat.shadowRoot!.querySelector<HTMLElement>('[part="icon"]')!;
  check(stat.querySelector('#retired-stat-content')!.getClientRects().length === 0, 'Retired stat slot still paints');
  const start = stat.querySelector('[slot="start"]')!;
  check(start.getClientRects().length > 0 && !icon.hidden, 'Canonical stat icon does not paint');
  start.remove(); await settled(stat);
  check(icon.hidden && stat.querySelector('[slot="caption"]')!.getClientRects().length > 0, 'Removing start broke independent caption rendering');
  results.push('menu-and-stat-slots');
}

// Source contracts: agent-tools/agent-run and prompt-studio colocated tests.
{
  const container = region('Inverted controls and request veto');
  const run = document.createElement('lr-agent-run'); run.run = { id: 'consumer-run', status: { kind: 'running' }, startedAt: Date.now(), steps: [] }; container.append(run); await settled(run);
  check(run.withoutCancel === false && run.shadowRoot!.querySelector('[part="cancel-button"]'), 'Unset canonical inverse changed rendered control');
  run.setAttribute('show-cancel', 'false'); await settled(run);
  check(run.withoutCancel === false, 'Retired inverse attribute still writes canonical state');
  run.withoutCancel = true; await settled(run); check(run.withoutCancel && !run.shadowRoot!.querySelector('[part="cancel-button"]'), 'Canonical inverse did not hide rendered control');
  const studio = document.createElement('lr-prompt-studio'); studio.reorderable = true;
  studio.messages = [{ id: 'system', role: 'system', content: 'You are helpful.' }, { id: 'user', role: 'user', content: 'Hello' }];
  container.append(studio); await settled(studio);
  let requests = 0; let retired = 0; let committed = 0;
  studio.addEventListener('lr-message-reorder', () => retired++);
  const veto = (event: Event) => { requests++; check(studio.messages[0].id === 'system', 'Request arrived after mutation'); event.preventDefault(); };
  studio.addEventListener('lr-message-reorder-request', veto);
  studio.addEventListener('lr-change', () => committed++);
  const button = studio.shadowRoot!.querySelector<HTMLButtonElement>('[part="move-message-down"]')!;
  check(button, 'Populated reorder button is missing'); button.click(); await settled(studio);
  check(requests === 1 && committed === 0 && studio.messages[0].id === 'system', 'Canonical veto failed');
  studio.removeEventListener('lr-message-reorder-request', veto); button.click(); await settled(studio);
  check(studio.messages[0].id === 'user' && committed === 1 && retired === 0, 'Accepted canonical reorder or retired event silence failed');
  results.push('polarity-and-veto');
}

// Source contracts: conversation/code-block shared/full/core tests.
{
  const container = region('Full and core code blocks');
  for (const tag of ['lr-code-block', 'lr-code-block-core'] as const) {
    const code = document.createElement(tag); code.code = 'const answer = 42;';
    code.setAttribute('copyable', 'false'); container.append(code); await settled(code);
    check(code.withoutCopyButton === false, `${tag} retired inverse affected default`);
    check(code.shadowRoot!.textContent!.includes('const answer = 42;'), `${tag} lost code rendering`);
    check(code.shadowRoot!.querySelector('[part~="copy-button"]'), `${tag} default copy button missing`);
    code.withoutCopyButton = true; await settled(code);
    check(!code.shadowRoot!.querySelector('[part~="copy-button"]'), `${tag} canonical copy polarity failed`);
  }
  results.push('full-and-core');
}

// Source contracts: retrieval/graph/graph-aliases.test.ts.
{
  const container = region('Graph detail and scoped paint');
  const graph = document.createElement('lr-graph'); graph.style.cssText = '--lr-graph-edge-color:rgb(1,2,3);--lr-graph-node-fill:rgb(4,5,6);width:500px;height:300px;';
  graph.nodes = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]; graph.edges = [{ id: 'ab', source: 'a', target: 'b' }];
  container.append(graph); await settled(graph);
  await until(() => graph.shadowRoot!.querySelectorAll('[part="link"]').length === 1, 'Graph edge never rendered');
  const edge = graph.shadowRoot!.querySelector('[part="link"]')!;
  check(getComputedStyle(edge).stroke === 'rgb(1, 2, 3)', 'Canonical graph edge paint failed');
  check(getComputedStyle(graph.shadowRoot!.querySelector('[part="node"]')!).fill === 'rgb(4, 5, 6)', 'Canonical graph node paint failed');
  let canonical = 0; let retired = 0;
  graph.addEventListener('lr-link-enter', () => retired++);
  graph.addEventListener('lr-edge-enter', event => {
    canonical++; check(event.detail.edgeId === 'ab' && !('linkId' in event.detail), 'Reviewed edge detail is incorrect');
  });
  edge.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, clientX: 100, clientY: 100 }));
  await until(() => canonical === 1, 'Canonical graph hover did not notify');
  check(retired === 0, 'Retired graph hover still notifies'); results.push('graph-detail-and-css');
}

// Source contracts: charts/chart/chart-deprecated-aliases.test.ts.
{
  const container = region('Populated charts');
  const chart = document.createElement('lr-chart'); chart.labels = ['Q1', 'Q2']; chart.datasets = [{ label: 'Revenue', data: [90, 100] }];
  chart.style.cssText = 'display:block;width:500px;height:300px;'; container.append(chart); await settled(chart);
  check(!chart.withoutZeroBaseline && !chart.withDataTable && chart.size === 'm', 'Shared chart canonical defaults changed');
  chart.withDataTable = true; await settled(chart);
  await until(() => Boolean(chart.shadowRoot!.querySelector('table')?.textContent?.includes('Revenue')), 'Populated canonical chart table missing');
  const lite = document.createElement('lr-lite-chart'); lite.labels = ['Q1', 'Q2'];
  lite.datasets = [{ label: 'Revenue', data: [90, 100] }, { label: 'Costs', data: [30, 40] }];
  lite.withDataTable = true; lite.withLegend = true; container.append(lite); await settled(lite);
  check(lite.shadowRoot!.querySelector('svg'), 'Lite chart did not paint');
  const liteTable = lite.shadowRoot!.querySelector('table');
  check(liteTable, 'Lite chart canonical table missing');
  check(JSON.stringify([...liteTable!.querySelectorAll('thead th')].slice(1).map(cell => cell.textContent?.trim())) === JSON.stringify(['Revenue', 'Costs']), 'Lite chart series headers are incorrect');
  check(JSON.stringify([...liteTable!.querySelectorAll('tbody td')].map(cell => cell.textContent?.trim())) === JSON.stringify(['90', '30', '100', '40']), 'Lite chart canonical values are incorrect');
  results.push('populated-charts');
}

// Source contracts: utility/mutation-observer/mutation-observer.test.ts.
{
  const container = region('Native mutation filters');
  const observer = document.createElement('lr-mutation-observer'); observer.attr = 'data-state';
  const child = document.createElement('div'); observer.append(child); container.append(observer); await settled(observer);
  const names: string[] = [];
  observer.addEventListener('lr-mutation', event => { names.push(...event.detail.records.map(record => record.attributeName ?? '')); });
  child.setAttribute('data-ignored', 'yes'); child.setAttribute('data-state', 'ready');
  await until(() => names.includes('data-state'), 'Canonical mutation filter did not observe');
  check(!names.includes('data-ignored'), 'Canonical attribute filter leaked an unrelated mutation');
  results.push('native-mutation-filter');
}

document.documentElement.dataset.migrationFamilies = JSON.stringify(results);
