// Pointer, wheel and keyboard input.
import {canvas} from './renderer.js';
import {clamp,lerp} from './utils.js';
import {cam,camV,camCtl,input,keys,userCam,panBy,orbitBy,resetView} from './camera.js';
import {app} from './app.js';
import {pickTerrain,candAt} from './picking.js';
import {sb,toggleBlock} from './sandbox.js';
import {addPin} from './labels.js';
import {toggleInfo,closeInfo,toggleCut,toggleLegend,toggleCard} from './ui.js';

const ptrs=new Map();let lastPinch=0,lastMid=null,clickTimer=null;
export const mouse={x:-1,y:-1,in:false};
function rel(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  let type='orbit';if(e.pointerType==='mouse'){if(e.button===1){type='dolly';e.preventDefault();}else if(e.button===2||e.shiftKey||e.ctrlKey||e.metaKey)type='pan';}
  if(ptrs.size>=2){type='pinch';lastPinch=0;lastMid=null;}
  input.down={x:e.clientX,y:e.clientY,t:performance.now(),moved:ptrs.size>=2,btn:e.button,type};camV.th=camV.ph=camV.x=camV.z=camV.r=0;});
canvas.addEventListener('pointermove',e=>{const m=rel(e);mouse.x=m.x;mouse.y=m.y;mouse.in=true;
  if(!ptrs.has(e.pointerId)||!input.down)return;const p=ptrs.get(e.pointerId);const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(!input.down.moved&&Math.hypot(e.clientX-input.down.x,e.clientY-input.down.y)>5){input.down.moved=true;userCam();}
  if(!input.down.moved)return;
  if(ptrs.size>=2){const a=[...ptrs.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);const mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};
    if(lastPinch)cam.r=clamp(cam.r*lastPinch/d,50,420);if(lastMid)panBy(mid.x-lastMid.x,mid.y-lastMid.y);lastPinch=d;lastMid=mid;return;}
  if(input.down.type==='orbit'){const v=orbitBy(dx,dy);camV.th=v[0];camV.ph=v[1];}
  else if(input.down.type==='pan'){const v=panBy(dx,dy);camV.x=v[0];camV.z=v[1];}
  else if(input.down.type==='dolly'){const f=1+dy*0.006;cam.r=clamp(cam.r*f,50,420);camV.r=f-1;}});
const endPtr=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2){lastPinch=0;lastMid=null;}
  if(input.down&&!input.down.moved&&e.type==='pointerup'&&input.down.btn===0&&performance.now()-input.down.t<600){const m=rel(e);
    if(clickTimer){clearTimeout(clickTimer);clickTimer=null;}else clickTimer=setTimeout(()=>{clickTimer=null;handleClick(m);},260);}
  if(ptrs.size===0)input.down=null;};
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('pointerleave',()=>{mouse.in=false;});
canvas.addEventListener('dblclick',e=>{if(app.mode==='intro')return;if(clickTimer){clearTimeout(clickTimer);clickTimer=null;}const p=pickTerrain(rel(e));if(!p)return;
  camCtl.from={...cam};camCtl.goal={x:p.x,y:Math.max(0,p.y-2),z:p.z,r:Math.max(55,cam.r*0.55),th:cam.th,ph:Math.min(cam.ph,1.1)};camCtl.t=0;camCtl.user=true;});
canvas.addEventListener('wheel',e=>{e.preventDefault();userCam();const f=1+Math.sign(e.deltaY)*0.1;
  if(f<1){const p=pickTerrain(rel(e));if(p){cam.x=lerp(cam.x,p.x,1-f);cam.z=lerp(cam.z,p.z,1-f);}}
  cam.r=clamp(cam.r*f,50,420);},{passive:false});
window.addEventListener('keydown',e=>{const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;if(app.mode==='intro')return;
  const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','q','e','+','=','-','_'].includes(k)){keys.add(k);userCam();if(k.startsWith('arrow'))e.preventDefault();}
  if(k==='r')resetView();if(k==='i')toggleInfo();if(k==='c')toggleCut();if(k==='l')toggleLegend();if(k==='p')toggleCard();
  if(k==='escape'){closeInfo();}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function handleClick(m){if(app.mode==='intro')return;
  if(app.mode==='sandbox'&&!sb.running){const c=candAt(m);if(c>=0){toggleBlock(c);return;}}
  const p=pickTerrain(m);if(p)addPin(p.x,p.z);}
