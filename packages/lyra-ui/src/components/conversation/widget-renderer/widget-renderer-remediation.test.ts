import { fixture, expect, oneEvent } from '@open-wc/testing';
import { MalformedTreeFailsClosed } from './widget-renderer.stories.js';
import type { LyraWidgetRenderer } from './widget-renderer.js';
import { createWidgetDocument, resolveTree, type ResolveContext } from './resolve.js';
import { createWidgetTypeRegistry } from './registry.js';

describe('widget renderer untrusted input example', () => {
  it('sends malformed input through the renderer while keeping the authoring factory strict', async () => {
    const root = await fixture<HTMLElement>(MalformedTreeFailsClosed.render!({}, null as never));
    const renderer = root.querySelector<LyraWidgetRenderer>('lr-widget-renderer')!;
    await renderer.updateComplete;
    expect(renderer.shadowRoot!.querySelectorAll('lr-stat').length).to.equal(1);
    const error = oneEvent(renderer, 'lr-render-error');
    root.querySelector<HTMLButtonElement>('button')!.click();
    await renderer.updateComplete;
    expect(renderer.shadowRoot!.querySelectorAll('lr-stat').length).to.equal(0);
    await error;
    expect(root.querySelector('output')!.textContent).to.equal('Malformed tree rejected');
    expect(() => createWidgetDocument({ type: 'row', children: [null] } as never)).to.throw();
  });
});

describe('widget resolver authoring diagnostics', () => {
  for (const development of [false, true]) {
    it(`keeps default diagnostics ${development ? 'visible in development' : 'silent in production'}`, () => {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'litIssuedWarnings');
      const warn = console.warn;
      const messages: string[] = [];
      try {
        if (development) Object.defineProperty(globalThis, 'litIssuedWarnings', { configurable: true, value: new Set<string>() });
        else Reflect.deleteProperty(globalThis, 'litIssuedWarnings');
        console.warn = (...values: unknown[]) => { messages.push(values.map(String).join(' ')); };
        const context: ResolveContext = { registry: createWidgetTypeRegistry([]), bindingState: {}, warned: new Set() };
        resolveTree({ type: 'unknown-example' }, context);
        resolveTree({ type: 'unknown-example' }, context);
        expect(messages.length).to.equal(development ? 1 : 0);
        const expert: string[] = [];
        context.warn = (message) => expert.push(message);
        context.warned.clear();
        resolveTree({ type: 'unknown-example' }, context);
        resolveTree({ type: 'unknown-example' }, context);
        expect(expert.length).to.equal(1);
        context.warned.clear();
        resolveTree({ type: 'unknown-example' }, context);
        expect(expert.length).to.equal(2);
      } finally {
        console.warn = warn;
        if (descriptor) Object.defineProperty(globalThis, 'litIssuedWarnings', descriptor);
        else Reflect.deleteProperty(globalThis, 'litIssuedWarnings');
      }
    });
  }
});
