import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { mapSceneSessionAttachment } from '../../../internal/map-scene-session.js';
import { sceneMarker, sceneModel, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

type SceneElement = LyraMap & { scene: unknown };
interface StateDetail { readonly revision: number; readonly state: string; readonly code?: string; }
interface ActivationDetail { readonly id: string; readonly kind: string; readonly source: string; readonly position?: unknown; }
const pending: (() => void)[] = [];

async function mount(scene?: unknown) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as SceneElement;
  element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.controls = { attribution: false };
  element.style.cssText = 'display:block;inline-size:320px;block-size:480px';
  let finish!: () => void;
  const library = new Promise<null>(resolve => { finish = () => resolve(null); });
  Object.defineProperty(element, 'loadLibrary', { configurable: true, value: () => library });
  pending.push(finish);
  if (scene !== undefined) Reflect.set(element, 'scene', scene);
  wrapper.append(element); await element.updateComplete;
  return { element, wrapper, failNative: finish };
}
function attachment(element: Element) {
  const value = mapSceneSessionAttachment(element as HTMLElement);
  expect(value !== undefined, 'connected scene attachment').to.equal(true);
  if (!value) throw new Error('Expected scene attachment');
  return value;
}
function stateEvents(element: Element): StateDetail[] {
  const values: StateDetail[] = [];
  element.addEventListener('lr-map-scene-state', event => {
    if (event instanceof CustomEvent) values.push(event.detail as StateDetail);
  });
  return values;
}
function activations(element: Element): ActivationDetail[] {
  const values: ActivationDetail[] = [];
  element.addEventListener('lr-map-scene-activate', event => {
    if (event instanceof CustomEvent) values.push(event.detail as ActivationDetail);
  });
  return values;
}
function part<T extends HTMLElement = HTMLElement>(element: Element, name: string): T {
  const value = element.shadowRoot?.querySelector<T>(`[part~="${name}"]`);
  expect(value !== null && value !== undefined, `scene ${name}`).to.equal(true);
  if (!value) throw new Error('Expected scene part');
  return value;
}
async function expand(element: SceneElement) {
  const toggle = part<HTMLButtonElement>(element, 'scene-toggle');
  if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
  await element.updateComplete;
}
function rowButtons(element: Element): HTMLButtonElement[] {
  return [...part(element, 'scene-list').querySelectorAll<HTMLButtonElement>('button')];
}

