/**
 * Registers every built-in `<lr-document-viewer>` kind through its own lazy, register-only entry.
 * Heavy viewer element classes stay out of this module's import graph; each loads only once
 * `<lr-document-viewer>` actually opens a matching file. Importing this single module is the
 * one-line equivalent of importing each `*-viewer-register.js` entry individually.
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
export * from '../notebook-viewer/notebook-viewer-register.js';
export * from '../dataset-viewer/dataset-viewer-register.js';
export * from '../email-viewer/email-viewer-register.js';
export * from '../calendar-viewer/calendar-viewer-register.js';
export * from '../contact-viewer/contact-viewer-register.js';
export * from '../html-viewer/html-viewer-register.js';
export * from '../svg-viewer/svg-viewer-register.js';
