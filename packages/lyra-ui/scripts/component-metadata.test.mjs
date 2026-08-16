import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  annotateComponentSource,
  applyComponentMetadataToManifest,
  applyMaturityToInventory,
  buildReleaseHistory,
  compareVersions,
  componentMetadataByTag,
  deriveSinceByTag,
  manifestComponentTags,
  parseVersion,
  partitionReleaseHistoryAtCurrent,
  reconcileCurrentReleaseHistory,
  requireCompleteGitHistory,
  sha256,
  UNRELEASED_VERSION,
  validateComponentMetadata,
  validateManifestMetadataProjection,
} from './component-metadata.mjs';
import { generateManifest } from './generate-manifest.mjs';
import cemConfig from '../custom-elements-manifest.config.js';
import {
  buildComponentMetadataIndex,
  componentMetadataPresentation,
} from '../../../.storybook/component-metadata.js';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(packageDir, relativePath), 'utf8')
  );
}

function fixture() {
  const rawManifest = fs.readFileSync(
    path.join(packageDir, 'custom-elements.json'),
    'utf8'
  );
  return {
    metadata: readJson('scripts/fixtures/component-metadata.json'),
    inventory: readJson('scripts/fixtures/component-inventory.json'),
    manifest: JSON.parse(rawManifest),
    packageJson: readJson('package.json'),
    rawManifest,
  };
}

test('checked-in metadata covers the current manifest and inventory', () => {
  const state = fixture();
  assert.deepEqual(validateComponentMetadata(state.metadata, state), []);
  assert.equal(state.metadata.assignments['published-stable'].length, 259);
  assert.equal(state.metadata.assignments['published-experimental'].length, 2);
  assert.equal(state.metadata.assignments['mapped-experimental'].length, 1);
  assert.equal(
    state.metadata.assignments['introduced-mapped-experimental'].length,
    2
  );
  assert.equal(state.metadata.assignments['compatibility-stable'].length, 1);
  assert.equal(state.metadata.assignments['introduced-stable'].length, 19);
  assert.equal(state.metadata.deprecations.length, 10);
});

test('new mirrors of experimental upstream media surfaces remain experimental everywhere authored', () => {
  const state = fixture();
  const maturity = componentMetadataByTag(state.metadata, {
    tags: ['lr-video', 'lr-video-playlist'],
    packageVersion: state.packageJson.version,
  });

  for (const tag of ['lr-video', 'lr-video-playlist']) {
    assert.equal(maturity.get(tag).status, 'experimental', `${tag} status`);
    assert.equal(
      maturity.get(tag).profile,
      'introduced-mapped-experimental',
      `${tag} profile`
    );
  }

  for (const relativePath of [
    'src/components/media/video/video.class.ts',
    'src/components/media/video-playlist/video-playlist.class.ts',
  ]) {
    assert.match(
      fs.readFileSync(path.join(packageDir, relativePath), 'utf8'),
      /@status experimental/
    );
  }
  for (const relativePath of [
    'src/components/media/video/video.stories.ts',
    'src/components/media/video-playlist/video-playlist.stories.ts',
  ]) {
    assert.match(
      fs.readFileSync(path.join(packageDir, relativePath), 'utf8'),
      /tags: \['autodocs', 'experimental'\]/
    );
  }

  const mediaDocs = fs.readFileSync(
    path.join(packageDir, 'llms/media.md'),
    'utf8'
  );
  assert.match(mediaDocs, /## `lr-video`\n\nExperimental\b/);
  assert.match(mediaDocs, /## `lr-video-playlist`\n\nExperimental\b/);
});

test('exact tag history derives the earliest release and leaves renamed prefixes distinct', () => {
  const history = {
    releases: [
      { version: '3.9.0', manifestPresent: true, tags: ['lyra-example'] },
      { version: '4.0.0', manifestPresent: true, tags: ['lr-example'] },
      {
        version: '4.1.0',
        manifestPresent: true,
        tags: ['lr-example', 'lr-later'],
      },
      { version: '5.0.0', manifestPresent: true, tags: ['lr-later'] },
    ],
    current: {
      version: '8.0.0',
      tags: ['lr-current', 'lr-example', 'lr-later'],
    },
  };

  assert.deepEqual(Object.fromEntries(deriveSinceByTag(history)), {
    'lyra-example': '3.9.0',
    'lr-example': '4.0.0',
    'lr-later': '4.1.0',
    'lr-current': '8.0.0',
  });
});

test('history provenance rejects malformed commit, blob, and digest evidence', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  const release = metadata.history.releases.find(
    (entry) => entry.manifestPresent
  );
  release.sourceCommit = 'not-a-commit';
  release.manifestBlob = 'not-a-blob';
  release.manifestSha256 = 'not-a-digest';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.includes(
      `${release.tag}: missing or invalid source commit provenance`
    )
  );
  assert.ok(
    findings.includes(`${release.tag}: manifest blob must be a Git object id`)
  );
  assert.ok(
    findings.includes(`${release.tag}: manifest digest must be SHA-256`)
  );
});

