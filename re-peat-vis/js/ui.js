// Toolbar, popovers, panel switching and toast messages.
import {$} from './dom.js';
import {app} from './app.js';
import {st,BASE} from './model.js';
import {scenes} from './scenes.js';
import {resetView} from './camera.js';
import {kompartemen} from './water.js';

let toastT=0;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('on');toastT=4.2;}
function tickToast(dt){if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').classList.remove('on');}}
function showPanel(which){$('story').hidden=which!=='story';$('sandbox').hidden=which!=='sandbox';}
function defaultCut(){if(app.mode!=='story')return -200;const s=scenes[app.sceneIdx];return s.tw.reduce((v,t)=>t.k==='cut'?t.to:v,s.start.cut??BASE.cut);}
function syncCutUI(){const on=(app.cutOverride!==null?app.cutOverride:defaultCut())>-100;$('btnCut').setAttribute('aria-pressed',on);if(!on)$('cutPop').hidden=true;}
$('resetView').onclick=()=>resetView();
function toggleCut(){const on=!(st.cut>-100);app.cutOverride=on?+$('cutPos').value:-200;$('btnCut').setAttribute('aria-pressed',on);
  $('cutPop').hidden=!on;if(on)closeInfo();}
$('btnCut').onclick=toggleCut;
$('cutPos').oninput=e=>{app.cutOverride=+e.target.value;};
function closeInfo(){$('infoPop').hidden=true;$('btnInfo').setAttribute('aria-expanded','false');}
function toggleInfo(){const open=$('infoPop').hidden;$('infoPop').hidden=!open;$('btnInfo').setAttribute('aria-expanded',open);if(open)$('cutPop').hidden=true;}
$('btnInfo').onclick=toggleInfo;
function toggleLegend(){const d=$('legendDock');d.hidden=!d.hidden;$('btnLegend').setAttribute('aria-expanded',!d.hidden);}
$('btnLegend').onclick=toggleLegend;
function toggleKomp(){kompartemen.visible=!kompartemen.visible;$('btnKomp').setAttribute('aria-pressed',kompartemen.visible);}
$('btnKomp').onclick=toggleKomp;
function toggleWell(){const d=$('wellDock');d.hidden=!d.hidden;$('btnWell').setAttribute('aria-pressed',!d.hidden);}
$('btnWell').onclick=toggleWell;
function toggleCard(force){const c=$('card');const min=force!==undefined?force:!c.classList.contains('min');c.classList.toggle('min',min);
  $('btnPanel').setAttribute('aria-expanded',!min);document.querySelectorAll('[data-collapse]').forEach(b=>b.setAttribute('aria-label',min?'Bentangkan panel':'Ciutkan panel'));}
$('btnPanel').onclick=()=>toggleCard();
document.querySelectorAll('[data-collapse]').forEach(b=>b.onclick=()=>toggleCard());
if(window.innerWidth<=640){$('legendDock').hidden=true;$('btnLegend').setAttribute('aria-expanded','false');}

export {toast,tickToast,showPanel,defaultCut,syncCutUI,toggleCut,closeInfo,toggleInfo,toggleLegend,toggleCard,toggleKomp,toggleWell};
