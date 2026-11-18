import assert from 'node:assert/strict';
import { zipEntry } from '../test/zip.mjs';

const near = (actual, expected, detail) => assert.ok(Math.abs(actual - expected) <= 1, JSON.stringify({ actual, expected, detail }));

async function rows(editor) {
  return editor.evaluate(element => {
    const part = name => element.shadowRoot.querySelector(`[part="${name}"]`);
    const toolbar = part('toolbar'), first = part('toolbar-first-row'), editing = part('editing-tools');
    const firstBox = first.getBoundingClientRect(), editingBox = editing.getBoundingClientRect();
    const style = getComputedStyle(toolbar);
    return {
      sameRow: Math.abs(firstBox.top + firstBox.height / 2 - editingBox.top - editingBox.height / 2) <= 1,
      unclipped: [first, editing].every(row => row.scrollWidth <= row.clientWidth + 1),
      formattingBelow: editingBox.top >= firstBox.bottom - 1,
      toolbarWidth: toolbar.clientWidth, toolbarScroll: toolbar.scrollWidth,
      hostWidth: element.clientWidth, hostScroll: element.scrollWidth,
      fitWidth: Math.ceil(firstBox.width + editingBox.width + parseFloat(style.columnGap) +
        parseFloat(style.paddingInlineStart) + parseFloat(style.paddingInlineEnd) +
        element.getBoundingClientRect().width - toolbar.getBoundingClientRect().width),
    };
  });
}

async function measurements(editor) {
  return editor.evaluate(element => {
    const root = element.shadowRoot;
    const part = name => root.querySelector(`[part="${name}"]`);
    const box = node => node.getBoundingClientRect();
    const control = (node, name) => box(node.shadowRoot.querySelector(`[part~="${name}"]`));
    const tools = ['new', 'open', 'save', 'commands', 'outline', 'checks', 'review', 'image-replace', 'bold', 'italic',
      'link', 'table-insert', 'image-insert', 'text-color', 'highlight', 'line-spacing'].map(key => {
      const tool = root.querySelector(`#tool-${key}`);
      const native = control(tool, 'base');
      return { key, height: native.height, width: native.width, glyph: box(tool.querySelector('lr-icon')).width };
    });
    const fields = [['paragraph-style', 'trigger'], ['font-family', 'combobox'], ['font-size', 'input-wrapper']]
      .map(([name, internal]) => ({ name, height: control(part(name), internal).height, width: box(part(name)).width }));
    const steppers = [...part('font-size').shadowRoot.querySelectorAll('[part~="stepper-down"], [part~="stepper-up"]')]
      .map(stepper => ({ width: box(stepper).width, height: box(stepper).height }));
    const bold = box(root.querySelector('#tool-bold')), italic = box(root.querySelector('#tool-italic'));
    const first = part('toolbar-first-row');
    return { tools, fields, steppers, toolGap: italic.left - bold.right,
      groupGap: box(first.children[1]).left - box(first.children[0]).right };
  });
}

