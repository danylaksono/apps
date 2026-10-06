// Hydrology model: terrain height, canals, sekat (blocks), burnt areas and water-table depth (TMA).
import {K} from './config.js';
import {clamp,lerp,smooth} from './utils.js';

function s0(x,z){const r=Math.hypot(x,z);return r>=K.R?1:1+K.H*(1-Math.pow(r/K.R,1.4));}
function noise(x,z){return 0.28*Math.sin(x*0.37+1.3)*Math.cos(z*0.29-0.7)+0.15*Math.sin((x+z)*0.6);}

// ---------- canals: a = downstream end, b = upstream end ----------
function mk(id,a,b,s1,step,s2){const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);
  const c={id,a,b,L,dx:dx/L,dz:dz/L,blocks:[]};if(step>0)for(let s=s1;s<=s2+1e-6;s+=step)c.blocks.push({s});return c;}
const canals=[mk('C1',[-100,0],[45,0],8,9,136), mk('C2',[-40,100],[-40,0],8,9,98), mk('C3',[10,-80],[10,0],0,0,-1)];
const C1=canals[0],C2=canals[1],C3=canals[2];
function cpt(c,s){return [c.a[0]+c.dx*s, c.a[1]+c.dz*s];}
const allBlocks=[];
canals.forEach((c,ci)=>c.blocks.forEach(b=>{b.gi=allBlocks.length;b.ci=ci;const p=cpt(c,b.s);b.x=p[0];b.z=p[1];b.s0=s0(p[0],p[1]);allBlocks.push(b);}));
const NB=allBlocks.length;
const donorGis=C1.blocks.filter(b=>b.s>110).map(b=>b.gi);
const GATE_S=76;
function nearest(x,z){let best=null;
  for(let i=0;i<canals.length;i++){const c=canals[i];const px=x-c.a[0],pz=z-c.a[1];const s=clamp(px*c.dx+pz*c.dz,0,c.L);
    const qx=c.a[0]+c.dx*s,qz=c.a[1]+c.dz*s;const d=Math.hypot(x-qx,z-qz);if(!best||d<best.d)best={ci:i,s,d};}
  return best;}
function blockIdx(c,s){for(let i=c.blocks.length-1;i>=0;i--)if(c.blocks[i].s<=s)return i;return -1;}
const burns=[{x:-48,z:36,rx:13,rz:9},{x:21,z:-48,rx:12,rz:11}];
function isBurnt(x,z){for(const b of burns){const q=((x-b.x)/b.rx)**2+((z-b.z)/b.rz)**2+0.08*Math.sin(x*0.9)*Math.cos(z*0.8);if(q<1)return true;}return false;}
function surfNG(x,z){return s0(x,z)+noise(x,z);}
function surfaceY(x,z,n){n=n||nearest(x,z);let y=surfNG(x,z);if(n.d<K.W)y-=K.GD*(1-(n.d/K.W)**2);return y;}

// ---------- state ----------
const BASE={t:0,te:0,color:0,pB:0,gate:0,front:0,cut:-200,et:0,dry:0,pump:0,strat:0,k:1,rainOn:false};
const st=Object.assign({},BASE);
const blockAct=new Float32Array(NB);
function rainCredit(t){return st.rainOn?20*smooth(30,34,t)+18*smooth(58,62,t):0;}
function rainNow(t){if(!st.rainOn)return 0;const w=(a,b)=>smooth(a-0.6,a,t)*(1-smooth(b,b+0.6,t));return Math.max(w(30,34),w(58,62));}
function setDerived(){st.te=Math.max(0,st.t-rainCredit(st.t));}
function canalDc(ci,s,bi){
  const c=canals[ci];const dU=0.8+0.006*st.te*st.k;let dc=dU;
  if(bi>=0){const q=cpt(c,s);const sg=s0(q[0],q[1]);let wl=sg-dU*K.VE;
    for(let j=0;j<=bi;j++){const b=c.blocks[j];const act=blockAct[b.gi];if(act>0.001){const crest=b.s0-0.15*K.VE;if(crest>wl)wl=lerp(wl,crest,act);}}
    dc=clamp((sg-wl)/K.VE,0.15,dU);}
  if(c===C1&&s>110)dc+=0.1*st.front;
  if(c===C3&&st.front>0){const sf=c.L*(1-st.front);dc=lerp(dU,0.3,smooth(sf-4,sf+2,s));}
  if(st.dry>0&&dc<dU)dc=lerp(dc,dU,st.dry*0.85);
  if(c===C2&&st.pump>0){const sf=c.L*st.pump;dc=lerp(dc,0.22,1-smooth(sf-2,sf+4,s));}
  return dc;}
