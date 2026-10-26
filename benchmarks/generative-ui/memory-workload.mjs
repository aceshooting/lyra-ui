export const MEMORY_PHASES = Object.freeze(['mounted', 'released', 'disposed', 'restored', 'restored-disposed']);
export const MAX_ARCHIVE_BYTES = 131072;
export const expectedNote = cycle => `Edited note ${String(cycle).padStart(4, '0')}`;
export const expectedData = cycle => `Cycle ${String(cycle).padStart(4, '0')}: 24 synthetic orders.`;
// Generate the transport in a short-lived call; a module-level full string would retain it.
export const memoryProse = () => 'Synthetic saved explanation 😀. '.repeat(1024);
export function memorySource(cycle) {
  return `${memoryProse()}\n\n\`\`\`lyra\n<stack id="answer"><heading id="heading">Saved session review</heading>`
    + `<text id="data">${expectedData(cycle)}</text>`
    + '<input id="note" label="Review note" value="Generated default" bindings={{"value":"/note"}} />'
    + '<button id="inspect" type="button" action={{"name":"inspect","payload":null}}>Inspect locally</button></stack>\n```\nSaved interface complete.';
}
