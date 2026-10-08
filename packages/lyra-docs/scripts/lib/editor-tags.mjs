// Lyra control tags the editor class renders through unsafeStatic(tag('<name>')).
export const renderedControlTags = (classSource) =>
  [...classSource.matchAll(/\bunsafeStatic\(tag\('([a-z][a-z0-9-]*)'\)\)/gu)].map((match) => match[1]);
