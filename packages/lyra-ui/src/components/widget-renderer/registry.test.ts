import { expect } from '@open-wc/testing';
import { registerWidgetType, getDefaultWidgetTypeRegistry, clearWidgetTypes } from './registry.js';

describe('widget-renderer registry', () => {
  afterEach(() => clearWidgetTypes());

  it('registers and retrieves a type definition from the default registry', () => {
    registerWidgetType('sparkline', { tag: 'lyra-sparkline', props: { values: 'string' } });
    expect(getDefaultWidgetTypeRegistry().get('sparkline')).to.deep.equal({
      tag: 'lyra-sparkline',
      props: { values: 'string' },
    });
  });

  it('overwrites an existing registration for the same type', () => {
    registerWidgetType('x', { tag: 'lyra-a' });
    registerWidgetType('x', { tag: 'lyra-b' });
    expect(getDefaultWidgetTypeRegistry().get('x')!.tag).to.equal('lyra-b');
  });

  it('clearWidgetTypes() empties the default registry', () => {
    registerWidgetType('x', { tag: 'lyra-a' });
    clearWidgetTypes();
    expect(getDefaultWidgetTypeRegistry().size).to.equal(0);
  });
});
