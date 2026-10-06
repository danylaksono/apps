// Challenge mode: budgeted sekat/gate/pump placement, season run, scoring and the greedy "model plan".
import {$} from './dom.js';
import {app} from './app.js';
import {st,BASE,blockAct,NB,allBlocks,donorGis,setDerived} from './model.js';
import {clamp,smooth,pctTxt,P} from './utils.js';
import {cam,camCtl} from './camera.js';
import {kpiNow,sub} from './terrain.js';
import {toast,showPanel,syncCutUI} from './ui.js';

const BUDGET=100,COST={block:5,gate:10,pump:30};
const CLIM={normal:{k:0.8,rain:true,dry:false,label:'Tahun normal'},el:{k:1.15,rain:false,dry:true,label:'Tahun El Niño'}};
const sb={blocks:new Set(),gate:false,pump:false,clim:'el',running:false,done:false,day:0,fuel:0,peak:0,model:{},computing:false,sum:0,n:0};
function spent(p){p=p||sb;return p.blocks.size*COST.block+(p.gate?COST.gate:0)+(p.pump?COST.pump:0);}
function hasDonor(set){return donorGis.some(g=>set.has(g));}
function refreshSandboxUI(){const u=spent();$('budgetTxt').textContent=u+' dari '+BUDGET+' poin';
  const bb=$('budgetBar');bb.style.width=(u/BUDGET*100)+'%';bb.style.background=u>BUDGET*0.9?'var(--high)':'var(--water)';
  $('tGate').setAttribute('aria-pressed',sb.gate);$('tGate').textContent=sb.gate?'Pintu air dibuka':'Pintu air';
  $('tPump').setAttribute('aria-pressed',sb.pump);$('tPump').textContent=sb.pump?'Estafet pompa aktif':'Estafet pompa';
  $('cNormal').setAttribute('aria-pressed',sb.clim==='normal');$('cEl').setAttribute('aria-pressed',sb.clim==='el');
  ['tGate','tPump','cNormal','cEl','reset','model'].forEach(id=>$(id).disabled=sb.running||(id==='model'&&sb.computing));
  $('run').disabled=sb.running;$('run').textContent=sb.running?'Musim berjalan…':(sb.done?'Ulangi musim':'Mulai musim kemarau');}
function invalidate(){sb.done=false;$('sbResult').hidden=true;}
function toggleBlock(gi){if(sb.blocks.has(gi)){sb.blocks.delete(gi);}else{if(spent()+COST.block>BUDGET){toast('Anggaran tidak cukup. Cabut sekat lain atau matikan pompa.');return;}sb.blocks.add(gi);
    if(sb.blocks.size===1)toast('Sekat terpasang. Perhatikan pita gambut di sekitar kanal yang kembali basah.');}
  if(sb.gate&&!hasDonor(sb.blocks))toast('Pintu air belum berguna: belum ada surplus. Pasang sekat di hulu kanal utama, dekat puncak kubah.');
  invalidate();refreshSandboxUI();}
$('tGate').onclick=()=>{if(!sb.gate&&spent()+COST.gate>BUDGET){toast('Anggaran tidak cukup untuk pintu air.');return;}sb.gate=!sb.gate;
  if(sb.gate)toast(hasDonor(sb.blocks)?'Pintu air dibuka: surplus dari hulu kanal utama mengalir ke kanal utara.':'Pintu air belum berguna: belum ada surplus. Pasang sekat di hulu kanal utama, dekat puncak kubah.');
  invalidate();refreshSandboxUI();};
$('tPump').onclick=()=>{if(!sb.pump&&spent()+COST.pump>BUDGET){toast('Anggaran tidak cukup untuk estafet pompa.');return;}sb.pump=!sb.pump;
  if(sb.pump)toast('Estafet pompa mengalirkan air sungai ke kanal selatan. Paling berguna saat kanal kering di tahun El Niño, tetapi menghabiskan BBM.');
  invalidate();refreshSandboxUI();};
