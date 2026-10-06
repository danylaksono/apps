// Entry point: wires the modules together and runs the frame loop.
import {$} from './dom.js';
import {app} from './app.js';
import {reduceMotion,clamp} from './utils.js';
import {renderer,scene,camera,canvas,sun,sunCalm,sunHaze,clipPlane} from './renderer.js';
import {st,BASE,NB,blockAct,setDerived} from './model.js';
import {updateTerrainColors} from './terrain.js';
import {updateRibbons} from './water.js';
// Order matters: these three draw from the same seeded RNG stream, so the scenery stays identical.
import './vegetation.js';
import {FIRE_N,updateFire} from './fire.js';
import {updateParticles} from './particles.js';
import {updateStructures} from './structures.js';
import {updateProfile,updateBracket} from './profile.js';
import {updateLabels} from './labels.js';
import {cam,applyCam,keyCam,inertia,updateCamGoal} from './camera.js';
import './input.js';
import {showPanel,tickToast} from './ui.js';
import {enter,runScene} from './story.js';
import {sb,enterSandbox,sandboxStep} from './sandbox.js';
import {updateKpi,updateTip} from './hud.js';

// ---------- intro ----------
function startFrom(fn){$('intro').classList.add('gone');document.body.classList.remove('intro');fn();}
$('startStory').onclick=()=>startFrom(()=>enter(0));
$('startPlay').onclick=()=>startFrom(enterSandbox);
showPanel('story');

// ---------- loop ----------
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);
let last=performance.now(),lastKey='';
function frame(now){const dt=Math.min(0.05,Math.max(0,(now-last)/1000));last=now;app.clock+=dt;
  if(app.mode==='story'){if(app.elapsed<999)app.elapsed+=dt;runScene();}
  else if(app.mode==='sandbox')sandboxStep(dt);
  else{Object.assign(st,BASE);if(!reduceMotion)cam.th+=dt*0.04;}
  keyCam(dt);inertia(dt);
  updateCamGoal(dt);
  setDerived();applyCam();clipPlane.constant=-st.cut;
  let bsum=0;for(let g=0;g<NB;g++)bsum+=blockAct[g]*(g+1);
  const key=[st.te,st.color,st.front,st.cut,st.dry,st.pump,st.strat,st.k,bsum].map(v=>v.toFixed(3)).join('|');
  if(key!==lastKey){lastKey=key;updateTerrainColors();updateRibbons();updateProfile();}
  updateKpi();
  const hov=updateStructures();
  // fire + haze
  const active=updateFire(dt);
  if(app.mode==='sandbox'&&sb.running)sb.peak=Math.max(sb.peak,active);
  const hz=clamp(active/FIRE_N,0,1);
  $('haze').style.opacity=(hz*0.75).toFixed(3);sun.color.copy(sunCalm).lerp(sunHaze,hz);
  updateParticles();
  updateBracket();
  updateTip(dt,hov);
  tickToast(dt);
  renderer.render(scene,camera);
  updateLabels(canvas.clientWidth,canvas.clientHeight);
  requestAnimationFrame(frame);}
resize();applyCam();requestAnimationFrame(frame);