test('a proven current release tag is allowed, then rolls into history on the next version write', () => {
  const prior = {
    tag: 'lyra-ui@7.8.1',
    version: '7.8.1',
    sourceCommit: '1'.repeat(40),
    manifestPresent: true,
    manifestBlob: '2'.repeat(40),
    manifestSha256: '3'.repeat(64),
    tags: ['lr-a'],
  };
  const current = {
    version: '8.0.0',
    sourceCommit: null,
    manifestSha256: '4'.repeat(64),
    tags: ['lr-a', 'lr-new'],
  };
  const taggedCurrent = {
    tag: 'lyra-ui@8.0.0',
    version: '8.0.0',
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: current.manifestSha256,
    tags: current.tags,
  };
  const history = { releases: [prior], current };

  assert.deepEqual(
    partitionReleaseHistoryAtCurrent([prior, taggedCurrent], current),
    {
      releases: [prior],
      taggedCurrent,
      currentRelease: taggedCurrent,
    }
  );
  assert.deepEqual(
    reconcileCurrentReleaseHistory(history, [prior, taggedCurrent]),
    {
      releases: [prior],
      taggedCurrent,
      currentRelease: taggedCurrent,
    }
  );
  assert.deepEqual(
    reconcileCurrentReleaseHistory(history, [prior, taggedCurrent], {
      rolloverCurrent: true,
    }),
    {
      releases: [prior, taggedCurrent],
      taggedCurrent: null,
      currentRelease: taggedCurrent,
    }
  );
});

test('tagged snapshot stays immutable while same-version worktree current evolves, then rolls over', () => {
  const current = {
    version: '8.0.0',
    sourceCommit: null,
    manifestSha256: '8'.repeat(64),
    tags: ['lr-a', 'lr-unreleased'],
  };
  const taggedCurrent = {
    tag: 'lyra-ui@8.0.0',
    version: '8.0.0',
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: '4'.repeat(64),
    tags: ['lr-a'],
  };
  const history = { releases: [], taggedCurrent, current };

  assert.deepEqual(reconcileCurrentReleaseHistory(history, [taggedCurrent]), {
    releases: [],
    taggedCurrent,
    currentRelease: taggedCurrent,
  });
  assert.deepEqual(
    reconcileCurrentReleaseHistory(history, [taggedCurrent], {
      rolloverCurrent: true,
    }),
    {
      releases: [taggedCurrent],
      taggedCurrent: null,
      currentRelease: taggedCurrent,
    }
  );
  assert.deepEqual(Object.fromEntries(deriveSinceByTag(history)), {
    'lr-a': '8.0.0',
  });
});

