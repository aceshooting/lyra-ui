import * as source from '@docx-editor.dev/core/store';

/** Keep the consumed store surface explicit without requiring optional exports at link time. */
export const capabilities = Object.freeze({
  get findNode() { return source.findNode; },
  get parentNodeOf() { return source.parentNodeOf; },
  get readZip() { return source.readZip; },
  get readOoxmlPart() { return source.readOoxmlPart; },
  get TreePackageStore() { return source.TreePackageStore; },
  get writeOoxmlPackage() { return source.writeOoxmlPackage; },
  get collectReviewItems() { return source.collectReviewItems; },
  get collectRevisionSites() { return source.collectRevisionSites; },
  get commentsOfPart() { return source.commentsOfPart; },
  get commentAnchorsOfStory() { return source.commentAnchorsOfStory; },
  get threadStateOfPart() { return source.threadStateOfPart; },
  get commentBodyText() { return source.commentBodyText; },
  get reviewItemKey() { return source.reviewItemKey; },
  get commentPartNameOf() { return source.commentPartNameOf; },
  get commentsExtendedPartNameOf() { return source.commentsExtendedPartNameOf; },
  get stylesPartOf() { return source.stylesPartOf; },
});
