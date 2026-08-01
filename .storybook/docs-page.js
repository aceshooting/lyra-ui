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

/**
 * The autodocs page, reproducing Storybook's own default block order with one addition: the
 * component's granular registration import, immediately under the title. Every component is its own
 * side-effect entry point, so "which module registers this tag?" is the first thing a reader needs
 * and the one thing the generated API tables below cannot tell them.
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
  const component = resolvedMeta?.preparedMeta?.component ?? resolvedMeta?.csfFile?.meta?.component;
  return typeof component === 'string' ? componentImports[component] : undefined;
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