test('full-history checks require a persisted snapshot once same-version current diverges', () => {
  const taggedCurrent = {
    tag: 'lyra-ui@8.0.0',
    version: '8.0.0',
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: '4'.repeat(64),
    tags: ['lr-a'],
  };
  const exactHistory = {
    releases: [],
    current: {
      version: '8.0.0',
      sourceCommit: null,
      manifestSha256: taggedCurrent.manifestSha256,
      tags: taggedCurrent.tags,
    },
  };
  assert.doesNotThrow(() =>
    reconcileCurrentReleaseHistory(exactHistory, [taggedCurrent], {
      requirePersistedTaggedCurrent: true,
    })
  );

  const evolvedHistory = structuredClone(exactHistory);
  evolvedHistory.current.manifestSha256 = '8'.repeat(64);
  evolvedHistory.current.tags.push('lr-unreleased');
  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(evolvedHistory, [taggedCurrent], {
        requirePersistedTaggedCurrent: true,
      }),
    /history\.taggedCurrent must persist the immutable release snapshot/
  );
  assert.equal(
    reconcileCurrentReleaseHistory(evolvedHistory, [taggedCurrent])
      .taggedCurrent,
    taggedCurrent
  );
});

test('component metadata fails closed in a shallow clone', () => {
  const temp = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lyra-component-metadata-')
  );
  const source = path.join(temp, 'source');
  const shallow = path.join(temp, 'shallow');
  try {
    fs.mkdirSync(source);
    execFileSync('git', ['init', '--quiet'], { cwd: source });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], {
      cwd: source,
    });
    execFileSync('git', ['config', 'user.name', 'Lyra Test'], { cwd: source });
    fs.writeFileSync(path.join(source, 'README.md'), 'fixture\n');
    execFileSync('git', ['add', 'README.md'], { cwd: source });
    execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], {
      cwd: source,
    });
    execFileSync('git', [
      'clone',
      '--quiet',
      '--depth',
      '1',
      `file://${source}`,
      shallow,
    ]);
    assert.throws(
      () => requireCompleteGitHistory(shallow),
      /requires a non-shallow clone with release tags/
    );
    assert.doesNotThrow(() => requireCompleteGitHistory(source));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('buildReleaseHistory hashes the exact committed manifest bytes, trailing newline included', () => {
  // custom-elements.json is always committed with a trailing newline (see writeJson in
  // generate-component-metadata.mjs). buildReleaseHistory must hash that file exactly as
  // committed -- not a version with the trailing newline stripped -- or its manifestSha256 can
  // never match history.current.manifestSha256, which is always hashed from the untrimmed bytes.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-release-history-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: temp });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], {
      cwd: temp,
    });
    execFileSync('git', ['config', 'user.name', 'Lyra Test'], { cwd: temp });
    const manifestRelativePath = 'custom-elements.json';
    const manifestContent = '{"schemaVersion":"1.0.0","modules":[]}\n';
    fs.writeFileSync(path.join(temp, manifestRelativePath), manifestContent);
    execFileSync('git', ['add', manifestRelativePath], { cwd: temp });
    execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: temp });
    execFileSync('git', ['tag', 'lyra-ui@9.9.9'], { cwd: temp });

    const [release] = buildReleaseHistory(temp, manifestRelativePath);
    assert.equal(release.tag, 'lyra-ui@9.9.9');
    assert.equal(release.manifestPresent, true);
    assert.equal(release.manifestSha256, sha256(manifestContent));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('a post-tag component remains unreleased until the package version advances', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  // Isolate this synthetic scenario from whatever real historical releases the checked-in
  // fixture happens to carry -- otherwise a component that has genuinely shipped before (like
  // the 'lr-page' this test strips from the synthetic taggedCurrent) still resolves a since
  // version from history.releases, defeating the "unreleased" assertion below.
  metadata.history.releases = [];
  metadata.history.taggedCurrent = {
    tag: `lyra-ui@${state.packageJson.version}`,
    version: state.packageJson.version,
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: '7'.repeat(64),
    tags: metadata.history.current.tags.filter((tag) => tag !== 'lr-page'),
  };

  assert.equal(deriveSinceByTag(metadata.history).has('lr-page'), false);
  assert.equal(
    componentMetadataByTag(metadata, {
      tags: ['lr-page'],
      packageVersion: state.packageJson.version,
    }).get('lr-page').since,
    UNRELEASED_VERSION
  );
});

