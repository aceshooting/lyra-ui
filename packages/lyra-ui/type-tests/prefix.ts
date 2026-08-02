import { defineElement } from '../src/lyra.js';
import { defineElement as defineGranular } from '../src/utilities/prefix.js';

declare const elementConstructor: CustomElementConstructor;

defineElement('example', elementConstructor);
defineGranular('example', elementConstructor);

// Package provenance is derived from generated package metadata, never supplied by a consumer.
// @ts-expect-error defineElement accepts only the component name and constructor
defineElement('example', elementConstructor, '7.8.1');
// @ts-expect-error the granular utility has the same supported signature
defineGranular('example', elementConstructor, '7.8.1');
