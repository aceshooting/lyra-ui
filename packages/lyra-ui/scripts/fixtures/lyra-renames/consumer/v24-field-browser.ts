import '@aceshooting/lyra-ui/components/lr-details.js';
import '@aceshooting/lyra-ui/components/lr-multi-split.js';
import '@aceshooting/lyra-ui/components/lr-navigation-menu-item.js';
import '@aceshooting/lyra-ui/components/lr-dock-panel.js';
import '@aceshooting/lyra-ui/components/lr-app-rail-item.js';
import '@aceshooting/lyra-ui/components/lr-app-rail.js';
import '@aceshooting/lyra-ui/components/lr-app-rail-group.js';
import '@aceshooting/lyra-ui/components/lr-thread-list.js';
import '@aceshooting/lyra-ui/components/lr-chat-message.js';
import '@aceshooting/lyra-ui/components/lr-code-block.js';
import '@aceshooting/lyra-ui/components/lr-code-block-core.js';
import { fieldProofConfig } from './v24-field-config.js';

type FieldExposure = {
  key: { tag: string; event: string; declaration: { module: string; detailType: string; field: string } };
  role: 'request' | 'settled';
  relation: 'equal' | 'inverse';
  canonicalOptional: boolean;
};

const exposures = fieldProofConfig.exposures as unknown as FieldExposure[];
const fieldMode = (): 'pre-removal' | 'retirement' => fieldProofConfig.mode;
const stage = document.createElement('main');
stage.style.cssText = 'position:fixed;inset:0 auto auto 0;width:390px;min-height:800px;overflow:auto;z-index:2147483647;background:white;';
document.body.append(stage);

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function settled(element: Element & { updateComplete?: Promise<unknown> }): Promise<void> {
  await element.updateComplete;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await element.updateComplete;
}
async function until(predicate: () => boolean, message: string): Promise<void> {
  const deadline = performance.now() + 15000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error(message);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
function button(element: HTMLElement, selector: string): HTMLButtonElement {
  const result = element.shadowRoot?.querySelector<HTMLButtonElement>(selector);
  check(result, `Missing installed control ${selector} on ${element.localName}`);
  return result;
}
function state(element: HTMLElement): unknown {
  switch (element.localName) {
    case 'lr-details': return (element as HTMLElement & { open: boolean }).open;
    case 'lr-multi-split': return (element as HTMLElement & { open: boolean }).open;
    case 'lr-navigation-menu-item': return (element as HTMLElement & { open: boolean }).open;
    case 'lr-dock-panel': return (element as HTMLElement & { collapsed: boolean }).collapsed;
    case 'lr-app-rail-item': return (element as HTMLElement & { expanded: boolean }).expanded;
    case 'lr-app-rail': return (element as HTMLElement & { open: boolean }).open;
    case 'lr-app-rail-group': return (element as HTMLElement & { collapsed: boolean }).collapsed;
    case 'lr-thread-list': return [...(element as HTMLElement & { collapsedGroupIds: string[] }).collapsedGroupIds];
    case 'lr-chat-message': return (element as HTMLElement & { collapsed: boolean }).collapsed;
    case 'lr-code-block':
    case 'lr-code-block-core': return (element as HTMLElement & { collapsed: boolean }).collapsed;
    default: throw new Error(`Unknown nested field owner ${element.localName}`);
  }
}
function stateEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
async function createAndAct(tag: string): Promise<{ element: HTMLElement; act: () => void | Promise<void> }> {
  const element = document.createElement(tag) as HTMLElement & Record<string, any>;
  let act: () => void | Promise<void>;
  switch (tag) {
    case 'lr-details':
      element.summary = 'Expand details';
      stage.append(element); await settled(element);
      act = async () => { await element.show(); await settled(element); };
      break;
    case 'lr-multi-split':
      element.innerHTML = '<div>Primary pane</div><div>Secondary pane</div>';
      element.collapse = 'start';
      stage.append(element); await settled(element);
      element.collapseState = 'floating'; element.open = true; await settled(element);
      act = () => {
        element.open = true;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
      };
      break;
    case 'lr-navigation-menu-item':
      element.innerHTML = '<span slot="panel">Menu panel</span>Open menu';
      stage.append(element); await settled(element);
      act = () => { element.open = !element.open; };
      break;
    case 'lr-dock-panel':
      element.collapsible = true; element.extent = '240px'; element.innerHTML = '<div slot="header">Panel</div>Content';
      stage.append(element); await settled(element);
      act = () => button(element, '[part="collapse-toggle"]').click();
      break;
    case 'lr-app-rail-item':
      element.innerHTML = 'Navigation item<div slot="children">Child link</div>';
      stage.append(element); await settled(element);
      act = () => button(element, '[part="toggle"]').click();
      break;
    case 'lr-app-rail':
      element.innerHTML = '<a href="#field-proof">Field proof link</a>';
      stage.append(element); await settled(element);
      await until(() => element.mode === 'mobile', 'The installed app rail did not resolve mobile mode at the consumer viewport');
      act = () => button(element, '[part="toggle"]').click();
      break;
    case 'lr-app-rail-group':
      element.collapsible = true; element.collapsed = true; element.heading = 'Navigation';
      element.innerHTML = '<lr-app-rail-item>Item</lr-app-rail-item>';
      stage.append(element); await settled(element);
      act = () => button(element, '[part="toggle"]').click();
      break;
    case 'lr-thread-list':
      element.threads = [
        { id: 'field-a', title: 'Alpha', project: 'alpha' },
        { id: 'field-b', title: 'Beta', project: 'beta' },
      ];
      element.grouping = 'custom';
      element.groupBy = (thread: { project: string }) => thread.project;
      element.collapsedGroupIds = ['alpha'];
      element.style.blockSize = '360px'; stage.append(element); await settled(element);
      await until(() => {
        const virtual = element.shadowRoot?.querySelector('lr-virtual-list');
        return Boolean(virtual?.shadowRoot?.querySelector('[part~="group-toggle"]'));
      }, 'The installed thread list did not render its group control');
      act = () => {
        const virtual = element.shadowRoot!.querySelector('lr-virtual-list')!;
        const button = [...virtual.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="group-toggle"]')]
          .find(item => item.textContent?.includes('alpha'));
        check(button, 'The installed thread-list group toggle is missing'); button.click();
      };
      break;
    case 'lr-chat-message':
      element.collapsible = true; element.collapsed = true; element.textContent = 'A message with a body.';
      stage.append(element); await settled(element);
      act = () => button(element, '[part="collapse-button"]').click();
      break;
    case 'lr-code-block':
    case 'lr-code-block-core':
      element.code = 'const answer = 42;'; element.collapsible = true; element.collapsed = true;
      stage.append(element); await settled(element);
      act = () => button(element, '[part~="toggle"]').click();
      break;
    default: throw new Error(`No installed interaction for ${tag}`);
  }
  return { element, act };
}

const grouped = new Map<string, FieldExposure[]>();
for (const exposure of exposures) {
  const group = grouped.get(exposure.key.tag) ?? [];
  group.push(exposure); grouped.set(exposure.key.tag, group);
}
const observed: FieldExposure['key'][] = [];
for (const [tag, rows] of grouped) {
  const { element, act } = await createAndAct(tag);
  const requests = rows.filter(row => row.role === 'request');
  const settledRows = rows.filter(row => row.role === 'settled');
  const received = new Map<string, Array<{ detail: Record<string, unknown>; cancelable: boolean }>>();
  const eventOrder: string[] = [];
  for (const row of rows) {
    const events: Array<{ detail: Record<string, unknown>; cancelable: boolean }> = [];
    received.set(row.key.event, events);
    element.addEventListener(row.key.event, event => {
      check(event instanceof CustomEvent, `${tag}/${row.key.event} was not a CustomEvent`);
      check(event.detail && (typeof event.detail.expanded === 'boolean' || (row.canonicalOptional && event.detail.expanded === undefined)), `${tag}/${row.key.event} lost canonical detail.expanded`);
      if (fieldMode() === 'retirement') {
        check(!Object.hasOwn(event.detail, row.key.declaration.field), `${tag}/${row.key.event} retained retired detail.${row.key.declaration.field}`);
      } else {
        check(Object.hasOwn(event.detail, row.key.declaration.field), `${tag}/${row.key.event} pre-removal proof lost detail.${row.key.declaration.field}`);
        const alias = event.detail[row.key.declaration.field];
        check(typeof alias === 'boolean', `${tag}/${row.key.event} deprecated detail field is not boolean`);
        check(alias === (row.relation === 'equal' ? event.detail.expanded : !event.detail.expanded), `${tag}/${row.key.event} deprecated detail field relation changed`);
      }
      events.push({ detail: event.detail, cancelable: event.cancelable });
      eventOrder.push(row.key.event);
    });
    observed.push(row.key);
  }
  if (requests.length) {
    check(settledRows.length === requests.length, `${tag} request/settled exposure count differs`);
    const before = state(element);
    const requestName = requests[0].key.event;
    const settledName = settledRows[0].key.event;
    if (tag === 'lr-multi-split') {
      const split = element as HTMLElement & { collapseState: string; open: boolean };
      const reentrant = () => { split.collapseState = 'rail'; };
      element.addEventListener(requestName, reentrant, { once: true });
      await act(); await settled(element);
      check(received.get(requestName)?.length === 1 && received.get(settledName)?.length === 1, 'The installed multi-split lost its reentrant request/settled pair');
      check(split.collapseState === 'rail' && split.open === false, 'The installed multi-split reentrant transition did not commit');
      split.collapseState = 'floating'; split.open = true; await settled(element);
      received.get(requestName)!.length = 0; received.get(settledName)!.length = 0; eventOrder.length = 0;
    }
    const veto = (event: Event) => event.preventDefault();
    element.addEventListener(requestName, veto);
    await act(); await settled(element);
    check(received.get(requestName)?.length === 1, `${tag} did not emit its cancelable request when vetoed`);
    check(received.get(settledName)?.length === 0, `${tag} emitted settled event after the request was vetoed`);
    check(stateEqual(state(element), before), `${tag} changed state after the request was vetoed`);
    element.removeEventListener(requestName, veto);
    await act(); await settled(element);
    await until(() => (received.get(settledName)?.length ?? 0) === 1, `${tag} accepted request did not emit its settled event`);
    const requestEvents = received.get(requestName)!; const settledEvents = received.get(settledName)!;
    const requestCount = 2;
    check(requestEvents.length === requestCount && settledEvents.length === 1, `${tag} request/settled counts differ`);
    check(requestEvents.every(event => event.cancelable), `${tag} request events must be cancelable`);
    check(!settledEvents[0].cancelable, `${tag} settled event must be non-cancelable`);
    check(requestEvents.at(-1)!.detail.expanded === settledEvents[0].detail.expanded, `${tag} accepted request and settled canonical value differ`);
    check(!stateEqual(state(element), before), `${tag} accepted request failed to commit state`);
    check(stateEqual(eventOrder, [requestName, requestName, settledName]), `${tag} request/settled order changed`);
  } else {
    check(settledRows.length === 1, `${tag} settled-only exposure count differs`);
    await act(); await settled(element);
    await until(() => (received.get(settledRows[0].key.event)?.length ?? 0) === 1, `${tag}/${settledRows[0].key.event} did not emit`);
    check(!received.get(settledRows[0].key.event)![0].cancelable, `${tag}/${settledRows[0].key.event} must be non-cancelable`);
    check(stateEqual(eventOrder, [settledRows[0].key.event]), `${tag} settled-only event order changed`);
  }
  element.remove();
}

check(observed.length === 20, `Installed browser exercised ${observed.length}/20 published field exposures`);
document.documentElement.dataset.migrationFieldsProof = JSON.stringify({ mode: fieldProofConfig.mode, exposures: observed });
stage.remove();
