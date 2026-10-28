import { createEngine } from '@aceshooting/lyra-3d/graph';
import { DEFAULT_LYRA_3D_STYLE, DEFAULT_ORBIT_CAMERA } from '@aceshooting/lyra-3d/core';
let active;
export function cleanupGraphSpatialNodeMeshes() { active?.engine.dispose(); active?.container.remove(); active=undefined; }
const triangle = (alpha=1) => ({positions:new Float32Array([-.8,-.5,0, .8,-.5,0, 0,.8,0]),normals:new Float32Array([0,0,1]),color:[1,0,0,alpha]});
async function mount(mesh, appearance = {}) {
  cleanupGraphSpatialNodeMeshes();
  const container=document.createElement('div'); container.style.cssText='position:absolute;left:0;top:0;width:640px;height:480px'; document.body.replaceChildren(container);
  const engine=createEngine(),lost=[]; active={engine,container,lost};
  engine.setData({nodeCount:1,positions:new Float32Array(3),sizes:new Float32Array([100]),source:new Uint32Array(),target:new Uint32Array(),spatialAppearance:{sizeUnits:'css',nodeMeshes:[mesh],...appearance}},0);
  engine.setStyle({...DEFAULT_LYRA_3D_STYLE,devicePixelRatio:1,background:'#000000',reducedMotion:true}); engine.setCamera(DEFAULT_ORBIT_CAMERA);
  await engine.mount(container,{hover(){},pick(){},camera(){},lost(reason){lost.push(reason);}}); engine.resize(640,480);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  return active;
}
export const graphSpatialNodeMeshCases={
  async 'graph-custom-mesh-exact-triangle-pick'() {
    const r=await mount(triangle()),center=r.engine.project(0);
    const inside=r.engine.pick(center.x,center.y),outside=r.engine.pick(center.x+35,center.y+25);
    r.engine.setNodeMeshes([triangle(0)]); await new Promise(resolve=>requestAnimationFrame(resolve));
    const transparent=r.engine.pick(center.x,center.y);
    r.engine.setNodeMeshes([triangle(.2)]); await new Promise(resolve=>requestAnimationFrame(resolve));
    const partial=r.engine.pick(center.x,center.y);
    r.engine.setNodeMeshes(undefined); await new Promise(resolve=>requestAnimationFrame(resolve));
    const restored=r.engine.pick(center.x+35,center.y+25);
    return {passed:!r.lost.length&&inside===0&&outside===null&&transparent===null&&partial===0&&restored===0,inside,outside,transparent,partial,restored};
  },
};

async function capture(record) {
  const gl=record.container.querySelector('canvas').getContext('webgl2'), original=gl.drawElementsInstanced;
  let timer;
  try {
    return await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>reject(new Error('Expected custom face visual draw')),5000);
      gl.drawElementsInstanced=(...args)=>{
        original.apply(gl,args);
        if(gl.getParameter(gl.FRAMEBUFFER_BINDING)!==null) return;
        const rgba=new Uint8Array(640*480*4); gl.readPixels(0,0,640,480,gl.RGBA,gl.UNSIGNED_BYTE,rgba); resolve(rgba);
      };
      record.engine.setCamera({...DEFAULT_ORBIT_CAMERA});
    });
  } finally {clearTimeout(timer);gl.drawElementsInstanced=original;}
}
const redAt=(rgba,x,y)=>rgba[((479-Math.floor(y))*640+Math.floor(x))*4];
graphSpatialNodeMeshCases['graph-custom-mesh-depth-shading-full-view-pick']=async()=>{
  const length=Math.hypot(.5,.6);
  const mesh={positions:new Float32Array([-.6,-.5,0,0,-.5,.5,0,.5,.5, 0,-.5,.5,.6,-.5,0,0,.5,.5]),
    normals:new Float32Array([-.5/length,0,.6/length,.5/length,0,.6/length]),color:[1,0,0,1]};
  const r=await mount(mesh),rgba=await capture(r);
  const left=redAt(rgba,312,240),right=redAt(rgba,328,240);
  const picks=[r.engine.pick(312,240),r.engine.pick(328,240),r.engine.pick(340,240)];
  r.engine.setCamera({...DEFAULT_ORBIT_CAMERA,distance:1000}); await new Promise(resolve=>requestAnimationFrame(resolve));
  const zoomed=[r.engine.pick(312,240),r.engine.pick(328,240),r.engine.pick(340,240)];
  return {passed:!r.lost.length&&left>right+10&&right>80&&JSON.stringify(picks)==='[0,0,null]'&&JSON.stringify(zoomed)==='[0,0,null]',left,right,picks,zoomed};
};