test('current-tag history reconciliation fails closed on provenance and immutable tag drift', () => {
  const current = {
    version: '8.0.0',
    sourceCommit: null,
    manifestSha256: '8'.repeat(64),
    tags: ['lr-a', 'lr-unreleased'],
  };
  const taggedCurrent = {
    tag: 'lyra-ui@8.0.0',
    version: '8.0.0',
    sourceCommit: '5'.repeat(40),
    manifestPresent: true,
    manifestBlob: '6'.repeat(40),
    manifestSha256: '4'.repeat(64),
    tags: ['lr-a'],
  };
  const history = { releases: [], taggedCurrent, current };

  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(history, [
        {
          ...taggedCurrent,
          sourceCommit: 'not-a-commit',
          manifestBlob: 'not-a-blob',
        },
      ]),
    /source commit provenance.*manifest blob provenance/
  );
  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(history, [
        {
          ...taggedCurrent,
          manifestSha256: '7'.repeat(64),
        },
      ]),
    /differs from immutable Git tag evidence/
  );
  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(history, [
        {
          ...taggedCurrent,
          tags: ['lr-other'],
        },
      ]),
    /differs from immutable Git tag evidence/
  );
  assert.throws(
    () =>
      reconcileCurrentReleaseHistory(history, [
        {
          ...taggedCurrent,
          version: '8.0.1',
          tag: 'lyra-ui@8.0.1',
        },
      ]),
    /missing from Git history/
  );
});

test('version comparison is numeric and rejects malformed versions', () => {
  assert.ok(compareVersions('4.10.0', '4.9.0') > 0);
  assert.ok(compareVersions('8.0.0-beta.1', '8.0.0') < 0);
  assert.deepEqual(parseVersion('10.2.3'), {
    major: 10,
    minor: 2,
    patch: 3,
    prerelease: null,
  });
  assert.equal(parseVersion('v8'), null);
});

test('manifest tag discovery ignores non-elements and sorts exact public tags', () => {
  const manifest = {
    modules: [
      {
        declarations: [
          { customElement: true, tagName: 'lr-z' },
          { customElement: false, tagName: 'lr-hidden' },
          { customElement: true, tagName: 'lr-a' },
          { kind: 'class', name: 'Helper' },
        ],
      },
    ],
  };
  assert.deepEqual(manifestComponentTags(manifest), ['lr-a', 'lr-z']);
});

test('validation fails closed on missing assignments and experimental semver exemptions', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.assignments['published-stable'].splice(
    metadata.assignments['published-stable'].indexOf('lr-graph'),
    1
  );
  metadata.policy.semverCoverage.experimental = 'best-effort';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.some((finding) =>
      finding.includes('lr-graph: no authored maturity assignment')
    )
  );
  assert.ok(
    findings.some((finding) =>
      finding.includes(
        'experimental APIs must both retain full semver coverage'
      )
    )
  );
});

test('validation rejects a removal in the immediately following major and a missing replacement', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  const icon = metadata.deprecations.find((entry) => entry.tag === 'lr-icon');
  icon.removalNotBefore = '9.0.0';
  icon.replacement.name = 'missingCanvas';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.some((finding) =>
      finding.includes('complete subsequent major release')
    )
  );
  assert.ok(
    findings.some((finding) =>
      finding.includes('replacement property missingCanvas does not exist')
    )
  );
});

test('validation rejects unsorted, pre-introduction, and future deprecation records', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.deprecations.reverse();
  const icon = metadata.deprecations.find((entry) => entry.tag === 'lr-icon');
  icon.since = '3.0.0';
  const knownDate = metadata.deprecations.find(
    (entry) => entry.tag === 'lr-known-date' && entry.name === 'label'
  );
  // A version that will realistically never be the real current package version -- this test
  // broke the day the real version became exactly '9.0.0' (the literal it used to hardcode here),
  // since a deprecation dated to exactly the current release is valid, not "after" it.
  knownDate.since = '999.0.0';
  knownDate.removalNotBefore = '1001.0.0';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.includes('deprecations must be sorted by tag, kind, and name')
  );
  assert.ok(
    findings.some((finding) =>
      finding.includes(
        "lr-icon:property:autoWidth: deprecation cannot predate the component's 4.0.0 introduction"
      )
    )
  );
  assert.ok(
    findings.some((finding) =>
      finding.includes(
        'lr-known-date:part:label: deprecation cannot start after the current package version'
      )
    )
  );
});

