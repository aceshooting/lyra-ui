import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { zipEntry } from '../test/zip.mjs';

export async function runEditorLayout(page, check, { createEditor, saveEditor }) {
  const evidence = name => fileURLToPath(new URL(`../.browser-evidence/${page.context().browser().browserType().name()}-${name}.png`, import.meta.url));
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
      await page.screenshot({ path: evidence(`layout-${theme}`) });
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
        const lastGroupBox = first.lastElementChild.getBoundingClientRect();
        const toolBox = toolbar.getBoundingClientRect();
        const inToolbar = node => {
          const box = node.getBoundingClientRect();
          return box.left >= toolBox.left - 1 && box.right <= toolBox.right + 1;
        };
        return { toolbarHeight: toolbar.getBoundingClientRect().height, hostWidth: element.clientWidth,
          overflow: element.scrollWidth, toolOverflow: toolbar.scrollWidth, toolWidth: toolbar.clientWidth,
          firstTop: firstBox.top, secondTop: secondBox.top,
          firstCenter: firstBox.top + firstBox.height / 2, secondCenter: secondBox.top + secondBox.height / 2,
          compactGap: getComputedStyle(element).direction === 'rtl' ? lastGroupBox.left - secondBox.right : secondBox.left - lastGroupBox.right,
          separatorWidth: parseFloat(getComputedStyle(first).borderInlineEndWidth),
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
        assert.ok(layout.compactGap >= 0 && layout.compactGap <= 32 && layout.separatorWidth >= 1, JSON.stringify({ width, ...layout }));
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
      assert.equal(last.key, 'highlight');
      assert.ok(last.left >= 0 && last.right <= width, JSON.stringify(last));
      await page.keyboard.press('Escape');
      await page.screenshot({ path: evidence(`layout-${width}`) });
    }
    await page.setViewportSize({ width: 1920, height: 900 });
    const rtlGap = await editor.evaluate(async element => {
      element.setAttribute('dir', 'rtl');
      await element.updateComplete;
      const first = element.shadowRoot.querySelector('.toolbar-row');
      const second = element.shadowRoot.querySelector('[part="editing-tools"]');
      const lastGroup = first.lastElementChild;
      return { gap: lastGroup.getBoundingClientRect().left - second.getBoundingClientRect().right,
        separatorWidth: parseFloat(getComputedStyle(first).borderInlineEndWidth),
        firstVisible: first.scrollWidth <= first.clientWidth + 1 };
    });
    assert.ok(rtlGap.gap >= 0 && rtlGap.gap <= 32 && rtlGap.separatorWidth >= 1 && rtlGap.firstVisible, JSON.stringify(rtlGap));
    await editor.evaluate(async element => { element.setAttribute('dir', 'ltr'); await element.updateComplete; });
    await page.setViewportSize({ width: 1440, height: 900 });
  });
  await check('engine overlay layers start where the painted pages start', async () => {
    const offset = await editor.evaluate(element => {
      const pages = element.querySelector('.docx-pages').getBoundingClientRect();
      const overlay = element.querySelector('.docx-paginated-surface .docx-selection-overlay, .docx-selection-overlay-container');
      return overlay ? overlay.getBoundingClientRect().top - pages.top : null;
    });
    assert.ok(offset !== null && Math.abs(offset) <= 1, `overlay offset ${offset}`);
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
      const controls = [['new-button', '[part~="base"]'], ['format-button', '[part~="base"]'], ['paragraph-style', '[part~="combobox"]'], ['font-family', '[part~="combobox"]'], ['font-size', '[part~="base"]'], ['text-color', '[part~="base"]'], ['highlight', '[part~="base"]'], ['line-spacing', '[part~="base"]']].map(([part, selector]) => {
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
        const overflow = await images.evaluate(element => element.scrollWidth - element.clientWidth);
        assert.ok(overflow <= 1, JSON.stringify({ width, index, overflow }));
        const rowOverflow = await images.evaluate(element => {
          const row = element.shadowRoot.querySelector('.toolbar-row');
          return row.scrollWidth - row.clientWidth;
        });
        if (width >= 1440) assert.ok(rowOverflow <= 1, JSON.stringify({ width, index, rowOverflow }));
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await images.evaluate(element => element.remove());
  });
  await check('document charts paint from cached values over their placeholders, follow zoom and round-trip untouched', async () => {
    const source = await createEditor(page, 'layout-charts', 'chart');
    const host = page.locator('#layout-charts');
    await host.scrollIntoViewIfNeeded();
    await host.locator('[part="chart"]').waitFor({ state: 'visible' });
    const painted = await host.evaluate(element => {
      const charts = [...element.shadowRoot.querySelectorAll('[part="chart"]')];
      const drawings = [...element.querySelectorAll('[data-drawing-node-id]')].map(node => node.getBoundingClientRect());
      const chart = charts[0], lite = chart.querySelector('lr-lite-chart'), box = chart.getBoundingClientRect();
      return { count: charts.length, drawings: drawings.length, type: chart.dataset.chartType, title: chart.querySelector('.chart-title')?.textContent,
        labels: [...lite.labels], datasets: lite.datasets.map(entry => ({ label: entry.label, data: [...entry.data], color: entry.color })),
        background: getComputedStyle(chart).backgroundColor, box: { x: box.x, y: box.y, width: box.width, height: box.height },
        first: { x: drawings[0].x, y: drawings[0].y, width: drawings[0].width, height: drawings[0].height } };
    });
    assert.equal(painted.count, 1, 'only the supported column chart is painted; the pie keeps its placeholder');
    assert.equal(painted.drawings, 2);
    assert.equal(painted.type, 'bar');
    assert.equal(painted.title, 'Quarterly column');
    assert.deepEqual(painted.labels, ['North', 'South', 'East']);
    assert.deepEqual(painted.datasets, [{ label: 'Sales', data: [12, 7, 9], color: '#4472C4' }, { label: 'Costs', data: [8, 5, 4], color: '#ED7D31' }]);
    assert.equal(painted.background, 'rgb(255, 255, 255)');
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(painted.box[key] - painted.first[key]) <= 1.5, JSON.stringify(painted));
    await host.evaluate(element => { element.zoom = 0.5; });
    await page.waitForFunction(width => {
      const chart = document.getElementById('layout-charts').shadowRoot.querySelector('[part="chart"]');
      return chart && chart.getBoundingClientRect().width < width * 0.6;
    }, painted.box.width);
    const saved = await saveEditor(page, 'layout-charts');
    const before = unzipSync(Uint8Array.from(source)), after = unzipSync(Uint8Array.from(saved));
    // The engine re-serializes parts canonically (namespace declaration order); the chart content is unchanged.
    const content = bytes => strFromU8(bytes).replace(/\s+xmlns:[a-z]+="[^"]*"/gu, '');
    for (const name of ['word/charts/chart1.xml', 'word/charts/chart2.xml']) assert.equal(content(after[name]), content(before[name]), name);
    await host.evaluate(element => element.remove());
  });
  await check('dragging image handles resizes the picture as one edit, keeping corner proportions', async () => {
    await createEditor(page, 'layout-drag', 'image-simple');
    const host = page.locator('#layout-drag');
    await host.scrollIntoViewIfNeeded();
    await host.locator('.docx-pages img').first().click();
    const handle = host.locator('[part="image-handle"][data-handle="se"]');
    await handle.waitFor({ state: 'visible' });
    const before = await host.evaluate(element => ({ ...element.snapshot().image, revision: element.snapshot().revision.value }));
    const frame = await host.locator('[part="image-frame"]').boundingBox();
    const image = await host.locator('.docx-pages img').first().boundingBox();
    assert.ok(Math.abs(frame.x - image.x) <= 1.5 && Math.abs(frame.width - image.width) <= 1.5, JSON.stringify({ frame, image }));
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 5, { steps: 5 });
    assert.equal(await host.locator('[part="image-size"]').count(), 1);
    await page.mouse.up();
    await page.waitForFunction(revision => document.getElementById('layout-drag').snapshot()?.revision?.value > revision, before.revision);
    const after = await host.evaluate(element => element.snapshot().image);
    assert.ok(after.widthPoints > before.widthPoints, JSON.stringify({ before, after }));
    assert.ok(Math.abs(after.widthPoints / after.heightPoints - before.widthPoints / before.heightPoints) < 0.02, JSON.stringify({ before, after }));
    assert.equal(await host.evaluate(element => element.snapshot().dirty), true);
    const dragged = await host.evaluate(element => element.snapshot().revision.value);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    await page.waitForFunction(({ revision, width }) => {
      const element = document.getElementById('layout-drag');
      const picture = element.querySelector('.docx-pages img');
      return element.snapshot()?.revision?.value !== revision && Math.abs(picture?.getBoundingClientRect().width - width) < 1;
    }, { revision: dragged, width: image.width }, { timeout: 5000 });
    // A click racing the post-undo repaint can land beside the picture; select it through the API instead.
    await page.waitForFunction(() => document.getElementById('layout-drag').selectImage('next').ok);
    await host.locator('[part="image-handle"][data-handle="e"]').waitFor({ state: 'visible' });
    const edge = await host.locator('[part="image-handle"][data-handle="e"]').boundingBox();
    const start = await host.evaluate(element => element.snapshot().image);
    assert.equal(start.widthPoints, before.widthPoints, 'one undo restores the dragged width');
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
    await page.mouse.down();
    await page.mouse.move(edge.x + edge.width / 2 + 30, edge.y + edge.height / 2, { steps: 3 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.deepEqual(await host.evaluate(element => element.snapshot().image), start, 'Escape cancels a drag without editing');
    await host.evaluate(async element => { element.setAttribute('read-only', ''); await element.open(await (await element.save()).value.bytes); });
    await host.locator('.docx-pages img').first().click();
    await page.waitForTimeout(200);
    assert.equal(await host.locator('[part="image-handle"]').count(), 0, 'Read-only documents show no handles');
    await host.evaluate(element => element.remove());
  });
}
