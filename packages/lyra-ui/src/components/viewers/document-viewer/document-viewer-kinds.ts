/**
 * Registers every built-in `<lr-document-viewer>` kind (archive, ebook, PDF, DOCX, PPTX,
 * spreadsheet, CSV, XML) through its own lazy, register-only entry -- none of the eight heavy
 * viewer element classes reaches this module's own import graph; each loads only once
 * `<lr-document-viewer>` actually opens a matching file. Importing this single module is the
 * one-line equivalent of importing all eight `*-viewer-register.js` entries individually.
 *
 * `<lr-document-viewer>` itself must still be imported separately (`document-viewer.js`); this
 * module only wires the built-in kind registry, matching how each individual
 * `*-viewer-register.js` entry already works.
 */
export * from '../archive-viewer/archive-viewer-register.js';
export * from '../ebook-viewer/ebook-viewer-register.js';
export * from '../pdf-viewer/pdf-viewer-register.js';
export * from '../docx-viewer/docx-viewer-register.js';
export * from '../pptx-viewer/pptx-viewer-register.js';
export * from '../spreadsheet-viewer/spreadsheet-viewer-register.js';
export * from '../csv-viewer/csv-viewer-register.js';
export * from '../xml-viewer/xml-viewer-register.js';
