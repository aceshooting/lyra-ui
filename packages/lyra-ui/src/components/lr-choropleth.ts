export * from './data/choropleth/choropleth.class.js';
import { LyraChoropleth } from './data/choropleth/choropleth.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('choropleth', LyraChoropleth);