$('cNormal').onclick=()=>{sb.clim='normal';invalidate();refreshSandboxUI();};
$('cEl').onclick=()=>{sb.clim='el';invalidate();refreshSandboxUI();};
$('reset').onclick=()=>{sb.blocks.clear();sb.gate=false;sb.pump=false;invalidate();refreshSandboxUI();};
$('run').onclick=()=>{sb.running=true;sb.done=false;sb.day=0;sb.fuel=0;sb.peak=0;sb.sum=0;sb.n=0;$('sbResult').hidden=true;
  if(sb.gate&&!hasDonor(sb.blocks))toast('Pintu air dibuka, tetapi tidak ada surplus untuk dibagi.');
  camCtl.goal=P(0,0,0,240,2.25,0.72);camCtl.t=0;camCtl.from={...cam};camCtl.user=true;refreshSandboxUI();};
function evalPlan(plan,clim){const save=Object.assign({},st);const act=blockAct.slice();
  for(let g=0;g<NB;g++)blockAct[g]=plan.blocks.has(g)?1:0;const donor=hasDonor(plan.blocks);
  Object.assign(st,{k:clim.k,rainOn:clim.rain,front:plan.gate&&donor?1:0,pump:plan.pump?1:0,strat:0});
  let sum=0;const T=[15,30,45,60,75,90];
  for(const t of T){st.t=t;setDerived();st.dry=clim.dry?smooth(55,80,t):0;sum+=kpiNow(sub);}
  Object.assign(st,save);blockAct.set(act);setDerived();return sum/T.length;}
function computeModel(climKey,cb){const clim=CLIM[climKey];const plan={blocks:new Set(),gate:false,pump:false};let left=BUDGET;let cur=evalPlan(plan,clim);const base=cur;
  const cands=allBlocks.map(b=>({t:'b',g:b.gi,c:COST.block})).concat([{t:'gate',c:COST.gate},{t:'pump',c:COST.pump}]);
  const has=(p,c)=>c.t==='b'?p.blocks.has(c.g):p[c.t];
  const add=(p,c)=>{if(c.t==='b')p.blocks.add(c.g);else p[c.t]=true;};
  const clone=p=>({blocks:new Set(p.blocks),gate:p.gate,pump:p.pump});
  function step(){let best=null,br=0;
    for(const c of cands){if(c.c>left||has(plan,c))continue;const p=clone(plan);add(p,c);
      if(c.t==='gate'&&!hasDonor(p.blocks)){const d=donorGis.find(g=>!p.blocks.has(g));if(d===undefined||c.c+COST.block>left)continue;p.blocks.add(d);}
      const v=evalPlan(p,clim);const cost=spent(p)-spent(plan);const r=(v-cur)/cost;if(r>br+1e-9){br=r;best={p,v,cost};}}
    if(!best){cb({plan,score:cur,base});return;}
    Object.assign(plan,best.p);left-=best.cost;cur=best.v;setTimeout(step,0);}
  step();}
function stars(ratio){const n=ratio>=0.9?3:ratio>=0.6?2:ratio>0.2?1:0;return '★'.repeat(n)+'☆'.repeat(3-n);}
function showResult(){const clim=CLIM[sb.clim];const user=evalPlan(sb,clim);const base=evalPlan({blocks:new Set(),gate:false,pump:false},clim);
  const r=$('sbResult');r.hidden=false;
  let html='<span class="big">'+pctTxt(user)+'</span>rata-rata luas KHG dengan TMA aman sepanjang musim ('+clim.label.toLowerCase()+').<br>'+
    'Tanpa tindakan: '+pctTxt(base)+'. Rencana Anda menambah '+Math.round((user-base)*100)+' poin persentase.<br>'+
    'Titik api terbanyak dalam sehari: '+sb.peak+'. BBM pompa: '+Math.round(sb.fuel).toLocaleString('id-ID')+' liter. Anggaran: '+spent()+' dari '+BUDGET+' poin.';
  const m=sb.model[sb.clim];
  if(m){const ratio=(m.score-m.base)>1e-6?(user-base)/(m.score-m.base):1;
    html+='<br><br><span class="stars" aria-label="Nilai">'+stars(ratio)+'</span><br>Rencana model dengan anggaran yang sama mencapai '+pctTxt(m.score)+
      ' ('+m.plan.blocks.size+' sekat'+(m.plan.gate?', pintu air':'')+(m.plan.pump?', estafet pompa':'')+'). Anda mencapai '+Math.round(clamp(ratio,0,9)*100)+'% dari peningkatan yang dicapai model.';}
  else html+='<br><br>Klik “Rencana model” untuk membandingkan dengan pilihan model.';
  r.innerHTML=html;}
