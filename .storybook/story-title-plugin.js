import { toId } from 'storybook/internal/csf';

import { groupedStoryTitle } from './story-indexer.js';

const STORY_FILE = /\.stories\.[cm]?[jt]sx?(?:\?.*)?$/;
const TITLE_PROPERTY = /^(\s*title\s*:\s*)(['"`])([^'"`\r\n]+)\2(\s*,)/m;

export function transformStoryTitle(source, fileName) {
  if (!STORY_FILE.test(fileName)) return source;

  const match = source.match(TITLE_PROPERTY);
  if (!match) return source;

  const [, property, quote, originalTitle, comma] = match;
  const groupedTitle = groupedStoryTitle(fileName, originalTitle);
  if (groupedTitle === originalTitle) return source;

  const indentation = property.match(/^\s*/)?.[0] ?? '';
  const replacement = `${property}${quote}${groupedTitle}${quote}${comma}\n${indentation}id: '${toId(originalTitle)}',`;
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
