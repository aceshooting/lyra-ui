import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import { defineElement } from './prefix.js';
import { AnchoredDisclosureController } from './anchored-disclosure-controller.js';
import { anchoredPopupSettle } from './overlay-surface.styles.js';
import { settleOverlayTransition } from './overlay-shared.js';
import { settlePopupTransition } from './anchored-overlay-runtime.js';

class DisclosureProbe extends LyraElement {
  static override styles = [LyraElement.styles, anchoredPopupSettle];
  @property({ type: Boolean, reflect: true }) open = false;
  log: string[] = [];
  vetoNext = new Set<string>();
  placed = true;
  popupHidden = true;
  animateImpl: (showing: boolean, popup: HTMLElement) => Animation | undefined = () => undefined;
  readonly disclosure = new AnchoredDisclosureController({
    host: this,
    isOpen: () => this.open,
    setOpen: (next) => { this.open = next; if (next) this.popupHidden = false; },
    emit: (name, cancelable) => {
      this.log.push(name);
      return cancelable && this.vetoNext.delete(name);
    },
    popup: () => this.renderRoot.querySelector<HTMLElement>('[part~="popup"]'),
    animate: (showing, popup) => this.animateImpl(showing, popup),
    readyToShow: async () => this.placed,
    afterHide: () => { this.popupHidden = true; this.requestUpdate(); },
  });

  override render() {
    return litHtml`<div part="popup" ?hidden=${this.popupHidden} ?data-hidden=${!this.open}>x</div>`;
  }
}
defineElement('disclosure-probe', DisclosureProbe);

const make = () => fixture<DisclosureProbe>(html`<lr-disclosure-probe></lr-disclosure-probe>`);

