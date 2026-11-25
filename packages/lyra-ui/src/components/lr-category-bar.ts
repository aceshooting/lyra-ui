export * from './data/category-bar/category-bar.class.js';
import { LyraCategoryBar } from './data/category-bar/category-bar.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('category-bar', LyraCategoryBar);
