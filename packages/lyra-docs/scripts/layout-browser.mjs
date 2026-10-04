import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import assert from 'node:assert/strict';
import { zipEntry } from '../test/zip.mjs';

export async function runEditorLayout(page, check, { createEditor, saveEditor }) {
  await page.evaluate(() => document.querySelector('#fixture').replaceChildren());
  await createEditor(page, 'layout');
  const editor = page.locator('#layout');
  await editor.locator('.docx-pages').click();
  await page.keyboard.insertText('Readable document text');
  await page.waitForFunction(() => document.getElementById('layout').snapshot()?.revision?.value > 0);
  const entries = unzipSync(Uint8Array.from(await saveEditor(page, 'layout')));
  entries['word/document.xml'] = strToU8(strFromU8(entries['word/document.xml']).replace('<w:r>', '<w:r><w:rPr><w:color w:val="000000"/></w:rPr>'));
  assert.equal(await editor.evaluate(async (element, bytes) => (await element.open(Uint8Array.from(bytes), { discardChanges: true })).ok, [...zipSync(entries)]), true);
  const before = zipEntry(await saveEditor(page, 'layout'), 'word/document.xml');
  assert.match(before, /w:color[^>]*w:val="000000"/u);
  await check('populated white paper survives dark chrome without changing authored black text', async () => {
    for (const theme of ['light', 'dark']) {
      await editor.evaluate(async (element, theme) => { element.setAttribute('data-lr-theme', theme); await element.updateComplete; }, theme);
      const colors = await editor.evaluate(element => {
        const page = element.querySelector('.docx-page');
        const text = [...page.querySelectorAll('span')].find(span => span.textContent.includes('Readable'));
        return { paper: getComputedStyle(page).backgroundColor, text: getComputedStyle(text).color,
          width: page.getBoundingClientRect().width };
      });
      assert.equal(colors.paper, 'rgb(255, 255, 255)', `${theme} document paper`);
      assert.equal(colors.text, 'rgb(0, 0, 0)', `${theme} authored text`);
      assert.ok(colors.width > 700 && colors.width < 900, 'Native paper width remains intact');
      assert.equal(zipEntry(await saveEditor(page, 'layout'), 'word/document.xml'), before);
      await page.screenshot({ path: new URL(`../.browser-evidence/layout-${theme}.png`, import.meta.url).pathname });
    }
  });
  await check('toolbar uses one stable row when wide and two reachable rows when narrower', async () => {
    for (const width of [2560, 1920, 1440, 800, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await editor.evaluate(element => {
        const root = element.shadowRoot;
        const toolbar = root.querySelector('[part="toolbar"]');
        const first = root.querySelector('.toolbar-row');
        const second = root.querySelector('[part="editing-tools"]');
        const firstBox = first.getBoundingClientRect();
        const secondBox = second.getBoundingClientRect();
        const toolBox = toolbar.getBoundingClientRect();
        const inToolbar = node => {
          const box = node.getBoundingClientRect();
          return box.left >= toolBox.left - 1 && box.right <= toolBox.right + 1;
        };
        return { toolbarHeight: toolbar.getBoundingClientRect().height, hostWidth: element.clientWidth,
          overflow: element.scrollWidth, toolOverflow: toolbar.scrollWidth, toolWidth: toolbar.clientWidth,
          firstTop: firstBox.top, secondTop: secondBox.top,
          firstCenter: firstBox.top + firstBox.height / 2, secondCenter: secondBox.top + secondBox.height / 2,
          firstVisible: first.scrollWidth <= first.clientWidth + 1,
          ordinaryToolsVisible: [root.querySelector('[part="file-actions"]'), root.querySelector('.history-tools'),
            root.querySelector('.insert-tools'), root.querySelector('.font-tools'), root.querySelector('[part="format-actions"]'),
            root.querySelector('[part="alignment-actions"]'), root.querySelector('[part="list-actions"]'),
            root.querySelector('.color-tools')].every(inToolbar) };
      });
      assert.ok(layout.toolbarHeight <= (width === 320 ? 300 : width === 800 ? 160 : 120), JSON.stringify({ width, ...layout }));
      assert.ok(layout.overflow <= layout.hostWidth + 1, JSON.stringify({ width, ...layout }));
      assert.ok(layout.toolOverflow <= layout.toolWidth + 1, JSON.stringify({ width, ...layout }));
      if (width >= 1920) {
        assert.ok(Math.abs(layout.firstCenter - layout.secondCenter) <= 1, JSON.stringify({ width, ...layout }));
        assert.ok(layout.firstVisible && layout.ordinaryToolsVisible, JSON.stringify({ width, ...layout }));
      } else if (width === 1440) {
        assert.ok(layout.secondTop > layout.firstTop + 1, JSON.stringify({ width, ...layout }));
      }
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('Alt+F10');
      await page.keyboard.press('End');
      const last = await editor.evaluate(element => {
        const focused = element.shadowRoot.activeElement;
        const box = focused.getBoundingClientRect();
        return { key: focused.getAttribute('data-tool-key'), left: box.left, right: box.right };
      });
      assert.equal(last.key, 'text-color-auto');
      assert.ok(last.left >= 0 && last.right <= width, JSON.stringify(last));
      await page.keyboard.press('Escape');
      await page.screenshot({ path: new URL(`../.browser-evidence/layout-${width}.png`, import.meta.url).pathname });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  });
  await check('a height-constrained editor keeps the toolbar and status outside the document scroll', async () => {
    await editor.evaluate(element => {
      element.style.blockSize = '600px';
      element.style.setProperty('--lr-docx-editor-document-max-block-size', '100%');
    });
    const layout = await editor.evaluate(element => {
      const documentPart = element.shadowRoot.querySelector('[part="document"]');
      const viewport = element.querySelector('[data-lr-docx-viewport]');
      const status = element.shadowRoot.querySelector('[part="status"]');
      return { host: element.getBoundingClientRect().height, document: documentPart.clientHeight,
        viewport: viewport.clientHeight, scroll: viewport.scrollHeight, status: status.getBoundingClientRect().bottom,
        bottom: element.getBoundingClientRect().bottom };
    });
    assert.equal(layout.host, 600);
    assert.ok(layout.document > 300, JSON.stringify(layout));
    assert.ok(layout.viewport <= layout.document + 1, JSON.stringify(layout));
    assert.ok(layout.scroll > layout.viewport, JSON.stringify(layout));
    assert.ok(layout.status <= layout.bottom, JSON.stringify(layout));
  });
  await check('RTL mirrors history and image navigation glyphs while preserving physical alignment', async () => {
    await editor.evaluate(async element => { element.setAttribute('dir', 'rtl'); await element.updateComplete; });
    const transforms = await editor.evaluate(element => Object.fromEntries(['undo', 'redo', 'image-previous', 'image-next', 'alignment-left', 'alignment-right'].map(key => [key, getComputedStyle(element.shadowRoot.querySelector(`#tool-${key} .tool-icon`)).transform])));
    for (const key of ['undo', 'redo', 'image-previous', 'image-next']) assert.equal(transforms[key], 'matrix(-1, 0, 0, 1, 0, 0)');
    for (const key of ['alignment-left', 'alignment-right']) assert.equal(transforms[key], 'none');
    await editor.evaluate(async element => { element.setAttribute('dir', 'ltr'); await element.updateComplete; });
  });
  await check('a consumer icon slot replaces the glyph while retaining the formatting action', async () => {
    await editor.evaluate(element => {
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('slot', 'bold-icon'); icon.setAttribute('viewBox', '0 0 24 24');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '8');
      icon.append(circle); element.append(icon);
    });
    assert.equal(await editor.locator('svg[slot="bold-icon"]').isVisible(), true);
    await editor.locator('.docx-pages').click();
    await page.keyboard.press('ControlOrMeta+A');
    await editor.locator('[data-command="bold"]').click();
    assert.match(zipEntry(await saveEditor(page, 'layout'), 'word/document.xml'), /<w:b(?:\s|\/|>)/u);
  });
  await check('toolbar glyphs and custom icon slots align with their native button centers', async () => {
    const offsets = await editor.evaluate(element => [...element.shadowRoot.querySelectorAll('.tool-icon')].flatMap(icon => {
      const button = icon.closest('lr-button').shadowRoot.querySelector('[part~="base"]');
      const control = button.getBoundingClientRect();
      const assigned = icon.querySelector('slot').assignedElements();
      const fallback = icon.querySelector('lr-icon');
      const glyphs = assigned.length ? assigned : [fallback, fallback.shadowRoot.querySelector('svg')];
      return [icon, ...glyphs].map(node => {
        const glyph = node.getBoundingClientRect();
        return { id: icon.closest('lr-button').id, glyph: node.localName, width: glyph.width, height: glyph.height,
          x: glyph.x + glyph.width / 2 - control.x - control.width / 2,
          y: glyph.y + glyph.height / 2 - control.y - control.height / 2 };
      });
    }));
    for (const offset of offsets) assert.ok(offset.width > 0 && offset.height > 0 && Math.abs(offset.x) <= 0.5 && Math.abs(offset.y) <= 0.5, JSON.stringify(offset));
  });
  await check('all toolbar controls share a height without shrinking stepper hit targets', async () => {
    const geometry = await editor.evaluate(element => {
      const root = element.shadowRoot;
      const controls = [['new-button', '[part~="base"]'], ['format-button', '[part~="base"]'], ['paragraph-style', '[part~="combobox"]'], ['font-family', '[part~="combobox"]'], ['font-size', '[part~="base"]'], ['text-color', '[part~="trigger"]'], ['color-auto', '[part~="base"]']].map(([part, selector]) => {
        const host = root.querySelector(part === 'format-button' ? '[data-command="bold"]' : `[part="${part}"]`), control = host.shadowRoot.querySelector(selector);
        const bounds = control?.getBoundingClientRect();
        return { part, height: bounds?.height ?? -1, center: bounds ? bounds.y + bounds.height / 2 : -1 };
      });
      const stepper = root.querySelector('[part="font-size"]').shadowRoot.querySelector('[part~="stepper-increment"]');
      return { controls, stepper: stepper.getBoundingClientRect().height, floor: parseFloat(getComputedStyle(stepper).minBlockSize) };
    });
    const reference = geometry.controls[0].height;
    for (const control of geometry.controls) assert.ok(Math.abs(control.height - reference) <= 0.5, JSON.stringify(geometry));
    const formattingCenter = geometry.controls[1].center;
    for (const control of geometry.controls.slice(1)) assert.ok(Math.abs(control.center - formattingCenter) <= 0.5, JSON.stringify(geometry));
    assert.ok(geometry.stepper >= geometry.floor, JSON.stringify(geometry));
  });
  await check('format icons keep localized accessible names and keyboard tooltips', async () => {
    await editor.evaluate(element => { element.strings = { docxEditorBold: 'Strong text' }; });
    const bold = editor.locator('[data-command="bold"]');
    assert.equal(await bold.getByRole('button', { name: 'Strong text', exact: true }).count(), 1);
    await editor.locator('.docx-pages').click();
    await page.keyboard.press('Alt+F10');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await editor.evaluate(element => element.shadowRoot.activeElement?.getAttribute('data-command')), 'bold');
    await editor.locator('lr-tooltip[for="tool-bold"]').getByRole('tooltip').waitFor({ state: 'visible' });
    assert.equal(await editor.locator('lr-tooltip[for="tool-bold"]').getAttribute('content'), 'Strong text');
    await page.keyboard.press('Escape');
  });
  await check('image context never moves the document while switching pictures across toolbar layouts', async () => {
    await createEditor(page, 'layout-images', 'image-simple');
    const images = page.locator('#layout-images');
    for (const width of [1920, 1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await images.scrollIntoViewIfNeeded();
      const stageTop = await images.evaluate(element => element.shadowRoot.querySelector('[part="document"]').getBoundingClientRect().top - element.getBoundingClientRect().top);
      const toolbarHeight = await images.evaluate(element => element.shadowRoot.querySelector('[part="toolbar"]').getBoundingClientRect().height);
      for (const index of [0, 1, 0]) {
        await images.locator('.docx-pages img').nth(index).click();
        await page.waitForFunction(({ index }) => document.getElementById('layout-images').imageDescription()?.value?.title === `Title ${index + 1}`, { index });
        const selectedTop = await images.evaluate(element => element.shadowRoot.querySelector('[part="document"]').getBoundingClientRect().top - element.getBoundingClientRect().top);
        const selectedToolbarHeight = await images.evaluate(element => element.shadowRoot.querySelector('[part="toolbar"]').getBoundingClientRect().height);
        assert.ok(Math.abs(selectedTop - stageTop) <= 1, JSON.stringify({ width, index, stageTop, selectedTop }));
        assert.ok(Math.abs(selectedToolbarHeight - toolbarHeight) <= 1, JSON.stringify({ width, index, toolbarHeight, selectedToolbarHeight }));
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await images.evaluate(element => element.remove());
  });
}
