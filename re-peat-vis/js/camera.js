// Orbit camera: state, pan/orbit helpers, inertia, keyboard movement, fly-to goals.
import {camera} from './renderer.js';
import {clamp,lerp,ease,P} from './utils.js';
import {scenes} from './scenes.js';
import {app} from './app.js';

export const cam={x:0,y:0,z:0,r:290,th:2.35,ph:0.85};
export const camV={th:0,ph:0,x:0,z:0,r:0};
function applyCam(){const sp=Math.sin(cam.ph);camera.position.set(cam.x+cam.r*sp*Math.cos(cam.th),cam.y+cam.r*Math.cos(cam.ph),cam.z+cam.r*sp*Math.sin(cam.th));camera.lookAt(cam.x,cam.y,cam.z);}
// Fly-to goal state (replaces loose camUser/camFrom/camGoal/camGoalT variables)
export const camCtl={user:false,from:null,goal:null,t:0};
// Pointer drag state shared with input.js
export const input={down:null};
export const keys=new Set();
function userCam(){camCtl.user=true;camCtl.goal=null;}
function panBy(dx,dy){const k=cam.r*0.0017;const rx=Math.sin(cam.th),rz=-Math.cos(cam.th),fx=-Math.cos(cam.th),fz=-Math.sin(cam.th);
  const mx=(-rx*dx+fx*dy)*k,mz=(-rz*dx+fz*dy)*k;cam.x=clamp(cam.x+mx,-120,120);cam.z=clamp(cam.z+mz,-120,120);return [mx,mz];}
function orbitBy(dx,dy){const a=dx*0.0055,b=-dy*0.0045;cam.th+=a;cam.ph=clamp(cam.ph+b,0.22,1.45);return [a,b];}
function keyCam(dt){if(!keys.size)return;const s=dt*60;
  if(keys.has('arrowleft')||keys.has('a'))panBy(6*s,0);if(keys.has('arrowright')||keys.has('d'))panBy(-6*s,0);
  if(keys.has('arrowup')||keys.has('w'))panBy(0,6*s);if(keys.has('arrowdown')||keys.has('s'))panBy(0,-6*s);
  if(keys.has('q'))cam.th-=0.02*s;if(keys.has('e'))cam.th+=0.02*s;
  if(keys.has('+')||keys.has('='))cam.r=clamp(cam.r*(1-0.015*s),50,420);if(keys.has('-')||keys.has('_'))cam.r=clamp(cam.r*(1+0.015*s),50,420);}
function inertia(dt){if(input.down)return;const d=Math.pow(0.004,dt);
  if(Math.abs(camV.th)+Math.abs(camV.ph)>1e-5){cam.th+=camV.th;cam.ph=clamp(cam.ph+camV.ph,0.22,1.45);camV.th*=d;camV.ph*=d;}
  if(Math.abs(camV.x)+Math.abs(camV.z)>1e-4){cam.x=clamp(cam.x+camV.x,-120,120);cam.z=clamp(cam.z+camV.z,-120,120);camV.x*=d;camV.z*=d;}
  if(Math.abs(camV.r)>1e-4){cam.r=clamp(cam.r*(1+camV.r),50,420);camV.r*=d;}}
function resetView(){camCtl.from={...cam};camV.th=camV.ph=camV.x=camV.z=camV.r=0;
  if(app.mode==='story'){const k=scenes[app.sceneIdx].cam;camCtl.goal={...k[k.length-1].p};}else camCtl.goal=P(-5,0,10,235,2.2,0.72);camCtl.t=0;camCtl.user=true;}

function updateCamGoal(dt){
  if(camCtl.goal){camCtl.t=Math.min(1,camCtl.t+dt/(camCtl.user?1.2:2.5));const u=ease(camCtl.t);['x','y','z','r','th','ph'].forEach(k=>cam[k]=lerp(camCtl.from[k],camCtl.goal[k],u));if(camCtl.t>=1)camCtl.goal=null;}
}

export {updateCamGoal,applyCam,userCam,panBy,orbitBy,keyCam,inertia,resetView};
