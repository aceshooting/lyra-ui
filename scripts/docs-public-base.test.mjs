import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const standalone = 'https://aceshooting.github.io/lyra-ui/';
const branded = 'https://docs.example.test/reference/';
const credentialBase = new URL(branded);
credentialBase.username = 'fixture';
credentialBase.password = 'synthetic-password';

function sitemapFixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-docs-base-'));
  try {
    for (const folder of ['scripts', '.storybook', 'storybook-static']) mkdirSync(join(root, folder));
    for (const file of ['generate-sitemap.mjs', 'docs-public-base.mjs']) {
      const source = new URL(file, import.meta.url);
      if (existsSync(source)) copyFileSync(source, join(root, 'scripts', file));
    }
    writeFileSync(join(root, 'storybook-static/index.json'), JSON.stringify({ entries: {
      'zeta--docs': { type: 'docs' },
      'alpha--docs': { type: 'docs' },
      'alpha--example': { type: 'story' },
    } }));
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('custom sitemap generation preserves the standalone source and records the artifact base', () => {
  sitemapFixture((root) => {
    const result = spawnSync(process.execPath, ['scripts/generate-sitemap.mjs'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, LYRA_DOCS_BASE_URL: branded },
    });
    assert.equal(result.status, 0, result.stderr);
    const source = readFileSync(join(root, '.storybook/sitemap.xml'), 'utf8');
    const built = readFileSync(join(root, 'storybook-static/sitemap.xml'), 'utf8');
    assert.ok(built.includes(`<loc>${branded}</loc>`), 'the built sitemap must use the selected public base');
    assert.ok(built.includes(`${branded}?path=/docs/alpha--docs`));
    assert.ok(source.includes(`<loc>${standalone}</loc>`));
    assert.ok(!source.includes(branded));
    assert.ok(!built.includes('alpha--example'));
    assert.ok(built.indexOf('alpha--docs') < built.indexOf('zeta--docs'));
    assert.equal(readFileSync(join(root, 'storybook-static/robots.txt'), 'utf8'),
      `User-agent: *\nAllow: /\n\nSitemap: ${branded}sitemap.xml\n`);
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'storybook-static/docs-public-base.json'), 'utf8')),
      { schemaVersion: 1, publicBase: branded });
  });
});

test('an unset override keeps standalone metadata and does not read a caller environment implicitly', async () => {
  const { resolveDocsPublicBase } = await import('./docs-public-base.mjs');
  assert.equal(resolveDocsPublicBase(undefined), standalone);
  assert.equal(resolveDocsPublicBase('https://docs.example.test/reference'), branded);
  assert.equal(resolveDocsPublicBase('https://docs.example.test'), 'https://docs.example.test/');
});

test('invalid public bases fail before generation overwrites existing artifacts', async () => {
  const { resolveDocsPublicBase } = await import('./docs-public-base.mjs');
  for (const invalid of ['', '/docs/', '//docs.example.test/', 'http://docs.example.test/',
    'javascript:alert(1)', credentialBase.href,
    'https://docs.example.test/?preview=1', 'https://docs.example.test/#guide',
    'https://docs.example.test/?', 'https://docs.example.test/#',
    ' https://docs.example.test/', 'https://docs.example.test/\n',
    'https://docs.example.test/\\guide', 'https://docs.example.test/<script>']) {
    assert.throws(() => resolveDocsPublicBase(invalid), /LYRA_DOCS_BASE_URL/, invalid);
  }
  sitemapFixture((root) => {
    writeFileSync(join(root, 'storybook-static/sitemap.xml'), 'retain');
    const result = spawnSync(process.execPath, ['scripts/generate-sitemap.mjs'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, LYRA_DOCS_BASE_URL: credentialBase.href },
    });
    assert.notEqual(result.status, 0);
    assert.ok(!result.stderr.includes(credentialBase.password), 'configuration errors must not echo credentials');
    assert.equal(readFileSync(join(root, 'storybook-static/sitemap.xml'), 'utf8'), 'retain');
  });
});

test('manager metadata uses correct HTML and JSON escaping without changing repository URLs', async () => {
  const { renderDocsManagerHead } = await import('./docs-public-base.mjs');
  const template = readFileSync(new URL('../.storybook/manager-head.html', import.meta.url), 'utf8');
  const base = 'https://docs.example.test/research&development/';
  const head = renderDocsManagerHead(template, base);
  assert.match(head, /rel="canonical" href="https:\/\/docs\.example\.test\/research&amp;development\/"/);
  assert.match(head, /property="og:url" content="https:\/\/docs\.example\.test\/research&amp;development\/"/);
  const json = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(json.url, base);
  assert.equal(json.codeRepository, 'https://github.com/aceshooting/lyra-ui');
  assert.ok(!head.includes('__LYRA_DOCS_'));
  assert.throws(() => renderDocsManagerHead('<meta name="description" content="docs">', base), /template/);
});

test('sitemap URLs encode story identifiers and escape XML without inventing separate documents', async () => {
  const { renderDocsSitemap } = await import('./docs-public-base.mjs');
  const xml = renderDocsSitemap(['alpha&beta--docs'], 'https://docs.example.test/research&development/');
  assert.ok(xml.includes('https://docs.example.test/research&amp;development/?path=/docs/alpha%26beta--docs'));
  assert.ok(xml.includes('one index.html'));
});

test('artifact metadata checks catch mixed build profiles and unrendered templates', async () => {
  const { docsPublicMetadataErrors, renderDocsManagerHead } = await import('./docs-public-base.mjs');
  const template = readFileSync(new URL('../.storybook/manager-head.html', import.meta.url), 'utf8');
  const rendered = renderDocsManagerHead(template, branded);
  assert.deepEqual(docsPublicMetadataErrors(rendered, branded), []);
  assert.deepEqual(docsPublicMetadataErrors(rendered, standalone),
    ['canonical', 'Open Graph URL', 'structured-data URL']);
  assert.ok(docsPublicMetadataErrors(template, branded).includes('unrendered public-base token'));
});

test('URL dollar sequences are literal data when replacing manager template tokens', async () => {
  const { docsPublicMetadataErrors, renderDocsManagerHead } = await import('./docs-public-base.mjs');
  const template = readFileSync(new URL('../.storybook/manager-head.html', import.meta.url), 'utf8');
  const base = 'https://docs.example.test/cash$&notes/';
  assert.deepEqual(docsPublicMetadataErrors(renderDocsManagerHead(template, base), base), []);
});
