import type { LyraGenCatalog } from '../../../src/types.js';

/** Catalog the versioned isolation corpus (`v1/`) is written against. */
export const isolationCatalog: LyraGenCatalog = {
  id: 'iso', version: '1',
  components: {
    row: { tag: 'div', properties: {}, children: true },
    list: { tag: 'ul', properties: {}, children: ['text'] },
    text: { tag: 'span', properties: { tone: { type: 'string', enum: ['a', 'b'] } }, text: true },
    card: { tag: 'section', properties: { title: { type: 'string' } }, required: ['title'], children: true, slots: ['aside'] },
    input: { tag: 'input', properties: { value: { type: 'string' }, label: { type: 'string' } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'input', property: 'value' } } },
    button: { tag: 'button', properties: {}, text: true, events: ['click'] },
    form: { tag: 'form', properties: {}, children: true }
  },
  actions: { save: { payload: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } } }
};
