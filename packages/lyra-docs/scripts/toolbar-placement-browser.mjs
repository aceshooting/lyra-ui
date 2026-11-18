import assert from 'node:assert/strict';
import { zipEntry } from '../test/zip.mjs';

export async function runToolbarPlacement(page, check, { createEditor, saveEditor }) {
  await check('a page grid allocates the toolbar independently and preserves document selection', async () => {
    const id = 'layout-placement';
    const size = page.viewportSize();
    const style = await page.addStyleTag({ content: `
      #fixture.toolbar-page { display: grid; grid-template-columns: 1fr 320px 1fr;
        grid-template-areas: "tools tools tools" "left document right"; }
      #layout-placement::part(toolbar-area) { grid-area: tools; }
      #layout-placement::part(workspace) { grid-area: document; }
      #fixture.toolbar-page aside:first-of-type { grid-area: left; }
      #fixture.toolbar-page aside:last-of-type { grid-area: right; }
    ` });
    try {
      await createEditor(page, id);
      const editor = page.locator(`#${id}`);
      const initial = await editor.evaluate(element => {
        const root = element.shadowRoot;
        const row = root.querySelector('[part="toolbar-first-row"]');
        return [element.toolbarPlacement, element.documentToolsPlacement, Boolean(row),
          Boolean(row?.contains(root.querySelector('[part="navigation-tools"]')))];
      });
      assert.deepEqual(initial, ['inline', 'separate', true, false]);
      const region = editor.getByRole('region', { name: 'Document editor', exact: true });
      assert.equal(await region.count(), 1);
      await editor.evaluate(async element => {
        element.parentElement.classList.add('toolbar-page');
        element.parentElement.append(document.createElement('aside'), document.createElement('aside'));
        element.toolbarPlacement = 'layout';
        element.setAttribute('document-tools-placement', 'first-row');
        element.zoom = 'fit';
        await element.updateComplete;
      });
      assert.equal(await region.count(), 1);
      assert.equal(await region.getAttribute('part'), 'workspace');
      for (const width of [2000, 900, 540]) {
        await page.setViewportSize({ width, height: 900 });
        const layout = await editor.evaluate(element => {
          const root = element.shadowRoot;
          const part = name => root.querySelector(`[part="${name}"]`);
          const box = node => node.getBoundingClientRect();
          const row = part('toolbar-first-row');
          const workspace = box(part('workspace'));
          const area = box(part('toolbar-area'));
          const sides = [...element.parentElement.querySelectorAll('aside')].map(box);
          return {
            areaWidth: area.width, workspaceWidth: workspace.width,
            grid: getComputedStyle(part('toolbar')).display,
            editingWrap: getComputedStyle(part('editing-tools')).flexWrap,
            aligned: sides.every(side => Math.abs(side.top - workspace.top) <= 1 && side.top >= area.bottom - 1),
            adjacent: row.lastElementChild === part('navigation-tools') && row.lastElementChild.previousElementSibling.classList.contains('insert-tools'),
            navCount: root.querySelectorAll('[part="navigation-tools"]').length,
          };
        });
        assert.ok(layout.areaWidth > layout.workspaceWidth && layout.areaWidth > width - 64, JSON.stringify(layout));
        assert.ok(Math.abs(layout.workspaceWidth - 320) <= 1 && layout.aligned, JSON.stringify(layout));
        assert.equal(layout.grid, width === 2000 ? 'grid' : 'flex');
        assert.equal(layout.editingWrap, width === 900 ? 'wrap' : 'nowrap');
        assert.ok(layout.adjacent && layout.navCount === 1);
        if (width === 2000) {
          await editor.locator('[part="find-toggle"]').click();
          const query = editor.locator('[part="find-query"]');
          await query.waitFor({ state: 'visible' });
          assert.equal(await query.evaluate(node => getComputedStyle(node).flexBasis), '100%',
            'Find uses the narrow document workspace while the page-wide toolbar uses its wide layout');
          await editor.locator('[part="find-toggle"]').click();
        }
      }
      await editor.locator('#tool-page-break').getByRole('button').focus();
      const tabOrder = [];
      const maxStops = await editor.locator('[part="toolbar-first-row"] lr-button').count() * 2;
      for (let step = 0; step < maxStops && !tabOrder.includes('tool-outline'); step++) {
        await page.keyboard.press('Tab');
        tabOrder.push(await editor.evaluate(element => element.shadowRoot.activeElement?.id));
      }
      assert.ok(tabOrder.includes('tool-commands') && tabOrder.indexOf('tool-commands') < tabOrder.indexOf('tool-outline'),
        JSON.stringify(tabOrder));
      await editor.locator('lr-tooltip[for="tool-outline"]').getByRole('tooltip').waitFor({ state: 'visible' });
      for (const placement of ['separate', 'first-row']) {
        await editor.evaluate(async (element, placement) => {
          element.documentToolsPlacement = placement;
          await element.updateComplete;
        }, placement);
        await page.waitForFunction(id => document.getElementById(id).shadowRoot.activeElement?.id === 'tool-outline', id);
      }
      await editor.locator('.docx-pages').click();
      await page.keyboard.insertText('Retained toolbar selection');
      await page.waitForFunction(id => document.getElementById(id).snapshot()?.revision?.value > 0, id);
      await page.keyboard.press('End');
      await page.keyboard.press('Shift+Home');
      await page.waitForFunction(id => document.getElementById(id).snapshot()?.selection?.kind === 'text', id);
      const before = await editor.evaluate(element => element.snapshot().revision.value);
      await page.keyboard.press('Alt+F10');
      assert.equal(await editor.evaluate(element => element.shadowRoot.activeElement?.getAttribute('data-command')), 'bold');
      await page.keyboard.press('ArrowRight');
      assert.equal(await editor.evaluate(element => element.shadowRoot.activeElement?.getAttribute('data-command')), 'italic');
      await page.keyboard.press('Enter');
      await page.waitForFunction(({ id, before }) => document.getElementById(id).snapshot().revision.value > before, { id, before });
      const xml = zipEntry(await saveEditor(page, id), 'word/document.xml');
      assert.match(xml, /<w:i(?:\s|\/|>)/u);
      assert.match(xml, /Retained toolbar selection/u);
      await editor.evaluate(element => { element.hidden = true; });
      assert.equal(await editor.locator('[part="toolbar-area"]').isVisible(), false);
      assert.equal(await editor.locator('[part="workspace"]').isVisible(), false);
      assert.deepEqual(await editor.evaluate(async element => {
        element.hidden = false;
        element.removeAttribute('toolbar-placement');
        element.removeAttribute('document-tools-placement');
        await element.updateComplete;
        return [element.toolbarPlacement, element.documentToolsPlacement, element.snapshot().status];
      }), ['inline', 'separate', 'ready']);
    } finally {
      await style.evaluate(node => node.remove());
      await page.evaluate(() => {
        const fixture = document.querySelector('#fixture');
        fixture.classList.remove('toolbar-page');
        fixture.replaceChildren();
      });
      if (size) await page.setViewportSize(size);
    }
  });
}
