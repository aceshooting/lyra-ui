import {
  Controls,
  Description,
  Primary,
  Source,
  Stories,
  Subtitle,
  Title,
  useOf,
} from '@storybook/addon-docs/blocks';
import { createElement, Fragment } from 'react';

import componentImports from 'virtual:lyra-component-imports';
import customElements from '../packages/lyra-ui/custom-elements.json';
import {
  buildComponentMetadataIndex,
  componentMetadataPresentation,
} from './component-metadata.js';

const componentMetadataByTag = buildComponentMetadataIndex(customElements);

/**
 * The autodocs page reproduces Storybook's default block order and adds the CEM-derived maturity /
 * introduction/deprecation contract plus the granular registration import immediately under the
 * title. Every component is its own side-effect entry point, so "which module registers this tag?"
 * remains the first integration detail the generated API tables cannot tell a reader.
 *
 * The specifier is derived per page from `.storybook/component-imports.js` (see its header for the
 * source of truth) rather than written into 275 story files.
 */

/**
 * `preparedMeta` is what Storybook resolves for `of="meta"`; the raw `csfFile.meta` is the same
 * value before project annotations are merged in, kept as a fallback so a page still renders its
 * import line if that resolution ever changes shape.
 */
function importSpecifier(resolvedMeta) {
  const component = componentTag(resolvedMeta);
  return typeof component === 'string' ? componentImports[component] : undefined;
}

function componentTag(resolvedMeta) {
  return resolvedMeta?.preparedMeta?.component ?? resolvedMeta?.csfFile?.meta?.component;
}

function metadataBlock(resolvedMeta) {
  const metadata = componentMetadataPresentation(
    componentMetadataByTag.get(componentTag(resolvedMeta)),
  );
  if (!metadata) return null;
  return createElement(
    'section',
    { 'aria-label': 'Component maturity and versioning' },
    createElement(
      'p',
      null,
      createElement('strong', null, 'Status: '),
      createElement('code', null, metadata.status),
      ' · ',
      createElement('strong', null, 'Since: '),
      createElement('code', null, metadata.since),
    ),
    metadata.rationale ? createElement('p', null, metadata.rationale) : null,
    metadata.graduationCriteria
      ? createElement('p', null, createElement('strong', null, 'Graduation: '), metadata.graduationCriteria)
      : null,
    metadata.deprecations.length
      ? createElement(
          Fragment,
          null,
          createElement('strong', null, 'Deprecations'),
          createElement(
            'ul',
            null,
            ...metadata.deprecations.map((entry) => createElement(
              'li',
              { key: entry.key },
              createElement('code', null, entry.subject),
              ` — deprecated since ${entry.since}; use ${entry.replacementKind} `,
              createElement('code', null, entry.replacement),
              `; removal not before ${entry.removalNotBefore}. ${entry.rationale}`,
            )),
          ),
        )
      : null,
  );
}

export function LyraDocsPage() {
  const resolvedMeta = useOf('meta', ['meta']);
  const specifier = importSpecifier(resolvedMeta);
  // Matches Storybook's own DocsPage: a one-story component shows that story's description inline
  // and skips the trailing Stories list, which would otherwise repeat the Primary block.
  const isSingleStory = Object.keys(resolvedMeta.csfFile?.stories ?? {}).length === 1;

  return createElement(
    Fragment,
    null,
    createElement(Title, null),
    createElement(Subtitle, null),
    metadataBlock(resolvedMeta),
    specifier
      ? createElement(Source, {
          code: `import '${specifier}';`,
          language: 'js',
          // The snippet is a single already-formatted line; leave the prettier pass off so it can
          // never reflow into something that isn't what a consumer should paste.
          format: false,
        })
      : null,
    createElement(Description, { of: 'meta' }),
    isSingleStory ? createElement(Description, { of: 'story' }) : null,
    createElement(Primary, null),
    createElement(Controls, null),
    isSingleStory ? null : createElement(Stories, null),
  );
}