// Only `part` deprecations remain in the ledger: 9.0.0 removed the last recorded `event` records
// (lr-tool-call-chip/lr-message-parts' `lr-tool-chip-select`) and the last `css-property` one
// (lr-flow-canvas' `--lr-flow-canvas-node-current-outline-color`), all three having reached their
// recorded `removalNotBefore: "9.0.0"`. Re-widen this to the kinds actually present if a future
// release records an event or CSS-property deprecation again.
test('validation covers prose-only part deprecations', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.deprecations = metadata.deprecations.filter(
    (entry) => entry.tag !== 'lr-sparkline'
  );

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(
    findings.includes(
      'lr-sparkline:part:base: manifest deprecation has no policy record'
    )
  );
});

test('applying metadata changes only maturity records and remains deterministic', () => {
  const state = fixture();
  const stripped = structuredClone(state.inventory);
  for (const component of stripped.components) {
    component.maturity = {
      status: 'unclassified',
      since: null,
      deprecated: null,
    };
  }
  stripped.pins.lyraVersion = '7.8.1';
  const applied = applyMaturityToInventory(state.metadata, stripped);
  const second = applyMaturityToInventory(state.metadata, applied);
  assert.deepEqual(second, applied);
  assert.equal(
    applied.components.find((entry) => entry.tag === 'lr-graph').maturity.since,
    '4.0.0'
  );
  assert.equal(
    applied.components.find((entry) => entry.tag === 'lr-page').maturity.since,
    '8.0.0'
  );
  assert.equal(
    applied.components.find((entry) => entry.tag === 'lr-icon').maturity
      .deprecations.length,
    1
  );
  assert.equal(applied.pins.lyraVersion, state.packageJson.version);
});

test('validation rejects a stale component-inventory Lyra version pin', () => {
  const state = fixture();
  const inventory = structuredClone(state.inventory);
  inventory.pins.lyraVersion = '7.8.1';
  assert.ok(
    validateComponentMetadata(state.metadata, { ...state, inventory }).includes(
      'inventory.pins.lyraVersion must match package.json'
    )
  );
});

test('CEM projection surfaces status, since, policy, and structured member deprecation metadata', () => {
  const state = fixture();
  const manifest = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  });

  const declarations = manifest.modules.flatMap(
    (module) => module.declarations ?? []
  );
  const graph = declarations.find((entry) => entry.tagName === 'lr-graph');
  assert.equal(graph.status, 'stable');
  assert.equal(graph.since, '4.0.0');
  assert.equal(graph.maturity.profile, 'published-stable');
  assert.match(graph.maturity.graduationCriteria, /Already stable/);

  const icon = declarations.find((entry) => entry.tagName === 'lr-icon');
  const autoWidth = icon.members.find(
    (entry) => entry.kind === 'field' && entry.name === 'autoWidth'
  );
  const autoWidthAttribute = icon.attributes.find(
    (entry) => entry.name === 'auto-width'
  );
  assert.equal(icon.deprecations.length, 1);
  assert.equal(autoWidth.deprecation.since, '8.0.0');
  assert.deepEqual(autoWidth.deprecation.replacement, {
    kind: 'property',
    name: 'canvas',
    usage: 'canvas="auto"',
  });
  assert.equal(autoWidth.deprecation.removalNotBefore, '10.0.0');
  assert.deepEqual(autoWidthAttribute.deprecation, autoWidth.deprecation);

  const knownDate = declarations.find(
    (entry) => entry.tagName === 'lr-known-date'
  );
  const knownDateLabelPart = knownDate.cssParts.find(
    (entry) => entry.name === 'label'
  );
  assert.deepEqual(knownDateLabelPart.deprecation.replacement, {
    kind: 'part',
    name: 'form-control-label',
    usage: '::part(form-control-label)',
  });
  assert.equal(knownDateLabelPart.deprecation.removalNotBefore, '10.0.0');
  assert.deepEqual(
    validateManifestMetadataProjection(state.metadata, manifest, {
      packageVersion: state.packageJson.version,
    }),
    []
  );
});

