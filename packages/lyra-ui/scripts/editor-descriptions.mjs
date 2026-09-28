/** Compact editor hover prose; complete contracts remain in the linked component reference. */
export function editorSummary(description) {
  if (!description) return undefined;
  const paragraph = description.trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' ');
  const sentence = paragraph.match(/^.*?[.!?](?=\s+[A-Z]|$)/)?.[0] ?? paragraph;
  return sentence.length > 240 ? `${sentence.slice(0, 237).trimEnd()}…` : sentence;
}

function componentDocumentation(tagName) {
  return `https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/llms/components/${tagName}.md`;
}

export function editorDescription(description, tagName) {
  return [editorSummary(description), `[Documentation](${componentDocumentation(tagName)})`]
    .filter(Boolean).join('\n\n');
}

/** Deprecated entries stay available in the manifest and migration reference, not completion. */
export function isCurrentEditorEntry(entry) {
  return !entry.deprecated && !entry.deprecation;
}
