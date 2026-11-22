import { expect, fixture, html } from '@open-wc/testing';
import './components/lr-dialog.js';
import './components/lr-switch.js';
import type { LyraDialog } from './components/lr-dialog.js';
import type { LyraSwitch } from './components/lr-switch.js';
import * as eventClasses from './event-classes.js';
import { LyraCloseRequestEvent, LyraChangeEvent, LyraEvent, LyraSortEvent } from './event-classes.js';
import { LyraElement } from './internal/lyra-element.js';

class Emitter extends LyraElement<{ 'lr-sort': CustomEvent<{ step: number }> }> {
  fire(): Event {
    return this.emit('lr-sort', { step: 2 });
  }
}
customElements.define('lr-event-class-probe', Emitter);

describe('per-event classes', () => {
  it('recognise the events components dispatch, by event name', async () => {
    const toggle = await fixture<LyraSwitch>(html`<lr-switch></lr-switch>`);
    const seen: Event[] = [];
    toggle.addEventListener('lr-change', (event) => seen.push(event));
    toggle.click();
    await toggle.updateComplete;

    expect(seen.length).to.equal(1);
    const event = seen[0]!;
    expect(event instanceof LyraChangeEvent).to.equal(true);
    expect(event instanceof LyraEvent).to.equal(true);
    expect(event instanceof CustomEvent).to.equal(true);
    expect(event instanceof LyraSortEvent).to.equal(false);
    expect(event.bubbles && event.composed).to.equal(true);
  });

  it('keep cancelable and defaultPrevented semantics', async () => {
    const dialog = await fixture<LyraDialog>(html`<lr-dialog open>Body</lr-dialog>`);
    let request: Event | undefined;
    dialog.addEventListener('lr-close-request', (event) => {
      request = event;
      event.preventDefault();
    });
    dialog.close('api');
    expect(request instanceof LyraCloseRequestEvent).to.equal(true);
    expect(request!.cancelable).to.equal(true);
    expect(request!.defaultPrevented).to.equal(true);
    expect(dialog.open).to.equal(true);

    const noisy = await fixture<Emitter>(html`<lr-event-class-probe></lr-event-class-probe>`);
    const event = noisy.fire();
    expect(event instanceof LyraSortEvent).to.equal(true);
    expect(event.cancelable).to.equal(false);
    expect((event as CustomEvent<{ step: number }>).detail).to.deep.equal({ step: 2 });
  });

  it('construct real events a consumer can dispatch and match', () => {
    const made = new LyraSortEvent({ step: 3 } as never, { cancelable: true });
    expect(made.type).to.equal('lr-sort');
    expect(made.bubbles && made.composed && made.cancelable).to.equal(true);
    expect(made instanceof LyraSortEvent).to.equal(true);
    expect(made instanceof LyraChangeEvent).to.equal(false);
    expect(new Event('lr-sort') instanceof LyraSortEvent).to.equal(false);
    expect(new CustomEvent('lr-sort') instanceof LyraSortEvent).to.equal(false);
  });

  it('construct every exported class as its own named, bubbling event and match only that name', () => {
    type EventClass = (new (detail: unknown, options?: { cancelable?: boolean }) => CustomEvent) & {
      eventName?: string;
    };
    const classes = (Object.entries(eventClasses) as unknown as [string, EventClass][])
      .filter(([, value]) => value !== (LyraEvent as unknown) && typeof value === 'function');
    expect(classes.length).to.be.greaterThan(400);
    const failures: string[] = [];
    const names = new Set<string>();
    classes.forEach(([exportName, EventClass], index) => {
      const name = EventClass.eventName ?? '';
      const words = name.replace(/^lr-/, '').split('-').map((word) => word[0]!.toUpperCase() + word.slice(1));
      const detail = { index };
      const event = new EventClass(detail, { cancelable: index % 2 === 0 });
      const other = classes[(index + 1) % classes.length]![1];
      if (exportName !== `Lyra${words.join('')}Event`) failures.push(`${exportName}: name ${name}`);
      if (event.type !== name) failures.push(`${exportName}: type ${event.type}`);
      if (!(event instanceof EventClass) || !(event instanceof LyraEvent)) failures.push(`${exportName}: instanceof`);
      if (event instanceof other) failures.push(`${exportName}: matched ${other.eventName}`);
      if (!event.bubbles || !event.composed || event.cancelable !== (index % 2 === 0)) {
        failures.push(`${exportName}: flags`);
      }
      if (event.detail !== detail) failures.push(`${exportName}: detail`);
      names.add(name);
    });
    expect(failures).to.deep.equal([]);
    expect(names.size).to.equal(classes.length);
  });

  it('still match events created for an element adopted into another window', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const el = await fixture<Emitter>(html`<lr-event-class-probe></lr-event-class-probe>`);
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      const event = el.fire();
      expect(event instanceof frame.contentWindow!.CustomEvent).to.equal(true);
      expect(event instanceof LyraSortEvent).to.equal(true);
      expect(event instanceof LyraChangeEvent).to.equal(false);
    } finally {
      frame.remove();
    }
  });
});
