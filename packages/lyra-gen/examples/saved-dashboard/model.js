/** Original fixture catalog: intentionally contains only literal document presentation. */
export const catalog = {
  id: 'saved-dashboard-example', version: '1',
  components: {
    stack: { tag: 'div', properties: {}, children: true },
    heading: { tag: 'h2', properties: {}, text: true },
    text: { tag: 'p', properties: {}, text: true },
  },
};

export function createDefinition(title) {
  return {
    format: 'lyra-dashboard', version: 1, title,
    view: {
      version: '1', catalog: { id: catalog.id, version: catalog.version },
      surfaceId: 'inventory-surface', revision: 0,
      root: { id: 'inventory', type: 'stack', children: [
        { id: 'heading', type: 'heading', text: title },
        { id: 'summary', type: 'text', text: 'Original sample inventory: 12 notebooks and 8 pens.' },
      ] },
    },
    dataSources: [{ id: 'inventory', source: 'sample-inventory' }],
  };
}
