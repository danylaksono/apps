// Monitoring-well chart: records each pin's TMA against the season day and draws it in the dock panel.
import {$} from './dom.js';
import {CSS_CLASS} from './config.js';
import {st,wtdAt} from './model.js';
import {app} from './app.js';
import {pins,PIN_COL} from './labels.js';

const cv=$('wellChart'),ctx=cv.getContext('2d'),dock=$('wellDock');
const XMAX=100,YMAX=1.2,BANDS=[[0,.4,0],[.4,.6,1],[.6,.85,2],[.85,YMAX,3]];
const hex=n=>'#'+n.toString(16).padStart(6,'0');
let legN=-1;

// Replace the head point while the day stands still, drop the future when a scene rewinds.
function record(){for(const p of pins){const h=p.hist,w=wtdAt(p.x,p.z);
  while(h.length&&h[h.length-1][0]>st.t+0.01)h.pop();
  if(h.length&&st.t-h[h.length-1][0]<0.3)h[h.length-1]=[st.t,w];else h.push([st.t,w]);}}

function draw(){const r=devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
  if(cv.width!==Math.round(W*r)||cv.height!==Math.round(H*r)){cv.width=Math.round(W*r);cv.height=Math.round(H*r);}
  ctx.setTransform(r,0,0,r,0,0);ctx.clearRect(0,0,W,H);
  const cs=getComputedStyle(document.documentElement),ink=cs.getPropertyValue('--ink-soft').trim(),line=cs.getPropertyValue('--line').trim();
  const L=34,R=8,T=6,B=24,pw=W-L-R,ph=H-T-B,X=d=>L+d/XMAX*pw,Y=w=>T+Math.min(w,YMAX)/YMAX*ph;
  ctx.font='11px system-ui,sans-serif';
  BANDS.forEach(([a,b,c])=>{ctx.globalAlpha=.16;ctx.fillStyle=cs.getPropertyValue(CSS_CLASS[c].slice(4,-1)).trim();ctx.fillRect(L,Y(a),pw,Y(b)-Y(a));});
  ctx.globalAlpha=1;ctx.strokeStyle=line;ctx.fillStyle=ink;ctx.lineWidth=1;ctx.textAlign='right';ctx.textBaseline='middle';
  for(let w=0;w<=1.2;w+=.4){ctx.beginPath();ctx.moveTo(L,Y(w));ctx.lineTo(L+pw,Y(w));ctx.stroke();ctx.fillText(w.toFixed(1).replace('.',','),L-4,Y(w));}
  ctx.textAlign='center';ctx.textBaseline='top';
  for(let d=0;d<=XMAX;d+=25)ctx.fillText(d,X(d),T+ph+4);
  ctx.fillText('hari',L+pw-10,T+ph+12);ctx.save();ctx.translate(9,T+ph/2);ctx.rotate(-Math.PI/2);ctx.textBaseline='middle';ctx.fillText('TMA (m)',0,0);ctx.restore();
  ctx.setLineDash([4,3]);ctx.strokeStyle=ink;ctx.beginPath();ctx.moveTo(L,Y(.4));ctx.lineTo(L+pw,Y(.4));ctx.stroke();ctx.setLineDash([]);
  pins.forEach((p,i)=>{if(!p.hist.length)return;ctx.strokeStyle=ctx.fillStyle=hex(PIN_COL[i]);ctx.lineWidth=2;ctx.lineJoin='round';ctx.beginPath();
    p.hist.forEach(([t,w],k)=>k?ctx.lineTo(X(t),Y(w)):ctx.moveTo(X(t),Y(w)));ctx.stroke();
    const [t,w]=p.hist[p.hist.length-1];ctx.beginPath();ctx.arc(X(t),Y(w),3.5,0,7);ctx.fill();});}

function updateWellChart(){if(app.mode!=='intro')record();
  if(legN!==pins.length){legN=pins.length;$('wellLeg').innerHTML=pins.map((p,i)=>'<span><i style="background:'+hex(PIN_COL[i])+'"></i>Sumur pantau '+(i+1)+'</span>').join('');$('wellEmpty').hidden=pins.length>0;}
  if(!dock.hidden)draw();}

export {updateWellChart};
