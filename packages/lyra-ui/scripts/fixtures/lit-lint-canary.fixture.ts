// Canary fixture for the Lit/wc oxlint gate. Every enabled rule has one seeded defect, so a silent no-op
// (plugin not loaded, `settings.lit.elementBaseClasses` not reaching the plugin, rule renamed) fails the canary test.
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { internalProperty } from 'lit-element'; // lit/no-legacy-imports
import { LyraElement } from '../internal/lyra-element.js';

declare const x: string;
declare function fn(): void;

export const t1 = html`<x-a ${x}="1"></x-a>`; // lit/binding-positions
export const t2 = html`<x-a invalid"attr></x-a>`; // lit/no-invalid-html
export const t3 = html`<x-a title=">"></x-a>`; // lit/attribute-value-entities
export const t4 = html`<x-a b b></x-a>`; // lit/no-duplicate-template-bindings
export const t5 = html`<x-a b?=${x}></x-a>`; // lit/no-legacy-template-syntax
export const t6 = html`oct \123`; // lit/no-invalid-escape-sequences
export const t7 = html`<x-a @e=${fn.bind(null)}></x-a>`; // lit/no-template-bind
export const t8 = html`<x-a t="${x}"></x-a>`; // lit/quoted-expressions
export const t9 = html`${'lit'}`; // lit/no-useless-template-literals
export const t10 = html`<input value=${x} />`; // lit/no-value-attribute
export const t11 = html`<input .value=${x} min=${x}>`; // lit/value-after-constraints
export const t12 = html`<style>a{}</style>`; // lit/prefer-static-styles

// A subclass of the repo's own base class: only detected through settings.lit/wc.elementBaseClasses.
export class Canary extends LyraElement {
  @property() camelCaseName = ''; // lit/attribute-names
  constructor(public readonly injected: string) { // wc/no-constructor-params
    super();
    this.setAttribute('role', 'x'); // wc/no-constructor-attributes
  }
  override connectedCallback() { fn(); } // lit/lifecycle-super
  override update(c: Map<string, unknown>) { // lit/no-property-change-update
    super.update(c as never);
    this.camelCaseName = 'x';
  }
  connectCallback() {} // wc/no-typos
  closed() { this.attachShadow({ mode: 'closed' }); } // wc/no-closed-shadow-root + wc/attach-shadow-constructor
  own() { this.classList.add('x'); } // wc/no-self-class
}
export const unused = internalProperty;