describe('lr-map accepted geographic scene', () => {
  afterEach(async () => { fixtureCleanup(); for (const finish of pending.splice(0)) finish(); await resetMouse(); await Promise.resolve(); });

  it('registers an empty attachment before native loading without adding an unset scene surface', async () => {
    const { element } = await mount(); const a = attachment(element);
    expect(a.target('target')).to.deep.equal({ status: 'absent' });
    expect(element.scene).to.equal(undefined);
    expect(element.shadowRoot!.querySelector('[part~="scene-panel"]') === null).to.equal(true);
    const stop = a.watchTarget('target'); a.requestFrame(); stop();
    expect(element.map === undefined).to.equal(true);
    expect(mapSceneSessionAttachment(element) === a).to.equal(true);
  });

  it('accepts configured input on connect before the held native library completes', async () => {
    const { element } = await mount({ objects: [sceneMarker('first', 7)] });
    const lookup = attachment(element).target('first');
    expect(lookup.status).to.equal('accepted');
    if (lookup.status !== 'accepted') throw new Error('Expected accepted target');
    expect(lookup.target.position.lngLat).to.deep.equal([7, 0]);
    expect(element.map === undefined).to.equal(true);
    part(element, 'scene-panel');
  });

  it('snapshots connected assignments synchronously before caller mutation or byte detachment', async () => {
    const { element } = await mount(); const a = attachment(element);
    const bytes = new Uint8Array([1, 2, 3]); const source = { format: 'glb' as const, bytes };
    const model = sceneModel('asset', source); model.position.lngLat[0] = 4;
    element.scene = { objects: [model] };
    const first = a.target('asset'); expect(first.status).to.equal('accepted');
    model.position.lngLat[0] = 99; structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
    await element.updateComplete;
    const copied = a.target('asset');
    expect(copied.status === 'accepted' && copied.target.position.lngLat[0]).to.equal(4);
    element.scene = { objects: [{ ...sceneModel('asset', source), position: { lngLat: [8, 0] } }] };
    expect(a.target('asset').status).to.equal('accepted');
    const latest = a.target('asset'); expect(latest.status === 'accepted' && latest.target.position.lngLat[0]).to.equal(8);
  });

  it('keeps exact facts through metadata changes and preserves accepted intent on invalid replacement', async () => {
    const { element } = await mount({ objects: [sceneMarker('target', 3)] }); const a = attachment(element);
    const first = a.target('target'); if (first.status !== 'accepted') throw new Error('Expected target');
    const changed: string[][] = []; a.subscribeTargets(notice => changed.push([...notice.changedIds]));
    const states = stateEvents(element);
    element.scene = { objects: [{ ...sceneMarker('target', 3), label: 'New label' }] }; await element.updateComplete;
    const same = a.target('target'); expect(same.status === 'accepted' && same.target === first.target).to.equal(true);
    expect(changed).to.deep.equal([]);
    const acceptedRevision = states.at(-1)?.revision;
    element.scene = { objects: [sceneMarker('duplicate'), sceneMarker('duplicate')] }; await element.updateComplete;
    expect(a.target('duplicate').status).to.equal('absent'); expect(a.target('target').status).to.equal('accepted');
    expect(states.at(-1)).to.deep.equal({ revision: acceptedRevision, state: 'error', code: 'invalid' });
    expect(changed).to.deep.equal([]);
  });

  it('distinguishes explicit empty acceptance from clear and revokes removed target facts', async () => {
    const { element } = await mount(); const a = attachment(element); const states = stateEvents(element);
    element.scene = { objects: [] }; await element.updateComplete;
    part(element, 'scene-panel'); expect(states.at(-1)?.state).to.equal('empty');
    element.scene = { objects: [sceneMarker()] }; await element.updateComplete;
    const before = a.target('target'); if (before.status !== 'accepted') throw new Error('Expected target');
    element.scene = undefined;
    expect(a.target('target')).to.deep.equal({ status: 'absent' }); await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part~="scene-panel"]') === null).to.equal(true);
    expect(states.at(-1)?.state).to.equal('empty');
    element.scene = { objects: [sceneMarker()] };
    const after = a.target('target');
    expect(after.status === 'accepted' && after.target.acceptedPositionRevision > before.target.acceptedPositionRevision).to.equal(true);
  });

  it('retains accepted targets and a visible text alternative when native loading fails', async () => {
    const { element, failNative } = await mount(); const a = attachment(element);
    const states = stateEvents(element);
    element.scene = { objects: [sceneMarker('retained', 12)] }; await element.updateComplete;
    expect(states).to.deep.equal([{ revision: 1, state: 'unavailable', code: 'engine' }]);
    failNative();
    await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]') !== null);
    await element.updateComplete; await expand(element);
    expect(mapSceneSessionAttachment(element) === a).to.equal(true);
    expect(a.target('retained').status).to.equal('accepted');
    expect(part(element, 'scene-list').textContent).to.include('retained');
    expect(states.every(state => state.state !== 'ready' && state.state !== 'loading')).to.equal(true);
    expect(element.map === undefined).to.equal(true);
  });

  it('keeps the stable accepted state across style configuration changes without a renderer', async () => {
    const { element } = await mount({ objects: [sceneMarker()] }); const a = attachment(element);
    const original = a.target('target'); const notices: string[][] = [];
    a.subscribeTargets(notice => notices.push([...notice.changedIds]));
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, name: 'Replacement' }; element.projection = 'globe';
    await element.updateComplete;
    const lookup = a.target('target');
    expect(lookup.status === 'accepted' && original.status === 'accepted' && lookup.target === original.target).to.equal(true);
    expect(mapSceneSessionAttachment(element) === a).to.equal(true); expect(notices).to.deep.equal([]);
  });

  it('closes the old facade on disconnect and creates a fresh accepted connection on reconnect', async () => {
    const { element, wrapper } = await mount({ objects: [sceneMarker()] }); const old = attachment(element);
    let callbacks = 0; old.subscribeTargets(() => callbacks++); const release = old.watchTarget('target');
    element.remove(); expect(mapSceneSessionAttachment(element)).to.equal(undefined);
    expect(old.target('target')).to.deep.equal({ status: 'absent' });
    wrapper.append(element); const next = attachment(element);
    expect(next === old).to.equal(false); expect(next.target('target').status).to.equal('accepted');
    release(); release(); element.scene = { objects: [sceneMarker('target', 9)] };
    expect(callbacks).to.equal(0); expect(next.target('target').status).to.equal('accepted');
  });

  it('retires old scene authority when the element is adopted into another document', async () => {
    const { element } = await mount({ objects: [sceneMarker('adopted', 5)] }); const old = attachment(element);
    const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Scene owner document"></iframe>`);
    const document = frame.contentDocument;
    if (!document?.body) throw new Error('Expected owner document');
    document.body.append(document.adoptNode(element));
    const next = attachment(element);
    expect(next === old).to.equal(false); expect(old.target('adopted')).to.deep.equal({ status: 'absent' });
    expect(next.target('adopted').status).to.equal('accepted');
    await element.updateComplete; element.remove();
    expect(mapSceneSessionAttachment(element)).to.equal(undefined);
  });

  it('does not deliver an obsolete status after a target listener accepts a newer scene', async () => {
    const { element } = await mount({ objects: [sceneMarker('target', 1)] }); const a = attachment(element);
    const states = stateEvents(element); let reentered = false;
    a.subscribeTargets(() => {
      if (!reentered) { reentered = true; element.scene = { objects: [sceneMarker('target', 3)] }; }
    });
    element.scene = { objects: [sceneMarker('target', 2)] }; await element.updateComplete;
    const lookup = a.target('target'); expect(lookup.status === 'accepted' && lookup.target.position.lngLat[0]).to.equal(3);
    expect(states.length).to.equal(1); expect(states[0]).to.deep.equal({ revision: 3, state: 'unavailable', code: 'engine' });
  });

  it('drops deferred scene events when a target listener disconnects the map', async () => {
    const { element } = await mount(); const states = stateEvents(element); const a = attachment(element);
    a.subscribeTargets(() => element.remove()); element.scene = { objects: [sceneMarker()] };
    await element.updateComplete;
    expect(states).to.deep.equal([]); expect(mapSceneSessionAttachment(element)).to.equal(undefined);
  });

  it('renders safe caller text, all approved parts and a bounded page of the accepted inventory', async () => {
    const objects = Array.from({ length: 101 }, (_, index) => ({ ...sceneMarker(`id-${index}`), label: `Row ${index}` }));
    objects[0]!.label = '<img src=x onerror=alert(1)>';
    const { element } = await mount({ objects }); await expand(element);
    for (const name of ['scene-panel', 'scene-toggle', 'scene-list', 'scene-item', 'scene-pagination', 'scene-status']) part(element, name);
    expect(rowButtons(element).length).to.equal(100);
    expect(part(element, 'scene-list').querySelector('img') === null).to.equal(true);
    expect(part(element, 'scene-list').textContent).to.include('<img src=x onerror=alert(1)>');
    const pages = [...part(element, 'scene-pagination').querySelectorAll<HTMLButtonElement>('button')];
    expect(pages.length).to.equal(2); pages[1]!.click(); await element.updateComplete;
    expect(rowButtons(element).length).to.equal(1); expect(part(element, 'scene-list').textContent).to.include('Row 100');
    pages[0]!.click(); await element.updateComplete; expect(rowButtons(element).length).to.equal(100);
  });

  it('activates the same eligible row by Enter, Space and pointer without rendered geometry', async () => {
    const { element, wrapper } = await mount({ objects: [sceneMarker('pin', 6), { ...scenePath('route'), interactive: false }] });
    await expand(element); const rows = rowButtons(element); const events = activations(element);
    const propagation: boolean[][] = [];
    wrapper.addEventListener('lr-map-scene-activate', event => { propagation.push([event.bubbles, event.composed, event.cancelable]); });
    expect(rows.length).to.equal(1);
    await focusByKeyboard(rows[0]!); await sendKeys({ press: 'Enter' });
    expect(events.length).to.equal(1);
    expect(events[0]).to.deep.equal({ id: 'pin', kind: 'marker', source: 'keyboard', position: { lngLat: [6, 0], altitude: 0, altitudeReference: 'sea-level' } });
    expect(Object.isFrozen(events[0])).to.equal(true); expect(element.map === undefined).to.equal(true);
    await sendKeys({ press: 'Space' });
    const bounds = rows[0]!.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(bounds.left + bounds.width / 2), Math.round(bounds.top + bounds.height / 2)] });
    expect(events.map(event => event.source)).to.deep.equal(['keyboard', 'keyboard', 'pointer']);
    expect(events.map(event => event.id)).to.deep.equal(['pin', 'pin', 'pin']);
    expect(events.every(event => Object.isFrozen(event))).to.equal(true);
    expect(propagation).to.deep.equal([[true, true, false], [true, true, false], [true, true, false]]);
  });

  it('refuses an old rendered row after same-ID position or kind replacement before Lit paints', async () => {
    for (const next of [sceneMarker('target', 8), sceneModel('target')]) {
      const { element } = await mount({ objects: [sceneMarker('target', 2)] }); await expand(element);
      const old = rowButtons(element)[0]!; const events = activations(element);
      element.scene = { objects: [next] }; old.click();
      expect(events).to.deep.equal([]); await element.updateComplete;
      rowButtons(element)[0]!.click(); expect(events.length).to.equal(1); expect(events[0]!.kind).to.equal(next.kind);
      element.remove();
    }
  });

  it('repairs focus to the scene toggle when a focused accepted row disappears', async () => {
    const { element } = await mount({ objects: [sceneMarker('first'), sceneMarker('second')] }); await expand(element);
    await focusByKeyboard(rowButtons(element)[0]!);
    element.scene = { objects: [sceneMarker('second')] }; await element.updateComplete;
    expect(element.shadowRoot!.activeElement === part(element, 'scene-toggle')).to.equal(true);
  });

  it('keeps populated, empty and invalid text states accessible at narrow RTL allocation', async () => {
    const { element } = await mount({ objects: [{ ...sceneMarker('wide', 3), label: 'Long unbroken label'.repeat(80) }] }); element.setAttribute('dir', 'rtl');
    await expand(element); expect(rowButtons(element).length).to.equal(1); await expect(element).to.be.accessible();
    const panel = part(element, 'scene-panel'); expect(panel.scrollWidth <= panel.clientWidth + 1).to.equal(true);
    element.scene = { objects: [] }; await element.updateComplete; part(element, 'scene-status'); await expect(element).to.be.accessible();
    Reflect.set(element, 'scene', { objects: [null] }); await element.updateComplete; part(element, 'scene-status'); await expect(element).to.be.accessible();
  });

  it('supports localized scene feedback and announces it separately from the shadow status', async () => {
    const { element } = await mount();
    element.strings = { mapSceneUnavailable: 'Rendering paused for this scene' };
    element.scene = { objects: [sceneMarker()] }; await element.updateComplete;
    const status = part(element, 'scene-status'); expect(status.textContent).to.include('Rendering paused for this scene');
    expect(status.hasAttribute('role') || status.hasAttribute('aria-live')).to.equal(false);
    await waitUntil(() => [...document.querySelectorAll('[aria-live="assertive"]')].some(sink => sink.textContent?.includes('Rendering paused for this scene')));
  });
});
