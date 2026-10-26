import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { chromium, firefox, webkit } from 'playwright';
import { startDashboardHost } from '../../examples/saved-dashboard/host.mjs';

const browsers = { chromium, firefox, webkit };
const engine = process.env.WTR_BROWSER ?? 'chromium';

async function ready(page, state = 'ready') {
  await page.waitForFunction(expected => document.getElementById('workspace')?.dataset.state === expected, state);
}
async function click(page, id, state = 'ready') {
  await page.locator(`#${id}`).click();
  if (['save', 'publish'].includes(id)) { await ready(page, 'review'); await page.locator('#confirm-change').click(); }
  await ready(page, state);
}
async function heading(page) { return page.locator('lr-gen-view h2').textContent(); }
async function api(page, body, token) {
  return page.evaluate(async ({ body, token }) => {
    const response = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { body, token });
}

test(`durable saved-dashboard host workflow in ${engine}`, { timeout: 120_000 }, async () => {
  assert.ok(browsers[engine], 'Select chromium, firefox or webkit with WTR_BROWSER.');
  const directory = mkdtempSync(join(tmpdir(), 'lyra-dashboard-browser-'));
  let host;
  let browser;
  try {
    host = await startDashboardHost({ directory });
    browser = await browsers[engine].launch({ headless: true });
    const context = await browser.newContext();
    const errors = [];
    const requests = [];
    context.on('page', page => page.on('pageerror', error => { errors.push(error.message); }));
    context.on('request', request => { requests.push(request.url()); });
    const author = await context.newPage();
    await author.goto(`${host.origin}/?session=author`);
    await ready(author);
    await author.locator('#title').getByRole('textbox').fill('Original published inventory');
    await click(author, 'create');
    const id = await author.locator('#workspace').getAttribute('data-document-id');
    const surface = await author.locator('#workspace').getAttribute('data-surface-id');
    assert.ok(id);
    await click(author, 'publish');
    assert.equal(await author.locator('#workspace').getAttribute('data-revision'), '2');

    const viewer = await context.newPage();
    await viewer.goto(`${host.origin}/?session=viewer&mode=published&id=${id}`);
    await ready(viewer);
    assert.equal(await heading(viewer), 'Original published inventory');
    const data = await api(viewer, { operation: 'data', id }, 'fixture-viewer');
    assert.equal(data.status, 200);
    assert.equal(data.body.viewer, 'viewer');
    const attempt = await api(viewer, { operation: 'update', id, expectedRevision: 2, definition: (await api(author, { operation: 'read', id }, 'fixture-author')).body.definition }, 'fixture-viewer');
    assert.equal(attempt.status, 403, 'The server refuses viewer writes independently of UI controls.');
    const spoof = await api(viewer, { operation: 'read', id, role: 'author', tenantId: 'north' }, 'fixture-viewer');
    assert.equal(spoof.status, 400, 'Client-provided authority is not accepted.');

    const editor = await context.newPage();
    await editor.goto(`${host.origin}/?session=editor&mode=draft&id=${id}`);
    await ready(editor);
    await editor.locator('#title').getByRole('textbox').fill('Unpublished editor inventory');
    await click(editor, 'save');
    assert.equal((await api(editor, { operation: 'publish', id, expectedRevision: 3 }, 'fixture-editor')).status, 403);
    await click(viewer, 'refresh');
    assert.equal(await heading(viewer), 'Original published inventory', 'Draft edits must not change published viewers.');

    await author.locator('#title').getByRole('textbox').fill('Author competing proposal');
    await click(author, 'save', 'conflict');
    assert.equal(await author.locator('#title').getByRole('textbox').inputValue(), 'Author competing proposal');
    assert.match(await author.locator('#differences').textContent(), /Unpublished editor inventory/);
    assert.match(await author.locator('#differences').textContent(), /Author competing proposal/);
    await click(author, 'review');
    assert.equal(await author.locator('#title').getByRole('textbox').inputValue(), 'Author competing proposal');
    await click(author, 'save');
    await click(author, 'publish');
    await click(viewer, 'refresh');
    assert.equal(await heading(viewer), 'Author competing proposal');
    const pinned = await api(viewer, { operation: 'resolve', id, policy: { mode: 'pin', revision: 2 } }, 'fixture-viewer');
    assert.equal(pinned.body.definition.title, 'Original published inventory');

    await click(viewer, 'fork');
    const forkId = await viewer.locator('#workspace').getAttribute('data-document-id');
    const forkSurface = await viewer.locator('#workspace').getAttribute('data-surface-id');
    assert.notEqual(forkId, id);
    assert.notEqual(forkSurface, surface);
    await viewer.locator('#title').getByRole('textbox').fill('Independent viewer copy');
    await click(viewer, 'save');
    await click(author, 'refresh');
    assert.equal(await heading(author), 'Author competing proposal');

    await click(author, 'history');
    assert.ok(await author.locator('#revisions li').count() >= 5);
    await author.getByRole('button', { name: 'Restore revision 1', exact: true }).click();
    await ready(author);
    assert.equal(await heading(author), 'Original published inventory');
    const published = await api(author, { operation: 'resolve', id }, 'fixture-viewer');
    assert.equal(published.body.definition.title, 'Author competing proposal', 'Undo creates a draft and does not republish.');

    const foreign = await context.newPage();
    await foreign.goto(`${host.origin}/?session=other-tenant&mode=published&id=${id}`);
    await ready(foreign, 'denied');
    assert.equal(await foreign.locator('lr-gen-view h2').count(), 0);
    const foreignHistory = await api(foreign, { operation: 'history', id }, 'fixture-other-tenant');
    assert.equal(foreignHistory.status, 403);

    // A restarted host instance reopens durable records without a generation request.
    const previousOrigin = host.origin;
    await host.close();
    host = await startDashboardHost({ directory });
    await author.goto(`${host.origin}/?session=author&mode=draft&id=${id}`);
    await ready(author);
    assert.equal(await heading(author), 'Original published inventory');
    await viewer.goto(`${host.origin}/?session=viewer&mode=published&id=${id}`);
    await ready(viewer);
    assert.equal(await heading(viewer), 'Author competing proposal');
    await click(author, 'revoke');
    await click(viewer, 'refresh', 'denied');
    assert.equal(await viewer.locator('lr-gen-view h2').count(), 0);
    const revoked = await api(viewer, { operation: 'resolve', id }, 'fixture-viewer');
    assert.equal(revoked.status, 403);
    const revokedData = await api(viewer, { operation: 'data', id }, 'fixture-viewer');
    assert.equal(revokedData.status, 403);
    assert.deepEqual(errors, []);
    assert.ok(requests.every(url => url.startsWith(`${host.origin}/`) || url.startsWith(`${previousOrigin}/`)), 'The workflow uses only the development host, with no provider/model request.');
  } finally {
    await browser?.close();
    await host?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});


test(`reviewed dashboard changes preserve proposals and conditional writes in ${engine}`, { timeout: 120_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-dashboard-review-'));
  let host;
  let browser;
  try {
    host = await startDashboardHost({ directory });
    browser = await browsers[engine].launch({ headless: true });
    const context = await browser.newContext();
    const author = await context.newPage();
    await author.goto(`${host.origin}/?session=author`);
    await ready(author);
    await author.locator('#title').getByRole('textbox').fill('Saved starting title');
    await click(author, 'create');
    const id = await author.locator('#workspace').getAttribute('data-document-id');
    const read = async () => (await api(author, { operation: 'read', id }, 'fixture-author')).body;

    await author.locator('#title').getByRole('textbox').fill('Cancelled proposal');
    await author.locator('#save').click();
    await author.waitForFunction(() => document.getElementById('workspace').dataset.state !== 'loading');
    assert.equal((await read()).metadata.revision, 1, 'Preview does not write the draft before approval.');
    await ready(author, 'review');
    assert.match(await author.locator('#change-differences').textContent(), /Saved starting title/);
    assert.match(await author.locator('#change-differences').textContent(), /Cancelled proposal/);
    await click(author, 'cancel-change');
    await author.waitForFunction(() => document.getElementById('save').matches(':focus-within'));
    assert.equal(await author.locator('#save').evaluate(button => button.matches(':focus-within')), true);
    assert.equal((await read()).metadata.revision, 1);
    assert.equal(await author.locator('#title').getByRole('textbox').inputValue(), 'Cancelled proposal');

    await author.locator('#title').getByRole('textbox').fill('Exact reviewed proposal');
    await author.locator('#save').click(); await ready(author, 'review');
    await author.locator('#title').getByRole('textbox').fill('A later unsaved edit');
    let releaseWrite;
    let writeStarted;
    const started = new Promise(resolve => { writeStarted = resolve; });
    const released = new Promise(resolve => { releaseWrite = resolve; });
    const holdWrite = async route => {
      if (route.request().postDataJSON()?.operation === 'update') { writeStarted(); await released; }
      await route.continue();
    };
    await author.route('**/api', holdWrite);
    await author.locator('#confirm-change').click();
    await started;
    await author.locator('#title').getByRole('textbox').fill('A later unsaved edit while saving');
    releaseWrite();
    await ready(author);
    await author.unroute('**/api', holdWrite);
    assert.equal((await read()).definition.title, 'Exact reviewed proposal', 'Approval commits the previewed snapshot, not later text edits.');
    assert.equal(await author.locator('#title').getByRole('textbox').inputValue(), 'A later unsaved edit while saving');

    const editor = await context.newPage();
    await editor.goto(`${host.origin}/?session=editor&mode=draft&id=${id}`); await ready(editor);
    await editor.locator('#title').getByRole('textbox').fill('Editor reviewed proposal');
    await editor.locator('#save').click(); await ready(editor, 'review');
    await author.locator('#title').getByRole('textbox').fill('Concurrent author save');
    await author.locator('#save').click(); await ready(author, 'review');
    await click(author, 'confirm-change');
    await click(editor, 'confirm-change', 'conflict');
    assert.equal((await read()).definition.title, 'Concurrent author save');
    assert.equal(await editor.locator('#title').getByRole('textbox').inputValue(), 'Editor reviewed proposal');
    assert.match(await editor.locator('#differences').textContent(), /Editor reviewed proposal/);

    await author.locator('#publish').click(); await ready(author, 'review');
    assert.match(await author.locator('#change-summary').textContent(), /Concurrent author save/);
    await click(author, 'cancel-change');
    assert.equal((await api(author, { operation: 'resolve', id }, 'fixture-author')).status, 400, 'Cancelled publication stays unpublished.');
    await author.locator('#publish').click(); await ready(author, 'review');
    await author.locator('#title').getByRole('textbox').fill('Unsaved after publication preview');
    await click(author, 'confirm-change');
    const published = await api(author, { operation: 'resolve', id }, 'fixture-author');
    assert.equal(published.body.definition.title, 'Concurrent author save');
    assert.equal(await author.locator('#title').getByRole('textbox').inputValue(), 'Unsaved after publication preview');
    assert.equal((await read()).metadata.revision, 4);

    await author.locator('#publish').click(); await ready(author, 'review');
    await editor.reload(); await ready(editor);
    await editor.locator('#title').getByRole('textbox').fill('Newer editor draft');
    await click(editor, 'save');
    await click(author, 'confirm-change', 'conflict');
    assert.equal((await read()).metadata.revision, 5);
    assert.equal((await api(author, { operation: 'resolve', id }, 'fixture-author')).body.definition.title, 'Concurrent author save', 'Publication approval cannot publish a newer unreviewed revision.');
    assert.equal(await author.locator('#title').getByRole('textbox').inputValue(), 'Unsaved after publication preview');
    await editor.locator('#publish').click(); await ready(editor, 'review');
    assert.match(await editor.locator('#change-differences').textContent(), /Concurrent author save/);
    assert.match(await editor.locator('#change-differences').textContent(), /Newer editor draft/);
    await click(editor, 'confirm-change', 'denied');
    assert.equal((await read()).metadata.revision, 5, 'The host still denies editor publication after explicit UI approval.');
    assert.equal(await editor.locator('lr-gen-view h2').count(), 0);
    assert.equal(await editor.locator('#title').getByRole('textbox').inputValue(), 'Newer editor draft');
  } finally {
    await browser?.close(); await host?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