async function panelGeometry(editor, trigger, fields, contents) {
  await editor.locator(`#tool-${trigger}`).click();
  const panel = editor.locator(`[part="${fields}"]`);
  await panel.waitFor({ state: 'visible' });
  for (const [part, internal] of contents) {
    const target = internal === 'input-wrapper' ? 'input' : internal;
    await panel.locator(`[part="${part}"] [part~="${target}"]`).click({ trial: true });
  }
  const geometry = await panel.evaluate((node, contents) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const parts = contents.map(([part, internal]) => {
      const host = node.querySelector(`[part="${part}"]`);
      const control = host.shadowRoot.querySelector(`[part~="${internal}"]`);
      const box = control.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    return { width: rect.width, height: rect.height, gap: style.gap, padding: style.padding, parts };
  }, contents);
  assert.ok(geometry.parts.every(part => part.width > 0 && part.height > 0), JSON.stringify({ trigger, geometry }));
  return geometry;
}

export async function runToolbarDensity(page, check, { createEditor, saveEditor }) {
  const id = 'toolbar-density';
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 2300, height: 900 });
  await createEditor(page, id, 'basic-editing');
  const editor = page.locator(`#${id}`);
  try {
    await check('auto toolbar fits its rendered groups below the former desktop breakpoint and reflows on allocation changes', async () => {
      await editor.evaluate(element => {
        element.style.inlineSize = '1650px';
        element.style.setProperty('--lr-docx-editor-tool-size', '30px');
      });
      const fitted = await rows(editor);
      assert.ok(fitted.sameRow && fitted.unclipped && fitted.toolbarWidth >= fitted.toolbarScroll - 1, JSON.stringify(fitted));
      assert.deepEqual(await editor.evaluate(element => [element.toolbarLayout, element.density]), ['auto', 'default']);
      await editor.evaluate(element => { element.style.inlineSize = '700px'; });
      const narrow = await rows(editor);
      assert.ok(narrow.formattingBelow && narrow.toolbarScroll <= narrow.toolbarWidth + 1 && narrow.hostScroll <= narrow.hostWidth + 1,
        JSON.stringify(narrow));
      await editor.evaluate(async element => {
        element.style.inlineSize = '1650px';
        element.setAttribute('toolbar-layout', 'two-rows');
        await element.updateComplete;
      });
      const separate = await rows(editor);
      assert.ok(separate.formattingBelow && separate.unclipped, JSON.stringify(separate));
      await editor.evaluate(async element => {
        element.removeAttribute('toolbar-layout');
        await element.updateComplete;
      });
      assert.deepEqual(await rows(editor), fitted);
      await editor.evaluate((element, width) => { element.style.inlineSize = `${width}px`; }, fitted.fitWidth - 8);
      assert.ok((await rows(editor)).formattingBelow, 'Auto separates groups below their measured natural width');
      await editor.evaluate((element, width) => { element.style.inlineSize = `${width}px`; }, fitted.fitWidth + 8);
      assert.ok((await rows(editor)).sameRow, 'Auto fits the groups above their measured natural width');
      await editor.evaluate(element => element.style.setProperty('--lr-docx-editor-font-family-inline-size', '10rem'));
      assert.ok((await rows(editor)).formattingBelow, 'A wider field reflows the same allocated toolbar');
      await editor.evaluate(async element => { element.fileActions = ''; await element.updateComplete; });
      assert.ok((await rows(editor)).sameRow, 'Removing the file group makes room for the wider field');
      await editor.evaluate(async element => {
        element.removeAttribute('file-actions');
        await element.updateComplete;
      });
      await editor.evaluate(element => {
        element.style.removeProperty('inline-size');
        element.style.removeProperty('--lr-docx-editor-tool-size');
        element.style.removeProperty('--lr-docx-editor-font-family-inline-size');
      });
    });

    await check('single-row toolbar scrolls keyboard focus into view in LTR and RTL with operable popovers', async () => {
      await editor.evaluate(async element => {
        element.toolbarLayout = 'single-row';
        element.style.inlineSize = '320px';
        element.zoom = 'fit';
        await element.updateComplete;
      });
      assert.equal(await editor.getAttribute('toolbar-layout'), 'single-row');
      for (const [direction, next] of [['ltr', 'ArrowRight'], ['rtl', 'ArrowLeft']]) {
        await editor.evaluate(async (element, dir) => { element.dir = dir; await element.updateComplete; }, direction);
        const layout = await rows(editor);
        assert.ok(layout.sameRow && layout.toolbarScroll > layout.toolbarWidth + 1 && layout.hostScroll <= layout.hostWidth + 1,
          JSON.stringify({ direction, ...layout }));
        await editor.locator('.docx-pages').click();
        await page.keyboard.press('Alt+F10');
        await page.keyboard.press(next);
        assert.equal(await editor.evaluate(element => element.shadowRoot.activeElement?.id), 'tool-italic');
        await page.keyboard.press('End');
        const focus = await editor.evaluate(element => {
          const focused = element.shadowRoot.activeElement;
          const bounds = focused.getBoundingClientRect();
          const toolbar = element.shadowRoot.querySelector('[part="toolbar"]').getBoundingClientRect();
          return { id: focused.id, left: bounds.left - toolbar.left, right: toolbar.right - bounds.right };
        });
        assert.ok(focus.id === 'tool-highlight' && focus.left >= -1 && focus.right >= -1, JSON.stringify({ direction, ...focus }));
        await page.keyboard.press('Enter');
        await editor.locator('[part="highlight-swatches"]').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await editor.locator('[part="highlight-swatches"]').waitFor({ state: 'hidden' });
      }
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+A');
      const paragraph = editor.locator('[part="paragraph-style"]');
      const paragraphTrigger = paragraph.getByRole('combobox');
      await paragraphTrigger.click();
      const heading = paragraph.locator('[part="option"][data-value="CustomHeading"]');
      await heading.click({ trial: true });
      const documentState = () => editor.evaluate(element => {
        const { revision, selection } = element.snapshot();
        return { revision, selection, text: element.querySelector('.docx-pages').textContent };
      });
      const beforeStyle = await documentState();
      assert.equal(beforeStyle.selection.kind, 'text');
      await page.keyboard.press('c');
      assert.equal(await paragraphTrigger.getAttribute('aria-activedescendant'), await heading.getAttribute('id'));
      assert.deepEqual(await documentState(), beforeStyle, 'Paragraph style typeahead leaves the selected document unchanged');
      await page.keyboard.press('Enter');
      await page.waitForFunction(id => document.getElementById(id).snapshot()?.formatting.paragraphStyleId === 'CustomHeading', id);
      assert.match(zipEntry(await saveEditor(page, id), 'word/document.xml'), /<w:pStyle\b[^>]*w:val="CustomHeading"/u);
      assert.equal((await documentState()).text, beforeStyle.text);
      await editor.locator('.docx-pages').getByText('Corpus opening', { exact: true }).click();
      await page.keyboard.press('ControlOrMeta+A');
      const font = editor.locator('[part="font-family"]');
      const fontInput = font.locator('[part="combobox-input"]');
      await fontInput.click();
      await fontInput.fill('Arial');
      const option = font.getByRole('option', { name: 'Arial', exact: true });
      await option.click({ trial: true });
      assert.equal(await fontInput.inputValue(), 'Arial');
      const active = await fontInput.getAttribute('aria-activedescendant');
      assert.ok(active === null || active === await option.getAttribute('id'), `Unexpected active option ${active}`);
      const beforeFont = await editor.evaluate(element => element.snapshot().revision.value);
      await fontInput.press('Enter');
      await page.waitForFunction(({ id, beforeFont }) => document.getElementById(id).snapshot()?.revision?.value > beforeFont, { id, beforeFont });
      assert.match(zipEntry(await saveEditor(page, id), 'word/document.xml'), /<w:rFonts\b[^>]*Arial/u);
      await editor.evaluate(async element => {
        element.removeAttribute('dir');
        element.removeAttribute('toolbar-layout');
        element.style.removeProperty('inline-size');
        element.zoom = 1;
        await element.updateComplete;
      });
    });

    await check('compact density and all seven toolbar hooks reach native controls and reset to themed defaults', async () => {
      const ordinary = await measurements(editor);
      await editor.evaluate(async element => { element.density = 'compact'; await element.updateComplete; });
      assert.equal(await editor.getAttribute('density'), 'compact');
      const compact = await measurements(editor);
      for (const tool of compact.tools) {
        near(tool.height, 28, tool.key);
        near(tool.width, 28, tool.key);
        near(tool.glyph, 16, tool.key);
        assert.ok(tool.height < ordinary.tools.find(original => original.key === tool.key).height, JSON.stringify(tool));
      }
      for (const field of compact.fields) near(field.height, 28, field.name);
      near(compact.toolGap, 2, 'compact tool gap');
      assert.equal(compact.steppers.length, 2);
      assert.ok(compact.steppers.every(stepper => stepper.width >= 24 && stepper.height >= 24), JSON.stringify(compact.steppers));
      const hooks = {
        'tool-size': '32px', 'tool-icon-size': '14px', 'tool-gap': '7px', 'group-gap': '11px',
        'paragraph-style-inline-size': '108px', 'font-family-inline-size': '120px', 'font-size-inline-size': '96px',
      };
      await editor.evaluate((element, hooks) => {
        for (const [name, value] of Object.entries(hooks)) element.style.setProperty(`--lr-docx-editor-${name}`, value);
      }, hooks);
      const themed = await measurements(editor);
      for (const tool of themed.tools) {
        near(tool.height, 32, tool.key);
        near(tool.width, 32, tool.key);
        near(tool.glyph, 14, tool.key);
      }
      for (const [index, field] of themed.fields.entries()) {
        near(field.height, 32, field.name);
        near(field.width, [108, 120, 96][index], field.name);
      }
      near(themed.toolGap, 7, 'custom tool gap');
      near(themed.groupGap, 11, 'custom group gap');
      await editor.evaluate(async (element, names) => {
        for (const name of names) element.style.removeProperty(`--lr-docx-editor-${name}`);
        element.removeAttribute('density');
        await element.updateComplete;
      }, Object.keys(hooks));
      assert.deepEqual(await measurements(editor), ordinary);
    });

    if (page.context().browser().browserType().name() === 'chromium') {
      await check('compact toolbar retains native coarse-pointer hit targets', async () => {
        const session = await page.context().newCDPSession(page);
        try {
          await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
          await page.waitForFunction(() => matchMedia('(hover: none), (pointer: coarse)').matches);
          const ordinary = await measurements(editor);
          await editor.evaluate(async element => { element.density = 'compact'; await element.updateComplete; });
          for (const override of [false, true]) {
            if (override) await editor.evaluate(element => element.style.setProperty('--lr-docx-editor-tool-size', '18px'));
            const compact = await measurements(editor);
            for (const [index, tool] of compact.tools.entries()) {
              assert.ok(tool.width >= 44 && tool.height >= 44, JSON.stringify(tool));
              near(tool.height, ordinary.tools[index].height, tool.key);
            }
            assert.ok(compact.steppers.every(stepper => stepper.width >= 44 && stepper.height >= 44), JSON.stringify(compact.steppers));
          }
        } finally {
          await editor.evaluate(async element => {
            element.removeAttribute('density');
            element.style.removeProperty('--lr-docx-editor-tool-size');
            await element.updateComplete;
          });
          await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
          await session.detach();
        }
      });
    }

    await check('compact toolbar leaves real open link, table and color panel controls and spacing unchanged', async () => {
      for (const [trigger, fields, contents] of [
        ['link', 'link-fields', [['link-href', 'input-wrapper'], ['link-cancel', 'base']]],
        ['table-insert', 'table-fields', [['table-rows', 'input-wrapper'], ['table-insert-cancel', 'base']]],
        ['text-color', 'text-color-fields', [['color-auto', 'base']]],
      ]) {
        const measurePanel = async () => {
          await editor.locator('.docx-pages').getByText('Corpus opening', { exact: true }).click();
          await page.keyboard.press('ArrowLeft');
          await page.waitForFunction(id => document.getElementById(id).snapshot()?.selection.kind === 'caret', id);
          return panelGeometry(editor, trigger, fields, contents);
        };
        const ordinary = await measurePanel();
        await page.keyboard.press('Escape');
        await editor.locator(`[part="${fields}"]`).waitFor({ state: 'hidden' });
        await editor.evaluate(async element => { element.density = 'compact'; await element.updateComplete; });
        assert.deepEqual(await measurePanel(), ordinary);
        await page.keyboard.press('Escape');
        await editor.locator(`[part="${fields}"]`).waitFor({ state: 'hidden' });
        await editor.evaluate(async element => { element.removeAttribute('density'); await element.updateComplete; });
      }
    });

    await check('compact density reaches contextual image and first-row document tools but preserves the open image dialog', async () => {
      const opened = await editor.evaluate(async element => element.open(await window.__docxTest.fixture('image-simple')));
      assert.equal(opened.ok, true, JSON.stringify(opened));
      await editor.locator('.docx-pages img').first().click();
      await page.waitForFunction(id => document.getElementById(id).imageDescription().ok, id);
      await editor.evaluate(async element => {
        element.documentToolsPlacement = 'first-row';
        await element.updateComplete;
      });
      const imagePanel = () => panelGeometry(editor, 'image-resize', 'image-resize-fields',
        [['image-width', 'input-wrapper'], ['image-resize-cancel', 'base']]);
      const ordinary = await imagePanel();
      await editor.locator('[part="image-resize-cancel"]').click();
      await editor.locator('[part="image-resize-fields"]').waitFor({ state: 'hidden' });
      await editor.evaluate(async element => { element.density = 'compact'; await element.updateComplete; });
      for (const key of ['image-resize', 'image-description', 'image-delete', 'image-replace', 'commands']) {
        const tool = editor.locator(`[part="toolbar-first-row"] #tool-${key}`);
        const native = await tool.locator('[part~="base"]').boundingBox();
        assert.ok(native, key);
        near(native.height, 28, key);
        near(native.width, 28, key);
      }
      assert.deepEqual(await imagePanel(), ordinary);
      await editor.locator('[part="image-resize-cancel"]').click();
    });
  } finally {
    await editor.evaluate(element => element.remove());
    if (viewport) await page.setViewportSize(viewport);
  }
}
