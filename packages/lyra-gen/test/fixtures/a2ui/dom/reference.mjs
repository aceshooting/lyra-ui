import { MessageProcessor } from '@a2ui/web_core/v0_9';
import { basicCatalog } from '@a2ui/lit-basic';
import '@a2ui/lit-surface';

let processor;
let host;
let surfaceId;
const actions = [];
async function render() {
  host.surface = processor.model.getSurface(surfaceId);
  await host.updateComplete;
  for (let pass = 0; pass < 3; pass++) {
    await Promise.all([...document.querySelectorAll('*')].map(element => element.updateComplete));
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}
window.fixture = {
  actions,
  async mount(messages) {
    processor = new MessageProcessor([basicCatalog], action => actions.push(action));
    surfaceId = messages[0].createSurface.surfaceId;
    for (const message of messages) processor.processMessages(message);
    host = document.createElement('a2ui-surface');
    document.querySelector('main').append(host); await render();
  },
  async update(messages) { for (const message of messages) processor.processMessages(message); await render(); },
};