test('authored compatibility parts carry deprecation markers before metadata validation', async () => {
  const { manifest } = await generateManifest({ write: false });
  const declarations = new Map(
    manifest.modules
      .flatMap((module) => module.declarations ?? [])
      .filter((declaration) => declaration.tagName)
      .map((declaration) => [declaration.tagName, declaration])
  );

  for (const [tag, parts] of [
    ['lr-file-input', ['base', 'label']],
    ['lr-qr-code', ['base']],
  ]) {
    const declaration = declarations.get(tag);
    assert.ok(declaration, `${tag} declaration`);
    for (const name of parts) {
      const part = declaration.cssParts?.find((entry) => entry.name === name);
      assert.ok(part, `${tag}::part(${name})`);
      assert.match(
        part.description ?? '',
        /^Deprecated\b/i,
        `${tag}::part(${name}) source marker`
      );
      assert.equal(
        part.deprecation?.kind,
        'part',
        `${tag}::part(${name}) structured policy`
      );
      assert.ok(
        part.deprecation?.replacement?.name,
        `${tag}::part(${name}) replacement`
      );
    }
  }
});

test('Storybook presentation exposes central maturity and structured deprecations', () => {
  const state = fixture();
  const manifest = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  });
  const index = buildComponentMetadataIndex(manifest);
  const presentation = componentMetadataPresentation(
    index.get('lr-date-input')
  );

  assert.equal(presentation.status, 'experimental');
  assert.equal(presentation.since, '4.0.0');
  assert.match(
    presentation.rationale,
    /remains experimental under full semver protection/
  );
  assert.match(
    presentation.graduationCriteria,
    /demonstrate sustained reliability/
  );
  assert.deepEqual(presentation.deprecations, []);

  const knownDatePresentation = componentMetadataPresentation(
    index.get('lr-known-date')
  );
  assert.deepEqual(
    knownDatePresentation.deprecations.map((entry) => ({
      subject: entry.subject,
      since: entry.since,
      replacement: entry.replacement,
      removalNotBefore: entry.removalNotBefore,
    })),
    [
      {
        subject: 'part label',
        since: '8.0.0',
        replacement: '::part(form-control-label)',
        removalNotBefore: '10.0.0',
      },
    ]
  );
  assert.equal(componentMetadataPresentation({ status: 'stable' }), null);
});

test('CEM projection reports drift and marks a new assigned tag unreleased once current is tagged', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.assignments['new-component-experimental'].push('lr-new-component');
  const resolved = componentMetadataByTag(metadata, {
    tags: ['lr-new-component'],
    packageVersion: state.packageJson.version,
  });
  assert.equal(resolved.get('lr-new-component').status, 'experimental');
  // The checked-in fixture's history.taggedCurrent is the persisted immutable snapshot of what
  // actually shipped at the current package version's release tag. A brand-new tag that isn't
  // part of that snapshot hasn't shipped yet -- it's unreleased until the next version bump, not
  // retroactively "since" a version that already went out without it. That only holds once
  // taggedCurrent is actually populated, though: scripts/publish.sh runs this exact suite between
  // bumping package.json and creating the release tag, a window where
  // generate-component-metadata.mjs --write deliberately nulls taggedCurrent out (the just-bumped
  // version genuinely isn't tagged yet -- see reconcileCurrentReleaseHistory's rolloverCurrent
  // branch). In that transient state a brand-new tag is correctly stamped "since: packageVersion"
  // instead (it's shipping in the release being prepared) -- mirror the same taggedCurrent check
  // componentMetadataByTag itself branches on rather than hardcoding the steady-state-only answer.
  assert.equal(
    resolved.get('lr-new-component').since,
    metadata.history?.taggedCurrent
      ? UNRELEASED_VERSION
      : state.packageJson.version
  );

  const manifest = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  });
  const graph = manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .find((entry) => entry.tagName === 'lr-graph');
  graph.since = '8.0.0';
  assert.deepEqual(
    validateManifestMetadataProjection(state.metadata, manifest, {
      packageVersion: state.packageJson.version,
    }),
    ['lr-graph: manifest maturity/deprecation projection drifted']
  );
});

