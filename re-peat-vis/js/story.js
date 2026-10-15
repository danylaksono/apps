// Story mode: scene stepping, per-frame scene tweens and the normal vs El Nino comparison.
import {$} from './dom.js';
import {app} from './app.js';
import {st,BASE,blockAct,NB,setDerived} from './model.js';
import {clamp,lerp,ease,reduceMotion} from './utils.js';
import {scenes} from './scenes.js';
import {cam,camCtl} from './camera.js';
import {kpiNow,allIn} from './terrain.js';
import {showPanel,syncCutUI} from './ui.js';
import {enterSandbox} from './sandbox.js';

const cmpRes={};
const dots=$('dots');
scenes.forEach((s,i)=>{const b=document.createElement('button');b.textContent=i+1;b.setAttribute('aria-label','Adegan '+(i+1)+': '+s.title);b.onclick=()=>enter(i);dots.appendChild(b);});
function enter(i){app.mode='story';showPanel('story');app.sceneIdx=i;const s=scenes[i];Object.assign(st,BASE,s.start);app.elapsed=reduceMotion?999:0;camCtl.user=false;camCtl.from={...cam};camCtl.goal=null;app.cutOverride=null;
  $('stepTxt').textContent='Adegan '+(i+1)+' dari '+scenes.length;$('title').textContent=s.title;$('narr').textContent=s.narr;
  [...dots.children].forEach((b,k)=>{if(k===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  $('prev').disabled=i===0;$('next').textContent=i===scenes.length-1?'Coba tantangan':'Berikutnya';
  $('legTma').hidden=i===5;$('legStrat').hidden=i!==5;$('cmp').hidden=i!==6;$('cmp').textContent='';
  if(i===6){const keep=Object.assign({},st);const ka=blockAct.slice();blockAct.fill(1);
    Object.assign(st,BASE,{color:1,pB:1,gate:1,front:1,t:90,k:0.6});setDerived();cmpRes.n=kpiNow(allIn);
    Object.assign(st,BASE,{color:1,pB:1,gate:1,front:1,t:90,k:1.3,dry:1,pump:1});setDerived();cmpRes.e=kpiNow(allIn);
    Object.assign(st,keep);blockAct.set(ka);setDerived();}
  syncCutUI();}
function runScene(){const s=scenes[app.sceneIdx];Object.assign(st,BASE,s.start);
  s.tw.forEach(tw=>{if(app.elapsed<tw.s)return;const u=ease(clamp((app.elapsed-tw.s)/(tw.e-tw.s),0,1));st[tw.k]=lerp(tw.f,tw.to,u);});
  if(app.cutOverride!==null)st.cut=app.cutOverride;
  for(let g=0;g<NB;g++)blockAct[g]=clamp(st.pB*NB-g,0,1);
  if(!camCtl.user&&!camCtl.goal){const keys=s.cam;let from=camCtl.from,to=keys[0].p,u;
    if(app.elapsed<=keys[0].t)u=app.elapsed/keys[0].t;
    else{let j=0;while(j<keys.length-1&&app.elapsed>keys[j+1].t)j++;
      if(j>=keys.length-1){from=to=keys[keys.length-1].p;u=1;}else{from=keys[j].p;to=keys[j+1].p;u=(app.elapsed-keys[j].t)/(keys[j+1].t-keys[j].t);}}
    u=ease(clamp(u,0,1));['x','y','z','r','th','ph'].forEach(k=>cam[k]=lerp(from[k],to[k],u));}
  $('prog').style.width=Math.min(100,app.elapsed/s.dur*100)+'%';}
$('prev').onclick=()=>enter(Math.max(0,app.sceneIdx-1));
$('next').onclick=()=>{if(app.sceneIdx===scenes.length-1)enterSandbox();else enter(app.sceneIdx+1);};
$('replay').onclick=()=>enter(app.sceneIdx);
$('toStory').onclick=()=>enter(0);

export {cmpRes,enter,runScene};