function farDepth(x,z,burnt){const r=Math.hypot(x,z);return 0.08+0.0035*st.te*st.k+0.18*Math.min(1,(r/K.R)**2)+(burnt?0.25:0);}
function wtdFrom(x,z,n,burnt,bi){const dc=canalDc(n.ci,n.s,bi);const dU=0.8+0.006*st.te*st.k;const ben=clamp((dU-dc)/(dU-0.15),0,1);
  const dF=farDepth(x,z,burnt)+(burnt?0:(0.08*(1-ben)-0.15*ben)*Math.exp(-n.d/30));const lam=(burnt?20:200)/K.U/3;return dF+(dc-dF)*Math.exp(-n.d/lam);}
function wtdAt(x,z){const n=nearest(x,z);return wtdFrom(x,z,n,isBurnt(x,z),blockIdx(canals[n.ci],n.s));}
function classOf(w){return w<=0.4?0:w<=0.6?1:w<=0.85?2:3;}

// ---------- kompartemen: the four units bounded by the main canals (C1 on z=0, C2 on x=-40, C3 on x=10) ----------
function kompOf(x,z){return z>=0?(x<-40?0:1):(x<10?2:3);}
// Cheapest action that lifts a kompartemen to >=60% safe TMA, tried in the narration's order (gate, sekat, pump),
// under a hard dry season (El Niño-like: k=1.15, rain, canals behind sekat half dried, day 90). Computed once. Returns 'keep' | 'gate' | 'block' | 'pump' | 'ready' (residual risk) per kompartemen.
let stratCache=null;
function kompStrategy(){if(stratCache)return stratCache;
  const save=Object.assign({},st),act=blockAct.slice();
  const pts=[[],[],[],[]];for(let x=-100;x<=100;x+=4)for(let z=-100;z<=100;z+=4)if(Math.hypot(x,z)<100){const n=nearest(x,z);pts[kompOf(x,z)].push([x,z,n,isBurnt(x,z),blockIdx(canals[n.ci],n.s)]);}
  const safe=k=>{let ok=0;for(const [x,z,n,b,bi] of pts[k])if(wtdFrom(x,z,n,b,bi)<=0.4)ok++;return ok/pts[k].length;};
  const ladder=[['keep',()=>{blockAct.fill(0);Object.assign(st,{front:0,pump:0});}],
    ['gate',()=>{blockAct.fill(0);donorGis.forEach(g=>blockAct[g]=1);st.front=1;}],
    ['block',()=>{blockAct.fill(1);st.front=1;}],
    ['pump',()=>{st.pump=1;}]];
  Object.assign(st,BASE,{t:90,k:1.15,rainOn:true,dry:0.5});setDerived();
  const res=[0,1,2,3].map(()=>'ready'),done=[false,false,false,false];
  for(const [name,apply] of ladder){apply();setDerived();
    for(let k=0;k<4;k++)if(!done[k]&&safe(k)>=0.6){res[k]=name;done[k]=true;}}
  Object.assign(st,save);blockAct.set(act);setDerived();return stratCache=res;}

export {kompOf,kompStrategy,s0,canals,C1,C2,C3,cpt,allBlocks,NB,donorGis,GATE_S,nearest,blockIdx,burns,isBurnt,surfNG,surfaceY,
  BASE,st,blockAct,rainNow,setDerived,canalDc,wtdFrom,wtdAt,classOf};