test('the final analyzer plugin projects central metadata into generated CEM', () => {
  const plugin = cemConfig.plugins.find(
    (entry) => entry.name === 'lr-component-maturity-metadata'
  );
  assert.ok(plugin);
  const manifest = {
    modules: [
      {
        declarations: [
          {
            kind: 'class',
            name: 'LyraGraph',
            customElement: true,
            tagName: 'lr-graph',
          },
        ],
      },
    ],
  };
  plugin.packageLinkPhase({ customElementsManifest: manifest });
  assert.equal(manifest.modules[0].declarations[0].status, 'stable');
  assert.equal(manifest.modules[0].declarations[0].since, '4.0.0');
});

test('the registration analyzer records module-evaluation definitions but ignores lazy helper calls', () => {
  const plugin = cemConfig.plugins.find(
    (entry) => entry.name === 'lr-define-element-registration'
  );
  assert.ok(plugin);
  const SyntaxKind = {
    CallExpression: 1,
    SourceFile: 2,
    FunctionDeclaration: 3,
  };
  const sourceFile = { kind: SyntaxKind.SourceFile, parent: null };
  const expressionStatement = { kind: 99, parent: sourceFile };
  const helperFunction = {
    kind: SyntaxKind.FunctionDeclaration,
    parent: sourceFile,
  };
  const lazyExpressionStatement = { kind: 99, parent: helperFunction };
  const call = (parent) => ({
    kind: SyntaxKind.CallExpression,
    parent,
    expression: { getText: () => 'defineElement' },
    arguments: [{ text: 'fixture' }, { getText: () => 'LyraFixture' }],
  });

  const moduleDoc = { exports: [] };
  plugin.analyzePhase({
    ts: { SyntaxKind },
    node: call(lazyExpressionStatement),
    moduleDoc,
  });
  assert.deepEqual(
    moduleDoc.exports,
    [],
    'a function-scoped helper call is not an import-time definition'
  );

  plugin.analyzePhase({
    ts: { SyntaxKind },
    node: call(expressionStatement),
    moduleDoc,
  });
  assert.deepEqual(moduleDoc.exports, [
    {
      kind: 'custom-element-definition',
      name: 'lr-fixture',
      declaration: { name: 'LyraFixture' },
    },
  ]);
});

test('generated CSS custom-property names are concrete valid identifiers', () => {
  const state = fixture();
  const graph = state.manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .find((entry) => entry.tagName === 'lr-graph');
  const names = graph.cssProperties.map((entry) => entry.name);

  assert.equal(
    names.some((name) => name.includes('..')),
    false
  );
  for (let index = 1; index <= 8; index += 1) {
    assert.ok(
      names.includes(`--lr-graph-cat-${index}`),
      `missing concrete graph palette slot ${index}`
    );
  }
});

test('source annotations replace stale tags on the exact component JSDoc idempotently', () => {
  const source = `/** Helper documentation. */
export class Helper {}

/**
 * Component documentation.
 * @customElement lr-example
 * @status experimental
 * @since 3.8
 */
export class LyraExample {}
`;
  const expected = `/** Helper documentation. */
export class Helper {}

/**
 * Component documentation.
 * @customElement lr-example
 * @status stable
 * @since 4.0.0
 */
export class LyraExample {}
`;
  const annotated = annotateComponentSource(source, {
    tag: 'lr-example',
    status: 'stable',
    since: '4.0.0',
  });
  assert.equal(annotated, expected);
  assert.equal(
    annotateComponentSource(annotated, {
      tag: 'lr-example',
      status: 'stable',
      since: '4.0.0',
    }),
    expected
  );
});

test('source annotation fails closed when the component JSDoc is detached', () => {
  assert.throws(
    () =>
      annotateComponentSource(
        `/**
 * @customElement lr-example
 */
const detached = true;
export class LyraExample {}
`,
        {
          tag: 'lr-example',
          status: 'stable',
          since: '4.0.0',
        }
      ),
    /directly above/
  );
});
