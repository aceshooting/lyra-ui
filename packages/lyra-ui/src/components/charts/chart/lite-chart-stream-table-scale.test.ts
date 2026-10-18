import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import { twoFrames } from '../../../../test/frames.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

function holdIdle() {
  const request = Object.getOwnPropertyDescriptor(window, 'requestIdleCallback');
  const cancel = Object.getOwnPropertyDescriptor(window, 'cancelIdleCallback');
  const callbacks: (() => void)[] = [];
  const timeouts: number[] = [];
  Object.defineProperty(window, 'requestIdleCallback', { configurable:true, value:(callback:()=>void, options:{timeout:number}) => {
    callbacks.push(callback); timeouts.push(options.timeout); return callbacks.length;
  } });
  Object.defineProperty(window, 'cancelIdleCallback', { configurable:true, value:()=>{} });
  return { callbacks, timeouts, restore() {
    if (request) Object.defineProperty(window,'requestIdleCallback',request); else Reflect.deleteProperty(window,'requestIdleCallback');
    if (cancel) Object.defineProperty(window,'cancelIdleCallback',cancel); else Reflect.deleteProperty(window,'cancelIdleCallback');
  } };
}
async function mount(format: (value:number)=>string): Promise<LyraLiteChart> {
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart .labels=${['a']}
    .datasets=${[{label:'S',data:[1]},{label:'T',data:[2]}]} .tableCellFormatter=${format}></lr-lite-chart>`);
  await waitUntil(()=>el.shadowRoot!.querySelectorAll('[part="bar"]').length===2);
  await twoFrames(); await el.updateComplete;
  return el;
}

it('coalesces hidden streamed table formatting while marks and exports use the latest values', async () => {
  let formats = 0;
  const el = await mount(value=>{ formats++; return String(value); });
  const idle = holdIdle();
  try {
    formats = 0;
    el.appendData('b',[3,4]); await el.updateComplete;
    el.appendData('c',[5,6]); await el.updateComplete;
    expect(formats).to.equal(0);
    expect(idle.callbacks.length).to.equal(1);
    expect(idle.timeouts).to.deep.equal([250]);
    expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(6);
    expect(el.exportData('csv')).to.include('c,5,6');
    recordScaleMeasurement('lr-lite-chart','two append hidden table updates',{tableFormats:formats});
    idle.callbacks[0]!(); await el.updateComplete;
    expect(formats).to.equal(6);
    expect(el.shadowRoot!.querySelector('tbody tr:last-child')!.textContent).to.include('c');
  } finally { el.remove(); idle.restore(); }
});

for (const refresh of ['visible','replacement','formatter','locale','bare'] as const) {
  it(`cancels hidden streamed formatting for ${refresh} and ignores obsolete idle callbacks`, async () => {
    let formats=0;
    let suffix='old';
    const el=await mount(value=>{ formats++; return `${value}${suffix}`; });
    const idle=holdIdle();
    try {
      el.appendData('b',[3,4]); await el.updateComplete;
      expect(idle.callbacks.length).to.equal(1);
      if(refresh==='visible') el.withDataTable=true;
      if(refresh==='replacement') { el.labels=['x']; el.datasets=[{label:'S',data:[9]},{label:'T',data:[8]}]; }
      if(refresh==='formatter') el.tableCellFormatter=value=>{ formats++; return `${value}new`; };
      if(refresh==='locale') el.locale='en';
      if(refresh==='bare') { suffix='new'; el.requestUpdate(); }
      await el.updateComplete;
      const text=el.shadowRoot!.querySelector('tbody')!.textContent!;
      expect(text).to.include(refresh==='replacement'?'9old':refresh==='formatter'||refresh==='bare'?'3new':'3old');
      formats=0; idle.callbacks[0]!(); await el.updateComplete;
      expect(formats).to.equal(0);
    } finally { el.remove(); idle.restore(); }
  });
}

it('cancels deferred work on disconnect and refreshes on reconnect', async () => {
  let formats=0;
  const el=await mount(value=>{formats++;return String(value);});
  const parent=el.parentNode!;
  const idle=holdIdle();
  try {
    el.appendData('b',[3,4]); await el.updateComplete;
    expect(idle.callbacks.length).to.equal(1);
    el.remove(); formats=0;
    idle.callbacks[0]!(); await Promise.resolve();
    expect(formats).to.equal(0);
    parent.appendChild(el); await el.updateComplete;
    expect(el.shadowRoot!.querySelector('tbody')!.textContent).to.include('b');
  } finally { el.remove(); idle.restore(); }
});

it('keeps the single-series accessible list immediately current during append', async () => {
  const el=await fixture<LyraLiteChart>(html`<lr-lite-chart .labels=${['a']} .datasets=${[{label:'S',data:[1]}]}></lr-lite-chart>`);
  const idle=holdIdle();
  try {
    el.appendData('b',[2]); await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="data-list"]')!.textContent).to.include('b');
    expect(idle.callbacks.length).to.equal(0);
  } finally { el.remove(); idle.restore(); }
});

it('refreshes through the timer fallback when idle callbacks are unavailable', async () => {
  const el=await mount(String);
  const request=Object.getOwnPropertyDescriptor(window,'requestIdleCallback');
  const cancel=Object.getOwnPropertyDescriptor(window,'cancelIdleCallback');
  Object.defineProperty(window,'requestIdleCallback',{configurable:true,value:undefined});
  Object.defineProperty(window,'cancelIdleCallback',{configurable:true,value:undefined});
  try {
    el.appendData('latest',[3,4]); await el.updateComplete;
    await waitUntil(()=>el.shadowRoot!.querySelector('tbody')!.textContent!.includes('latest'));
  } finally {
    el.remove();
    if(request) Object.defineProperty(window,'requestIdleCallback',request); else Reflect.deleteProperty(window,'requestIdleCallback');
    if(cancel) Object.defineProperty(window,'cancelIdleCallback',cancel); else Reflect.deleteProperty(window,'cancelIdleCallback');
  }
});
