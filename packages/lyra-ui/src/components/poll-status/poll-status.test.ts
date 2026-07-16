import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './poll-status.js';
import '../live-region/live-region.js';
import type { LyraPollStatus } from './poll-status.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import { styles } from './poll-status.styles.js';

function liveRegionText(el: LyraPollStatus): string {
  const region = el.shadowRoot!.querySelector('lyra-live-region') as LyraLiveRegion;
  return region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
}

describe('lyra-poll-status', () => {
  it('ticks down the countdown display and reaches the due phase, firing lyra-poll-due', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="40"></lyra-poll-status>`)) as LyraPollStatus;
    await oneEvent(el, 'lyra-poll-due');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');
  });

  it('pauses on the built-in pause button, suppressing lyra-poll-due, and announces the transition', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="10000"></lyra-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    const pauseButton = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
    setTimeout(() => pauseButton.click());
    await oneEvent(el, 'lyra-pause-change');
    expect(el.paused).to.be.true;
    await aTimeout(50);
    expect(liveRegionText(el)).to.include('Paused');
  });

  it('does not tick or fire lyra-poll-due while paused', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="40" paused></lyra-poll-status>`)) as LyraPollStatus;
    let fired = false;
    el.addEventListener('lyra-poll-due', () => (fired = true));
    await aTimeout(150);
    expect(fired).to.be.false;
  });

  it('never arms the ticker (and never fires a spurious lyra-poll-due) when mounted with no next-in-ms scheduled', async () => {
    // Regression test: connectedCallback() used to unconditionally arm the
    // ticker whenever active && !paused -- true by default -- even though
    // targetAt is still its 0 default when next-in-ms was never set. The
    // very first tick then saw targetAt - Date.now() <= 0 and immediately
    // fired lyra-poll-due for a countdown that never actually ran.
    const el = (await fixture(html`<lyra-poll-status></lyra-poll-status>`)) as LyraPollStatus;
    let fired = false;
    el.addEventListener('lyra-poll-due', () => (fired = true));
    await aTimeout(1150); // outlives one full tick interval (1000ms)
    expect(fired, 'no countdown was ever started, so due can never legitimately be reached').to.be.false;
    expect(el.shadowRoot!.querySelector('[part="indicator"]')!.hasAttribute('data-due')).to.be.false;
  });

  it('disarms the ticker when next-in-ms is cleared, instead of leaving a stale deadline running', async () => {
    // Regression test: updated() only reacted to nextInMs becoming non-null;
    // clearing it left the ticker armed for the previous deadline still
    // running in the background, eventually firing a stale lyra-poll-due
    // (and flipping the indicator's data-due) even though [part='countdown']
    // already renders nothing once next-in-ms is unset.
    const el = (await fixture(html`<lyra-poll-status next-in-ms="40"></lyra-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.nextInMs = undefined;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('');

    let fired = false;
    el.addEventListener('lyra-poll-due', () => (fired = true));
    await aTimeout(150);
    expect(fired, 'clearing next-in-ms should stop the ticker armed for the previous deadline').to.be.false;
    expect(el.shadowRoot!.querySelector('[part="indicator"]')!.hasAttribute('data-due')).to.be.false;
  });

  it('freezes the countdown and suppresses lyra-poll-due while active is set to false', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="40"></lyra-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.active = false;
    await el.updateComplete;

    let fired = false;
    el.addEventListener('lyra-poll-due', () => (fired = true));
    await aTimeout(150); // outlives the original 40ms deadline
    expect(fired, 'no tick should run while inactive, so due can never be reached').to.be.false;
  });

  it('resumes ticking toward the existing deadline once active is toggled back to true', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="60"></lyra-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.active = false;
    await el.updateComplete;
    el.active = true;
    await el.updateComplete;

    await oneEvent(el, 'lyra-poll-due');
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');
  });

  it('clears the running interval on disconnect, so a removed element never fires a late lyra-poll-due', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="40"></lyra-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lyra-poll-due', () => (fired = true));
    el.remove();
    await aTimeout(150);
    expect(fired, 'disarmTicker() should have run in disconnectedCallback').to.be.false;
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="10000"></lyra-poll-status>`)) as LyraPollStatus;
    await expect(el).to.be.accessible();
  });

  it('defaults to English "Pause"/"Resume" aria-labels when no strings override is set', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="10000"></lyra-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    const pauseButton = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
    expect(pauseButton.getAttribute('aria-label')).to.equal('Pause');
    el.paused = true;
    await el.updateComplete;
    expect(pauseButton.getAttribute('aria-label')).to.equal('Resume');
  });

  it('localizes the pause-button aria-label via this.localize()', async () => {
    const el = (await fixture(
      html`<lyra-poll-status
        next-in-ms="10000"
        .strings=${{ pollPause: 'Interrompre', pollResume: 'Reprendre' }}
      ></lyra-poll-status>`,
    )) as LyraPollStatus;
    await el.updateComplete;
    const pauseButton = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
    expect(pauseButton.getAttribute('aria-label')).to.equal('Interrompre');
    el.paused = true;
    await el.updateComplete;
    expect(pauseButton.getAttribute('aria-label')).to.equal('Reprendre');
  });

  it('localizes the due-state countdown text via this.localize()', async () => {
    const el = (await fixture(
      html`<lyra-poll-status next-in-ms="40" .strings=${{ pollRefreshing: 'Actualisation…' }}></lyra-poll-status>`,
    )) as LyraPollStatus;
    await oneEvent(el, 'lyra-poll-due');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('Actualisation…');
  });

  it('localizes the pause/resume live-region announcements via this.localize()', async () => {
    const el = (await fixture(
      html`<lyra-poll-status
        next-in-ms="10000"
        .strings=${{ pollPausedAnnounce: 'Interrompu.', pollResumedAnnounce: 'Repris.' }}
      ></lyra-poll-status>`,
    )) as LyraPollStatus;
    await el.updateComplete;
    el.paused = true;
    await el.updateComplete;
    expect(liveRegionText(el)).to.equal('Interrompu.');
    el.paused = false;
    await el.updateComplete;
    expect(liveRegionText(el)).to.equal('Repris.');
  });

  it('localizes the due live-region announcement via this.localize()', async () => {
    const el = (await fixture(
      html`<lyra-poll-status
        next-in-ms="40"
        .strings=${{ pollRefreshingAnnounce: 'Actualisation en cours.' }}
      ></lyra-poll-status>`,
    )) as LyraPollStatus;
    await oneEvent(el, 'lyra-poll-due');
    await el.updateComplete;
    expect(liveRegionText(el)).to.equal('Actualisation en cours.');
  });

  it('shows a distinct "Paused" countdown text instead of a frozen value while paused', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="10000"></lyra-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    el.paused = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('Paused');
  });

  it('localizes the paused countdown text via this.localize()', async () => {
    const el = (await fixture(
      html`<lyra-poll-status next-in-ms="10000" .strings=${{ pollPaused: 'En pause' }}></lyra-poll-status>`,
    )) as LyraPollStatus;
    await el.updateComplete;
    el.paused = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.equal('En pause');
  });

  it('uses the ambient transition token for its looping pulse animation', async () => {
    const el = (await fixture(html`<lyra-poll-status></lyra-poll-status>`)) as LyraPollStatus;
    const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
    expect(getComputedStyle(indicator).animationDuration).to.equal('1.8s');
  });

  it('gives the pause button a :hover treatment, matching lyra-widget\'s collapse/fullscreen buttons', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='pause-button'\]:hover\s*\{[^}]+\}/);
  });
});