$('model').onclick=()=>{const key=sb.clim;const m=sb.model[key];
  if(m&&$('model').dataset.apply==='1'){sb.blocks=new Set(m.plan.blocks);sb.gate=m.plan.gate;sb.pump=m.plan.pump;invalidate();$('model').dataset.apply='';$('model').textContent='Rencana model';
    toast('Rencana model diterapkan. Mulai musim kemarau untuk melihat hasilnya.');refreshSandboxUI();return;}
  const fin=()=>{const mm=sb.model[key];$('model').dataset.apply='1';$('model').textContent='Terapkan rencana model';
    toast('Model memilih '+mm.plan.blocks.size+' sekat'+(mm.plan.gate?', membuka pintu air':'')+(mm.plan.pump?', dan menjalankan pompa':'')+': '+pctTxt(mm.score)+' rata-rata luas aman.');
    if(sb.done)showResult();sb.computing=false;refreshSandboxUI();};
  if(m){fin();return;}
  sb.computing=true;$('model').textContent='Model menghitung…';refreshSandboxUI();
  setTimeout(()=>computeModel(key,res=>{sb.model[key]=res;fin();}),30);};
function enterSandbox(){app.mode='sandbox';showPanel('sandbox');$('legTma').hidden=false;$('legStrat').hidden=true;app.cutOverride=null;
  Object.assign(st,BASE,{color:1});camCtl.goal=P(-5,0,10,235,2.2,0.72);camCtl.t=0;camCtl.from={...cam};camCtl.user=true;
  sb.running=false;refreshSandboxUI();syncCutUI();
  toast('Klik lingkaran putih di kanal untuk memasang sekat. Anggaran Anda 100 poin.');}
function sandboxStep(dt){const clim=CLIM[sb.clim];
  for(let g=0;g<NB;g++){const tgt=sb.blocks.has(g)?1:0;blockAct[g]+=clamp(tgt-blockAct[g],-dt*2.5,dt*2.5);}
  const donor=hasDonor(sb.blocks);
  if(sb.running){sb.day=Math.min(90,sb.day+dt*6);if(sb.pump)sb.fuel+=3*4.9*24*dt*6;}
  const day=sb.running||sb.done?sb.day:50;
  Object.assign(st,{t:day,color:1,k:clim.k,rainOn:clim.rain,strat:0,et:sb.running?0.45:0.15});
  st.cut=app.cutOverride!==null?app.cutOverride:-200;
  st.dry=clim.dry?smooth(55,80,day):0;
  const live=sb.running||sb.done;
  st.front=sb.gate&&donor?(live?smooth(3,20,day):1):0;
  st.pump=sb.pump?(live?smooth(2,12,day):1):0;
  st.gate+=clamp((sb.gate?1:0)-st.gate,-dt*1.5,dt*1.5);
  if(sb.running&&sb.day>=90){sb.running=false;sb.done=true;refreshSandboxUI();showResult();
    if(!sb.model[sb.clim]&&!sb.computing){sb.computing=true;refreshSandboxUI();setTimeout(()=>computeModel(sb.clim,res=>{sb.model[sb.clim]=res;sb.computing=false;$('model').dataset.apply='1';$('model').textContent='Terapkan rencana model';refreshSandboxUI();showResult();}),60);}}}

export {sb,CLIM,toggleBlock,enterSandbox,sandboxStep};
