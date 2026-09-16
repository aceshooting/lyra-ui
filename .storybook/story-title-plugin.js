import { toId } from 'storybook/internal/csf';

import { groupedStoryTitle } from './story-indexer.js';

const STORY_FILE = /\.stories\.[cm]?[jt]sx?(?:\?.*)?$/;
// Keep inline and multiline runtime metadata aligned with the grouped story index.
const TITLE_PROPERTY = /(^|[{,])(\s*title\s*:\s*)(['"`])([^'"`\r\n]+)\3(\s*,)/m;

export function transformStoryTitle(source, fileName) {
  if (!STORY_FILE.test(fileName)) return source;

  const match = source.match(TITLE_PROPERTY);
  if (!match) return source;

  const [, prefix, property, quote, originalTitle, comma] = match;
  const groupedTitle = groupedStoryTitle(fileName, originalTitle);
  if (groupedTitle === originalTitle) return source;

  const indentation = property.match(/(?:^|\n)([^\S\r\n]*)title/)?.[1] ?? '';
  const replacement = `${prefix}${property}${quote}${groupedTitle}${quote}${comma}\n${indentation}id: '${toId(originalTitle)}',`;
  return source.replace(match[0], replacement);
}

export function storyTitlePlugin() {
  return {
    name: 'lyra-story-family-titles',
    enforce: 'pre',
    transform(source, fileName) {
      const code = transformStoryTitle(source, fileName);
      return code === source ? undefined : { code, map: null };
    },
  };
}