graphSpatialNodeMeshCases['graph-custom-mesh-zero-dimming-pick']=async()=>{
  const r=await mount(triangle(),{dimmedOpacity:0});
  r.engine.setState({selected:new Set(),dimmed:new Set([0]),hover:-1,focus:-1});
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const pick=r.engine.pick(320,240);
  r.engine.setNodeMeshes([triangle(0)]); await new Promise(resolve=>requestAnimationFrame(resolve));
  const alphaZero=r.engine.pick(320,240);
  return {passed:!r.lost.length&&pick===0&&alphaZero===null,pick,alphaZero};
};
graphSpatialNodeMeshCases['graph-custom-mesh-world-near-clip-css-center-policy']=async()=>{
  const mesh={positions:new Float32Array([-.2,-.2,-.3,.2,-.2,-.3,0,.2,.1]),normals:new Float32Array([0,-Math.SQRT1_2,Math.SQRT1_2]),color:[1,0,0,1]};
  const r=await mount(mesh,{sizeUnits:'world'});
  r.engine.setData({nodeCount:1,positions:new Float32Array([0,0,500.25]),sizes:new Float32Array([100]),source:new Uint32Array(),target:new Uint32Array(),spatialAppearance:{sizeUnits:'world',nodeMeshes:[mesh]}},1);
  const world=await capture(r),worldPick=r.engine.pick(320,240),worldRed=redAt(world,320,240);
  r.engine.setAppearance({spatialAppearance:{sizeUnits:'css',nodeMeshes:[mesh]}});
  const css=await capture(r),cssPick=r.engine.pick(320,240),cssRed=redAt(css,320,240);
  return {passed:!r.lost.length&&worldPick===0&&worldRed>50&&cssPick===null&&cssRed<10,worldPick,worldRed,cssPick,cssRed};
};
graphSpatialNodeMeshCases['graph-custom-mesh-slanted-fragment-depth-edge-pick']=async()=>{
  const length=Math.hypot(.78,2.08);
  const mesh={positions:new Float32Array([-.8,-.5,-.3,.8,-.5,.3,0,.8,0]),normals:new Float32Array([-.78/length,0,2.08/length]),color:[1,0,0,1]};
  const r=await mount(mesh,{sizeUnits:'world'});
  r.engine.setData({nodeCount:3,positions:new Float32Array([0,0,0,-100,0,0,100,0,0]),sizes:new Float32Array([200,0,0]),source:new Uint32Array([1]),target:new Uint32Array([2]),spatialAppearance:{sizeUnits:'world',nodeMeshes:[mesh,null,null],edgeWidths:new Float32Array([4]),edgeColors:new Float32Array([0,0,1,1])}},1);
  const rgba=await capture(r),scale=480/(2*Math.tan(Math.PI/8)*500),leftX=320-20*scale,rightX=320+20*scale;
  const leftPick=r.engine.pick(leftX,240),rightPick=r.engine.pick(rightX,240);
  const leftRed=redAt(rgba,leftX,240),rightRed=redAt(rgba,rightX,240);
  const leftBlue=rgba[((479-240)*640+Math.floor(leftX))*4+2];
  return {passed:!r.lost.length&&leftPick===3&&rightPick===0&&leftRed<20&&leftBlue>180&&rightRed>80,leftPick,rightPick,leftRed,rightRed,leftBlue};
};
