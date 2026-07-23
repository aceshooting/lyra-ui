import { expect } from '@open-wc/testing';
import { adaptA2UiSurface } from './a2ui.js';

it('maps an A2UI-style component graph into a versioned allowlisted widget document', () => {
  const document = adaptA2UiSurface(
    {
      surfaceId: 'answer-card',
      rootId: 'root',
      components: [
        { id: 'root', type: 'Column', children: ['title', 'action'] },
        { id: 'title', type: 'Text', text: 'Grounded answer' },
        {
          id: 'action',
          type: 'Button',
          text: 'Open',
          action: { id: 'open-source', payload: { sourceId: 'doc-1' } },
        },
      ],
      data: { selected: 'doc-1' },
    },
    { Column: 'col', Text: 'text', Button: 'button' },
  );

  expect(document?.version).to.equal('1');
  expect(document?.root.type).to.equal('col');
  expect(document?.root.children).to.have.lengthOf(2);
  expect((document?.root.children?.[1] as { actionId?: string }).actionId).to.equal('open-source');
  expect(document?.state).to.deep.equal({ selected: 'doc-1' });
});

it('fails closed for unknown component types and dangling roots', () => {
  expect(adaptA2UiSurface(
    {
      rootId: 'root',
      components: [{ id: 'root', type: 'ArbitraryHtml', text: '<script>bad()</script>' }],
    },
    { Text: 'text' },
  )).to.equal(null);
  expect(adaptA2UiSurface({ rootId: 'missing', components: [] }, {})).to.equal(null);
});
