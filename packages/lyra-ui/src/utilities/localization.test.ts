import { expect, fixture, html } from '@open-wc/testing';
import { bridgeLyraLocale, subscribeLyraLocale } from './localization.js';
import { getLyraLocale, registerLyraLocale, setLyraLocale } from '../internal/localization.js';

/** Restores the module-global active locale after each case; it is shared by the whole file. */
function withActiveLocale(body: () => void): void {
  const previous = getLyraLocale();
  try {
    body();
  } finally {
    setLyraLocale(previous);
  }
}

async function host(): Promise<HTMLElement> {
  return fixture<HTMLElement>(html`<div></div>`);
}

it('exposes the active-locale subscription, which is not the registry subscription', () => {
  withActiveLocale(() => {
    setLyraLocale('');
    let calls = 0;
    const unsubscribe = subscribeLyraLocale(() => {
      calls += 1;
    });
    try {
      setLyraLocale('x-bridge-subscribe');
      expect(calls).to.equal(1);
    } finally {
      unsubscribe();
    }
    setLyraLocale('x-bridge-subscribe-2');
    expect(calls, 'the disposer must stop further notifications').to.equal(1);
  });
});

describe('bridgeLyraLocale', () => {
  it('mirrors the canonical public BCP-47 spelling chosen by setLyraLocale', async () => {
    const el = await host();
    withActiveLocale(() => {
      setLyraLocale('  PT_BR  ');
      const stop = bridgeLyraLocale({ target: el });
      try {
        expect(el.getAttribute('lang')).to.equal('pt-BR');
      } finally {
        stop();
      }
    });
  });

  it('mirrors the active locale onto lang and dir, and keeps mirroring on later changes', async () => {
    const el = await host();
    withActiveLocale(() => {
      registerLyraLocale('x-bridge-rtl', { close: 'x' }, { dir: 'rtl' });
      setLyraLocale('en');
      const stop = bridgeLyraLocale({ target: el });
      try {
        expect(el.getAttribute('lang')).to.equal('en');
        expect(el.getAttribute('dir')).to.equal('ltr');

        setLyraLocale('x-bridge-rtl');
        expect(el.getAttribute('lang')).to.equal('x-bridge-rtl');
        expect(el.getAttribute('dir')).to.equal('rtl');
      } finally {
        stop();
      }
    });
  });

  it('restores the prior lang and dir on dispose, including their absence', async () => {
    const el = await host();
    withActiveLocale(() => {
      setLyraLocale('en');
      const stop = bridgeLyraLocale({ target: el });
      expect(el.hasAttribute('lang')).to.equal(true);
      stop();
      expect(el.hasAttribute('lang'), 'an absent attribute must come back absent').to.equal(false);
      expect(el.hasAttribute('dir')).to.equal(false);
    });
  });

  it('restores authored values rather than removing them', async () => {
    const el = await host();
    el.setAttribute('lang', 'de');
    el.setAttribute('dir', 'ltr');
    withActiveLocale(() => {
      setLyraLocale('en');
      const stop = bridgeLyraLocale({ target: el });
      expect(el.getAttribute('lang')).to.equal('en');
      stop();
      expect(el.getAttribute('lang')).to.equal('de');
      expect(el.getAttribute('dir')).to.equal('ltr');
    });
  });

  it('is idempotent on repeated dispose', async () => {
    const el = await host();
    el.setAttribute('lang', 'de');
    withActiveLocale(() => {
      setLyraLocale('en');
      const stop = bridgeLyraLocale({ target: el });
      stop();
      el.setAttribute('lang', 'fr');
      stop();
      expect(el.getAttribute('lang'), 'a second dispose must not re-restore').to.equal('fr');
    });
  });

  it('shares ownership across nested handles and restores only after the last out-of-order release', async () => {
    const el = await host();
    el.setAttribute('lang', 'de');
    el.setAttribute('dir', 'ltr');
    withActiveLocale(() => {
      setLyraLocale('x-bridge-nested');
      const stopOlder = bridgeLyraLocale({ target: el });
      const stopNewer = bridgeLyraLocale({ target: el });
      const activeDirection = el.getAttribute('dir');

      stopOlder();
      expect(el.getAttribute('lang'), 'the newer owner must keep the active locale applied').to.equal('x-bridge-nested');
      expect(el.getAttribute('dir')).to.equal(activeDirection);

      setLyraLocale('x-bridge-nested-next');
      expect(el.getAttribute('lang'), 'the shared subscription remains live for the surviving owner').to.equal('x-bridge-nested-next');

      stopNewer();
      expect(el.getAttribute('lang')).to.equal('de');
      expect(el.getAttribute('dir')).to.equal('ltr');
    });
  });

  it('also releases safely in newest-first order', async () => {
    const el = await host();
    withActiveLocale(() => {
      setLyraLocale('en');
      const stopOlder = bridgeLyraLocale({ target: el });
      const stopNewer = bridgeLyraLocale({ target: el });
      stopNewer();
      expect(el.getAttribute('lang')).to.equal('en');
      stopOlder();
      expect(el.hasAttribute('lang')).to.equal(false);
      expect(el.hasAttribute('dir')).to.equal(false);
    });
  });

  it('mirrors direction while any owner requests it and restores authored dir for direction-false survivors', async () => {
    const el = await host();
    el.setAttribute('dir', 'ltr');
    withActiveLocale(() => {
      registerLyraLocale('x-bridge-mixed-direction', { close: 'x' }, { dir: 'rtl' });
      setLyraLocale('x-bridge-mixed-direction');
      const stopLangOnly = bridgeLyraLocale({ target: el, direction: false });
      expect(el.getAttribute('dir')).to.equal('ltr');
      const stopDirection = bridgeLyraLocale({ target: el });
      expect(el.getAttribute('dir')).to.equal('rtl');

      stopDirection();
      expect(el.getAttribute('lang')).to.equal('x-bridge-mixed-direction');
      expect(el.getAttribute('dir'), 'the remaining lang-only owner must not retain a stale bridged direction').to.equal('ltr');
      stopLangOnly();
      expect(el.getAttribute('dir')).to.equal('ltr');
    });
  });

  it('leaves the authored lang alone while no locale is active, and again once it is cleared', async () => {
    const el = await host();
    el.setAttribute('lang', 'de');
    withActiveLocale(() => {
      setLyraLocale('');
      const stop = bridgeLyraLocale({ target: el });
      try {
        expect(el.getAttribute('lang'), 'no active locale means nothing to mirror').to.equal('de');

        setLyraLocale('en');
        expect(el.getAttribute('lang')).to.equal('en');

        setLyraLocale('');
        expect(el.getAttribute('lang'), 'clearing the locale restores the authored value').to.equal('de');
      } finally {
        stop();
      }
    });
  });

  it('leaves dir untouched when direction mirroring is opted out', async () => {
    const el = await host();
    el.setAttribute('dir', 'rtl');
    withActiveLocale(() => {
      setLyraLocale('en');
      const stop = bridgeLyraLocale({ target: el, direction: false });
      try {
        expect(el.getAttribute('lang')).to.equal('en');
        expect(el.getAttribute('dir')).to.equal('rtl');
      } finally {
        stop();
      }
    });
  });

  it('refreshes direction when the active catalog arrives but ignores unrelated registrations', async () => {
    const el = await host();
    withActiveLocale(() => {
      const active = 'x-bridge-lazy-active';
      setLyraLocale(active);
      const originalSetAttribute = el.setAttribute.bind(el);
      let bridgeWrites = 0;
      el.setAttribute = ((name: string, value: string) => {
        if (name === 'lang' || name === 'dir') bridgeWrites += 1;
        originalSetAttribute(name, value);
      }) as typeof el.setAttribute;
      const stop = bridgeLyraLocale({ target: el });
      try {
        bridgeWrites = 0;
        registerLyraLocale('x-bridge-unrelated-catalog', { close: 'unrelated' }, { dir: 'rtl' });
        expect(bridgeWrites).to.equal(0);

        registerLyraLocale(active, { close: 'active' }, { dir: 'rtl' });
        expect(el.getAttribute('dir')).to.equal('rtl');
        expect(bridgeWrites).to.be.greaterThan(0);
      } finally {
        stop();
        el.setAttribute = originalSetAttribute;
      }
    });
  });

  it('defaults its target to the document element', () => {
    withActiveLocale(() => {
      setLyraLocale('x-bridge-default-target');
      const stop = bridgeLyraLocale();
      try {
        expect(document.documentElement.getAttribute('lang')).to.equal('x-bridge-default-target');
      } finally {
        stop();
      }
    });
  });

  it('rejects a target that is not an element', () => {
    expect(() => bridgeLyraLocale({ target: {} as Element })).to.throw(TypeError);
  });
});
