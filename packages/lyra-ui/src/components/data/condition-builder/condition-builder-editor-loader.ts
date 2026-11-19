type EditorLoader = (root: ParentNode) => Promise<unknown> | undefined;

let loadEditors: EditorLoader | undefined;

export function setConditionBuilderEditorLoader(loader: EditorLoader): void {
  loadEditors = loader;
}

export function loadConditionBuilderEditors(root: ParentNode): Promise<unknown> | undefined {
  return loadEditors?.(root);
}
