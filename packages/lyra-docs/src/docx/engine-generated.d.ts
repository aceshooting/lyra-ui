/** Finite internal build interfaces; these aliases are absent from public declarations. */
declare module '#lyra-docx-engine/core' {
  export const createDocxEditor: (config: import('@docx-editor.dev/core').DocxEditorConfig) =>
    import('@docx-editor.dev/core').DocxEditorInstance;
  export const blankDocumentBytes: typeof import('@docx-editor.dev/core').blankDocumentBytes;
  export const prepareFeatures: (features: readonly import('./engine-loader.js').EditorFeature[]) => Promise<void>;
  export const prepareCommandFeatures: (command: import('@docx-editor.dev/core/contracts/editor').EditorCommand) => Promise<void>;
}

declare module '#lyra-docx-engine/store' {
  export const findNode: typeof import('@docx-editor.dev/core/store').findNode;
  export const parentNodeOf: typeof import('@docx-editor.dev/core/store').parentNodeOf;
  export const readZip: typeof import('@docx-editor.dev/core/store').readZip;
  export const readOoxmlPart: typeof import('@docx-editor.dev/core/store').readOoxmlPart;
  export const TreePackageStore: typeof import('@docx-editor.dev/core/store').TreePackageStore;
  export const writeOoxmlPackage: typeof import('@docx-editor.dev/core/store').writeOoxmlPackage;
  export const collectReviewItems: typeof import('@docx-editor.dev/core/store').collectReviewItems;
  export const collectRevisionSites: typeof import('@docx-editor.dev/core/store').collectRevisionSites;
  export const commentsOfPart: typeof import('@docx-editor.dev/core/store').commentsOfPart;
  export const commentAnchorsOfStory: typeof import('@docx-editor.dev/core/store').commentAnchorsOfStory;
  export const threadStateOfPart: typeof import('@docx-editor.dev/core/store').threadStateOfPart;
  export const commentBodyText: typeof import('@docx-editor.dev/core/store').commentBodyText;
  export const reviewItemKey: typeof import('@docx-editor.dev/core/store').reviewItemKey;
  export const commentPartNameOf: typeof import('@docx-editor.dev/core/store').commentPartNameOf;
  export const commentsExtendedPartNameOf: typeof import('@docx-editor.dev/core/store').commentsExtendedPartNameOf;
  export const stylesPartOf: typeof import('@docx-editor.dev/core/store').stylesPartOf;
}
