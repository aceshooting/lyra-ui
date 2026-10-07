import assert from 'node:assert/strict';
import { paints } from './lib/harness.mjs';

/** Element contracts: deferred controls, session loss, steady toolbar, localization, landmarks, zoom and contained events. */
export async function runEditorContracts(page, check, { createEditor }) {
  const host = id => page.locator(`#${id}`);
  const remove = id => page.evaluate(id => document.getElementById(id)?.remove(), id);

  await check('opening registers the deferred controls and charts load their painter', async () => {
    const id = 'contracts-chart';
    await createEditor(page, id, 'chart');
    await page.waitForFunction(() => ['lr-checkbox', 'lr-color-picker', 'lr-lite-chart', 'lr-swatch-picker', 'lr-textarea']
      .every(name => customElements.get(name)));
    await host(id).locator('[part="chart"] lr-lite-chart:defined').first().waitFor();
    await remove(id);
  });

  await check('bulk ancestor mutations keep the session, and a lost session is reported', async () => {
    const id = 'contracts-loss';
    await createEditor(page, id);
    await host(id).locator('.docx-pages').click();
    await page.keyboard.insertText('Unsaved');
    await page.waitForFunction(id => document.getElementById(id).snapshot()?.dirty, id);
    assert.equal(await page.evaluate(async id => {
      const parent = document.getElementById(id).parentNode;
      for (let index = 0; index < 1100; index++) parent.append(Object.assign(document.createElement('span'), { className: 'bulk' }));
      await new Promise(resolve => setTimeout(resolve, 50));
      for (const node of parent.querySelectorAll(':scope > .bulk')) node.remove();
      await new Promise(resolve => setTimeout(resolve, 50));
      return document.getElementById(id).snapshot().status;
    }, id), 'ready');
    const lost = await host(id).evaluate(async element => {
      const errors = [];
      element.addEventListener('lr-error', event => errors.push(event.detail.code));
      const mount = element.querySelector('[slot="document"]');
      mount.remove(); element.prepend(mount);
      await new Promise(resolve => setTimeout(resolve, 50));
      await element.updateComplete;
      return { errors, status: element.snapshot()?.status, state: element.shadowRoot.querySelector('[part="state"]').textContent,
        error: element.shadowRoot.querySelector('[part="error"]')?.textContent ?? null };
    });
    assert.deepEqual(lost, { errors: ['destroyed'], status: 'destroyed',
      state: 'The editor was disconnected. Open the document again to continue.',
      error: 'The editor was disconnected. Open the document again to continue.' });
    await host(id).locator('[part="new-button"]').click();
    await page.waitForFunction(id => document.getElementById(id).snapshot()?.status === 'ready', id);
    assert.equal(await host(id).locator('[part="confirm"]').count(), 0);
    await remove(id);
  });

  await check('typing keeps formatting controls enabled and the remembered toolbar stop', async () => {
    const id = 'contracts-typing';
    await createEditor(page, id);
    await host(id).locator('.docx-pages').click();
    await page.keyboard.press('Alt+F10');
    await page.keyboard.press('ArrowRight');
    assert.equal(await host(id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('data-command')), 'italic');
    await page.keyboard.press('Escape');
    await host(id).evaluate(element => {
      window.__disabledFlips = 0;
      window.__flipObserver = new MutationObserver(records => { window.__disabledFlips += records.length; });
      for (const button of element.shadowRoot.querySelectorAll('[part="format-button"]:not([data-command="undo"])'))
        window.__flipObserver.observe(button, { attributes: true, attributeFilter: ['disabled'] });
    });
    await page.keyboard.type('steady');
    await page.waitForFunction(id => document.getElementById(id).snapshot()?.commands.bold.enabled, id);
    await paints(page);
    const result = await host(id).evaluate(element => {
      window.__flipObserver.disconnect();
      return { flips: window.__disabledFlips, italic: element.shadowRoot.querySelector('[data-command="italic"]').getAttribute('tabindex') };
    });
    assert.deepEqual(result, { flips: 0, italic: '0' });
    await remove(id);
  });

  await check('the locale property and later catalogs reach the editor strings', async () => {
    const label = id => host(id).evaluate(async element => {
      await element.updateComplete;
      return element.shadowRoot.querySelector('[part="new-button"]').getAttribute('aria-label');
    });
    await page.evaluate(() => {
      for (const [id, locale] of [['contracts-attribute', 'tlh'], ['contracts-property', null]]) {
        const element = document.createElement('lr-docx-editor');
        element.id = id;
        if (locale) element.setAttribute('locale', locale);
        document.querySelector('#fixture').append(element);
      }
    });
    assert.equal(await label('contracts-attribute'), 'New');
    await page.evaluate(() => window.__docxTest.registerLocale('tlh', { docxEditorNew: 'Late catalog new' }));
    await page.waitForFunction(() => document.getElementById('contracts-attribute').shadowRoot
      .querySelector('[part="new-button"]').getAttribute('aria-label') === 'Late catalog new');
    assert.equal(await host('contracts-property').evaluate(async element => {
      element.locale = 'tlh';
      await element.updateComplete;
      return element.shadowRoot.querySelector('[part="new-button"]').getAttribute('aria-label');
    }), 'Late catalog new');
    await remove('contracts-attribute');
    await remove('contracts-property');
  });

  await check('one named region, a distinct toolbar name and a described editing surface', async () => {
    const id = 'contracts-names';
    await createEditor(page, id);
    assert.deepEqual(await host(id).evaluate(element => {
      const root = element.shadowRoot, mount = element.querySelector('[slot="document"]'), documentPart = root.querySelector('[part="document"]');
      return { base: root.querySelector('[part="base"]').getAttribute('aria-label'),
        toolbar: root.querySelector('[part="toolbar"]').getAttribute('aria-label'),
        documentPart: ['role', 'tabindex', 'aria-label'].map(name => documentPart.getAttribute(name)), title: mount.getAttribute('title'),
        description: document.getElementById(mount.getAttribute('aria-describedby'))?.textContent ?? null };
    }), { base: 'Document editor', toolbar: 'Editing tools', documentPart: [null, null, null], title: null,
      description: 'Press Alt+F10 to reach the toolbar.' });
    await remove(id);
  });

  await check('an editor inside another shadow root names the placement problem', async () => {
    const result = await page.evaluate(async () => {
      const shell = document.createElement('div');
      document.querySelector('#fixture').append(shell);
      const element = document.createElement('lr-docx-editor');
      shell.attachShadow({ mode: 'open' }).append(element);
      const opened = await element.newDocument();
      await element.updateComplete;
      const text = element.shadowRoot.querySelector('[part="error"]')?.textContent ?? null;
      shell.remove();
      return { opened, text };
    });
    assert.deepEqual(result.opened, { ok: false, code: 'invalid-mount' });
    assert.match(result.text ?? '', /shadow root/u);
  });

  await check('the zoom select shows custom factors and the applied zoom', async () => {
    const id = 'contracts-zoom';
    await createEditor(page, id);
    assert.deepEqual(await host(id).evaluate(async element => {
      const select = element.shadowRoot.querySelector('[part="zoom"]'), shown = [];
      for (const zoom of [0.3, 10, 1]) {
        element.zoom = zoom;
        await element.updateComplete;
        shown.push(select.querySelector(`[value="${select.value}"]`) ? select.value : null);
      }
      return shown;
    }), ['0.3', '1', '1']);
    await remove(id);
  });

  await check('inner control events stay inside the editor', async () => {
    const id = 'contracts-events';
    await createEditor(page, id);
    await host(id).evaluate(element => {
      window.__escaped = [];
      window.__escapeListener = event => { if (event.composedPath()[0] !== element) window.__escaped.push(event.type); };
      for (const type of ['lr-input', 'lr-change', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide'])
        document.addEventListener(type, window.__escapeListener);
    });
    await host(id).locator('[part="find-toggle"]').click();
    await host(id).locator('[part="find-query"] input').fill('steady');
    await host(id).locator('[part="font-family"] input').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(id => document.getElementById(id).shadowRoot.querySelector('[part="font-family"]').open, id);
    await page.keyboard.press('Escape');
    await paints(page);
    assert.deepEqual(await page.evaluate(() => {
      for (const type of ['lr-input', 'lr-change', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide'])
        document.removeEventListener(type, window.__escapeListener);
      return window.__escaped;
    }), []);
    await remove(id);
  });
}
