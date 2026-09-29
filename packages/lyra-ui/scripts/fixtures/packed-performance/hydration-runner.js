const { configuration } = window;
const host = document.querySelector('lr-input[data-hydration-probe]');
const shadowRoot = host?.shadowRoot;
const nativeInput = shadowRoot?.querySelector('input');
const lightDomProbe = host?.querySelector('[data-hydration-light-dom]');

if (!host || !shadowRoot || !nativeInput || !lightDomProbe) {
  throw new Error('SSR fixture did not produce the expected declarative shadow tree');
}

const initialValue = nativeInput.value;
const initialLightDomText = lightDomProbe.textContent;
const startedAt = configuration.measureTiming ? performance.now() : undefined;

await import(configuration.hydrationUrl);
await import(configuration.registrationUrl);
await customElements.whenDefined('lr-input');
await host.updateComplete;
await new Promise((resolve) => requestAnimationFrame(() => resolve()));

if (host.shadowRoot !== shadowRoot) throw new Error('Hydration replaced the declarative shadow root');
if (host.shadowRoot.querySelector('input') !== nativeInput) {
  throw new Error('Hydration replaced the native input node');
}
if (nativeInput.value !== initialValue || initialValue !== configuration.expectedValue) {
  throw new Error('Hydration did not preserve the SSR input value');
}
if (host.querySelector('[data-hydration-light-dom]') !== lightDomProbe) {
  throw new Error('Hydration replaced the light-DOM probe node');
}
if (lightDomProbe.textContent !== initialLightDomText || initialLightDomText !== configuration.expectedLightDomText) {
  throw new Error('Hydration did not preserve the SSR light-DOM content');
}

window.__lyraHydrationResult = {
  ...(startedAt === undefined ? {} : { hydrationToUsableMs: performance.now() - startedAt }),
  preservedDeclarativeShadowRoot: true,
  preservedNativeInput: true,
  preservedInputValue: nativeInput.value,
  preservedLightDomNode: true,
  preservedLightDomText: lightDomProbe.textContent,
};