describe('AnchoredDisclosureController', () => {
  it('emits lr-show, opens, then settles with lr-after-show', async () => {
    const host = await make();
    await host.disclosure.show();
    expect(host.open).to.equal(true);
    expect(host.log).to.deep.equal(['lr-show', 'lr-after-show']);
  });

  it('settles a hide: data-closing during the exit, cleared and concealed before lr-after-hide', async () => {
    const host = await make();
    await host.disclosure.show();
    host.log.length = 0;
    let closingDuringExit: boolean | undefined;
    host.animateImpl = () => {
      closingDuringExit = host.hasAttribute('data-closing');
      return undefined;
    };
    await host.disclosure.hide();
    expect(host.open).to.equal(false);
    expect(closingDuringExit).to.equal(true);
    expect(host.hasAttribute('data-closing')).to.equal(false);
    expect(host.popupHidden).to.equal(true);
    expect(host.log).to.deep.equal(['lr-hide', 'lr-after-hide']);
  });

  it('a vetoed show keeps the host closed, re-syncs the attribute and skips the after-event', async () => {
    const host = await make();
    host.vetoNext.add('lr-show');
    await host.disclosure.show();
    expect(host.open).to.equal(false);
    expect(host.hasAttribute('open')).to.equal(false);
    expect(host.log).to.deep.equal(['lr-show']);
  });

  it('refuse() after the event also leaves it closed', async () => {
    const host = await make();
    await host.disclosure.show(() => true);
    expect(host.open).to.equal(false);
    expect(host.log).to.deep.equal(['lr-show']);
  });

  it('a vetoed hide keeps the host open and the attribute in sync', async () => {
    const host = await make();
    await host.disclosure.show();
    host.log.length = 0;
    host.vetoNext.add('lr-hide');
    await host.disclosure.hide();
    expect(host.open).to.equal(true);
    expect(host.hasAttribute('open')).to.equal(true);
    expect(host.log).to.deep.equal(['lr-hide']);
  });

  it('forceClose cannot be vetoed and emits only the after-event', async () => {
    const host = await make();
    await host.disclosure.show();
    host.log.length = 0;
    host.vetoNext.add('lr-hide');
    await host.disclosure.forceClose();
    expect(host.open).to.equal(false);
    expect(host.log).to.deep.equal(['lr-after-hide']);
    host.vetoNext.clear();
  });

  it('a re-entrant same-direction show from a listener shares one completion', async () => {
    const host = await make();
    let inner: Promise<void> | undefined;
    const original = host.disclosure.show.bind(host.disclosure);
    host.vetoNext = new Set();
    const emit = host.log.push.bind(host.log);
    host.log.push = (...items: string[]) => {
      if (items[0] === 'lr-show' && !inner) inner = original();
      return emit(...items);
    };
    const outer = host.disclosure.show();
    await outer;
    expect(inner).to.equal(outer);
    expect(host.log.filter((name) => name === 'lr-show')).to.have.length(1);
  });

  it('hiding right after showing supersedes the show: no stale lr-after-show', async () => {
    const host = await make();
    const shown = host.disclosure.show();
    const hidden = host.disclosure.hide();
    await Promise.all([shown, hidden]);
    expect(host.open).to.equal(false);
    expect(host.log).to.not.include('lr-after-show');
    expect(host.log.at(-1)).to.equal('lr-after-hide');
  });

  it('placement failure keeps the reveal from settling', async () => {
    const host = await make();
    host.placed = false;
    await host.disclosure.show();
    expect(host.log).to.deep.equal(['lr-show']);
  });

  it('with motion disabled (no animation) the lifecycle still settles', async () => {
    const host = await make();
    host.animateImpl = () => undefined;
    await host.disclosure.show();
    expect(host.log).to.include('lr-after-show');
  });

  it('waits for the host animation before settling and cancels it afterwards', async () => {
    const host = await make();
    await host.disclosure.show();
    host.log.length = 0;
    let animation: Animation | undefined;
    host.animateImpl = (_showing, popup) => {
      animation = popup.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80 });
      return animation;
    };
    const hidden = host.disclosure.hide();
    expect(host.log).to.deep.equal(['lr-hide']);
    await hidden;
    expect(animation!.playState).to.equal('idle');
    expect(host.log).to.deep.equal(['lr-hide', 'lr-after-hide']);
  });

  it('a disconnect resets the exit state and orphans a pending settle', async () => {
    const host = await make();
    await host.disclosure.show();
    host.log.length = 0;
    const hiding = host.disclosure.hide();
    host.remove();
    await hiding;
    expect(host.hasAttribute('data-closing')).to.equal(false);
    expect(host.log).to.not.include('lr-after-hide');
  });

  it('the settle style fragment paints hidden, concealed and exiting popups', async () => {
    const host = await make();
    const popup = host.renderRoot.querySelector<HTMLElement>('[part~="popup"]')!;
    expect(getComputedStyle(popup).display).to.equal('none');
    await host.disclosure.show();
    await waitUntil(() => !popup.hidden);
    expect(getComputedStyle(popup).visibility).to.equal('visible');
    host.popupHidden = false;
    host.open = false;
    await host.updateComplete;
    expect(getComputedStyle(popup).visibility).to.equal('hidden');
    host.setAttribute('data-closing', '');
    expect(getComputedStyle(popup).visibility).to.equal('visible');
  });
});

describe('settle abstraction', () => {
  it('settleOverlayTransition runs the popup ordering: render, place, animate, conceal, settle', async () => {
    const steps: string[] = [];
    const ready = () => Promise.resolve();
    await settleOverlayTransition({
      showing: true,
      updateComplete: () => { steps.push('update'); return ready(); },
      isCurrent: () => true,
      readyToShow: async () => { steps.push('place'); return true; },
      animate: async () => { steps.push('animate'); },
      afterHide: () => steps.push('afterHide'),
      settled: () => steps.push('settled'),
    });
    expect(steps).to.deep.equal(['update', 'place', 'update', 'animate', 'settled']);
    steps.length = 0;
    await settleOverlayTransition({
      showing: false,
      updateComplete: () => { steps.push('update'); return ready(); },
      isCurrent: () => true,
      readyToShow: async () => { steps.push('place'); return true; },
      animate: async () => { steps.push('animate'); },
      afterHide: () => steps.push('afterHide'),
      settled: () => steps.push('settled'),
    });
    expect(steps).to.deep.equal(['update', 'animate', 'afterHide', 'update', 'settled']);
  });

  it('a superseded transition stops at the next checkpoint', async () => {
    let current = true;
    const steps: string[] = [];
    await settlePopupTransition({
      host: { updateComplete: Promise.resolve() },
      isCurrent: () => current,
      animate: async () => { current = false; },
      conceal: () => steps.push('conceal'),
      onSettled: () => steps.push('settled'),
    });
    expect(steps).to.deep.equal([]);
  });
});
