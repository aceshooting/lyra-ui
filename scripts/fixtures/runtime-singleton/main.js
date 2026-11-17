import * as featureA from 'feature-a';
import * as featureB from 'feature-b';

const owners = { a: featureA, b: featureB };
const counts = { lower: 0, upper: 0 };
const modals = new Map();
let lower, lowerHandle, upper, external, releaseExternal;
const lowerOwner = new URL(location.href).searchParams.get('owner') ?? 'a';
const otherOwner = () => lowerOwner === 'a' ? 'b' : 'a';
if (!Object.hasOwn(owners, lowerOwner)) throw new Error('Unknown runtime owner');
const popoverClass = await owners[otherOwner()].loadPopover();
const opener = document.querySelector('#open-lower');

function openLower() {
  if (lowerHandle?.isActive()) return;
  lower?.remove();
  lower = document.createElement('section');
  lower.id = 'lower';
  lower.dataset.panel = '';
  lower.innerHTML = '<button id="lower-action">Lower action</button><lr-popover id="upper"><button id="open-upper" slot="trigger">Open upper overlay</button><button id="upper-action">Upper action</button></lr-popover>';
  document.body.append(lower);
  upper = lower.querySelector('#upper');
  upper.addEventListener('lr-after-hide', () => { counts.upper++; });
  lowerHandle = owners[lowerOwner].activateOverlay({
    host: lower, panel: () => lower, modal: false, trapFocus: false,
    restoreFocusTo: opener,
    onEscape: () => {
      counts.lower++;
      lowerHandle.deactivate();
      lower.hidden = true;
    },
  });
}
opener.addEventListener('click', openLower);

function openModal(owner, id) {
  const host = document.createElement('section');
  host.id = id;
  host.dataset.panel = '';
  host.dataset.modal = '';
  host.innerHTML = `<button id="${id}-first">First</button><button id="${id}-last">Last</button>`;
  document.body.append(host);
  const record = { host, handle: undefined, closes: 0 };
  modals.set(id, record);
  record.handle = owners[owner].activateOverlay({
    host, panel: () => host, modal: true, trapFocus: true, lockScroll: true,
    onEscape: () => { record.closes++; closeModal(id); },
  });
  record.handle.focusInitial();
}
function closeModal(id) {
  const record = modals.get(id);
  record.handle.deactivate();
  record.host.remove();
}

window.runtimeFixture = {
  sameUtility: featureA.activateOverlay === featureB.activateOverlay,
  ownership: {
    lower: lowerOwner, upper: otherOwner(),
    registeredPopoverMatches: customElements.get('lr-popover') === popoverClass,
  },
  snapshot: () => ({
    counts: { ...counts }, lowerOpen: lowerHandle?.isActive() ?? false,
    upperOpen: upper?.open ?? false, focused: document.activeElement?.id ?? '',
  }),
  preventNextEscape() {
    document.querySelector('#upper-action').addEventListener('keydown', event => {
      if (event.key === 'Escape') event.preventDefault();
    }, { once: true });
  },
  vetoNextHide() { upper.addEventListener('lr-hide', event => event.preventDefault(), { once: true }); },
  openModal, closeModal,
  modalState: () => ({
    backgroundInert: document.querySelector('#background').inert,
    authoredInert: document.querySelector('#authored-inert').inert,
    overflow: document.documentElement.style.getPropertyValue('overflow'),
    priority: document.documentElement.style.getPropertyPriority('overflow'),
    focused: document.activeElement?.id,
    active: [...modals].filter(([, record]) => record.handle.isActive()).map(([id]) => id),
    closes: Object.fromEntries([...modals].map(([id, record]) => [id, record.closes])),
  }),
  startExternal() {
    external = document.createElement('dialog');
    external.id = 'external';
    external.innerHTML = '<button id="external-action">External action</button>';
    document.body.append(external);
    releaseExternal = owners.b.suspendLyraModalsFor(external);
    external.showModal();
  },
  finishExternal() { external.close(); releaseExternal(); releaseExternal(); external.remove(); },
  async startNative(shadow) {
    await owners[otherOwner()].loadDialog();
    const container = document.createElement('section');
    container.id = 'native-container';
    document.body.append(container);
    const scope = shadow ? container.attachShadow({ mode: 'open' }) : container;
    const native = document.createElement('dialog');
    native.id = 'native-parent';
    native.innerHTML = '<button id="native-opener">Open details</button>';
    scope.append(native);
    const dialog = document.createElement('lr-dialog');
    dialog.id = 'details';
    dialog.label = 'Details';
    dialog.innerHTML = '<button id="details-action">Apply</button>';
    let clicks = 0;
    dialog.querySelector('button').addEventListener('click', () => { clicks++; });
    document.body.append(dialog);
    native.querySelector('button').addEventListener('click', () => { void dialog.show(); });
    native.showModal();
    window.runtimeFixture.nativeState = () => ({
      parentOpen: native.open, childOpen: dialog.open, clicks,
      focused: scope.activeElement?.id ?? document.activeElement?.id,
    });
  },
  openNativePopup() {
    const dialog = document.querySelector('#details');
    const host = document.createElement('section');
    host.id = 'native-popup';
    host.dataset.panel = '';
    host.innerHTML = '<button id="native-popup-action">Popup action</button>';
    dialog.append(host);
    const handle = featureA.activateOverlay({
      host, panel: () => host, modal: false, trapFocus: false,
      restoreFocusTo: dialog.querySelector('#details-action'),
      onEscape: () => { handle.deactivate(); host.remove(); },
    });
  },
  exerciseBothOwners() {
    for (let index = 0; index < 8; index++) {
      for (const owner of [lowerOwner, otherOwner()]) {
        const host = document.createElement('div');
        host.textContent = 'Transient overlay';
        document.body.append(host);
        const handle = owners[owner].activateOverlay({
          host, panel: () => host, modal: false, trapFocus: false,
          onEscape: () => { throw new Error('Diagnostics must not dispatch overlay callbacks'); },
        });
        handle.deactivate({ restoreFocus: false });
        host.remove();
      }
    }
  },
};
